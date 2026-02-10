/**
 * Tests for useUndoRedo hook.
 */

import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { MappingChange, GLAccountMapping } from '../../../types/glMapping';

// Mock mapping data
const createMockMapping = (id: string): GLAccountMapping => ({
  mappingId: id,
  eventId: 'EVT-001',
  sourceProvider: 'STATE_STREET',
  sourceGlAccountNumber: '1050',
  sourceGlAccountDescription: 'CASH',
  sourceLedgerSection: 'ASSETS',
  targetGlAccountNumber: 'EAGLE-1050',
  targetGlAccountDescription: 'Cash Account',
  targetLedgerSection: 'ASSETS',
  mappingType: 'ONE_TO_ONE',
  splitWeight: 1.0,
  status: 'DRAFT',
  createdBy: 'u1',
});

const createMockChange = (id: string, type: 'CREATE' | 'UPDATE' | 'DELETE'): MappingChange => ({
  id,
  type,
  mapping: createMockMapping(`MAP-${id}`),
  timestamp: Date.now(),
});

describe('useUndoRedo', () => {
  it('initializes with canUndo and canRedo as false', () => {
    const { result } = renderHook(() => useUndoRedo());
    const [state] = result.current;

    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.historySize).toBe(0);
  });

  it('can record a change', () => {
    const { result } = renderHook(() => useUndoRedo());
    const [, actions] = result.current;

    act(() => {
      actions.recordChange(createMockChange('1', 'CREATE'));
    });

    const [newState] = result.current;
    expect(newState.canUndo).toBe(true);
    expect(newState.canRedo).toBe(false);
    expect(newState.historySize).toBe(1);
  });

  it('can record multiple changes', () => {
    const { result } = renderHook(() => useUndoRedo());
    const [, actions] = result.current;

    act(() => {
      actions.recordChange(createMockChange('1', 'CREATE'));
      actions.recordChange(createMockChange('2', 'CREATE'));
      actions.recordChange(createMockChange('3', 'CREATE'));
    });

    const [state] = result.current;
    expect(state.historySize).toBe(3);
    expect(state.currentIndex).toBe(2);
  });

  it('can undo a change', () => {
    const { result } = renderHook(() => useUndoRedo());
    const [, actions] = result.current;

    act(() => {
      actions.recordChange(createMockChange('1', 'CREATE'));
    });

    let changes: MappingChange[] | null = null;
    act(() => {
      changes = actions.undo();
    });

    const [state] = result.current;
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(true);
    expect(changes).not.toBeNull();
  });

  it('can redo an undone change', () => {
    const { result } = renderHook(() => useUndoRedo());
    const [, actions] = result.current;

    act(() => {
      actions.recordChange(createMockChange('1', 'CREATE'));
    });

    act(() => {
      actions.undo();
    });

    let changes: MappingChange[] | null = null;
    act(() => {
      changes = actions.redo();
    });

    const [state] = result.current;
    expect(state.canUndo).toBe(true);
    expect(state.canRedo).toBe(false);
    expect(changes).not.toBeNull();
  });

  it('clears redo history when new change is recorded after undo', () => {
    const { result } = renderHook(() => useUndoRedo());
    const [, actions] = result.current;

    act(() => {
      actions.recordChange(createMockChange('1', 'CREATE'));
      actions.recordChange(createMockChange('2', 'CREATE'));
    });

    act(() => {
      actions.undo();
    });

    // At this point, we should be able to redo
    expect(result.current[0].canRedo).toBe(true);

    act(() => {
      actions.recordChange(createMockChange('3', 'CREATE'));
    });

    // After recording a new change, redo should be gone
    expect(result.current[0].canRedo).toBe(false);
    expect(result.current[0].historySize).toBe(2); // 1 + 3 (2 was replaced)
  });

  it('can record a batch of changes', () => {
    const { result } = renderHook(() => useUndoRedo());
    const [, actions] = result.current;

    const batch = [
      createMockChange('1', 'CREATE'),
      createMockChange('2', 'CREATE'),
      createMockChange('3', 'CREATE'),
    ];

    act(() => {
      actions.recordChanges(batch);
    });

    const [state] = result.current;
    expect(state.historySize).toBe(1); // One batch
    expect(state.canUndo).toBe(true);
  });

  it('undoing a batch returns all changes in the batch', () => {
    const { result } = renderHook(() => useUndoRedo());
    const [, actions] = result.current;

    const batch = [
      createMockChange('1', 'CREATE'),
      createMockChange('2', 'CREATE'),
    ];

    act(() => {
      actions.recordChanges(batch);
    });

    let undoneChanges: MappingChange[] | null = null;
    act(() => {
      undoneChanges = actions.undo();
    });

    expect(undoneChanges).not.toBeNull();
    expect(undoneChanges!.length).toBe(2);
  });

  it('can clear all history', () => {
    const { result } = renderHook(() => useUndoRedo());
    const [, actions] = result.current;

    act(() => {
      actions.recordChange(createMockChange('1', 'CREATE'));
      actions.recordChange(createMockChange('2', 'CREATE'));
    });

    act(() => {
      actions.clear();
    });

    const [state] = result.current;
    expect(state.historySize).toBe(0);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });

  it('returns null when trying to undo with no history', () => {
    const { result } = renderHook(() => useUndoRedo());
    const [, actions] = result.current;

    let changes: MappingChange[] | null = null;
    act(() => {
      changes = actions.undo();
    });

    expect(changes).toBeNull();
  });

  it('returns null when trying to redo with no future', () => {
    const { result } = renderHook(() => useUndoRedo());
    const [, actions] = result.current;

    act(() => {
      actions.recordChange(createMockChange('1', 'CREATE'));
    });

    let changes: MappingChange[] | null = null;
    act(() => {
      changes = actions.redo();
    });

    expect(changes).toBeNull();
  });

  it('getState returns current state', () => {
    const { result } = renderHook(() => useUndoRedo());
    const [, actions] = result.current;

    act(() => {
      actions.recordChange(createMockChange('1', 'CREATE'));
    });

    const state = actions.getState();
    expect(state.canUndo).toBe(true);
    expect(state.historySize).toBe(1);
  });
});
