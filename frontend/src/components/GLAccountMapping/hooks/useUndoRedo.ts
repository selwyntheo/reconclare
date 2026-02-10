/**
 * Undo/Redo history management for GL Account Mapping.
 * Tracks changes and allows reverting/replaying them.
 */

import { useCallback, useRef, useState } from 'react';
import { MappingChange, GLAccountMapping } from '../../../types/glMapping';

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  historySize: number;
  currentIndex: number;
}

export interface UndoRedoActions {
  recordChange: (change: MappingChange) => void;
  recordChanges: (changes: MappingChange[]) => void;
  undo: () => MappingChange[] | null;
  redo: () => MappingChange[] | null;
  clear: () => void;
  getState: () => UndoRedoState;
}

const MAX_HISTORY_SIZE = 50;

export function useUndoRedo(): [UndoRedoState, UndoRedoActions] {
  // History is an array of change batches (each batch can contain multiple changes)
  const history = useRef<MappingChange[][]>([]);
  const currentIndex = useRef<number>(-1);

  // State for triggering re-renders
  const [state, setState] = useState<UndoRedoState>({
    canUndo: false,
    canRedo: false,
    historySize: 0,
    currentIndex: -1,
  });

  const updateState = useCallback(() => {
    setState({
      canUndo: currentIndex.current >= 0,
      canRedo: currentIndex.current < history.current.length - 1,
      historySize: history.current.length,
      currentIndex: currentIndex.current,
    });
  }, []);

  const recordChange = useCallback(
    (change: MappingChange) => {
      // Remove any future history if we're not at the end
      if (currentIndex.current < history.current.length - 1) {
        history.current = history.current.slice(0, currentIndex.current + 1);
      }

      // Add the new change as a single-item batch
      history.current.push([change]);
      currentIndex.current = history.current.length - 1;

      // Trim history if it exceeds max size
      if (history.current.length > MAX_HISTORY_SIZE) {
        history.current = history.current.slice(-MAX_HISTORY_SIZE);
        currentIndex.current = history.current.length - 1;
      }

      updateState();
    },
    [updateState]
  );

  const recordChanges = useCallback(
    (changes: MappingChange[]) => {
      if (changes.length === 0) return;

      // Remove any future history if we're not at the end
      if (currentIndex.current < history.current.length - 1) {
        history.current = history.current.slice(0, currentIndex.current + 1);
      }

      // Add the changes as a batch
      history.current.push(changes);
      currentIndex.current = history.current.length - 1;

      // Trim history if it exceeds max size
      if (history.current.length > MAX_HISTORY_SIZE) {
        history.current = history.current.slice(-MAX_HISTORY_SIZE);
        currentIndex.current = history.current.length - 1;
      }

      updateState();
    },
    [updateState]
  );

  const undo = useCallback((): MappingChange[] | null => {
    if (currentIndex.current < 0) {
      return null;
    }

    const changes = history.current[currentIndex.current];
    currentIndex.current -= 1;
    updateState();

    // Return inverse changes for the caller to apply
    return changes.map((change) => invertChange(change));
  }, [updateState]);

  const redo = useCallback((): MappingChange[] | null => {
    if (currentIndex.current >= history.current.length - 1) {
      return null;
    }

    currentIndex.current += 1;
    const changes = history.current[currentIndex.current];
    updateState();

    return changes;
  }, [updateState]);

  const clear = useCallback(() => {
    history.current = [];
    currentIndex.current = -1;
    updateState();
  }, [updateState]);

  const getState = useCallback((): UndoRedoState => {
    return {
      canUndo: currentIndex.current >= 0,
      canRedo: currentIndex.current < history.current.length - 1,
      historySize: history.current.length,
      currentIndex: currentIndex.current,
    };
  }, []);

  const actions: UndoRedoActions = {
    recordChange,
    recordChanges,
    undo,
    redo,
    clear,
    getState,
  };

  return [state, actions];
}

/**
 * Inverts a change to create the opposite action for undo.
 */
function invertChange(change: MappingChange): MappingChange {
  switch (change.type) {
    case 'CREATE':
      // Inverse of create is delete
      return {
        ...change,
        type: 'DELETE',
        id: `inv-${change.id}`,
        timestamp: Date.now(),
      };

    case 'DELETE':
      // Inverse of delete is create
      return {
        ...change,
        type: 'CREATE',
        id: `inv-${change.id}`,
        timestamp: Date.now(),
      };

    case 'UPDATE':
      // For updates, we need to store the previous state
      // This is a simplified version - in practice, you'd store the previous state
      return {
        ...change,
        type: 'UPDATE',
        id: `inv-${change.id}`,
        timestamp: Date.now(),
      };

    default:
      return change;
  }
}

export default useUndoRedo;
