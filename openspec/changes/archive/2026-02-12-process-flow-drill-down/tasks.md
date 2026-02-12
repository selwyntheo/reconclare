## 1. Foundation: Shared Components, Types, and State Management

- [x] 1.1 Define TypeScript interfaces for all drill-down data types: NavCompareRow, CrossCheckResult, TrialBalanceCategoryRow, SubledgerCheckResult, PositionCompareRow, TaxLotRow, BasisLotRow, WaterfallBar, and SSE event types in `frontend/src/types/index.ts`
- [x] 1.2 Create DrillDownProvider context and drillDownReducer in `frontend/src/context/DrillDownContext.tsx` implementing the full state shape (context, navDashboard, trialBalance, positionDrillDown, aiAnalysis slices) with actions for context propagation (setEvent, setFund, setCategory, clearChildContext, goBack)
- [x] 1.3 Create `<ValidationStatus>` shared component in `frontend/src/components/shared/ValidationStatus.tsx` rendering dual-signal indicators (color + icon: green checkmark, amber warning triangle, red X) with configurable threshold and marginalThreshold props
- [x] 1.4 Create `<DrillDownBreadcrumb>` shared component in `frontend/src/components/shared/DrillDownBreadcrumb.tsx` that reads DrillDownContext and renders MUI Breadcrumbs with clickable navigation links preserving parent context
- [x] 1.5 Create `useSSE` custom hook in `frontend/src/hooks/useSSE.ts` wrapping native EventSource API with auto-reconnect, scoped subscription by eventId/account, and event parsing for validation_progress, validation_complete, ai_analysis_complete event types
- [x] 1.6 Create `<AICommentaryPanel>` shared component in `frontend/src/components/shared/AICommentaryPanel.tsx` as a collapsible right-hand sidebar (350px default, resizable drag handle) with sections: Trend Summary, Pattern Recognition, Confidence Score gauge, Recommended Next Step. Content adapts based on drill-down level prop

## 2. Routing and Layout Updates

- [x] 2.1 Update `frontend/src/App.tsx` route structure: replace `/events/:eventId` with `/events/:eventId/nav-dashboard`, replace `/events/:eventId/funds/:fundAccount` with `/events/:eventId/funds/:account/trial-balance` and `/events/:eventId/funds/:account/positions`. Preserve `/events/:eventId/runs/:runId`, `/review`, `/ledger-mapping`, `/gl-account-mapping` routes unchanged
- [x] 2.2 Wrap the drill-down route subtree (EventDashboard, NavDashboard, TrialBalance, PositionDrillDown) with DrillDownProvider in the route configuration
- [x] 2.3 Update `frontend/src/layouts/MainLayout.tsx` sidebar navigation to reflect new route paths (Events → `/events`, remove or update any links pointing to old EventDetail/FundBreakDetail routes)

## 3. Backend: Comparison API Endpoints

