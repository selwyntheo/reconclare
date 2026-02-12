## Why

The RECON-AI Control Center needs a complete four-screen progressive drill-down flow that takes analysts from a portfolio-level event view down through NAV comparison, trial balance ledger decomposition, and position-level detail. While basic screens exist (EventDashboard, EventDetail, LedgerSubledger components, FundBreakDetail), they lack the structured hierarchical navigation, inline cross-check validations, AI commentary integration, real-time updates, and the data granularity required for production parallel operations. This is needed now as the system enters the Production Parallel Phase with live fund administration data.

## What Changes

- **Replace Event Dashboard** with a card-based grid layout featuring status badges, fund progress bars, 7-day break trend sparklines, quick filters (status, date range, assigned-to-me, search), and a real-time activity feed panel
- **Add NAV Dashboard** screen (L0-L1) with AG-Grid Enterprise NAV Compare grid, expandable inline cross-check validations (Ledger BS Compare Check, Ledger INCST Compare Check), validation control panel with date picker and check suite selectors, and collapsible AI commentary panel
- **Add Trial Balance** screen (L1-L2) with categorized GL account comparison grid, expandable subledger compare checks, reconciliation roll-up summary with tie-out validation, and D3.js NAV waterfall chart with interactive click-to-filter
- **Add Position Drill-Down** screen (L2-L3) with category-context-aware position comparison grid (columns vary by GL category), expandable tax lot detail rows, basis lot check secondary validation, and position roll-up tie-out to GL category variance
- **Add Redux state management** with drill-down context slice, context propagation rules across screen transitions, and breadcrumb-encoded navigation state
- **Add WebSocket real-time updates** scoped to current drill-down context for validation completions, AI analysis results, and status transitions
- **Add AI commentary panels** at every drill-down level with trend summaries, pattern recognition, confidence scoring, and recommended next steps
- **Add validation execution pipeline** orchestrating 6 sequential checks (NAV to Ledger, Ledger BS to INCST, Ledger TF to Class, Ledger to Subledger, Position to Lot, Basis Lot Check) with derived subledger rollup computation
- **BREAKING**: Replaces current EventDashboard, EventDetail, and FundBreakDetail pages with new drill-down screens and routing structure

## Capabilities

### New Capabilities
- `event-dashboard`: Event cards grid with status badges, fund progress bars, sparkline trends, quick filters bar, activity feed panel, and run-validation action
- `nav-dashboard`: NAV Compare grid (AG-Grid Enterprise, server-side row model) with fund-level TNA comparison, expandable inline Ledger BS and INCST cross-check validations, validation control panel (date picker, check suite selector, fund filter), and AI commentary panel
- `trial-balance`: Categorized GL account comparison grid with incumbent vs BNY balances, expandable subledger compare checks per category, reconciliation roll-up summary with tie-out validation, and D3.js waterfall chart decomposing NAV variance into category contributions
- `position-drill-down`: Category-context-aware position comparison grid with dynamic columns per GL category, expandable tax lot detail rows with Incumbent/BNY/Variance tri-column pattern, basis lot check (primary vs non-primary basis), and position roll-up tie-out validation
- `drill-down-navigation`: Redux Toolkit state management with drillDown context slice, context propagation rules (set/preserve/clear per transition), breadcrumb navigation encoding filter state, and WebSocket subscriptions scoped to drill-down context for real-time updates
- `validation-pipeline`: Validation execution sequence orchestrating 6 checks in dependency order, derived subledger rollup computation per GL account using canonical model rules, and validation run progress tracking with per-fund status

### Modified Capabilities
_(No existing specs to modify)_

## Impact

- **Frontend routing**: New route structure — `/events` (dashboard), `/events/{eventId}/nav-dashboard` (NAV), `/events/{eventId}/funds/{account}/trial-balance` (ledger), `/events/{eventId}/funds/{account}/positions` (positions). Replaces current `/events/:eventId` and `/events/:eventId/funds/:fundAccount` routes.
- **Frontend state**: Introduces Redux Toolkit as state management layer (currently pure React hooks). Affects all drill-down screens and requires new store setup.
- **Frontend dependencies**: AG-Grid Enterprise (server-side row model), D3.js (waterfall chart), Redux Toolkit, WebSocket client library
- **Backend APIs**: New/updated endpoints for NAV compare data, ledger category breakdowns, position comparisons by category, tax lot detail, validation run orchestration, and derived subledger rollup computation. Extends existing `/api/funds/` and `/api/validation/` endpoint families.
- **Backend services**: Extends ValidationEngine with sequential check orchestration and DerivedSubledgerService with rollup computation logic per GL account mapping rules
- **Real-time infrastructure**: WebSocket server support on FastAPI backend for scoped subscription channels (event-level, fund-level, fund+category-level)
- **Performance**: Must meet sub-second render targets (< 1s for 500-row NAV grid, < 500ms for 30-category trial balance, < 1s for 1000-position grid, < 300ms for lot expansion)
- **Accessibility**: WCAG 2.1 AA compliance across all screens — keyboard navigation, ARIA live regions, 4.5:1 color contrast, icon+color for status indicators
