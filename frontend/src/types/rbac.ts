export type AppRole =
  | 'FUND_ACCOUNTANT'
  | 'PRICING_TEAM'
  | 'TRADE_CAPTURE_TEAM'
  | 'RECON_LEAD'
  | 'AUDITOR'
  | 'NAV_OPS_ANALYST'
  | 'CLIENT_STAKEHOLDER';

export type PositionSubView =
  | 'full-portfolio'
  | 'share-breaks'
  | 'price-breaks'
  | 'cost-breaks'
  | 'tax-lots'
  | 'equity-dividends'
  | 'fixed-income'
  | 'expenses'
  | 'derivative-income'
  | 'forwards'
  | 'futures'
  | 'swaps';

export interface ScreenAccess {
  visible: boolean;
  readOnly: boolean;
  canTriggerValidation: boolean;
  canSignOff: boolean;
}

export interface RolePermissions {
  role: AppRole;
  label: string;
  defaultRoute: string;
  screens: {
    eventDashboard: ScreenAccess;
    navDashboard: ScreenAccess;
    trialBalance: ScreenAccess;
    positionDrillDown: ScreenAccess;
    reviewerAllocation: ScreenAccess;
    navShareClass: ScreenAccess;
    navShareClassDashboard: ScreenAccess;
    navClientScorecard: ScreenAccess;
    navRagTracker: ScreenAccess;
    positionsShareBreaks: ScreenAccess;
    positionsPriceBreaks: ScreenAccess;
    positionsTaxLots: ScreenAccess;
    incomeDividends: ScreenAccess;
    incomeFixedIncome: ScreenAccess;
    derivativesForwards: ScreenAccess;
    derivativesFutures: ScreenAccess;
    dataMapping: ScreenAccess;
  };
  positionSubViews: PositionSubView[];
  defaultPositionSubView: PositionSubView;
  commentary: {
    canAdd: boolean;
    allowedCategories: 'all' | 'price-only' | 'share-only' | 'none';
  };
  canReassignBreak: boolean;
  reassignTargets: string[];
  canApproveSignOff: boolean;
  canManageRoster: boolean;
  canOverrideKD: boolean;
  canViewAuditTrail: boolean;
  exportScope: 'all' | 'price-only' | 'share-only' | 'none';
}
