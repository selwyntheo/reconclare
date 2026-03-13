import { AppRole, PositionSubView, RolePermissions, ScreenAccess } from '../types/rbac';

const ALL_POSITION_SUB_VIEWS: PositionSubView[] = [
  'full-portfolio',
  'share-breaks',
  'price-breaks',
  'cost-breaks',
  'tax-lots',
  'equity-dividends',
  'fixed-income',
  'expenses',
  'derivative-income',
  'forwards',
  'futures',
  'swaps',
];

const REASSIGN_TEAMS = [
  'Reconciliation',
  'Pricing',
  'Trade Capture',
  'Corporate Actions',
  'Fund Accounting',
  'Fund Administration',
];

const FULL_SCREEN_ACCESS: ScreenAccess = { visible: true, readOnly: false, canTriggerValidation: true, canSignOff: false };
const READ_ONLY_ACCESS: ScreenAccess = { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false };
const NO_ACCESS: ScreenAccess = { visible: false, readOnly: true, canTriggerValidation: false, canSignOff: false };

export const ROLE_PERMISSIONS: Record<AppRole, RolePermissions> = {
  FUND_ACCOUNTANT: {
    role: 'FUND_ACCOUNTANT',
    label: 'Fund Accountant',
    defaultRoute: '/events',
    screens: {
      eventDashboard: { visible: true, readOnly: false, canTriggerValidation: true, canSignOff: false },
      navDashboard: { visible: true, readOnly: false, canTriggerValidation: true, canSignOff: false },
      trialBalance: { visible: true, readOnly: false, canTriggerValidation: true, canSignOff: false },
      positionDrillDown: { visible: true, readOnly: false, canTriggerValidation: false, canSignOff: false },
      reviewerAllocation: READ_ONLY_ACCESS,
      navShareClass: FULL_SCREEN_ACCESS,
      navShareClassDashboard: FULL_SCREEN_ACCESS,
      navClientScorecard: READ_ONLY_ACCESS,
      navRagTracker: READ_ONLY_ACCESS,
      positionsShareBreaks: FULL_SCREEN_ACCESS,
      positionsPriceBreaks: FULL_SCREEN_ACCESS,
      positionsTaxLots: FULL_SCREEN_ACCESS,
      incomeDividends: FULL_SCREEN_ACCESS,
      incomeFixedIncome: FULL_SCREEN_ACCESS,
      derivativesForwards: FULL_SCREEN_ACCESS,
      derivativesFutures: FULL_SCREEN_ACCESS,
      dataMapping: FULL_SCREEN_ACCESS,
      mmifDashboard: READ_ONLY_ACCESS,
      mmifReconciliation: READ_ONLY_ACCESS,
    },
    positionSubViews: ALL_POSITION_SUB_VIEWS,
    defaultPositionSubView: 'full-portfolio',
    commentary: { canAdd: true, allowedCategories: 'all' },
    canReassignBreak: true,
    reassignTargets: [...REASSIGN_TEAMS],
    canApproveSignOff: false,
    canManageRoster: false,
    canOverrideKD: false,
    canViewAuditTrail: false,
    exportScope: 'all',
  },

  PRICING_TEAM: {
    role: 'PRICING_TEAM',
    label: 'Pricing Team',
    defaultRoute: '/events',
    screens: {
      eventDashboard: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      navDashboard: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      trialBalance: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      positionDrillDown: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      reviewerAllocation: NO_ACCESS,
      navShareClass: READ_ONLY_ACCESS,
      navShareClassDashboard: READ_ONLY_ACCESS,
      navClientScorecard: NO_ACCESS,
      navRagTracker: READ_ONLY_ACCESS,
      positionsShareBreaks: NO_ACCESS,
      positionsPriceBreaks: READ_ONLY_ACCESS,
      positionsTaxLots: NO_ACCESS,
      incomeDividends: NO_ACCESS,
      incomeFixedIncome: NO_ACCESS,
      derivativesForwards: NO_ACCESS,
      derivativesFutures: NO_ACCESS,
      dataMapping: NO_ACCESS,
      mmifDashboard: NO_ACCESS,
      mmifReconciliation: NO_ACCESS,
    },
    positionSubViews: ['price-breaks'],
    defaultPositionSubView: 'price-breaks',
    commentary: { canAdd: true, allowedCategories: 'price-only' },
    canReassignBreak: true,
    reassignTargets: ['Reconciliation'],
    canApproveSignOff: false,
    canManageRoster: false,
    canOverrideKD: false,
    canViewAuditTrail: false,
    exportScope: 'price-only',
  },

  TRADE_CAPTURE_TEAM: {
    role: 'TRADE_CAPTURE_TEAM',
    label: 'Trade Capture Team',
    defaultRoute: '/events',
    screens: {
      eventDashboard: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      navDashboard: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      trialBalance: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      positionDrillDown: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      reviewerAllocation: NO_ACCESS,
      navShareClass: READ_ONLY_ACCESS,
      navShareClassDashboard: READ_ONLY_ACCESS,
      navClientScorecard: NO_ACCESS,
      navRagTracker: READ_ONLY_ACCESS,
      positionsShareBreaks: READ_ONLY_ACCESS,
      positionsPriceBreaks: NO_ACCESS,
      positionsTaxLots: NO_ACCESS,
      incomeDividends: NO_ACCESS,
      incomeFixedIncome: NO_ACCESS,
      derivativesForwards: NO_ACCESS,
      derivativesFutures: NO_ACCESS,
      dataMapping: NO_ACCESS,
      mmifDashboard: NO_ACCESS,
      mmifReconciliation: NO_ACCESS,
    },
    positionSubViews: ['share-breaks'],
    defaultPositionSubView: 'share-breaks',
    commentary: { canAdd: true, allowedCategories: 'share-only' },
    canReassignBreak: true,
    reassignTargets: ['Corporate Actions'],
    canApproveSignOff: false,
    canManageRoster: false,
    canOverrideKD: false,
    canViewAuditTrail: false,
    exportScope: 'share-only',
  },

  RECON_LEAD: {
    role: 'RECON_LEAD',
    label: 'Recon Lead',
    defaultRoute: '/events',
    screens: {
      eventDashboard: { visible: true, readOnly: false, canTriggerValidation: true, canSignOff: false },
      navDashboard: { visible: true, readOnly: false, canTriggerValidation: true, canSignOff: true },
      trialBalance: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      positionDrillDown: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      reviewerAllocation: FULL_SCREEN_ACCESS,
      navShareClass: FULL_SCREEN_ACCESS,
      navShareClassDashboard: FULL_SCREEN_ACCESS,
      navClientScorecard: { visible: true, readOnly: false, canTriggerValidation: false, canSignOff: true },
      navRagTracker: FULL_SCREEN_ACCESS,
      positionsShareBreaks: FULL_SCREEN_ACCESS,
      positionsPriceBreaks: FULL_SCREEN_ACCESS,
      positionsTaxLots: FULL_SCREEN_ACCESS,
      incomeDividends: FULL_SCREEN_ACCESS,
      incomeFixedIncome: FULL_SCREEN_ACCESS,
      derivativesForwards: FULL_SCREEN_ACCESS,
      derivativesFutures: FULL_SCREEN_ACCESS,
      dataMapping: FULL_SCREEN_ACCESS,
      mmifDashboard: READ_ONLY_ACCESS,
      mmifReconciliation: READ_ONLY_ACCESS,
    },
    positionSubViews: ALL_POSITION_SUB_VIEWS,
    defaultPositionSubView: 'full-portfolio',
    commentary: { canAdd: false, allowedCategories: 'none' },
    canReassignBreak: true,
    reassignTargets: [...REASSIGN_TEAMS],
    canApproveSignOff: true,
    canManageRoster: true,
    canOverrideKD: true,
    canViewAuditTrail: true,
    exportScope: 'all',
  },

  AUDITOR: {
    role: 'AUDITOR',
    label: 'Auditor',
    defaultRoute: '/events',
    screens: {
      eventDashboard: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      navDashboard: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      trialBalance: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      positionDrillDown: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      reviewerAllocation: READ_ONLY_ACCESS,
      navShareClass: READ_ONLY_ACCESS,
      navShareClassDashboard: READ_ONLY_ACCESS,
      navClientScorecard: READ_ONLY_ACCESS,
      navRagTracker: READ_ONLY_ACCESS,
      positionsShareBreaks: READ_ONLY_ACCESS,
      positionsPriceBreaks: READ_ONLY_ACCESS,
      positionsTaxLots: READ_ONLY_ACCESS,
      incomeDividends: READ_ONLY_ACCESS,
      incomeFixedIncome: READ_ONLY_ACCESS,
      derivativesForwards: READ_ONLY_ACCESS,
      derivativesFutures: READ_ONLY_ACCESS,
      dataMapping: READ_ONLY_ACCESS,
      mmifDashboard: READ_ONLY_ACCESS,
      mmifReconciliation: READ_ONLY_ACCESS,
    },
    positionSubViews: ALL_POSITION_SUB_VIEWS,
    defaultPositionSubView: 'full-portfolio',
    commentary: { canAdd: false, allowedCategories: 'none' },
    canReassignBreak: false,
    reassignTargets: [],
    canApproveSignOff: false,
    canManageRoster: false,
    canOverrideKD: false,
    canViewAuditTrail: true,
    exportScope: 'all',
  },

  NAV_OPS_ANALYST: {
    role: 'NAV_OPS_ANALYST',
    label: 'NAV Ops Analyst',
    defaultRoute: '/events',
    screens: {
      eventDashboard: { visible: true, readOnly: false, canTriggerValidation: true, canSignOff: false },
      navDashboard: { visible: true, readOnly: false, canTriggerValidation: true, canSignOff: false },
      trialBalance: { visible: true, readOnly: false, canTriggerValidation: true, canSignOff: false },
      positionDrillDown: { visible: true, readOnly: false, canTriggerValidation: false, canSignOff: false },
      reviewerAllocation: READ_ONLY_ACCESS,
      navShareClass: FULL_SCREEN_ACCESS,
      navShareClassDashboard: FULL_SCREEN_ACCESS,
      navClientScorecard: { visible: true, readOnly: false, canTriggerValidation: false, canSignOff: false },
      navRagTracker: FULL_SCREEN_ACCESS,
      positionsShareBreaks: FULL_SCREEN_ACCESS,
      positionsPriceBreaks: FULL_SCREEN_ACCESS,
      positionsTaxLots: FULL_SCREEN_ACCESS,
      incomeDividends: FULL_SCREEN_ACCESS,
      incomeFixedIncome: FULL_SCREEN_ACCESS,
      derivativesForwards: FULL_SCREEN_ACCESS,
      derivativesFutures: FULL_SCREEN_ACCESS,
      dataMapping: FULL_SCREEN_ACCESS,
      mmifDashboard: READ_ONLY_ACCESS,
      mmifReconciliation: READ_ONLY_ACCESS,
    },
    positionSubViews: ALL_POSITION_SUB_VIEWS,
    defaultPositionSubView: 'full-portfolio',
    commentary: { canAdd: true, allowedCategories: 'all' },
    canReassignBreak: true,
    reassignTargets: [...REASSIGN_TEAMS],
    canApproveSignOff: false,
    canManageRoster: false,
    canOverrideKD: true,
    canViewAuditTrail: true,
    exportScope: 'all',
  },

  CLIENT_STAKEHOLDER: {
    role: 'CLIENT_STAKEHOLDER',
    label: 'Client Stakeholder',
    defaultRoute: '/events',
    screens: {
      eventDashboard: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      navDashboard: { visible: true, readOnly: true, canTriggerValidation: false, canSignOff: false },
      trialBalance: NO_ACCESS,
      positionDrillDown: NO_ACCESS,
      reviewerAllocation: NO_ACCESS,
      navShareClass: NO_ACCESS,
      navShareClassDashboard: READ_ONLY_ACCESS,
      navClientScorecard: READ_ONLY_ACCESS,
      navRagTracker: READ_ONLY_ACCESS,
      positionsShareBreaks: NO_ACCESS,
      positionsPriceBreaks: NO_ACCESS,
      positionsTaxLots: NO_ACCESS,
      incomeDividends: NO_ACCESS,
      incomeFixedIncome: NO_ACCESS,
      derivativesForwards: NO_ACCESS,
      derivativesFutures: NO_ACCESS,
      dataMapping: NO_ACCESS,
      mmifDashboard: NO_ACCESS,
      mmifReconciliation: NO_ACCESS,
    },
    positionSubViews: [],
    defaultPositionSubView: 'full-portfolio',
    commentary: { canAdd: false, allowedCategories: 'none' },
    canReassignBreak: false,
    reassignTargets: [],
    canApproveSignOff: false,
    canManageRoster: false,
    canOverrideKD: false,
    canViewAuditTrail: false,
    exportScope: 'none',
  },

  FUND_ADMIN: {
    role: 'FUND_ADMIN',
    label: 'Fund Administrator',
    defaultRoute: '/events',
    screens: {
      eventDashboard: READ_ONLY_ACCESS,
      navDashboard: READ_ONLY_ACCESS,
      trialBalance: READ_ONLY_ACCESS,
      positionDrillDown: READ_ONLY_ACCESS,
      reviewerAllocation: NO_ACCESS,
      navShareClass: NO_ACCESS,
      navShareClassDashboard: NO_ACCESS,
      navClientScorecard: NO_ACCESS,
      navRagTracker: NO_ACCESS,
      positionsShareBreaks: NO_ACCESS,
      positionsPriceBreaks: NO_ACCESS,
      positionsTaxLots: NO_ACCESS,
      incomeDividends: NO_ACCESS,
      incomeFixedIncome: NO_ACCESS,
      derivativesForwards: NO_ACCESS,
      derivativesFutures: NO_ACCESS,
      dataMapping: READ_ONLY_ACCESS,
      mmifDashboard: FULL_SCREEN_ACCESS,
      mmifReconciliation: FULL_SCREEN_ACCESS,
    },
    positionSubViews: ALL_POSITION_SUB_VIEWS,
    defaultPositionSubView: 'full-portfolio',
    commentary: { canAdd: true, allowedCategories: 'all' },
    canReassignBreak: true,
    reassignTargets: ['Fund Administration', 'Reconciliation'],
    canApproveSignOff: true,
    canManageRoster: true,
    canOverrideKD: true,
    canViewAuditTrail: true,
    exportScope: 'all',
  },
};