- [x] 3.1 Create `GET /api/events/{eventId}/nav-compare` endpoint in `backend/api/main.py` that joins dataNav records (isPrimaryBasis='Y') for incumbent and BNY userBank on (valuationDt, account, class), aggregates by account, and returns rows with incumbentTNA, bnyTNA, tnaDifference, tnaDifferenceBP, validationStatus
- [x] 3.2 Create `GET /api/events/{eventId}/nav-compare/{account}/cross-checks` endpoint returning Ledger BS Compare Check (ledger BS sum vs NAV netAssets) and Ledger INCST Compare Check (ledger INCST sum vs BS remainder) with differences and validation statuses
- [x] 3.3 Create `GET /api/funds/{account}/trial-balance-compare` endpoint that groups dataLedger by GL category for both incumbent and BNY, returns per-category incumbentBalance, bnyBalance, balanceDiff, balanceDiffBP, validationStatus
- [x] 3.4 Create `GET /api/funds/{account}/trial-balance-compare/{category}/subledger-check` endpoint returning ledger endingBalance vs derived subledger rollup value for the specified category with difference and validation status
- [x] 3.5 Create `GET /api/funds/{account}/position-compare` endpoint that joins dataSubLedgerPosition for incumbent and BNY on (valuationDt, account, shareClass, assetId, longShortInd), filtered by GL category, with category-context-aware comparison fields
- [x] 3.6 Create `GET /api/funds/{account}/position-compare/{assetId}/tax-lots` endpoint returning tax lot detail from dataSubLedgerTrans joined on transactionId with Incumbent/BNY/Variance per field
- [x] 3.7 Create `GET /api/funds/{account}/basis-lot-check` endpoint comparing shares between isPrimaryBasis='Y' and isPrimaryBasis<>'Y' per assetId
- [x] 3.8 Create `GET /api/events/{eventId}/available-dates` endpoint returning distinct valuation dates that have validation run data for the event
- [x] 3.9 Create `GET /api/ai/analysis` endpoint that aggregates AI insights by scope (eventId, account, category) for the AI Commentary panel

## 4. Backend: SSE and Sequential Validation

- [x] 4.1 Create `GET /api/events/{eventId}/sse` SSE endpoint using FastAPI StreamingResponse that yields Server-Sent Events scoped to the event. Implement asyncio queue mechanism for pushing validation_progress, validation_complete, ai_analysis_complete, and status_change events
- [x] 4.2 Create `POST /api/validation/run-sequential` endpoint that orchestrates 6 validation checks in dependency order (NAV→LedgerBS→LedgerTF→Subledger→Position→BasisLot), respects check dependencies, emits SSE progress events per fund/check, and skips downstream checks if a dependency fails
- [x] 4.3 Add MongoDB compound indexes on (valuationDt, account, userBank) for dataNav, dataLedger, and dataSubLedgerPosition collections to support comparison query performance

## 5. Frontend API Service Layer

- [x] 5.1 Add `fetchNavCompare(eventId, valuationDt)` function to `frontend/src/services/api.ts`
- [x] 5.2 Add `fetchNavCrossChecks(eventId, account, valuationDt)` function to `frontend/src/services/api.ts`
- [x] 5.3 Add `fetchTrialBalanceCompare(account, valuationDt)` function to `frontend/src/services/api.ts`
- [x] 5.4 Add `fetchSubledgerCheck(account, category, valuationDt)` function to `frontend/src/services/api.ts`
- [x] 5.5 Add `fetchPositionCompare(account, valuationDt, category)` function to `frontend/src/services/api.ts`
- [x] 5.6 Add `fetchTaxLots(account, assetId, valuationDt)` function to `frontend/src/services/api.ts`
- [x] 5.7 Add `fetchBasisLotCheck(account, valuationDt)` function to `frontend/src/services/api.ts`
- [x] 5.8 Add `fetchAvailableDates(eventId)` and `fetchAIAnalysis(eventId, account?, category?)` functions to `frontend/src/services/api.ts`
- [x] 5.9 Add `runSequentialValidation(eventId, valuationDt, checkSuite, fundSelection?)` function to `frontend/src/services/api.ts`

## 6. Screen: Event Dashboard

