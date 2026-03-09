import { useState, useCallback } from 'react';

export function useColumnVisibility(storageKey: string, defaultColumns: string[]) {
  const [visibleColumns, setVisibleColumnsRaw] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: string[] = JSON.parse(stored);
        // Validate stored IDs against current available columns
        const valid = parsed.filter((id) => defaultColumns.includes(id));
        if (valid.length > 0) return valid;
      }
    } catch {
      // Ignore parse errors
    }
    return defaultColumns;
  });

  const setVisibleColumns = useCallback(
    (ids: string[]) => {
      setVisibleColumnsRaw(ids);
      try {
        localStorage.setItem(storageKey, JSON.stringify(ids));
      } catch {
        // localStorage full or unavailable
      }
    },
    [storageKey],
  );

  const resetToDefault = useCallback(() => {
    setVisibleColumns(defaultColumns);
  }, [defaultColumns, setVisibleColumns]);

  return { visibleColumns, setVisibleColumns, resetToDefault };
}