export function canAccessScreen(
  role: AppRole,
  screen: keyof RolePermissions['screens'],
): ScreenAccess {
  return ROLE_PERMISSIONS[role].screens[screen];
}

export function getPositionSubViews(role: AppRole): PositionSubView[] {
  return ROLE_PERMISSIONS[role].positionSubViews;
}

export function canAddCommentary(role: AppRole, category?: string): boolean {
  const perms = ROLE_PERMISSIONS[role].commentary;
  if (!perms.canAdd) return false;
  if (perms.allowedCategories === 'all') return true;
  if (perms.allowedCategories === 'price-only' && category === 'price') return true;
  if (perms.allowedCategories === 'share-only' && category === 'share') return true;
  // If no specific category is queried, return true as long as they can add something
  if (!category) return true;
  return false;
}

export function canReassign(role: AppRole): boolean {
  return ROLE_PERMISSIONS[role].canReassignBreak;
}

export function getReassignTargets(role: AppRole): string[] {
  return ROLE_PERMISSIONS[role].reassignTargets;
}

export function canManageRoster(role: AppRole): boolean {
  return ROLE_PERMISSIONS[role].canManageRoster;
}

export function canOverrideKD(role: AppRole): boolean {
  return ROLE_PERMISSIONS[role].canOverrideKD;
}

export function canViewAuditTrail(role: AppRole): boolean {
  return ROLE_PERMISSIONS[role].canViewAuditTrail;
}