- [x] 6.1 Rewrite `frontend/src/pages/EventDashboard/EventDashboard.tsx` with card-based responsive grid layout. Each event card renders: Event Name + ID, Status Badge (DRAFT=gray, ACTIVE=blue, PARALLEL=amber, SIGNED_OFF=green, COMPLETE=teal), Incumbent Provider, Target Go-Live with countdown, Last Validation timestamp, and Quick Action buttons [Run Validation] and [View Details]
- [x] 6.2 Add Fund Progress Bar component to event cards showing passed (green) / attention (amber) / failed (red) segments with "X of Y funds passed" label
- [x] 6.3 Add 7-Day Break Trend sparkline to event cards using Recharts LineChart mini-chart showing trailing 7 valuation dates of break counts
- [x] 6.4 Add Quick Filters Bar above the cards grid: Status multi-select chips, Date Range picker, Assigned To Me toggle, and Search text field with full-text filtering across event name, fund names, incumbent provider
- [x] 6.5 Add Activity Feed right panel component showing chronological feed items (validation completions, AI analysis, human reviews, status changes) with clickable navigation to context-specific routes. Connect to SSE for real-time updates
- [x] 6.6 Add Run Validation modal triggered by [Run Validation] card button: date picker, check suite multi-select (6 checks, all checked by default), fund filter (All Funds / Selected Only)
- [x] 6.7 Wire event card click and [View Details] button to navigate to `/events/{eventId}/nav-dashboard` and dispatch setEvent action to DrillDownContext

## 7. Screen: NAV Dashboard

- [x] 7.1 Create `frontend/src/pages/NavDashboard/NavDashboard.tsx` page component with DrillDownBreadcrumb ("Events > {Event Name}"), Validation Control Panel (sticky top), NAV Compare AG-Grid, and AI Commentary Panel (right sidebar)
- [x] 7.2 Implement Validation Control Panel: Valuation Date picker (defaults to most recent, dot indicators for dates with runs via fetchAvailableDates), Check Suite multi-select checkboxes (6 checks), Fund Filter (All/Selected radio with searchable picker), Run Validation button with progress bar, Schedule button (opens placeholder modal)
- [x] 7.3 Implement NAV Compare AG-Grid with columns: Valuation Dt, Account, Account Name, Incumbent TNA, BNY TNA, TNA Difference (red for negative), TNA Difference BP, Validation (ValidationStatus component). Default sort: breaks first, then |TNA Difference| descending. Single-click selects row (updates AI panel), double-click navigates to Trial Balance
- [x] 7.4 Implement expandable row detail renderer for cross-check validations: on chevron expand, render MUI Table showing Ledger BS Compare Check and Ledger INCST Compare Check tables with Incumbent/BNY/Difference/Validation columns, data fetched via fetchNavCrossChecks
- [x] 7.5 Integrate AICommentaryPanel with NAV Dashboard: pass current selected fund context, fetch AI analysis, display fund-level trend summary and pattern recognition
- [x] 7.6 Wire Run Validation button to call runSequentialValidation and subscribe to SSE progress events to show "Processing fund N of M..." in the button/progress area
- [x] 7.7 Implement right-click context menu with Export to Excel option for the NAV Compare grid
- [x] 7.8 Connect SSE subscription (useSSE hook) scoped to current eventId for real-time row updates with pulse animation on status changes

## 8. Screen: Trial Balance

- [x] 8.1 Create `frontend/src/pages/TrialBalance/TrialBalance.tsx` page component with DrillDownBreadcrumb ("Events > {Event Name} > {Fund Name} > Trial Balance"), Context Header bar, Waterfall Chart, Ledger BS Compare AG-Grid, and AI Commentary Panel
- [x] 8.2 Implement Context Header showing: Fund name (account), Valuation Date, NAV Variance amount + BP + traffic light, AI Status badge
- [x] 8.3 Implement Ledger BS Compare AG-Grid with columns: Valuation Dt, Account, Category, Incumbent Balance, BNY Balance, Balance Diff (parenthesized if negative), Balance Diff BP, Validation. Data fetched via fetchTrialBalanceCompare. Double-click category row navigates to Position Drill-Down
- [x] 8.4 Implement expandable row detail renderer for Subledger Compare Check: on chevron expand, render MUI Table showing Ledger value vs Subledger Rollup value with difference and validation status, data fetched via fetchSubledgerCheck
- [x] 8.5 Implement Reconciliation Roll-Up Summary footer: Total Incumbent Balance, Total BNY Balance, Total Variance, and Tie-Out Validation check comparing total variance to NAV TNA Difference (green pass or warning with discrepancy amount)
- [x] 8.6 Create `<WaterfallChart>` component using Recharts BarChart with stacked bars (transparent base + colored delta). Starting bar = Incumbent NAV, component bars = category variances (green positive, red negative), ending bar = BNY NAV. Click handler highlights corresponding grid row. Tooltip shows category name, amount, % of total variance
- [x] 8.7 Integrate AICommentaryPanel with Trial Balance: pass category-level context, show variance driver identification, position-level correlation, upward propagation commentary, and drill-down priority suggestions
- [x] 8.8 Implement Export to Excel for full trial balance with subledger detail

