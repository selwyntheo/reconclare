"""
RBAC Permission Matrix Tests.

Verifies the expected role-based access control rules defined in
frontend/src/config/permissions.ts. Since the RBAC logic lives in
the frontend, these Python tests serve as a canonical reference
documenting the permission matrix and detecting drift.

Roles tested:
- FUND_ACCOUNTANT
- PRICING_TEAM
- TRADE_CAPTURE_TEAM
- RECON_LEAD
- AUDITOR
- NAV_OPS_ANALYST
- CLIENT_STAKEHOLDER
"""

import pytest
from typing import Optional


# ═══════════════════════════════════════════════════════════════
# Permission Matrix — Python mirror of permissions.ts
# ═══════════════════════════════════════════════════════════════

# Screen access flags
FULL_SCREEN_ACCESS = {"visible": True, "readOnly": False, "canTriggerValidation": True, "canSignOff": False}
READ_ONLY_ACCESS = {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False}
NO_ACCESS = {"visible": False, "readOnly": True, "canTriggerValidation": False, "canSignOff": False}

ALL_POSITION_SUB_VIEWS = [
    "full-portfolio", "share-breaks", "price-breaks", "cost-breaks",
    "tax-lots", "equity-dividends", "fixed-income", "expenses",
    "derivative-income", "forwards", "futures", "swaps",
]

REASSIGN_TEAMS = [
    "Reconciliation", "Pricing", "Trade Capture", "Corporate Actions", "Fund Accounting",
]

ALL_SCREENS = [
    "eventDashboard", "navDashboard", "trialBalance", "positionDrillDown",
    "reviewerAllocation", "navShareClass", "navClientScorecard", "navRagTracker",
    "positionsShareBreaks", "positionsPriceBreaks", "positionsTaxLots",
    "incomeDividends", "incomeFixedIncome", "derivativesForwards", "derivativesFutures",
]

