import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import {
  NavCompareRow,
  CrossCheckResult,
  TrialBalanceCategoryRow,
  SubledgerCheckResult,
  PositionCompareRow,
  TaxLotRow,
  BasisLotRow,
  WaterfallBar,
  AICommentaryData,
} from '../types';

// ── State Shape ──────────────────────────────────────────────

interface DrillDownState {
  context: {
    eventId: string;
    eventName: string;
    account: string | null;
    accountName: string | null;
    valuationDt: string | null;
    category: string | null;
    assetId: string | null;
  };
  navDashboard: {
    funds: NavCompareRow[];
    selectedFund: string | null;
    expandedRows: string[];
    crossChecks: Record<string, CrossCheckResult>;
  };
  trialBalance: {
    categories: TrialBalanceCategoryRow[];
    selectedCategory: string | null;
    expandedRows: string[];
    subledgerChecks: Record<string, SubledgerCheckResult>;
    waterfallData: WaterfallBar[];
    navVariance: number | null;
    navVarianceBP: number | null;
  };
  positionDrillDown: {
    positions: PositionCompareRow[];
    selectedPosition: string | null;
    expandedRows: string[];
    taxLots: Record<string, TaxLotRow[]>;
    basisLotCheck: BasisLotRow[];
    categoryVariance: number | null;
    categoryVarianceBP: number | null;
  };
  aiAnalysis: {
    currentAnalysis: AICommentaryData | null;
    loading: boolean;
    history: AICommentaryData[];
  };
}

const initialState: DrillDownState = {
  context: {
    eventId: '',
    eventName: '',
    account: null,
    accountName: null,
    valuationDt: null,
    category: null,
    assetId: null,
  },
  navDashboard: {
    funds: [],
    selectedFund: null,
    expandedRows: [],
    crossChecks: {},
  },
  trialBalance: {
    categories: [],
    selectedCategory: null,
    expandedRows: [],
    subledgerChecks: {},
    waterfallData: [],
    navVariance: null,
    navVarianceBP: null,
  },
  positionDrillDown: {
    positions: [],
    selectedPosition: null,
    expandedRows: [],
    taxLots: {},
    basisLotCheck: [],
    categoryVariance: null,
    categoryVarianceBP: null,
  },
  aiAnalysis: {
    currentAnalysis: null,
    loading: false,
    history: [],
  },
};

// ── Actions ──────────────────────────────────────────────────

type DrillDownAction =
  | { type: 'SET_EVENT'; eventId: string; eventName: string }
  | { type: 'SET_FUND'; account: string; accountName: string; valuationDt: string }
  | { type: 'SET_CATEGORY'; category: string; navVariance: number; navVarianceBP: number }
  | { type: 'SET_ASSET'; assetId: string; categoryVariance: number; categoryVarianceBP: number }
  | { type: 'SET_VALUATION_DATE'; valuationDt: string }
  | { type: 'GO_BACK_TO_EVENTS' }
  | { type: 'GO_BACK_TO_NAV' }
  | { type: 'GO_BACK_TO_TRIAL_BALANCE' }
  | { type: 'SET_NAV_FUNDS'; funds: NavCompareRow[] }
  | { type: 'SET_NAV_SELECTED_FUND'; account: string | null }
  | { type: 'TOGGLE_NAV_EXPANDED_ROW'; account: string }
  | { type: 'SET_NAV_CROSS_CHECK'; account: string; result: CrossCheckResult }
  | { type: 'SET_TB_CATEGORIES'; categories: TrialBalanceCategoryRow[]; waterfallData: WaterfallBar[] }
  | { type: 'SET_TB_SELECTED_CATEGORY'; category: string | null }
  | { type: 'TOGGLE_TB_EXPANDED_ROW'; category: string }
  | { type: 'SET_TB_SUBLEDGER_CHECK'; category: string; result: SubledgerCheckResult }
  | { type: 'SET_POS_POSITIONS'; positions: PositionCompareRow[] }
  | { type: 'SET_POS_SELECTED'; assetId: string | null }
  | { type: 'TOGGLE_POS_EXPANDED_ROW'; assetId: string }
  | { type: 'SET_POS_TAX_LOTS'; assetId: string; lots: TaxLotRow[] }
  | { type: 'SET_POS_BASIS_LOT_CHECK'; results: BasisLotRow[] }
  | { type: 'SET_AI_ANALYSIS'; analysis: AICommentaryData }
  | { type: 'SET_AI_LOADING'; loading: boolean }
  | { type: 'UPDATE_NAV_ROW'; account: string; updates: Partial<NavCompareRow> };

// ── Reducer ──────────────────────────────────────────────────

