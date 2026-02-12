## Context

The RECON-AI Control Center is a React 19 + TypeScript frontend with a FastAPI + MongoDB backend. The frontend currently uses pure React hooks for state management, MUI v7 for UI components, ag-grid-community for grids, Recharts for charts, and React Router v7 for routing. The backend provides REST endpoints for events, validation runs, breaks, and ledger/subledger data via MongoDB (motor async driver), with AI analysis via LangChain/LangGraph.

Existing screens (EventDashboard, EventDetail, FundBreakDetail, LedgerSubledger components) provide basic views but lack the structured four-level hierarchical drill-down with inline cross-check validations, contextual AI commentary, and real-time updates required for production parallel operations.

Key constraints:
- Must maintain compatibility with existing LedgerMapping and GLAccountMapping screens (not part of this change)
- MongoDB is the canonical data store; all validation data lives in existing collections (dataNav, dataLedger, dataSubLedgerPosition, dataSubLedgerTrans)
- The DerivedSubledgerService and ValidationEngine already exist and compute subledger rollups and validation checks
- AG-Grid Community is already installed (v35); Enterprise upgrade is needed for server-side row model
- Must support 500+ fund rows, 1000+ position rows with sub-second rendering

## Goals / Non-Goals

**Goals:**
- Implement a four-screen progressive drill-down: Event Dashboard → NAV Dashboard → Trial Balance → Position Drill-Down
- Each screen narrows analytical scope and increases data granularity (Event → Fund → GL Category → Position/Lot)
- Provide inline expandable cross-check validations at every level
- Integrate AI commentary panels with trend summaries and root cause analysis
- Support real-time updates for validation completions and AI analysis via WebSocket
- Meet sub-second performance targets for all screen loads and interactions
- Achieve WCAG 2.1 AA accessibility compliance

**Non-Goals:**
- Rewriting the LedgerMapping or GLAccountMapping screens
- Changing the underlying MongoDB data model or collection structure
- Replacing the existing AI analysis engine (LangChain/LangGraph)
- Mobile-responsive layouts (desktop-first operational tool)
- User authentication/authorization (handled separately)
- Automated scheduling infrastructure (the Schedule button opens a modal but backend scheduling is deferred)

## Decisions

### D1: State Management — React Context + useReducer (not Redux Toolkit)

**Decision**: Use React Context with useReducer for the drill-down state instead of Redux Toolkit.

**Rationale**: The rest of the application uses React hooks exclusively. Introducing Redux Toolkit for one flow creates a split architecture where some screens use Redux and others use local state. The drill-down context (eventId, account, valuationDt, category) is naturally scoped to the drill-down route tree and doesn't need global state.

**Implementation**: A `DrillDownProvider` context wrapping the drill-down route subtree, with a `drillDownReducer` managing the state shape from the spec (context, navDashboard, trialBalance, positionDrillDown, aiAnalysis slices). This preserves the state structure from the spec while staying consistent with the existing architecture.

**Alternative considered**: Redux Toolkit as specified. Rejected because it adds ~15KB to the bundle, requires store setup boilerplate, and creates architectural inconsistency. The spec's Redux state shape is preserved exactly — only the mechanism changes from Redux slices to useReducer actions.

### D2: Grid Component — AG-Grid Community with Client-Side Model

**Decision**: Use AG-Grid Community (already installed, v35) with client-side row model rather than upgrading to Enterprise.

**Rationale**: AG-Grid Enterprise requires a commercial license ($1,595+/seat). The datasets in this application are bounded: max ~500 funds in NAV Compare, ~30 GL categories in Trial Balance, ~1,000 positions in drill-down. Client-side row model handles these volumes within the performance targets. Server-side row model is designed for 100K+ row datasets.

**Implementation**: ag-grid-react with client-side data, server-side *fetching* (API pagination), and AG-Grid Community features: sorting, filtering, row grouping (community), expandable rows via masterDetail (use custom detail renderer with nested grid).

**Alternative considered**: AG-Grid Enterprise with SSRM. Would provide built-in lazy loading but is unnecessary at our data volumes and requires licensing. Also considered MUI X DataGrid (already installed) but AG-Grid's row expansion and master/detail pattern better matches the inline cross-check requirement.

### D3: Waterfall Chart — Recharts (not D3.js)

**Decision**: Build the NAV waterfall chart using Recharts (already installed) with BarChart and custom bar shapes, rather than adding D3.js.