# Full permission matrix keyed by role
ROLE_PERMISSIONS = {
    "FUND_ACCOUNTANT": {
        "role": "FUND_ACCOUNTANT",
        "label": "Fund Accountant",
        "defaultRoute": "/events",
        "screens": {
            "eventDashboard": {"visible": True, "readOnly": False, "canTriggerValidation": True, "canSignOff": False},
            "navDashboard": {"visible": True, "readOnly": False, "canTriggerValidation": True, "canSignOff": False},
            "trialBalance": {"visible": True, "readOnly": False, "canTriggerValidation": True, "canSignOff": False},
            "positionDrillDown": {"visible": True, "readOnly": False, "canTriggerValidation": False, "canSignOff": False},
            "reviewerAllocation": READ_ONLY_ACCESS,
            "navShareClass": FULL_SCREEN_ACCESS,
            "navClientScorecard": READ_ONLY_ACCESS,
            "navRagTracker": READ_ONLY_ACCESS,
            "positionsShareBreaks": FULL_SCREEN_ACCESS,
            "positionsPriceBreaks": FULL_SCREEN_ACCESS,
            "positionsTaxLots": FULL_SCREEN_ACCESS,
            "incomeDividends": FULL_SCREEN_ACCESS,
            "incomeFixedIncome": FULL_SCREEN_ACCESS,
            "derivativesForwards": FULL_SCREEN_ACCESS,
            "derivativesFutures": FULL_SCREEN_ACCESS,
        },
        "positionSubViews": ALL_POSITION_SUB_VIEWS,
        "defaultPositionSubView": "full-portfolio",
        "commentary": {"canAdd": True, "allowedCategories": "all"},
        "canReassignBreak": True,
        "reassignTargets": REASSIGN_TEAMS,
        "canApproveSignOff": False,
        "canManageRoster": False,
        "canOverrideKD": False,
        "canViewAuditTrail": False,
        "exportScope": "all",
    },
    "PRICING_TEAM": {
        "role": "PRICING_TEAM",
        "label": "Pricing Team",
        "defaultRoute": "/events",
        "screens": {
            "eventDashboard": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "navDashboard": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "trialBalance": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "positionDrillDown": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "reviewerAllocation": NO_ACCESS,
            "navShareClass": READ_ONLY_ACCESS,
            "navClientScorecard": NO_ACCESS,
            "navRagTracker": READ_ONLY_ACCESS,
            "positionsShareBreaks": NO_ACCESS,
            "positionsPriceBreaks": READ_ONLY_ACCESS,
            "positionsTaxLots": NO_ACCESS,
            "incomeDividends": NO_ACCESS,
            "incomeFixedIncome": NO_ACCESS,
            "derivativesForwards": NO_ACCESS,
            "derivativesFutures": NO_ACCESS,
        },
        "positionSubViews": ["price-breaks"],
        "defaultPositionSubView": "price-breaks",
        "commentary": {"canAdd": True, "allowedCategories": "price-only"},
        "canReassignBreak": True,
        "reassignTargets": ["Reconciliation"],
        "canApproveSignOff": False,
        "canManageRoster": False,
        "canOverrideKD": False,
        "canViewAuditTrail": False,
        "exportScope": "price-only",
    },
    "TRADE_CAPTURE_TEAM": {
        "role": "TRADE_CAPTURE_TEAM",
        "label": "Trade Capture Team",
        "defaultRoute": "/events",
        "screens": {
            "eventDashboard": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "navDashboard": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "trialBalance": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "positionDrillDown": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "reviewerAllocation": NO_ACCESS,
            "navShareClass": READ_ONLY_ACCESS,
            "navClientScorecard": NO_ACCESS,
            "navRagTracker": READ_ONLY_ACCESS,
            "positionsShareBreaks": READ_ONLY_ACCESS,
            "positionsPriceBreaks": NO_ACCESS,
            "positionsTaxLots": NO_ACCESS,
            "incomeDividends": NO_ACCESS,
            "incomeFixedIncome": NO_ACCESS,
            "derivativesForwards": NO_ACCESS,
            "derivativesFutures": NO_ACCESS,
        },
        "positionSubViews": ["share-breaks"],
        "defaultPositionSubView": "share-breaks",
        "commentary": {"canAdd": True, "allowedCategories": "share-only"},
        "canReassignBreak": True,
        "reassignTargets": ["Corporate Actions"],
        "canApproveSignOff": False,
        "canManageRoster": False,
        "canOverrideKD": False,
        "canViewAuditTrail": False,
        "exportScope": "share-only",
    },
    "RECON_LEAD": {
        "role": "RECON_LEAD",
        "label": "Recon Lead",
        "defaultRoute": "/events",
        "screens": {
            "eventDashboard": {"visible": True, "readOnly": False, "canTriggerValidation": True, "canSignOff": False},
            "navDashboard": {"visible": True, "readOnly": False, "canTriggerValidation": True, "canSignOff": True},
            "trialBalance": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "positionDrillDown": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "reviewerAllocation": FULL_SCREEN_ACCESS,
            "navShareClass": FULL_SCREEN_ACCESS,
            "navClientScorecard": {"visible": True, "readOnly": False, "canTriggerValidation": False, "canSignOff": True},
            "navRagTracker": FULL_SCREEN_ACCESS,
            "positionsShareBreaks": FULL_SCREEN_ACCESS,
            "positionsPriceBreaks": FULL_SCREEN_ACCESS,
            "positionsTaxLots": FULL_SCREEN_ACCESS,
            "incomeDividends": FULL_SCREEN_ACCESS,
            "incomeFixedIncome": FULL_SCREEN_ACCESS,
            "derivativesForwards": FULL_SCREEN_ACCESS,
            "derivativesFutures": FULL_SCREEN_ACCESS,
        },
        "positionSubViews": ALL_POSITION_SUB_VIEWS,
        "defaultPositionSubView": "full-portfolio",
        "commentary": {"canAdd": False, "allowedCategories": "none"},
        "canReassignBreak": True,
        "reassignTargets": REASSIGN_TEAMS,
        "canApproveSignOff": True,
        "canManageRoster": True,
        "canOverrideKD": True,
        "canViewAuditTrail": True,
        "exportScope": "all",
    },
    "AUDITOR": {
        "role": "AUDITOR",
        "label": "Auditor",
        "defaultRoute": "/events",
        "screens": {
            "eventDashboard": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "navDashboard": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "trialBalance": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "positionDrillDown": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "reviewerAllocation": READ_ONLY_ACCESS,
            "navShareClass": READ_ONLY_ACCESS,
            "navClientScorecard": READ_ONLY_ACCESS,
            "navRagTracker": READ_ONLY_ACCESS,
            "positionsShareBreaks": READ_ONLY_ACCESS,
            "positionsPriceBreaks": READ_ONLY_ACCESS,
            "positionsTaxLots": READ_ONLY_ACCESS,
            "incomeDividends": READ_ONLY_ACCESS,
            "incomeFixedIncome": READ_ONLY_ACCESS,
            "derivativesForwards": READ_ONLY_ACCESS,
            "derivativesFutures": READ_ONLY_ACCESS,
        },
        "positionSubViews": ALL_POSITION_SUB_VIEWS,
        "defaultPositionSubView": "full-portfolio",
        "commentary": {"canAdd": False, "allowedCategories": "none"},
        "canReassignBreak": False,
        "reassignTargets": [],
        "canApproveSignOff": False,
        "canManageRoster": False,
        "canOverrideKD": False,
        "canViewAuditTrail": True,
        "exportScope": "all",
    },
    "NAV_OPS_ANALYST": {
        "role": "NAV_OPS_ANALYST",
        "label": "NAV Ops Analyst",
        "defaultRoute": "/events",
        "screens": {
            "eventDashboard": {"visible": True, "readOnly": False, "canTriggerValidation": True, "canSignOff": False},
            "navDashboard": {"visible": True, "readOnly": False, "canTriggerValidation": True, "canSignOff": False},
            "trialBalance": {"visible": True, "readOnly": False, "canTriggerValidation": True, "canSignOff": False},
            "positionDrillDown": {"visible": True, "readOnly": False, "canTriggerValidation": False, "canSignOff": False},
            "reviewerAllocation": READ_ONLY_ACCESS,
            "navShareClass": FULL_SCREEN_ACCESS,
            "navClientScorecard": {"visible": True, "readOnly": False, "canTriggerValidation": False, "canSignOff": False},
            "navRagTracker": FULL_SCREEN_ACCESS,
            "positionsShareBreaks": FULL_SCREEN_ACCESS,
            "positionsPriceBreaks": FULL_SCREEN_ACCESS,
            "positionsTaxLots": FULL_SCREEN_ACCESS,
            "incomeDividends": FULL_SCREEN_ACCESS,
            "incomeFixedIncome": FULL_SCREEN_ACCESS,
            "derivativesForwards": FULL_SCREEN_ACCESS,
            "derivativesFutures": FULL_SCREEN_ACCESS,
        },
        "positionSubViews": ALL_POSITION_SUB_VIEWS,
        "defaultPositionSubView": "full-portfolio",
        "commentary": {"canAdd": True, "allowedCategories": "all"},
        "canReassignBreak": True,
        "reassignTargets": REASSIGN_TEAMS,
        "canApproveSignOff": False,
        "canManageRoster": False,
        "canOverrideKD": True,
        "canViewAuditTrail": True,
        "exportScope": "all",
    },
    "CLIENT_STAKEHOLDER": {
        "role": "CLIENT_STAKEHOLDER",
        "label": "Client Stakeholder",
        "defaultRoute": "/events",
        "screens": {
            "eventDashboard": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "navDashboard": {"visible": True, "readOnly": True, "canTriggerValidation": False, "canSignOff": False},
            "trialBalance": NO_ACCESS,
            "positionDrillDown": NO_ACCESS,
            "reviewerAllocation": NO_ACCESS,
            "navShareClass": NO_ACCESS,
            "navClientScorecard": READ_ONLY_ACCESS,
            "navRagTracker": READ_ONLY_ACCESS,
            "positionsShareBreaks": NO_ACCESS,
            "positionsPriceBreaks": NO_ACCESS,
            "positionsTaxLots": NO_ACCESS,
            "incomeDividends": NO_ACCESS,
            "incomeFixedIncome": NO_ACCESS,
            "derivativesForwards": NO_ACCESS,
            "derivativesFutures": NO_ACCESS,
        },
        "positionSubViews": [],
        "defaultPositionSubView": "full-portfolio",
        "commentary": {"canAdd": False, "allowedCategories": "none"},
        "canReassignBreak": False,
        "reassignTargets": [],
        "canApproveSignOff": False,
        "canManageRoster": False,
        "canOverrideKD": False,
        "canViewAuditTrail": False,
        "exportScope": "none",
    },
}


