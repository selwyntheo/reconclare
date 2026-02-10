/**
 * Central state management for GL Account Mapping workspace.
 * Uses a reducer pattern to manage mappings, selections, and pending changes.
 */

import { useReducer, useCallback, useMemo } from 'react';
import {
  GLAccountMapping,
  IncumbentGLAccount,
  EagleGLAccount,
  MappingChange,
  SelectionState,
  FilterState,
  MappingType,
  CreateMappingRequest,
} from '../../../types/glMapping';

// ── State Type ───────────────────────────────────────────────

export interface MappingState {
  // Reference data
  incumbentAccounts: IncumbentGLAccount[];
  eagleAccounts: EagleGLAccount[];

  // Mappings
  mappings: GLAccountMapping[];
  pendingChanges: MappingChange[];

  // Selection
  selection: SelectionState;

  // Filters
  filters: FilterState;

  // UI State
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  selectedMappingDetails: GLAccountMapping | null;
}

// ── Action Types ─────────────────────────────────────────────

type MappingAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_INCUMBENT_ACCOUNTS'; payload: IncumbentGLAccount[] }
  | { type: 'SET_EAGLE_ACCOUNTS'; payload: EagleGLAccount[] }
  | { type: 'SET_MAPPINGS'; payload: GLAccountMapping[] }
  | { type: 'ADD_MAPPING'; payload: GLAccountMapping }
  | { type: 'UPDATE_MAPPING'; payload: { mappingId: string; updates: Partial<GLAccountMapping> } }
  | { type: 'DELETE_MAPPING'; payload: string }
  | { type: 'ADD_PENDING_CHANGE'; payload: MappingChange }
  | { type: 'REMOVE_PENDING_CHANGE'; payload: string }
  | { type: 'CLEAR_PENDING_CHANGES' }
  | { type: 'SET_PENDING_CHANGES'; payload: MappingChange[] }
  | { type: 'SELECT_INCUMBENT_ACCOUNT'; payload: { accountNumber: string; multiSelect: boolean } }
  | { type: 'SELECT_EAGLE_ACCOUNT'; payload: { accountNumber: string; multiSelect: boolean } }
  | { type: 'SELECT_MAPPING'; payload: string | null }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_FILTER'; payload: Partial<FilterState> }
  | { type: 'SET_SELECTED_MAPPING_DETAILS'; payload: GLAccountMapping | null };

// ── Initial State ────────────────────────────────────────────

const initialState: MappingState = {
  incumbentAccounts: [],
  eagleAccounts: [],
  mappings: [],
  pendingChanges: [],
  selection: {
    selectedIncumbentAccounts: [],
    selectedEagleAccounts: [],
    selectedMappingId: null,
  },
  filters: {
    incumbentSearch: '',
    eagleSearch: '',
    incumbentSection: 'ALL',
    eagleSection: 'ALL',
    showMappedOnly: false,
    showUnmappedOnly: false,
  },
  isLoading: false,
  isSaving: false,
  error: null,
  selectedMappingDetails: null,
};

// ── Reducer ──────────────────────────────────────────────────

