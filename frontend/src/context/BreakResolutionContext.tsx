import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { ResolutionBreakCategory, KnownDifference } from '../types/breakResolution';
import { fetchKnownDifferences, fetchNotificationCount } from '../services/api';

interface BreakResolutionState {
  selectedCategories: ResolutionBreakCategory[];
  activeKDs: KnownDifference[];
  notificationCount: number;
  setSelectedCategories: (categories: ResolutionBreakCategory[]) => void;
  refreshKDs: (eventId: string) => Promise<void>;
  refreshNotificationCount: () => Promise<void>;
}

const BreakResolutionContext = createContext<BreakResolutionState>({
  selectedCategories: [],
  activeKDs: [],
  notificationCount: 0,
  setSelectedCategories: () => {},
  refreshKDs: async () => {},
  refreshNotificationCount: async () => {},
});

export function BreakResolutionProvider({ children, eventId }: { children: ReactNode; eventId?: string }) {
  const [selectedCategories, setSelectedCategories] = useState<ResolutionBreakCategory[]>([]);
  const [activeKDs, setActiveKDs] = useState<KnownDifference[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const refreshKDs = useCallback(async (eid: string) => {
    try {
      const kds = await fetchKnownDifferences(eid, true);
      setActiveKDs(kds as KnownDifference[]);
    } catch {
      // Silently fail
    }
  }, []);

  const refreshNotificationCount = useCallback(async () => {
    try {
      const data = await fetchNotificationCount();
      setNotificationCount(data.unread || 0);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    if (eventId) {
      refreshKDs(eventId);
    }
    refreshNotificationCount();
  }, [eventId, refreshKDs, refreshNotificationCount]);

  return (
    <BreakResolutionContext.Provider
      value={{
        selectedCategories,
        activeKDs,
        notificationCount,
        setSelectedCategories,
        refreshKDs,
        refreshNotificationCount,
      }}
    >
      {children}
    </BreakResolutionContext.Provider>
  );
}

export function useBreakResolution() {
  return useContext(BreakResolutionContext);
}