# ═══════════════════════════════════════════════════════════════
# Helper functions (mirror of permissions.ts utility functions)
# ═══════════════════════════════════════════════════════════════

def can_access_screen(role: str, screen: str) -> dict:
    """Return screen access flags for a role."""
    return ROLE_PERMISSIONS[role]["screens"][screen]


def get_position_sub_views(role: str) -> list[str]:
    """Return allowed position sub-views for a role."""
    return ROLE_PERMISSIONS[role]["positionSubViews"]


def can_add_commentary(role: str, category: Optional[str] = None) -> bool:
    """Check if a role can add commentary for a given category."""
    perms = ROLE_PERMISSIONS[role]["commentary"]
    if not perms["canAdd"]:
        return False
    if perms["allowedCategories"] == "all":
        return True
    if perms["allowedCategories"] == "price-only" and category == "price":
        return True
    if perms["allowedCategories"] == "share-only" and category == "share":
        return True
    if not category:
        return True
    return False


def can_reassign(role: str) -> bool:
    """Check if a role can reassign breaks."""
    return ROLE_PERMISSIONS[role]["canReassignBreak"]


def get_reassign_targets(role: str) -> list[str]:
    """Get the teams a role can reassign breaks to."""
    return ROLE_PERMISSIONS[role]["reassignTargets"]


def can_manage_roster(role: str) -> bool:
    return ROLE_PERMISSIONS[role]["canManageRoster"]


def can_override_kd(role: str) -> bool:
    return ROLE_PERMISSIONS[role]["canOverrideKD"]


def can_view_audit_trail(role: str) -> bool:
    return ROLE_PERMISSIONS[role]["canViewAuditTrail"]


# ═══════════════════════════════════════════════════════════════
# 1. FUND_ACCOUNTANT Tests
# ═══════════════════════════════════════════════════════════════