function mappingReducer(state: MappingState, action: MappingAction): MappingState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_INCUMBENT_ACCOUNTS':
      return { ...state, incumbentAccounts: action.payload };

    case 'SET_EAGLE_ACCOUNTS':
      return { ...state, eagleAccounts: action.payload };

    case 'SET_MAPPINGS':
      return { ...state, mappings: action.payload };

    case 'ADD_MAPPING':
      return { ...state, mappings: [...state.mappings, action.payload] };

    case 'UPDATE_MAPPING':
      return {
        ...state,
        mappings: state.mappings.map((m) =>
          m.mappingId === action.payload.mappingId
            ? { ...m, ...action.payload.updates }
            : m
        ),
      };

    case 'DELETE_MAPPING':
      return {
        ...state,
        mappings: state.mappings.filter((m) => m.mappingId !== action.payload),
      };

    case 'ADD_PENDING_CHANGE':
      return {
        ...state,
        pendingChanges: [...state.pendingChanges, action.payload],
      };

    case 'REMOVE_PENDING_CHANGE':
      return {
        ...state,
        pendingChanges: state.pendingChanges.filter((c) => c.id !== action.payload),
      };

    case 'CLEAR_PENDING_CHANGES':
      return { ...state, pendingChanges: [] };

    case 'SET_PENDING_CHANGES':
      return { ...state, pendingChanges: action.payload };

    case 'SELECT_INCUMBENT_ACCOUNT': {
      const { accountNumber, multiSelect } = action.payload;
      const currentSelected = state.selection.selectedIncumbentAccounts;

      let newSelected: string[];
      if (multiSelect) {
        if (currentSelected.includes(accountNumber)) {
          newSelected = currentSelected.filter((n) => n !== accountNumber);
        } else {
          newSelected = [...currentSelected, accountNumber];
        }
      } else {
        newSelected = currentSelected.includes(accountNumber) ? [] : [accountNumber];
      }

      return {
        ...state,
        selection: {
          ...state.selection,
          selectedIncumbentAccounts: newSelected,
          selectedMappingId: null,
        },
      };
    }

    case 'SELECT_EAGLE_ACCOUNT': {
      const { accountNumber, multiSelect } = action.payload;
      const currentSelected = state.selection.selectedEagleAccounts;

      let newSelected: string[];
      if (multiSelect) {
        if (currentSelected.includes(accountNumber)) {
          newSelected = currentSelected.filter((n) => n !== accountNumber);
        } else {
          newSelected = [...currentSelected, accountNumber];
        }
      } else {
        newSelected = currentSelected.includes(accountNumber) ? [] : [accountNumber];
      }

      return {
        ...state,
        selection: {
          ...state.selection,
          selectedEagleAccounts: newSelected,
          selectedMappingId: null,
        },
      };
    }

    case 'SELECT_MAPPING':
      return {
        ...state,
        selection: {
          ...state.selection,
          selectedMappingId: action.payload,
          selectedIncumbentAccounts: [],
          selectedEagleAccounts: [],
        },
      };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selection: {
          selectedIncumbentAccounts: [],
          selectedEagleAccounts: [],
          selectedMappingId: null,
        },
      };

    case 'SET_FILTER':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
      };

    case 'SET_SELECTED_MAPPING_DETAILS':
      return { ...state, selectedMappingDetails: action.payload };

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────

