/**
 * Drag and Drop logic using @dnd-kit for GL Account Mapping.
 * Handles dragging accounts between columns to create mappings.
 */

import { useCallback, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  DragItem,
  DragItemType,
  DropResult,
  IncumbentGLAccount,
  EagleGLAccount,
} from '../../../types/glMapping';

export interface DragState {
  isDragging: boolean;
  activeId: string | null;
  activeType: DragItemType | null;
  overId: string | null;
}

export interface UseDragAndDropProps {
  onDrop: (result: DropResult) => void;
  incumbentAccounts: IncumbentGLAccount[];
  eagleAccounts: EagleGLAccount[];
}

export interface UseDragAndDropResult {
  dragState: DragState;
  sensors: ReturnType<typeof useSensors>;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
  getActiveItem: () => (IncumbentGLAccount | EagleGLAccount) | null;
}

export function useDragAndDrop({
  onDrop,
  incumbentAccounts,
  eagleAccounts,
}: UseDragAndDropProps): UseDragAndDropResult {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    activeId: null,
    activeType: null,
    overId: null,
  });

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before dragging starts
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current as DragItem | undefined;

    setDragState({
      isDragging: true,
      activeId: active.id as string,
      activeType: activeData?.type || null,
      overId: null,
    });
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;

    setDragState((prev) => ({
      ...prev,
      overId: over?.id as string | null,
    }));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || !active) {
        setDragState({
          isDragging: false,
          activeId: null,
          activeType: null,
          overId: null,
        });
        return;
      }

      const activeData = active.data.current as DragItem | undefined;
      const overId = over.id as string;

      if (!activeData) {
        setDragState({
          isDragging: false,
          activeId: null,
          activeType: null,
          overId: null,
        });
        return;
      }

      // Determine if this is a valid drop
      // Incumbent accounts can only drop on Eagle accounts and vice versa
      const isIncumbentToEagle =
        activeData.type === 'INCUMBENT_ACCOUNT' &&
        overId.startsWith('eagle-');
      const isEagleToIncumbent =
        activeData.type === 'EAGLE_ACCOUNT' &&
        overId.startsWith('incumbent-');

      if (isIncumbentToEagle) {
        const targetAccountNumber = overId.replace('eagle-', '');
        onDrop({
          sourceAccountNumber: activeData.accountNumber,
          targetAccountNumber,
          sourceType: 'INCUMBENT_ACCOUNT',
        });
      } else if (isEagleToIncumbent) {
        const targetAccountNumber = overId.replace('incumbent-', '');
        onDrop({
          sourceAccountNumber: targetAccountNumber,
          targetAccountNumber: activeData.accountNumber,
          sourceType: 'EAGLE_ACCOUNT',
        });
      }

      setDragState({
        isDragging: false,
        activeId: null,
        activeType: null,
        overId: null,
      });
    },
    [onDrop]
  );

  const handleDragCancel = useCallback(() => {
    setDragState({
      isDragging: false,
      activeId: null,
      activeType: null,
      overId: null,
    });
  }, []);

  const getActiveItem = useCallback((): IncumbentGLAccount | EagleGLAccount | null => {
    if (!dragState.activeId || !dragState.activeType) {
      return null;
    }

    const accountNumber = dragState.activeId.replace(
      dragState.activeType === 'INCUMBENT_ACCOUNT' ? 'incumbent-' : 'eagle-',
      ''
    );

    if (dragState.activeType === 'INCUMBENT_ACCOUNT') {
      return (
        incumbentAccounts.find((a) => a.glAccountNumber === accountNumber) || null
      );
    } else {
      return eagleAccounts.find((a) => a.glAccountNumber === accountNumber) || null;
    }
  }, [dragState, incumbentAccounts, eagleAccounts]);

  return {
    dragState,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    getActiveItem,
  };
}

// ── Droppable Zone IDs ───────────────────────────────────────

export function getIncumbentDroppableId(accountNumber: string): string {
  return `incumbent-${accountNumber}`;
}

export function getEagleDroppableId(accountNumber: string): string {
  return `eagle-${accountNumber}`;
}

// ── Draggable Item IDs ───────────────────────────────────────

export function getDraggableId(
  type: DragItemType,
  accountNumber: string
): string {
  return type === 'INCUMBENT_ACCOUNT'
    ? `incumbent-${accountNumber}`
    : `eagle-${accountNumber}`;
}

export default useDragAndDrop;