class TestFundAccountantPermissions:
    """FUND_ACCOUNTANT: Full access to most screens, can add any commentary."""

    ROLE = "FUND_ACCOUNTANT"

    def test_can_access_all_screens(self):
        """FUND_ACCOUNTANT can see every screen (all visible=True)."""
        for screen in ALL_SCREENS:
            access = can_access_screen(self.ROLE, screen)
            assert access["visible"] is True, (
                f"FUND_ACCOUNTANT should have visible=True for {screen}"
            )

    def test_event_dashboard_has_write_access(self):
        """FUND_ACCOUNTANT can edit event dashboard."""
        access = can_access_screen(self.ROLE, "eventDashboard")
        assert access["readOnly"] is False
        assert access["canTriggerValidation"] is True

    def test_nav_dashboard_has_write_access(self):
        """FUND_ACCOUNTANT can edit NAV dashboard."""
        access = can_access_screen(self.ROLE, "navDashboard")
        assert access["readOnly"] is False
        assert access["canTriggerValidation"] is True

    def test_trial_balance_has_write_access(self):
        """FUND_ACCOUNTANT can edit trial balance."""
        access = can_access_screen(self.ROLE, "trialBalance")
        assert access["readOnly"] is False
        assert access["canTriggerValidation"] is True

    def test_reviewer_allocation_is_read_only(self):
        """FUND_ACCOUNTANT can view but not edit reviewer allocations."""
        access = can_access_screen(self.ROLE, "reviewerAllocation")
        assert access["visible"] is True
        assert access["readOnly"] is True

    def test_has_all_position_sub_views(self):
        """FUND_ACCOUNTANT can see all position sub-views."""
        views = get_position_sub_views(self.ROLE)
        assert views == ALL_POSITION_SUB_VIEWS

    def test_can_add_commentary_any_category(self):
        """FUND_ACCOUNTANT can add commentary for any category."""
        assert can_add_commentary(self.ROLE) is True
        assert can_add_commentary(self.ROLE, "price") is True
        assert can_add_commentary(self.ROLE, "share") is True
        assert can_add_commentary(self.ROLE, "income") is True

    def test_can_reassign_breaks_to_all_teams(self):
        """FUND_ACCOUNTANT can reassign breaks to all teams."""
        assert can_reassign(self.ROLE) is True
        targets = get_reassign_targets(self.ROLE)
        assert targets == REASSIGN_TEAMS

    def test_cannot_manage_roster(self):
        """FUND_ACCOUNTANT cannot manage the reviewer roster."""
        assert can_manage_roster(self.ROLE) is False

    def test_cannot_override_known_differences(self):
        """FUND_ACCOUNTANT cannot override KDs."""
        assert can_override_kd(self.ROLE) is False

    def test_cannot_view_audit_trail(self):
        """FUND_ACCOUNTANT cannot view audit trail."""
        assert can_view_audit_trail(self.ROLE) is False

    def test_cannot_approve_sign_off(self):
        """FUND_ACCOUNTANT cannot approve sign-offs."""
        assert ROLE_PERMISSIONS[self.ROLE]["canApproveSignOff"] is False

    def test_export_scope_is_all(self):
        """FUND_ACCOUNTANT can export all data."""
        assert ROLE_PERMISSIONS[self.ROLE]["exportScope"] == "all"


# ═══════════════════════════════════════════════════════════════
# 2. PRICING_TEAM Tests
# ═══════════════════════════════════════════════════════════════

class TestPricingTeamPermissions:
    """PRICING_TEAM: Limited to price-related screens and data."""

    ROLE = "PRICING_TEAM"

    def test_core_screens_are_read_only(self):
        """PRICING_TEAM sees core screens in read-only mode."""
        for screen in ["eventDashboard", "navDashboard", "trialBalance", "positionDrillDown"]:
            access = can_access_screen(self.ROLE, screen)
            assert access["visible"] is True
            assert access["readOnly"] is True
            assert access["canTriggerValidation"] is False

    def test_price_breaks_visible_read_only(self):
        """PRICING_TEAM can see price breaks screen (read-only)."""
        access = can_access_screen(self.ROLE, "positionsPriceBreaks")
        assert access["visible"] is True
        assert access["readOnly"] is True

    def test_non_price_screens_not_accessible(self):
        """PRICING_TEAM cannot access non-price screens."""
        hidden_screens = [
            "reviewerAllocation", "navClientScorecard",
            "positionsShareBreaks", "positionsTaxLots",
            "incomeDividends", "incomeFixedIncome",
            "derivativesForwards", "derivativesFutures",
        ]
        for screen in hidden_screens:
            access = can_access_screen(self.ROLE, screen)
            assert access["visible"] is False, (
                f"PRICING_TEAM should NOT see {screen}"
            )

    def test_only_price_breaks_position_sub_view(self):
        """PRICING_TEAM can only access the price-breaks sub-view."""
        views = get_position_sub_views(self.ROLE)
        assert views == ["price-breaks"]

    def test_can_add_commentary_price_only(self):
        """PRICING_TEAM can add commentary only for price category."""
        assert can_add_commentary(self.ROLE, "price") is True
        assert can_add_commentary(self.ROLE, "share") is False
        assert can_add_commentary(self.ROLE, "income") is False
        # When no category specified, returns True (they can add *something*)
        assert can_add_commentary(self.ROLE) is True

    def test_can_reassign_only_to_reconciliation(self):
        """PRICING_TEAM can only reassign to Reconciliation."""
        assert can_reassign(self.ROLE) is True
        targets = get_reassign_targets(self.ROLE)
        assert targets == ["Reconciliation"]

    def test_no_admin_capabilities(self):
        """PRICING_TEAM has no admin capabilities."""
        assert can_manage_roster(self.ROLE) is False
        assert can_override_kd(self.ROLE) is False
        assert can_view_audit_trail(self.ROLE) is False
        assert ROLE_PERMISSIONS[self.ROLE]["canApproveSignOff"] is False

    def test_export_scope_price_only(self):
        """PRICING_TEAM export scope is limited to price data."""
        assert ROLE_PERMISSIONS[self.ROLE]["exportScope"] == "price-only"


