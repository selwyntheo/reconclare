/**
 * Tests for useMappingState hook.
 */

import { renderHook, act } from '@testing-library/react';
import { useMappingState } from '../hooks/useMappingState';
import { IncumbentGLAccount, EagleGLAccount, GLAccountMapping } from '../../../types/glMapping';

// Mock data
const mockIncumbentAccounts: IncumbentGLAccount[] = [
  { glAccountNumber: '1050', glAccountDescription: 'CASH', ledgerSection: 'ASSETS', provider: 'STATE_STREET' },
  { glAccountNumber: '1100', glAccountDescription: 'FX HOLDINGS', ledgerSection: 'ASSETS', provider: 'STATE_STREET' },
  { glAccountNumber: '2050', glAccountDescription: 'PAYABLES', ledgerSection: 'LIABILITIES', provider: 'STATE_STREET' },
];

const mockEagleAccounts: EagleGLAccount[] = [
  { glAccountNumber: 'EAGLE-1050', glAccountDescription: 'Cash Account', ledgerSection: 'ASSETS', category: 'Cash' },
  { glAccountNumber: 'EAGLE-1100', glAccountDescription: 'FX Account', ledgerSection: 'ASSETS', category: 'Cash' },
  { glAccountNumber: 'EAGLE-2050', glAccountDescription: 'Payables', ledgerSection: 'LIABILITIES', category: 'Expense RecPay' },
];

const mockMapping: GLAccountMapping = {
  mappingId: 'MAP-001',
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
};

describe('useMappingState', () => {
  it('initializes with empty state', () => {
    const { result } = renderHook(() => useMappingState());

    expect(result.current.state.incumbentAccounts).toHaveLength(0);
    expect(result.current.state.eagleAccounts).toHaveLength(0);
    expect(result.current.state.mappings).toHaveLength(0);
    expect(result.current.state.isLoading).toBe(false);
  });

  it('can set incumbent accounts', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.setIncumbentAccounts(mockIncumbentAccounts);
    });

    expect(result.current.state.incumbentAccounts).toHaveLength(3);
  });

  it('can set eagle accounts', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.setEagleAccounts(mockEagleAccounts);
    });

    expect(result.current.state.eagleAccounts).toHaveLength(3);
  });

  it('can set mappings', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.setMappings([mockMapping]);
    });

    expect(result.current.state.mappings).toHaveLength(1);
  });

  it('can add a mapping', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.addMapping(mockMapping);
    });

    expect(result.current.state.mappings).toHaveLength(1);
    expect(result.current.state.mappings[0].mappingId).toBe('MAP-001');
  });

  it('can update a mapping', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.setMappings([mockMapping]);
    });

    act(() => {
      result.current.updateMapping('MAP-001', { splitWeight: 0.5 });
    });

    expect(result.current.state.mappings[0].splitWeight).toBe(0.5);
  });

  it('can delete a mapping', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.setMappings([mockMapping]);
    });

    act(() => {
      result.current.deleteMapping('MAP-001');
    });

    expect(result.current.state.mappings).toHaveLength(0);
  });

  it('computes mapped incumbent accounts correctly', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.setIncumbentAccounts(mockIncumbentAccounts);
      result.current.setMappings([mockMapping]);
    });

    expect(result.current.mappedIncumbentAccounts.has('1050')).toBe(true);
    expect(result.current.mappedIncumbentAccounts.has('1100')).toBe(false);
  });

  it('computes mapped eagle accounts correctly', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.setEagleAccounts(mockEagleAccounts);
      result.current.setMappings([mockMapping]);
    });

    expect(result.current.mappedEagleAccounts.has('EAGLE-1050')).toBe(true);
    expect(result.current.mappedEagleAccounts.has('EAGLE-1100')).toBe(false);
  });

  it('filters incumbent accounts by search', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.setIncumbentAccounts(mockIncumbentAccounts);
      result.current.setFilter({ incumbentSearch: 'cash' });
    });

    expect(result.current.filteredIncumbentAccounts).toHaveLength(1);
    expect(result.current.filteredIncumbentAccounts[0].glAccountNumber).toBe('1050');
  });

  it('filters incumbent accounts by section', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.setIncumbentAccounts(mockIncumbentAccounts);
      result.current.setFilter({ incumbentSection: 'LIABILITIES' });
    });

    expect(result.current.filteredIncumbentAccounts).toHaveLength(1);
    expect(result.current.filteredIncumbentAccounts[0].glAccountNumber).toBe('2050');
  });

  it('can select incumbent accounts', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.selectIncumbentAccount('1050', false);
    });

    expect(result.current.state.selection.selectedIncumbentAccounts).toContain('1050');
  });

  it('can multi-select incumbent accounts', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.selectIncumbentAccount('1050', false);
    });

    act(() => {
      result.current.selectIncumbentAccount('1100', true);
    });

    expect(result.current.state.selection.selectedIncumbentAccounts).toHaveLength(2);
    expect(result.current.state.selection.selectedIncumbentAccounts).toContain('1050');
    expect(result.current.state.selection.selectedIncumbentAccounts).toContain('1100');
  });

  it('toggles selection when clicking selected account', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.selectIncumbentAccount('1050', false);
    });

    act(() => {
      result.current.selectIncumbentAccount('1050', false);
    });

    expect(result.current.state.selection.selectedIncumbentAccounts).toHaveLength(0);
  });

  it('can select a mapping', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.selectMapping('MAP-001');
    });

    expect(result.current.state.selection.selectedMappingId).toBe('MAP-001');
    // Selecting a mapping should clear account selections
    expect(result.current.state.selection.selectedIncumbentAccounts).toHaveLength(0);
    expect(result.current.state.selection.selectedEagleAccounts).toHaveLength(0);
  });

  it('can clear selection', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.selectIncumbentAccount('1050', false);
      result.current.selectEagleAccount('EAGLE-1050', false);
    });

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.state.selection.selectedIncumbentAccounts).toHaveLength(0);
    expect(result.current.state.selection.selectedEagleAccounts).toHaveLength(0);
    expect(result.current.state.selection.selectedMappingId).toBeNull();
  });

  it('tracks pending changes', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.addPendingChange({
        id: 'change-1',
        type: 'CREATE',
        mapping: mockMapping,
        timestamp: Date.now(),
      });
    });

    expect(result.current.state.pendingChanges).toHaveLength(1);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('can clear pending changes', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.addPendingChange({
        id: 'change-1',
        type: 'CREATE',
        mapping: mockMapping,
        timestamp: Date.now(),
      });
    });

    act(() => {
      result.current.clearPendingChanges();
    });

    expect(result.current.state.pendingChanges).toHaveLength(0);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('can set loading state', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.state.isLoading).toBe(true);
  });

  it('can set error state', () => {
    const { result } = renderHook(() => useMappingState());

    act(() => {
      result.current.setError('Test error');
    });

    expect(result.current.state.error).toBe('Test error');
  });
});
