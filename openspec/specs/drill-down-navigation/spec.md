## ADDED Requirements

### Requirement: Drill-down state management via React Context
The system SHALL manage drill-down state using a DrillDownProvider (React Context + useReducer) wrapping the drill-down route subtree. The state shape SHALL include: context (eventId, eventName, account, accountName, valuationDt, category, assetId), navDashboard (funds, selectedFund, expandedRows, crossChecks), trialBalance (categories, selectedCategory, expandedRows, subledgerChecks, waterfallData), positionDrillDown (positions, selectedPosition, expandedRows, taxLots, basisLotCheck), and aiAnalysis (currentAnalysis, loading, history).

#### Scenario: DrillDownProvider wraps drill-down routes
- **WHEN** user navigates to any route under `/events`
- **THEN** the DrillDownProvider SHALL be mounted and provide state to all child drill-down screens

#### Scenario: State persists across drill-down levels
- **WHEN** user drills from NAV Dashboard to Trial Balance and back
- **THEN** the NAV Dashboard state (selectedFund, expandedRows) SHALL be preserved

### Requirement: Context propagation on forward navigation
The system SHALL propagate context when navigating forward through the drill-down. When navigating Event → NAV: the system SHALL SET eventId and eventName, and CLEAR account, category, assetId. When navigating NAV → Trial Balance: the system SHALL SET account and accountName, PRESERVE eventId and valuationDt, and CLEAR category and assetId. When navigating Trial Balance → Position: the system SHALL SET category, PRESERVE eventId, account, and valuationDt, and CLEAR assetId.

#### Scenario: Event to NAV sets event context
- **WHEN** user clicks event EVT-001 "Vanguard Migration" on the Event Dashboard
- **THEN** context SHALL be updated to eventId="EVT-001", eventName="Vanguard Migration", and account/category/assetId SHALL be null

#### Scenario: NAV to Trial Balance sets fund context
- **WHEN** user double-clicks fund AC0002 "Fixed Income Fund" on the NAV Dashboard
- **THEN** context SHALL be updated to account="AC0002", accountName="Fixed Income Fund", eventId and valuationDt SHALL be preserved, and category/assetId SHALL be null

#### Scenario: Trial Balance to Position sets category context
- **WHEN** user double-clicks category "Investment Urgl" on the Trial Balance
- **THEN** context SHALL be updated to category="Investment Urgl", eventId/account/valuationDt SHALL be preserved, and assetId SHALL be null

### Requirement: Context propagation on back navigation
When navigating backward (via breadcrumb or browser back), the system SHALL preserve all parent-level context and clear child-level context.

#### Scenario: Back from Position to Trial Balance clears position context
- **WHEN** user clicks the "Trial Balance" breadcrumb from Position Drill-Down
- **THEN** category context SHALL be preserved, assetId SHALL be cleared, and the Trial Balance SHALL restore with previous state

#### Scenario: Back from Trial Balance to NAV clears category context
- **WHEN** user clicks the "Events > {Event Name}" breadcrumb from Trial Balance
- **THEN** eventId and valuationDt SHALL be preserved, account and category SHALL be cleared, and NAV Dashboard SHALL restore with previous state

### Requirement: Breadcrumb navigation
The system SHALL render breadcrumb navigation at the top of each drill-down screen. Breadcrumbs SHALL be derived from the current route hierarchy and the DrillDownProvider's context state (display names). Each breadcrumb segment SHALL be a clickable link that navigates to the parent screen with context preserved.

#### Scenario: Trial Balance breadcrumb navigation
- **WHEN** user is on Trial Balance for AC0002 in event EVT-001
- **THEN** breadcrumb SHALL show "Events > Vanguard Fixed Income Migration > AC0002 Fund > Trial Balance" where each segment before the current one is a clickable link