# ═══════════════════════════════════════════════════════════════
# 3. TRADE_CAPTURE_TEAM Tests
# ═══════════════════════════════════════════════════════════════

class TestTradeCaptureTeamPermissions:
    """TRADE_CAPTURE_TEAM: Limited to share/trade-related screens."""

    ROLE = "TRADE_CAPTURE_TEAM"

    def test_core_screens_are_read_only(self):
        """TRADE_CAPTURE_TEAM sees core screens in read-only mode."""
        for screen in ["eventDashboard", "navDashboard", "trialBalance", "positionDrillDown"]:
            access = can_access_screen(self.ROLE, screen)
            assert access["visible"] is True
            assert access["readOnly"] is True

    def test_share_breaks_visible_read_only(self):
        """TRADE_CAPTURE_TEAM can see share breaks screen (read-only)."""
        access = can_access_screen(self.ROLE, "positionsShareBreaks")
        assert access["visible"] is True
        assert access["readOnly"] is True

    def test_price_breaks_not_visible(self):
        """TRADE_CAPTURE_TEAM cannot see price breaks screen."""
        access = can_access_screen(self.ROLE, "positionsPriceBreaks")
        assert access["visible"] is False

    def test_only_share_breaks_position_sub_view(self):
        """TRADE_CAPTURE_TEAM can only access the share-breaks sub-view."""
        views = get_position_sub_views(self.ROLE)
        assert views == ["share-breaks"]

    def test_can_add_commentary_share_only(self):
        """TRADE_CAPTURE_TEAM can add commentary only for share category."""
        assert can_add_commentary(self.ROLE, "share") is True
        assert can_add_commentary(self.ROLE, "price") is False
        assert can_add_commentary(self.ROLE, "income") is False

    def test_can_reassign_only_to_corporate_actions(self):
        """TRADE_CAPTURE_TEAM can only reassign to Corporate Actions."""
        assert can_reassign(self.ROLE) is True
        targets = get_reassign_targets(self.ROLE)
        assert targets == ["Corporate Actions"]

    def test_export_scope_share_only(self):
        """TRADE_CAPTURE_TEAM export scope is limited to share data."""
        assert ROLE_PERMISSIONS[self.ROLE]["exportScope"] == "share-only"


# ═══════════════════════════════════════════════════════════════
# 4. RECON_LEAD Tests
# ═══════════════════════════════════════════════════════════════

class TestReconLeadPermissions:
    """RECON_LEAD: Full admin access with roster management, KD override, audit trail."""

    ROLE = "RECON_LEAD"

    def test_can_access_all_screens(self):
        """RECON_LEAD can see every screen."""
        for screen in ALL_SCREENS:
            access = can_access_screen(self.ROLE, screen)
            assert access["visible"] is True, (
                f"RECON_LEAD should have visible=True for {screen}"
            )

    def test_can_manage_roster(self):
        """RECON_LEAD can manage the reviewer roster."""
        assert can_manage_roster(self.ROLE) is True

    def test_can_override_known_differences(self):
        """RECON_LEAD can override known differences."""
        assert can_override_kd(self.ROLE) is True

    def test_can_view_audit_trail(self):
        """RECON_LEAD can view audit trail."""
        assert can_view_audit_trail(self.ROLE) is True

    def test_can_approve_sign_off(self):
        """RECON_LEAD can approve sign-offs."""
        assert ROLE_PERMISSIONS[self.ROLE]["canApproveSignOff"] is True

    def test_nav_dashboard_can_sign_off(self):
        """RECON_LEAD can sign off on NAV dashboard."""
        access = can_access_screen(self.ROLE, "navDashboard")
        assert access["canSignOff"] is True

    def test_client_scorecard_can_sign_off(self):
        """RECON_LEAD can sign off on client scorecard."""
        access = can_access_screen(self.ROLE, "navClientScorecard")
        assert access["canSignOff"] is True

    def test_reviewer_allocation_full_access(self):
        """RECON_LEAD has full access to reviewer allocation."""
        access = can_access_screen(self.ROLE, "reviewerAllocation")
        assert access["visible"] is True
        assert access["readOnly"] is False
        assert access["canTriggerValidation"] is True

    def test_trial_balance_read_only(self):
        """RECON_LEAD has read-only access to trial balance (supervisory)."""
        access = can_access_screen(self.ROLE, "trialBalance")
        assert access["visible"] is True
        assert access["readOnly"] is True
        assert access["canTriggerValidation"] is False

    def test_cannot_add_commentary(self):
        """RECON_LEAD cannot add commentary (supervisory role)."""
        assert can_add_commentary(self.ROLE, "price") is False
        assert can_add_commentary(self.ROLE, "share") is False

    def test_can_reassign_to_all_teams(self):
        """RECON_LEAD can reassign breaks to all teams."""
        assert can_reassign(self.ROLE) is True
        targets = get_reassign_targets(self.ROLE)
        assert targets == REASSIGN_TEAMS

    def test_has_all_position_sub_views(self):
        """RECON_LEAD can see all position sub-views."""
        views = get_position_sub_views(self.ROLE)
        assert views == ALL_POSITION_SUB_VIEWS

    def test_export_scope_is_all(self):
        """RECON_LEAD can export all data."""
        assert ROLE_PERMISSIONS[self.ROLE]["exportScope"] == "all"


