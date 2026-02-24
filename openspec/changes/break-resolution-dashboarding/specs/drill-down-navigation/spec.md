## ADDED Requirements

### Requirement: New view routes
The system SHALL implement the following additional routes under the MainLayout, extending the existing drill-down route structure: `/events/:eventId/allocations` (ReviewerAllocation), `/events/:eventId/nav-dashboard/share-class/:account` (NavShareClass), `/events/:eventId/nav-dashboard/scorecard` (NavClientScorecard), `/events/:eventId/nav-dashboard/rag-tracker` (NavRagTracker), `/events/:eventId/funds/:account/positions/share-breaks` (PositionsShareBreaks), `/events/:eventId/funds/:account/positions/price-breaks` (PositionsPriceBreaks), `/events/:eventId/funds/:account/positions/tax-lots` (PositionsTaxLots), `/events/:eventId/income/dividends` (IncomeDividends — all funds), `/events/:eventId/funds/:account/income/dividends` (IncomeDividends — specific fund), `/events/:eventId/income/fixed-income` (IncomeFixedIncome — all funds), `/events/:eventId/funds/:account/income/fixed-income` (IncomeFixedIncome — specific fund), `/events/:eventId/derivatives/forwards` (DerivativesForwards — all funds), `/events/:eventId/funds/:account/derivatives/forwards` (DerivativesForwards — specific fund), `/events/:eventId/derivatives/futures` (DerivativesFutures — all funds), `/events/:eventId/funds/:account/derivatives/futures` (DerivativesFutures — specific fund). All new page components SHALL be lazy-loaded using `React.lazy()` with a `Suspense` fallback.

#### Scenario: New routes render correct components
- **WHEN** user navigates to `/events/EVT-001/nav-dashboard/scorecard?valuationDt=2026-02-10`
- **THEN** the NavClientScorecard component SHALL render with eventId="EVT-001" and valuationDt="2026-02-10"

#### Scenario: Fund-scoped and event-scoped income routes both work
- **WHEN** user navigates to `/events/EVT-001/income/dividends?valuationDt=2026-02-10`
- **THEN** the IncomeDividends component SHALL render showing all funds
- **WHEN** user navigates to `/events/EVT-001/funds/AC0001/income/dividends?valuationDt=2026-02-10`
- **THEN** the IncomeDividends component SHALL render showing only fund AC0001

#### Scenario: Lazy loading with fallback
- **WHEN** user navigates to a new view for the first time
- **THEN** the system SHALL display the LoadingFallback spinner while the component chunk loads

### Requirement: Extended breadcrumb navigation
The breadcrumb navigation SHALL support the new views with the following patterns: Reviewer Allocation: "Events > {Event Name} > Reviewer Allocation". Share Class: "Events > {Event Name} > NAV Dashboard > {Account Name} Share Classes". Client Scorecard: "Events > {Event Name} > Client Scorecard". RAG Tracker: "Events > {Event Name} > RAG Status Tracker". Share Breaks: "Events > {Event Name} > {Fund Name} > Positions > Share Breaks". Price Breaks: "Events > {Event Name} > {Fund Name} > Positions > Price Breaks". Tax Lots: "Events > {Event Name} > {Fund Name} > Positions > Tax Lots". Dividends: "Events > {Event Name} > [Fund Name >] Income > Dividends". Fixed Income: "Events > {Event Name} > [Fund Name >] Income > Fixed Income". Forwards: "Events > {Event Name} > [Fund Name >] Derivatives > Forwards". Futures: "Events > {Event Name} > [Fund Name >] Derivatives > Futures".

#### Scenario: Share Breaks breadcrumb
- **WHEN** user is on Share Breaks for fund AC0001 in event EVT-001
- **THEN** breadcrumb SHALL display "Events > Vanguard Migration > AC0001 Fund > Positions > Share Breaks"

#### Scenario: All-funds income breadcrumb
- **WHEN** user is on Dividends view for all funds in event EVT-001
- **THEN** breadcrumb SHALL display "Events > Vanguard Migration > Income > Dividends"

#### Scenario: Fund-specific income breadcrumb
- **WHEN** user is on Dividends view for fund AC0001 in event EVT-001
- **THEN** breadcrumb SHALL display "Events > Vanguard Migration > AC0001 Fund > Income > Dividends"

### Requirement: Extended context propagation
The DrillDownProvider context state SHALL be extended to include: shareClassView (shareClasses, selectedShareClass), scorecardView (scorecardData, kdColumns, overrides), ragTrackerView (ragMatrix), positionSubView (activeSubView: "full" | "share-breaks" | "price-breaks" | "tax-lots"), incomeView (dividends, fixedIncome, drilldownLevel), and derivativesView (forwards, futures). Context propagation rules: NAV Dashboard → Share Class: SET account, PRESERVE eventId/valuationDt. NAV Dashboard → Scorecard: PRESERVE eventId/valuationDt. NAV Dashboard → RAG Tracker: PRESERVE eventId. Positions → Share/Price Breaks: PRESERVE all parent context, SET activeSubView. Fund → Income: SET account, PRESERVE eventId/valuationDt. Fund → Derivatives: SET account, PRESERVE eventId/valuationDt.

#### Scenario: Context preserved navigating to Share Breaks
- **WHEN** user navigates from Full Portfolio to Share Breaks for fund AC0001
- **THEN** eventId, account, and valuationDt SHALL be preserved and activeSubView SHALL be set to "share-breaks"

#### Scenario: Context cleared returning from derivatives to fund
- **WHEN** user clicks the fund breadcrumb from the Forwards view
- **THEN** derivatives context SHALL be cleared and the Trial Balance SHALL restore with previous state