#### Scenario: Click breadcrumb navigates to parent
- **WHEN** user clicks "Vanguard Fixed Income Migration" in the breadcrumb from Position Drill-Down
- **THEN** the system SHALL navigate to `/events/EVT-001/nav-dashboard?valuationDt={date}` with fund selection preserved

### Requirement: Real-time updates via SSE
The system SHALL subscribe to Server-Sent Events scoped to the current drill-down context. Event Dashboard: subscribe to all events in user's scope. NAV Dashboard: subscribe to validation updates for the current event. Trial Balance: subscribe to AI analysis updates for the current fund. Position Drill-Down: subscribe to AI analysis for current fund + category. When a validation run completes or AI analysis finishes, affected grid rows SHALL update in-place without full page refresh. New break status indicators SHALL animate briefly (pulse effect) to draw attention.

#### Scenario: SSE subscription established on NAV Dashboard
- **WHEN** user navigates to NAV Dashboard for event EVT-001
- **THEN** the system SHALL establish an SSE connection to `/api/events/EVT-001/sse` for real-time validation updates

#### Scenario: SSE subscription re-established on navigation
- **WHEN** user navigates from NAV Dashboard to Trial Balance
- **THEN** the previous SSE subscription SHALL be closed and a new subscription SHALL be established scoped to the current fund context

#### Scenario: Validation completion updates grid in real-time
- **WHEN** a validation run completes while user is on NAV Dashboard
- **THEN** affected fund rows SHALL update their validation status in-place and new break indicators SHALL pulse briefly

#### Scenario: SSE latency meets performance target
- **WHEN** a server event is emitted
- **THEN** the UI update SHALL occur within 200ms of the server event

### Requirement: Drill-down route structure
The system SHALL implement the following route structure under the MainLayout: `/events` (EventDashboard), `/events/:eventId/nav-dashboard` (NavDashboard), `/events/:eventId/funds/:account/trial-balance` (TrialBalance), `/events/:eventId/funds/:account/positions` (PositionDrillDown). The existing routes `/events/:eventId/runs/:runId` (ValidationRunView), `/review`, `/ledger-mapping`, and `/gl-account-mapping` SHALL be preserved unchanged.

#### Scenario: Route renders correct screen
- **WHEN** user navigates to `/events/EVT-001/funds/AC0002/trial-balance?valuationDt=2026-02-10`
- **THEN** the TrialBalance component SHALL render with eventId="EVT-001", account="AC0002", and valuationDt="2026-02-10"

#### Scenario: Non-drill-down routes preserved
- **WHEN** user navigates to `/ledger-mapping`
- **THEN** the LedgerMapping screen SHALL render unchanged

### Requirement: WCAG 2.1 AA accessibility
All drill-down screens SHALL comply with WCAG 2.1 AA. This includes: full keyboard navigation (Tab through grid rows, Enter to expand, Escape to collapse, Arrow keys for cell navigation), screen reader support (ARIA live regions for validation status changes, AI analysis updates, and real-time feed items), color contrast (4.5:1 minimum for all text), dual-signal validation status (both color AND icon: checkmark for pass, warning triangle for marginal, X for fail), and visible focus indicators on all interactive elements (per WCAG 2.4.7).

#### Scenario: Keyboard navigation in grid
- **WHEN** user presses Tab to reach a grid row and then presses Enter
- **THEN** the row SHALL expand to show detail content, and pressing Escape SHALL collapse it

#### Scenario: Validation status uses dual signal
- **WHEN** a validation status is "break"
- **THEN** the indicator SHALL display both a red color AND an X icon, ensuring accessibility for color-blind users

#### Scenario: Screen reader announces validation updates
- **WHEN** a validation status changes in real-time
- **THEN** an ARIA live region SHALL announce the change to screen readers

#### Scenario: Color contrast meets minimum ratio
- **WHEN** any text is rendered on the drill-down screens
- **THEN** the text SHALL have a minimum contrast ratio of 4.5:1 against its background