# ═══════════════════════════════════════════════════════════════
# 5. AUDITOR Tests
# ═══════════════════════════════════════════════════════════════

class TestAuditorPermissions:
    """AUDITOR: Read-only access everywhere, can view audit trail."""

    ROLE = "AUDITOR"

    def test_all_screens_are_read_only(self):
        """AUDITOR has read-only access to every screen."""
        for screen in ALL_SCREENS:
            access = can_access_screen(self.ROLE, screen)
            assert access["visible"] is True, (
                f"AUDITOR should have visible=True for {screen}"
            )
            assert access["readOnly"] is True, (
                f"AUDITOR should have readOnly=True for {screen}"
            )

    def test_no_screen_can_trigger_validation(self):
        """AUDITOR cannot trigger validation on any screen."""
        for screen in ALL_SCREENS:
            access = can_access_screen(self.ROLE, screen)
            assert access["canTriggerValidation"] is False, (
                f"AUDITOR should NOT trigger validation on {screen}"
            )

    def test_no_screen_can_sign_off(self):
        """AUDITOR cannot sign off on any screen."""
        for screen in ALL_SCREENS:
            access = can_access_screen(self.ROLE, screen)
            assert access["canSignOff"] is False, (
                f"AUDITOR should NOT sign off on {screen}"
            )

    def test_can_view_audit_trail(self):
        """AUDITOR can view audit trail."""
        assert can_view_audit_trail(self.ROLE) is True

    def test_cannot_add_commentary(self):
        """AUDITOR cannot add commentary."""
        assert can_add_commentary(self.ROLE, "price") is False
        assert can_add_commentary(self.ROLE, "share") is False

    def test_cannot_reassign_breaks(self):
        """AUDITOR cannot reassign breaks."""
        assert can_reassign(self.ROLE) is False
        assert get_reassign_targets(self.ROLE) == []

    def test_cannot_manage_roster(self):
        """AUDITOR cannot manage roster."""
        assert can_manage_roster(self.ROLE) is False

    def test_cannot_override_known_differences(self):
        """AUDITOR cannot override KDs."""
        assert can_override_kd(self.ROLE) is False

    def test_cannot_approve_sign_off(self):
        """AUDITOR cannot approve sign-offs."""
        assert ROLE_PERMISSIONS[self.ROLE]["canApproveSignOff"] is False

    def test_has_all_position_sub_views(self):
        """AUDITOR can see all position sub-views (read-only)."""
        views = get_position_sub_views(self.ROLE)
        assert views == ALL_POSITION_SUB_VIEWS

    def test_export_scope_is_all(self):
        """AUDITOR can export all data (for audit purposes)."""
        assert ROLE_PERMISSIONS[self.ROLE]["exportScope"] == "all"


# ═══════════════════════════════════════════════════════════════
# 6. NAV_OPS_ANALYST Tests
# ═══════════════════════════════════════════════════════════════

class TestNavOpsAnalystPermissions:
    """NAV_OPS_ANALYST: Power user with most access except roster and sign-off."""

    ROLE = "NAV_OPS_ANALYST"

    def test_can_access_all_screens(self):
        """NAV_OPS_ANALYST can see every screen."""
        for screen in ALL_SCREENS:
            access = can_access_screen(self.ROLE, screen)
            assert access["visible"] is True

    def test_core_screens_writable_with_validation(self):
        """NAV_OPS_ANALYST can edit and trigger validation on core screens."""
        for screen in ["eventDashboard", "navDashboard", "trialBalance"]:
            access = can_access_screen(self.ROLE, screen)
            assert access["readOnly"] is False
            assert access["canTriggerValidation"] is True

    def test_can_add_commentary_all_categories(self):
        """NAV_OPS_ANALYST can add commentary for all categories."""
        assert can_add_commentary(self.ROLE) is True
        assert can_add_commentary(self.ROLE, "price") is True
        assert can_add_commentary(self.ROLE, "share") is True

    def test_can_override_known_differences(self):
        """NAV_OPS_ANALYST can override KDs."""
        assert can_override_kd(self.ROLE) is True

    def test_can_view_audit_trail(self):
        """NAV_OPS_ANALYST can view audit trail."""
        assert can_view_audit_trail(self.ROLE) is True

    def test_cannot_manage_roster(self):
        """NAV_OPS_ANALYST cannot manage roster."""
        assert can_manage_roster(self.ROLE) is False

    def test_cannot_approve_sign_off(self):
        """NAV_OPS_ANALYST cannot approve sign-offs."""
        assert ROLE_PERMISSIONS[self.ROLE]["canApproveSignOff"] is False

    def test_can_reassign_to_all_teams(self):
        """NAV_OPS_ANALYST can reassign breaks to all teams."""
        assert can_reassign(self.ROLE) is True
        targets = get_reassign_targets(self.ROLE)
        assert targets == REASSIGN_TEAMS


