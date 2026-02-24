import { useEffect, useRef, useCallback, useState } from 'react';

// ── WebSocket Message Types ─────────────────────────────────

export type WSMessageType =
  | 'ALLOCATION_CHANGED'
  | 'BREAK_UPDATED'
  | 'COMMENTARY_ADDED'
  | 'STATUS_CHANGED'
  | 'KD_OVERRIDE';

export interface WSMessage {
  type: WSMessageType;
  eventId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ── Hook Options & Result ───────────────────────────────────

interface UseWebSocketOptions {
  eventId: string;
  enabled?: boolean;
  onMessage?: (message: WSMessage) => void;
  reconnectInterval?: number;
  maxRetries?: number;
}

interface UseWebSocketResult {
  connected: boolean;
  lastMessage: WSMessage | null;
  send: (message: WSMessage) => void;
}

const WS_BASE = process.env.REACT_APP_WS_URL
  || (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/^http/, 'ws');

export function useWebSocket({
  eventId,
  enabled = true,
  onMessage,
  reconnectInterval = 3000,
  maxRetries = 10,
}: UseWebSocketOptions): UseWebSocketResult {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  onMessageRef.current = onMessage;

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!eventId || !enabled) return;

    cleanup();

    const url = `${WS_BASE}/ws/events/${eventId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const parsed: WSMessage = JSON.parse(event.data);
        setLastMessage(parsed);
        onMessageRef.current?.(parsed);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Auto-reconnect with back-off
      if (enabled && retriesRef.current < maxRetries) {
        retriesRef.current += 1;
        timerRef.current = setTimeout(connect, reconnectInterval);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }, [eventId, enabled, reconnectInterval, maxRetries, cleanup]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { connected, lastMessage, send };
}

export default useWebSocket;
