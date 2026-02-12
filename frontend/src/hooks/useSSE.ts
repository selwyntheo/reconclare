import { useEffect, useRef, useCallback, useState } from 'react';
import { SSEEvent, SSEEventType } from '../types';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface UseSSEOptions {
  eventId: string;
  enabled?: boolean;
  onEvent?: (event: SSEEvent) => void;
}

interface UseSSEResult {
  connected: boolean;
  lastEvent: SSEEvent | null;
}

export function useSSE({ eventId, enabled = true, onEvent }: UseSSEOptions): UseSSEResult {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);

  // Keep callback ref current without triggering reconnection
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!eventId || !enabled) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `${API_BASE}/api/events/${eventId}/sse`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (msg) => {
      try {
        const parsed: SSEEvent = JSON.parse(msg.data);
        setLastEvent(parsed);
        onEventRef.current?.(parsed);
      } catch {
        // Ignore malformed messages
      }
    };

    // Listen for specific event types
    const eventTypes: SSEEventType[] = [
      'validation_progress',
      'validation_complete',
      'ai_analysis_complete',
      'status_change',
    ];

    eventTypes.forEach((eventType) => {
      es.addEventListener(eventType, (msg: MessageEvent) => {
        try {
          const parsed: SSEEvent = {
            type: eventType,
            eventId,
            data: JSON.parse(msg.data),
          };
          setLastEvent(parsed);
          onEventRef.current?.(parsed);
        } catch {
          // Ignore malformed messages
        }
      });
    });

    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects
    };
  }, [eventId, enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setConnected(false);
      }
    };
  }, [connect]);

  return { connected, lastEvent };
}

export default useSSE;