export function useMappingState() {
  const [state, dispatch] = useReducer(mappingReducer, initialState);

  // ── Computed Values ────────────────────────────────────────

  const mappedIncumbentAccounts = useMemo(() => {
    const mapped = new Set(state.mappings.map((m) => m.sourceGlAccountNumber));
    return mapped;
  }, [state.mappings]);

  const mappedEagleAccounts = useMemo(() => {
    const mapped = new Set(state.mappings.map((m) => m.targetGlAccountNumber));
    return mapped;
  }, [state.mappings]);

  const filteredIncumbentAccounts = useMemo(() => {
    return state.incumbentAccounts.filter((account) => {
      // Search filter
      if (state.filters.incumbentSearch) {
        const search = state.filters.incumbentSearch.toLowerCase();
        const matchesSearch =
          account.glAccountNumber.toLowerCase().includes(search) ||
          account.glAccountDescription.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Section filter
      if (state.filters.incumbentSection !== 'ALL') {
        if (account.ledgerSection !== state.filters.incumbentSection) return false;
      }

      // Mapped/Unmapped filter
      const isMapped = mappedIncumbentAccounts.has(account.glAccountNumber);
      if (state.filters.showMappedOnly && !isMapped) return false;
      if (state.filters.showUnmappedOnly && isMapped) return false;

      return true;
    });
  }, [state.incumbentAccounts, state.filters, mappedIncumbentAccounts]);

  const filteredEagleAccounts = useMemo(() => {
    return state.eagleAccounts.filter((account) => {
      // Search filter
      if (state.filters.eagleSearch) {
        const search = state.filters.eagleSearch.toLowerCase();
        const matchesSearch =
          account.glAccountNumber.toLowerCase().includes(search) ||
          account.glAccountDescription.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Section filter
      if (state.filters.eagleSection !== 'ALL') {
        if (account.ledgerSection !== state.filters.eagleSection) return false;
      }

      // Mapped/Unmapped filter
      const isMapped = mappedEagleAccounts.has(account.glAccountNumber);
      if (state.filters.showMappedOnly && !isMapped) return false;
      if (state.filters.showUnmappedOnly && isMapped) return false;

      return true;
    });
  }, [state.eagleAccounts, state.filters, mappedEagleAccounts]);

  const hasUnsavedChanges = state.pendingChanges.length > 0;

  // ── Actions ────────────────────────────────────────────────

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setSaving = useCallback((saving: boolean) => {
    dispatch({ type: 'SET_SAVING', payload: saving });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const setIncumbentAccounts = useCallback((accounts: IncumbentGLAccount[]) => {
    dispatch({ type: 'SET_INCUMBENT_ACCOUNTS', payload: accounts });
  }, []);

  const setEagleAccounts = useCallback((accounts: EagleGLAccount[]) => {
    dispatch({ type: 'SET_EAGLE_ACCOUNTS', payload: accounts });
  }, []);

  const setMappings = useCallback((mappings: GLAccountMapping[]) => {
    dispatch({ type: 'SET_MAPPINGS', payload: mappings });
  }, []);

  const addMapping = useCallback((mapping: GLAccountMapping) => {
    dispatch({ type: 'ADD_MAPPING', payload: mapping });
  }, []);

  const updateMapping = useCallback(
    (mappingId: string, updates: Partial<GLAccountMapping>) => {
      dispatch({ type: 'UPDATE_MAPPING', payload: { mappingId, updates } });
    },
    []
  );

  const deleteMapping = useCallback((mappingId: string) => {
    dispatch({ type: 'DELETE_MAPPING', payload: mappingId });
  }, []);

  const addPendingChange = useCallback((change: MappingChange) => {
    dispatch({ type: 'ADD_PENDING_CHANGE', payload: change });
  }, []);

  const removePendingChange = useCallback((changeId: string) => {
    dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: changeId });
  }, []);

  const clearPendingChanges = useCallback(() => {
    dispatch({ type: 'CLEAR_PENDING_CHANGES' });
  }, []);

  const setPendingChanges = useCallback((changes: MappingChange[]) => {
    dispatch({ type: 'SET_PENDING_CHANGES', payload: changes });
  }, []);

  const selectIncumbentAccount = useCallback(
    (accountNumber: string, multiSelect: boolean = false) => {
      dispatch({ type: 'SELECT_INCUMBENT_ACCOUNT', payload: { accountNumber, multiSelect } });
    },
    []
  );

  const selectEagleAccount = useCallback(
    (accountNumber: string, multiSelect: boolean = false) => {
      dispatch({ type: 'SELECT_EAGLE_ACCOUNT', payload: { accountNumber, multiSelect } });
    },
    []
  );

  const selectMapping = useCallback((mappingId: string | null) => {
    dispatch({ type: 'SELECT_MAPPING', payload: mappingId });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const setFilter = useCallback((filter: Partial<FilterState>) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
  }, []);

  const setSelectedMappingDetails = useCallback((mapping: GLAccountMapping | null) => {
    dispatch({ type: 'SET_SELECTED_MAPPING_DETAILS', payload: mapping });
  }, []);

  // ── Helper: Create mapping from drag ───────────────────────

  const createMappingFromDrag = useCallback(
    (
      sourceAccountNumber: string,
      targetAccountNumber: string,
      eventId: string,
      sourceProvider: string
    ): CreateMappingRequest => {
      // Determine mapping type based on current selection state
      const selectedIncumbent = state.selection.selectedIncumbentAccounts;
      const selectedEagle = state.selection.selectedEagleAccounts;

      let mappingType: MappingType = 'ONE_TO_ONE';

      if (selectedIncumbent.length > 1 || selectedEagle.includes(targetAccountNumber)) {
        // Many sources to one target
        mappingType = 'MANY_TO_ONE';
      } else if (selectedEagle.length > 1 || selectedIncumbent.includes(sourceAccountNumber)) {
        // One source to many targets
        mappingType = 'ONE_TO_MANY';
      }

      return {
        eventId,
        sourceProvider,
        sourceGlAccountNumber: sourceAccountNumber,
        targetGlAccountNumber: targetAccountNumber,
        mappingType,
        splitWeight: 1.0,
      };
    },
    [state.selection]
  );

  return {
    state,
    // Computed
    filteredIncumbentAccounts,
    filteredEagleAccounts,
    mappedIncumbentAccounts,
    mappedEagleAccounts,
    hasUnsavedChanges,
    // Actions
    setLoading,
    setSaving,
    setError,
    setIncumbentAccounts,
    setEagleAccounts,
    setMappings,
    addMapping,
    updateMapping,
    deleteMapping,
    addPendingChange,
    removePendingChange,
    clearPendingChanges,
    setPendingChanges,
    selectIncumbentAccount,
    selectEagleAccount,
    selectMapping,
    clearSelection,
    setFilter,
    setSelectedMappingDetails,
    createMappingFromDrag,
  };
}

export type MappingStateHook = ReturnType<typeof useMappingState>;