### Requirement: WebSocket subscription for new views
The system SHALL establish WebSocket connections for all new views scoped to the appropriate context. Reviewer Allocation: subscribe to allocation changes for the event. Client Scorecard: subscribe to KD overrides, review status changes, and commentary rollup updates. RAG Tracker: subscribe to adjusted BP recalculations. Position sub-views: subscribe to break assignment and commentary changes. Income/Derivatives views: subscribe to break assignment changes.

#### Scenario: WebSocket established for Client Scorecard
- **WHEN** user navigates to the Client Scorecard
- **THEN** the system SHALL establish a WebSocket connection scoped to the event for real-time KD override and review status updates

#### Scenario: WebSocket subscription switches on navigation
- **WHEN** user navigates from NAV Dashboard to Reviewer Allocation
- **THEN** the previous WebSocket subscription SHALL be closed and a new subscription SHALL be established for allocation change events

### Requirement: RBAC integration for new views
All new views SHALL integrate with the existing RBAC permission matrix. The `RolePermissions.screens` object SHALL be extended with entries for each new view. Route rendering SHALL check `canAccessScreen()` before rendering components. Unauthorized users SHALL be redirected to their `defaultRoute`.

#### Scenario: Client Stakeholder accesses scorecard
- **WHEN** a user with CLIENT_STAKEHOLDER role navigates to the Client Scorecard
- **THEN** the system SHALL render the scorecard in read-only mode (no edit controls, sign-off disabled)

#### Scenario: Unauthorized access redirected
- **WHEN** a Trade Capture Analyst attempts to navigate to the Reviewer Allocation screen
- **THEN** the system SHALL redirect to their defaultRoute since roster management is restricted to Conversion Managers

## MODIFIED Requirements

### Requirement: Drill-down route structure
The system SHALL implement the following route structure under the MainLayout: `/events` (EventDashboard), `/events/:eventId/nav-dashboard` (NavDashboard), `/events/:eventId/nav-dashboard/share-class/:account` (NavShareClass), `/events/:eventId/nav-dashboard/scorecard` (NavClientScorecard), `/events/:eventId/nav-dashboard/rag-tracker` (NavRagTracker), `/events/:eventId/allocations` (ReviewerAllocation), `/events/:eventId/funds/:account/trial-balance` (TrialBalance), `/events/:eventId/funds/:account/positions` (PositionDrillDown), `/events/:eventId/funds/:account/positions/share-breaks` (PositionsShareBreaks), `/events/:eventId/funds/:account/positions/price-breaks` (PositionsPriceBreaks), `/events/:eventId/funds/:account/positions/tax-lots` (PositionsTaxLots), `/events/:eventId/funds/:account/income/dividends` (IncomeDividends), `/events/:eventId/funds/:account/income/fixed-income` (IncomeFixedIncome), `/events/:eventId/funds/:account/derivatives/forwards` (DerivativesForwards), `/events/:eventId/funds/:account/derivatives/futures` (DerivativesFutures), `/events/:eventId/income/dividends` (IncomeDividends — all funds), `/events/:eventId/income/fixed-income` (IncomeFixedIncome — all funds), `/events/:eventId/derivatives/forwards` (DerivativesForwards — all funds), `/events/:eventId/derivatives/futures` (DerivativesFutures — all funds). The existing routes `/events/:eventId/runs/:runId` (ValidationRunView), `/review`, `/ledger-mapping`, and `/gl-account-mapping` SHALL be preserved unchanged.

#### Scenario: Route renders correct screen
- **WHEN** user navigates to `/events/EVT-001/funds/AC0002/trial-balance?valuationDt=2026-02-10`
- **THEN** the TrialBalance component SHALL render with eventId="EVT-001", account="AC0002", and valuationDt="2026-02-10"

#### Scenario: New sub-view routes render correctly
- **WHEN** user navigates to `/events/EVT-001/funds/AC0001/positions/share-breaks?valuationDt=2026-02-10`
- **THEN** the PositionsShareBreaks component SHALL render with eventId="EVT-001", account="AC0001", and valuationDt="2026-02-10"

#### Scenario: Non-drill-down routes preserved
- **WHEN** user navigates to `/ledger-mapping`
- **THEN** the LedgerMapping screen SHALL render unchanged

### Requirement: Drill-down state management via React Context
The system SHALL manage drill-down state using a DrillDownProvider (React Context + useReducer) wrapping the drill-down route subtree. The state shape SHALL include: context (eventId, eventName, account, accountName, valuationDt, category, assetId), navDashboard (funds, selectedFund, expandedRows, crossChecks), trialBalance (categories, selectedCategory, expandedRows, subledgerChecks, waterfallData), positionDrillDown (positions, selectedPosition, expandedRows, taxLots, basisLotCheck), aiAnalysis (currentAnalysis, loading, history), shareClassView (shareClasses, selectedShareClass), scorecardView (scorecardData, kdColumns, overrides), ragTrackerView (ragMatrix), positionSubView (activeSubView), incomeView (dividends, fixedIncome, drilldownLevel), and derivativesView (forwards, futures).

#### Scenario: DrillDownProvider wraps drill-down routes
- **WHEN** user navigates to any route under `/events`
- **THEN** the DrillDownProvider SHALL be mounted and provide state to all child drill-down screens including new views

#### Scenario: State persists across drill-down levels
- **WHEN** user drills from NAV Dashboard to Trial Balance and back
- **THEN** the NAV Dashboard state (selectedFund, expandedRows) SHALL be preserved

#### Scenario: New view state managed in context
- **WHEN** user navigates from NAV Dashboard to Client Scorecard and back
- **THEN** the scorecardView state (kdColumns, overrides) SHALL be preserved