function drillDownReducer(state: DrillDownState, action: DrillDownAction): DrillDownState {
  switch (action.type) {
    case 'SET_EVENT':
      return {
        ...initialState,
        context: {
          ...initialState.context,
          eventId: action.eventId,
          eventName: action.eventName,
        },
      };

    case 'SET_FUND':
      return {
        ...state,
        context: {
          ...state.context,
          account: action.account,
          accountName: action.accountName,
          valuationDt: action.valuationDt,
          category: null,
          assetId: null,
        },
        trialBalance: initialState.trialBalance,
        positionDrillDown: initialState.positionDrillDown,
        aiAnalysis: initialState.aiAnalysis,
      };

    case 'SET_CATEGORY':
      return {
        ...state,
        context: {
          ...state.context,
          category: action.category,
          assetId: null,
        },
        trialBalance: {
          ...state.trialBalance,
          navVariance: action.navVariance,
          navVarianceBP: action.navVarianceBP,
        },
        positionDrillDown: initialState.positionDrillDown,
        aiAnalysis: initialState.aiAnalysis,
      };

    case 'SET_ASSET':
      return {
        ...state,
        context: { ...state.context, assetId: action.assetId },
        positionDrillDown: {
          ...state.positionDrillDown,
          categoryVariance: action.categoryVariance,
          categoryVarianceBP: action.categoryVarianceBP,
        },
      };

    case 'SET_VALUATION_DATE':
      return {
        ...state,
        context: { ...state.context, valuationDt: action.valuationDt },
        navDashboard: { ...initialState.navDashboard },
        trialBalance: initialState.trialBalance,
        positionDrillDown: initialState.positionDrillDown,
      };

    case 'GO_BACK_TO_EVENTS':
      return initialState;

    case 'GO_BACK_TO_NAV':
      return {
        ...state,
        context: {
          ...state.context,
          account: null,
          accountName: null,
          category: null,
          assetId: null,
        },
        trialBalance: initialState.trialBalance,
        positionDrillDown: initialState.positionDrillDown,
        aiAnalysis: initialState.aiAnalysis,
      };

    case 'GO_BACK_TO_TRIAL_BALANCE':
      return {
        ...state,
        context: { ...state.context, category: null, assetId: null },
        positionDrillDown: initialState.positionDrillDown,
        aiAnalysis: initialState.aiAnalysis,
      };

    case 'SET_NAV_FUNDS':
      return { ...state, navDashboard: { ...state.navDashboard, funds: action.funds } };

    case 'SET_NAV_SELECTED_FUND':
      return { ...state, navDashboard: { ...state.navDashboard, selectedFund: action.account } };

    case 'TOGGLE_NAV_EXPANDED_ROW': {
      const rows = state.navDashboard.expandedRows;
      const next = rows.includes(action.account)
        ? rows.filter((r) => r !== action.account)
        : [...rows, action.account];
      return { ...state, navDashboard: { ...state.navDashboard, expandedRows: next } };
    }

    case 'SET_NAV_CROSS_CHECK':
      return {
        ...state,
        navDashboard: {
          ...state.navDashboard,
          crossChecks: { ...state.navDashboard.crossChecks, [action.account]: action.result },
        },
      };

    case 'SET_TB_CATEGORIES':
      return {
        ...state,
        trialBalance: {
          ...state.trialBalance,
          categories: action.categories,
          waterfallData: action.waterfallData,
        },
      };

    case 'SET_TB_SELECTED_CATEGORY':
      return { ...state, trialBalance: { ...state.trialBalance, selectedCategory: action.category } };

    case 'TOGGLE_TB_EXPANDED_ROW': {
      const rows = state.trialBalance.expandedRows;
      const next = rows.includes(action.category)
        ? rows.filter((r) => r !== action.category)
        : [...rows, action.category];
      return { ...state, trialBalance: { ...state.trialBalance, expandedRows: next } };
    }

    case 'SET_TB_SUBLEDGER_CHECK':
      return {
        ...state,
        trialBalance: {
          ...state.trialBalance,
          subledgerChecks: { ...state.trialBalance.subledgerChecks, [action.category]: action.result },
        },
      };

    case 'SET_POS_POSITIONS':
      return { ...state, positionDrillDown: { ...state.positionDrillDown, positions: action.positions } };

    case 'SET_POS_SELECTED':
      return { ...state, positionDrillDown: { ...state.positionDrillDown, selectedPosition: action.assetId } };

    case 'TOGGLE_POS_EXPANDED_ROW': {
      const rows = state.positionDrillDown.expandedRows;
      const next = rows.includes(action.assetId)
        ? rows.filter((r) => r !== action.assetId)
        : [...rows, action.assetId];
      return { ...state, positionDrillDown: { ...state.positionDrillDown, expandedRows: next } };
    }

    case 'SET_POS_TAX_LOTS':
      return {
        ...state,
        positionDrillDown: {
          ...state.positionDrillDown,
          taxLots: { ...state.positionDrillDown.taxLots, [action.assetId]: action.lots },
        },
      };

    case 'SET_POS_BASIS_LOT_CHECK':
      return { ...state, positionDrillDown: { ...state.positionDrillDown, basisLotCheck: action.results } };

    case 'SET_AI_ANALYSIS':
      return {
        ...state,
        aiAnalysis: {
          currentAnalysis: action.analysis,
          loading: false,
          history: [action.analysis, ...state.aiAnalysis.history],
        },
      };

    case 'SET_AI_LOADING':
      return { ...state, aiAnalysis: { ...state.aiAnalysis, loading: action.loading } };

    case 'UPDATE_NAV_ROW':
      return {
        ...state,
        navDashboard: {
          ...state.navDashboard,
          funds: state.navDashboard.funds.map((f) =>
            f.account === action.account ? { ...f, ...action.updates } : f
          ),
        },
      };

    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────

const DrillDownStateContext = createContext<DrillDownState>(initialState);
const DrillDownDispatchContext = createContext<React.Dispatch<DrillDownAction>>(() => {});

export function DrillDownProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(drillDownReducer, initialState);
  return (
    <DrillDownStateContext.Provider value={state}>
      <DrillDownDispatchContext.Provider value={dispatch}>
        {children}
      </DrillDownDispatchContext.Provider>
    </DrillDownStateContext.Provider>
  );
}

export function useDrillDownState() {
  return useContext(DrillDownStateContext);
}

export function useDrillDownDispatch() {
  return useContext(DrillDownDispatchContext);
}