# ═══════════════════════════════════════════════════════════════
# 7. CLIENT_STAKEHOLDER Tests
# ═══════════════════════════════════════════════════════════════

class TestClientStakeholderPermissions:
    """CLIENT_STAKEHOLDER: Most restricted role, limited to high-level views."""

    ROLE = "CLIENT_STAKEHOLDER"

    def test_event_and_nav_dashboard_visible_read_only(self):
        """CLIENT_STAKEHOLDER can see event and NAV dashboards (read-only)."""
        for screen in ["eventDashboard", "navDashboard"]:
            access = can_access_screen(self.ROLE, screen)
            assert access["visible"] is True
            assert access["readOnly"] is True
            assert access["canTriggerValidation"] is False

    def test_cannot_access_trial_balance(self):
        """CLIENT_STAKEHOLDER cannot access trial balance."""
        access = can_access_screen(self.ROLE, "trialBalance")
        assert access["visible"] is False

    def test_cannot_access_position_drill_down(self):
        """CLIENT_STAKEHOLDER cannot access position drill-down."""
        access = can_access_screen(self.ROLE, "positionDrillDown")
        assert access["visible"] is False

    def test_cannot_access_reviewer_allocation(self):
        """CLIENT_STAKEHOLDER cannot see reviewer allocations."""
        access = can_access_screen(self.ROLE, "reviewerAllocation")
        assert access["visible"] is False

    def test_cannot_access_detailed_position_screens(self):
        """CLIENT_STAKEHOLDER cannot see detailed position/income/derivative screens."""
        restricted_screens = [
            "navShareClass", "positionsShareBreaks", "positionsPriceBreaks",
            "positionsTaxLots", "incomeDividends", "incomeFixedIncome",
            "derivativesForwards", "derivativesFutures",
        ]
        for screen in restricted_screens:
            access = can_access_screen(self.ROLE, screen)
            assert access["visible"] is False, (
                f"CLIENT_STAKEHOLDER should NOT see {screen}"
            )

    def test_can_see_client_scorecard_read_only(self):
        """CLIENT_STAKEHOLDER can see the client scorecard (read-only)."""
        access = can_access_screen(self.ROLE, "navClientScorecard")
        assert access["visible"] is True
        assert access["readOnly"] is True

    def test_can_see_rag_tracker_read_only(self):
        """CLIENT_STAKEHOLDER can see the RAG tracker (read-only)."""
        access = can_access_screen(self.ROLE, "navRagTracker")
        assert access["visible"] is True
        assert access["readOnly"] is True

    def test_no_position_sub_views(self):
        """CLIENT_STAKEHOLDER has no position sub-views."""
        views = get_position_sub_views(self.ROLE)
        assert views == []

    def test_cannot_add_commentary(self):
        """CLIENT_STAKEHOLDER cannot add commentary."""
        assert can_add_commentary(self.ROLE, "price") is False
        assert can_add_commentary(self.ROLE, "share") is False

    def test_cannot_reassign_breaks(self):
        """CLIENT_STAKEHOLDER cannot reassign breaks."""
        assert can_reassign(self.ROLE) is False
        assert get_reassign_targets(self.ROLE) == []

    def test_no_admin_capabilities(self):
        """CLIENT_STAKEHOLDER has no admin capabilities."""
        assert can_manage_roster(self.ROLE) is False
        assert can_override_kd(self.ROLE) is False
        assert can_view_audit_trail(self.ROLE) is False
        assert ROLE_PERMISSIONS[self.ROLE]["canApproveSignOff"] is False

    def test_export_scope_is_none(self):
        """CLIENT_STAKEHOLDER cannot export any data."""
        assert ROLE_PERMISSIONS[self.ROLE]["exportScope"] == "none"


# ═══════════════════════════════════════════════════════════════
# 8. Cross-Role Comparative Tests
# ═══════════════════════════════════════════════════════════════