**Rationale**: Recharts is already a dependency. A waterfall chart is achievable with Recharts' BarChart using stacked bars with transparent bases (the "invisible bar" technique). Adding D3.js introduces a second charting library, increases bundle size (~50KB), and requires more imperative SVG code.

**Implementation**: A `<WaterfallChart>` component using Recharts `<BarChart>` with stacked `<Bar>` components: one transparent bar for the base offset, one colored bar for the delta. Click handlers on bars dispatch filter actions to the grid. Tooltips via Recharts' built-in `<Tooltip>`.

**Alternative considered**: D3.js as specified. Rejected to avoid adding a redundant charting dependency when Recharts can achieve the same result with less code and consistent styling.

### D4: Real-Time Updates — Server-Sent Events (SSE) over WebSocket

**Decision**: Use Server-Sent Events (SSE) for real-time updates instead of WebSocket.

**Rationale**: The real-time communication is unidirectional (server → client): validation run progress, AI analysis completion, and status changes. SSE is simpler to implement (native `EventSource` API, no client library needed), works through HTTP proxies/load balancers without special configuration, and auto-reconnects. FastAPI supports SSE via `StreamingResponse`. WebSocket adds bidirectional capability we don't need and requires more infrastructure (connection management, heartbeats, reconnection logic).

**Implementation**:
- Backend: FastAPI `StreamingResponse` endpoints that yield SSE events, scoped by eventId and optional fundAccount. Uses asyncio queues fed by database change streams or post-validation hooks.
- Frontend: Native `EventSource` in a custom `useSSE` hook, managed by the DrillDownProvider. Subscriptions are scoped to the current drill-down context and re-established on navigation.

**Alternative considered**: WebSocket as specified. Rejected for simplicity — SSE handles the unidirectional push pattern with less code and infrastructure. Can upgrade to WebSocket later if bidirectional communication is needed.

### D5: Routing Structure — Nested Routes Under /events

**Decision**: Replace existing routes with a nested route structure under `/events`.

**Implementation**:
```
/events                                           → EventDashboard (new)
/events/:eventId/nav-dashboard                    → NavDashboard (new)
/events/:eventId/funds/:account/trial-balance     → TrialBalance (new)
/events/:eventId/funds/:account/positions          → PositionDrillDown (new)
```

The existing `/events/:eventId` (EventDetail) and `/events/:eventId/funds/:fundAccount` (FundBreakDetail) routes are replaced. The `/events/:eventId/runs/:runId` (ValidationRunView) route is preserved as a sibling. Non-drill-down routes (`/review`, `/ledger-mapping`, `/gl-account-mapping`) are unchanged.

The DrillDownProvider wraps only the drill-down route subtree, not the entire app.

### D6: Backend API — Extend Existing Endpoints + New Compare Endpoints

**Decision**: Add new comparison endpoints that return Incumbent vs BNY side-by-side data, while preserving existing single-bank endpoints.

**New endpoints**:
- `GET /api/events/{eventId}/nav-compare?valuationDt={date}` — Returns NAV Compare grid data (Incumbent vs BNY joined)
- `GET /api/events/{eventId}/nav-compare/{account}/cross-checks?valuationDt={date}` — Returns Ledger BS and INCST cross-check data for a fund
- `GET /api/funds/{account}/trial-balance-compare?valuationDt={date}` — Returns categorized ledger comparison (Incumbent vs BNY)
- `GET /api/funds/{account}/trial-balance-compare/{category}/subledger-check?valuationDt={date}` — Returns subledger compare check for a category
- `GET /api/funds/{account}/position-compare?valuationDt={date}&category={cat}` — Returns position comparison by category
- `GET /api/funds/{account}/position-compare/{assetId}/tax-lots?valuationDt={date}` — Returns tax lot detail comparison
- `GET /api/funds/{account}/basis-lot-check?valuationDt={date}` — Returns basis lot check results
- `GET /api/events/{eventId}/sse` — SSE stream for real-time updates scoped to an event
- `POST /api/validation/run-sequential` — Orchestrated 6-check sequential validation with progress events

These endpoints join Incumbent and BNY data server-side and return comparison objects with `{ incumbent, bny, variance, validationStatus }` per field, reducing frontend computation.

### D7: Expandable Row Pattern — Master/Detail with Nested AG-Grid

**Decision**: Use AG-Grid's `masterDetail` feature (community-supported via custom detail cell renderer) for all expandable rows across the four screens.