## 9. Screen: Position Drill-Down

- [x] 9.1 Create `frontend/src/pages/PositionDrillDown/PositionDrillDown.tsx` page component with DrillDownBreadcrumb ("Events > {Event Name} > {Fund Name} > Trial Balance > {Category} Positions"), Context Header, Position Compare AG-Grid, and AI Commentary Panel
- [x] 9.2 Implement Context Header showing: Fund name (account), Valuation Date, Category name, Category Variance amount + BP, NAV Variance (fund-level reference)
- [x] 9.3 Implement Position Compare AG-Grid with core columns (Asset ID, Security Type, Issue Description, CUSIP, Long/Short, Share Class) and category-context-aware comparison columns: dynamically render Incumbent/BNY/Variance tri-columns based on current category (Investment Cost → cost fields, Investment Urgl → unrealized fields, Interest RecPay → income fields, etc.). Data fetched via fetchPositionCompare
- [x] 9.4 Implement expandable row detail renderer for Tax Lot Detail: on chevron expand, render MUI Table with lot columns (Transaction ID, Lot Trade Date, Lot Settle Date, Shares, Original Face, Orig Cost, Book Value, Market Value, Income, Broker Code) in Incumbent/BNY/Variance pattern, data fetched via fetchTaxLots
- [x] 9.5 Implement Basis Lot Check tab/toggle: switch grid to show primary vs non-primary basis shares per position with variance, data fetched via fetchBasisLotCheck
- [x] 9.6 Implement Position Roll-Up Validation footer: Sum of Position Variances vs GL Category Variance with tie-out pass/fail indicator
- [x] 9.7 Implement Security Reference Detail modal: clickable Asset ID/CUSIP links open MUI Dialog showing refSecurity fields
- [x] 9.8 Integrate AICommentaryPanel with Position Drill-Down: pass position-level context, show root cause per security, lot anomaly detection, cross-position pattern recognition, resolution recommendations, confidence scoring
- [x] 9.9 Implement "Request Analysis" action button that triggers AI analysis for selected position and updates the AI panel on completion
- [x] 9.10 Implement Export to Excel for position grid with expanded lot detail

## 10. Integration and Polish

- [x] 10.1 Wire all navigation flows end-to-end: Event card click → NAV Dashboard → double-click fund → Trial Balance → double-click category → Position Drill-Down, with context propagation and breadcrumb back-navigation working correctly at each transition
- [x] 10.2 Implement code splitting with React.lazy() for all four drill-down page components to reduce initial bundle size
- [x] 10.3 Verify WCAG 2.1 AA compliance: keyboard navigation (Tab/Enter/Escape/Arrow in grids), ARIA live regions for real-time status updates, 4.5:1 color contrast, visible focus indicators on all interactive elements
- [x] 10.4 Performance validation: Event Dashboard < 2s FCP, NAV grid < 1s (500 rows), Trial Balance < 500ms (30 categories), Position grid < 1s (1000 positions), tax lot expansion < 300ms, cross-check expansion < 200ms, waterfall render < 200ms, SSE latency < 200ms
- [x] 10.5 Remove or archive old page components (EventDetail, FundBreakDetail) that are replaced by the new drill-down screens, ensuring no broken imports or dead code remains