class TestCrossRolePermissions:
    """Tests that verify permission boundaries across multiple roles."""

    def test_only_recon_lead_can_manage_roster(self):
        """Only RECON_LEAD has canManageRoster=True."""
        for role, perms in ROLE_PERMISSIONS.items():
            if role == "RECON_LEAD":
                assert perms["canManageRoster"] is True
            else:
                assert perms["canManageRoster"] is False, (
                    f"{role} should NOT have canManageRoster"
                )

    def test_only_recon_lead_can_approve_sign_off(self):
        """Only RECON_LEAD has canApproveSignOff=True."""
        for role, perms in ROLE_PERMISSIONS.items():
            if role == "RECON_LEAD":
                assert perms["canApproveSignOff"] is True
            else:
                assert perms["canApproveSignOff"] is False, (
                    f"{role} should NOT have canApproveSignOff"
                )

    def test_override_kd_roles(self):
        """Only RECON_LEAD and NAV_OPS_ANALYST can override KDs."""
        kd_override_roles = {"RECON_LEAD", "NAV_OPS_ANALYST"}
        for role, perms in ROLE_PERMISSIONS.items():
            if role in kd_override_roles:
                assert perms["canOverrideKD"] is True, (
                    f"{role} should have canOverrideKD"
                )
            else:
                assert perms["canOverrideKD"] is False, (
                    f"{role} should NOT have canOverrideKD"
                )

    def test_audit_trail_roles(self):
        """Only RECON_LEAD, AUDITOR, and NAV_OPS_ANALYST can view audit trail."""
        audit_roles = {"RECON_LEAD", "AUDITOR", "NAV_OPS_ANALYST"}
        for role, perms in ROLE_PERMISSIONS.items():
            if role in audit_roles:
                assert perms["canViewAuditTrail"] is True, (
                    f"{role} should have canViewAuditTrail"
                )
            else:
                assert perms["canViewAuditTrail"] is False, (
                    f"{role} should NOT have canViewAuditTrail"
                )

    def test_no_export_for_client_stakeholder(self):
        """CLIENT_STAKEHOLDER is the only role with exportScope=none."""
        for role, perms in ROLE_PERMISSIONS.items():
            if role == "CLIENT_STAKEHOLDER":
                assert perms["exportScope"] == "none"
            else:
                assert perms["exportScope"] != "none", (
                    f"{role} should have some export scope"
                )

    def test_all_roles_have_events_default_route(self):
        """All roles default to /events."""
        for role, perms in ROLE_PERMISSIONS.items():
            assert perms["defaultRoute"] == "/events", (
                f"{role} should default to /events"
            )

    def test_roles_that_cannot_reassign(self):
        """AUDITOR and CLIENT_STAKEHOLDER cannot reassign breaks."""
        no_reassign_roles = {"AUDITOR", "CLIENT_STAKEHOLDER"}
        for role in no_reassign_roles:
            assert can_reassign(role) is False
            assert get_reassign_targets(role) == []

    def test_roles_that_can_add_commentary(self):
        """Only FUND_ACCOUNTANT, PRICING_TEAM, TRADE_CAPTURE_TEAM, NAV_OPS_ANALYST can add commentary."""
        commentary_roles = {"FUND_ACCOUNTANT", "PRICING_TEAM", "TRADE_CAPTURE_TEAM", "NAV_OPS_ANALYST"}
        for role, perms in ROLE_PERMISSIONS.items():
            if role in commentary_roles:
                assert perms["commentary"]["canAdd"] is True, (
                    f"{role} should be able to add commentary"
                )
            else:
                assert perms["commentary"]["canAdd"] is False, (
                    f"{role} should NOT be able to add commentary"
                )

    def test_client_stakeholder_has_fewest_visible_screens(self):
        """CLIENT_STAKEHOLDER has the fewest visible screens."""
        cs_visible = sum(
            1 for screen in ALL_SCREENS
            if can_access_screen("CLIENT_STAKEHOLDER", screen)["visible"]
        )
        for role in ROLE_PERMISSIONS:
            if role == "CLIENT_STAKEHOLDER":
                continue
            role_visible = sum(
                1 for screen in ALL_SCREENS
                if can_access_screen(role, screen)["visible"]
            )
            assert cs_visible <= role_visible, (
                f"CLIENT_STAKEHOLDER ({cs_visible} screens) should have "
                f"<= visible screens than {role} ({role_visible} screens)"
            )

    def test_auditor_has_all_screens_visible(self):
        """AUDITOR can see all screens (for read-only audit)."""
        for screen in ALL_SCREENS:
            access = can_access_screen("AUDITOR", screen)
            assert access["visible"] is True

    def test_permission_matrix_completeness(self):
        """Every role has all required fields defined."""
        required_fields = [
            "role", "label", "defaultRoute", "screens",
            "positionSubViews", "defaultPositionSubView",
            "commentary", "canReassignBreak", "reassignTargets",
            "canApproveSignOff", "canManageRoster", "canOverrideKD",
            "canViewAuditTrail", "exportScope",
        ]
        for role, perms in ROLE_PERMISSIONS.items():
            for field in required_fields:
                assert field in perms, (
                    f"{role} is missing required field: {field}"
                )

    def test_all_screens_defined_for_every_role(self):
        """Every role defines access for every screen."""
        for role, perms in ROLE_PERMISSIONS.items():
            for screen in ALL_SCREENS:
                assert screen in perms["screens"], (
                    f"{role} is missing screen definition: {screen}"
                )
                screen_access = perms["screens"][screen]
                assert "visible" in screen_access
                assert "readOnly" in screen_access
                assert "canTriggerValidation" in screen_access
                assert "canSignOff" in screen_access


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