**Implementation**: Each grid row has a chevron toggle. Expanding renders a custom React component (not a nested AG-Grid — community doesn't support nested grids in masterDetail). The detail component renders a MUI Table for the cross-check/subledger/tax-lot data, styled to align with the parent grid columns.

This keeps the pattern consistent: parent data in AG-Grid, expansion detail in MUI Table.

### D8: AI Commentary Panel — Shared Component with Context-Aware Content

**Decision**: Build a single reusable `<AICommentaryPanel>` component used across NAV Dashboard, Trial Balance, and Position Drill-Down screens. Content adapts based on the current drill-down level and selected entity.

**Implementation**: The panel receives the current drill-down context (level, entity IDs) and fetches AI analysis from an existing endpoint (`/api/breaks/{breakId}` which includes `aiAnalysis`). For trend summaries and pattern recognition, a new endpoint `GET /api/ai/analysis?eventId={id}&account={acct}&category={cat}` aggregates AI insights at the requested scope.

The panel is a collapsible right-hand sidebar (350px default, resizable via drag handle) with sections: Trend Summary, Pattern Recognition, Confidence Score (gauge), Recommended Next Step.

### D9: Breadcrumb Navigation — Derived from Route + DrillDown Context

**Decision**: Build breadcrumbs by combining React Router's route hierarchy with the DrillDownProvider's context state (which stores display names like eventName, accountName, category).

**Implementation**: A `<DrillDownBreadcrumb>` component at the top of each drill-down screen reads the current context and renders MUI Breadcrumbs. Each breadcrumb link preserves parent context via URL params (valuationDt) and route params (eventId, account). Back navigation clears child-level context per the spec's propagation rules.

### D10: Validation Status Rendering — Dual Signal (Color + Icon)

**Decision**: All validation status indicators use both color AND icon to meet WCAG color-blind accessibility requirements.

**Implementation**: A `<ValidationStatus>` component renders:
- Pass: Green circle + checkmark icon
- Warning/Marginal: Amber triangle + warning icon
- Break/Fail: Red circle + X icon

Thresholds are configurable per event (stored in event metadata). The component accepts `value`, `threshold`, and optional `marginalThreshold` props.

## Risks / Trade-offs

**[AG-Grid Community limitations]** → Community edition lacks some Enterprise features (server-side row model, integrated master/detail). Mitigation: Use custom detail cell renderers and client-side model. If data volumes grow beyond 1K+ rows with pagination needs, Enterprise can be adopted later.

**[Replacing existing screens]** → EventDetail and FundBreakDetail are replaced. Any workflows depending on those specific screens will break. Mitigation: Map all existing features to new screens to ensure no regression. The HumanReview page is preserved separately.

**[SSE scalability]** → SSE connections are long-lived HTTP connections. With many concurrent users, this could exhaust server connections. Mitigation: SSE connections are scoped (one per active drill-down session), and FastAPI/uvicorn handles concurrent connections well. If scaling issues arise, switch to a message broker (Redis pub/sub) backing the SSE streams.

**[Performance with comparison endpoints]** → New comparison endpoints join Incumbent + BNY data server-side, doubling query scope. Mitigation: MongoDB compound indexes on (valuationDt, account, userBank) for dataNav, dataLedger, and dataSubLedgerPosition collections. Cache derived subledger rollups per validation run.

**[Bundle size]** → Adding AG-Grid features and the new screens will increase the frontend bundle. Mitigation: Code-split drill-down screens using React.lazy(). AG-Grid and Recharts are already in the bundle.

## Open Questions

1. **AG-Grid Enterprise licensing**: If the team decides to purchase Enterprise licenses, decisions D2 and D7 should be revisited to use SSRM and native master/detail. The current design works without it.

2. **Validation thresholds**: Where are per-event break thresholds configured? The spec mentions configurable thresholds but doesn't specify the configuration UI. For now, assume thresholds are stored in event metadata and editable via a settings modal.

3. **AI analysis endpoint consolidation**: The current backend has AI analysis tied to break records. The new multi-level commentary (event-level trends, fund-level patterns) may need a new aggregation endpoint or a dedicated AI summary collection. Deferred to implementation.

4. **Historical valuation date availability**: The NAV Dashboard date picker needs to know which dates have validation data. Need an endpoint like `GET /api/events/{eventId}/available-dates` or derive from existing validation runs.
