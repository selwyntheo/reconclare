## Context

The RECON-AI platform is a React/TypeScript + Python/FastAPI + MongoDB application for fund conversion reconciliation. The existing codebase has:

- **Backend**: Single `main.py` FastAPI app with async Motor MongoDB access, centralized `COLLECTIONS` dict, Pydantic schemas, SSE stub but no active real-time infrastructure
- **Frontend**: React Router v6 with lazy-loaded pages, AG-Grid for data grids, Material-UI theming, Context-based state (AuthContext, DrillDownContext), `fetchJSON<T>()` API client pattern
- **RBAC**: 5 roles (Fund Accountant, Pricing Team, Trade Capture Team, Recon Lead, Auditor) with a permission matrix controlling screen access, commentary, reassignment, and export scope
- **Existing pages**: Event Dashboard, NAV Dashboard, Trial Balance, Position Drill-Down, Human Review, GL Account Mapping, Ledger Mapping, Validation Run View

This change adds 14 new capabilities and modifies 5 existing ones, introducing ~10 new pages, ~25 new API endpoints, 6 new MongoDB collections, and real-time WebSocket updates.

## Goals / Non-Goals

**Goals:**
- Deliver the complete break resolution lifecycle: detect → categorize → assign → investigate → resolve → report
- Provide hierarchical reconciliation views from NAV fund level through share class, trial balance, positions (full/share breaks/price breaks/tax lots), income (dividends/fixed income), and derivatives (forwards/futures)
- Enable daily reviewer allocation with roster management across the parallel period
- Produce client-facing scorecards with adjusted RAG using configurable Known Differences
- Implement commentary rollup that flows from L4 (transaction) to L1 (scorecard) levels
- Support real-time multi-user collaboration via WebSocket push updates
- Maintain consistency with existing codebase patterns (FastAPI, AG-Grid, React Context, permission matrix)

**Non-Goals:**
- External email notification integration (Phase 1 is in-app only; email is a future enhancement)
- Full SSO/LDAP authentication (continue using demo role-based auth pattern)
- Mobile-responsive layouts (desktop-first for fund accounting workflows)
- Historical trend analytics beyond the RAG Status Tracker parallel period view
- Automated break resolution (AI suggests, humans decide)
- Multi-tenant isolation (single-tenant deployment model continues)

## Decisions

### D1: Backend Router Modularization

**Decision**: Introduce FastAPI `APIRouter` modules instead of adding all ~25 endpoints to `main.py`.

**Rationale**: The existing `main.py` is already large. Adding 25+ endpoints would make it unmaintainable. FastAPI's router pattern allows domain separation without changing the runtime behavior.

**Structure**:
```
backend/api/
  main.py                    # App init, CORS, lifespan, include routers
  routers/
    allocations.py           # Reviewer allocation CRUD + audit
    known_differences.py     # KD configuration CRUD
    break_resolution.py      # Break category, team assignment, review status
    nav_views.py             # Share class, client scorecard, RAG tracker
    positions_views.py       # Share breaks, price breaks, tax lots
    income_views.py          # Dividends, fixed income
    derivatives_views.py     # Forwards, futures
    commentary.py            # Commentary CRUD + rollup calculation
    notifications.py         # In-app notification endpoints
    export.py                # Excel/PDF export generation
    audit.py                 # Audit trail queries
```

**Alternatives considered**:
- *Keep everything in main.py*: Rejected — would exceed 3000+ lines, unmanageable merge conflicts
- *Separate FastAPI apps per domain*: Rejected — over-engineered for a monolith, adds deployment complexity

### D2: Real-Time Updates via WebSocket

**Decision**: Use FastAPI's native WebSocket support (Starlette) with a simple pub/sub broadcast pattern. Not Socket.IO.

**Rationale**: The requirement specifies <200ms update latency when any reviewer makes changes. FastAPI natively supports WebSocket via Starlette without additional dependencies. Socket.IO adds complexity (separate protocol, client library) that isn't needed for broadcast-style updates.

**Pattern**:
```python
# ConnectionManager maintains active WebSocket connections per event
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}  # eventId → connections

    async def broadcast(self, event_id: str, message: dict):
        for connection in self.active_connections.get(event_id, []):
            await connection.send_json(message)
```

**Message types**: `ALLOCATION_CHANGED`, `BREAK_UPDATED`, `COMMENTARY_ADDED`, `STATUS_CHANGED`, `KD_OVERRIDE`

**Alternatives considered**:
- *Server-Sent Events (SSE)*: Rejected — SSE is unidirectional (server→client only), doesn't support client-initiated messages for presence/typing indicators
- *Socket.IO*: Rejected — adds `python-socketio` dependency, separate protocol negotiation, heavier client bundle; no rooms/namespaces needed beyond event-level grouping
- *Polling*: Rejected — cannot meet <200ms requirement without excessive server load

### D3: MongoDB Collection Design

**Decision**: 6 new collections with the existing `COLLECTIONS` registry pattern.

```python
COLLECTIONS = {
    # Existing...
    "reviewerAllocations": "reviewerAllocations",
    "knownDifferences": "knownDifferences",
    "breakAssignments": "breakAssignments",
    "notifications": "notifications",
    "commentary": "commentary",
    "auditLogs": "auditLogs",
}
```

**Index strategy**:
- `reviewerAllocations`: compound index on `(eventId, valuationDate)`, secondary on `(assignedReviewerId)`
- `knownDifferences`: compound on `(eventId, isActive)`, unique on `(eventId, reference)`
- `breakAssignments`: compound on `(eventId, valuationDate, entityReference)`, secondary on `(assignedTeam)`
- `notifications`: compound on `(assignedOwner, isRead)`, TTL index on `createdAt` (90 days)
- `commentary`: compound on `(reconciliationLevel, entityReference)`, secondary on `(parentCommentId)` for threading
- `auditLogs`: compound on `(eventId, action, timestamp)`, TTL index on `timestamp` (1 year)

**Rationale**: Separate collections align with the distinct access patterns — allocations are queried by date matrix, commentary is queried by entity hierarchy, audit logs are append-only with time-based retention. Embedding commentary inside position/TB documents would cause unbounded document growth and make rollup queries complex.

**Alternatives considered**:
- *Embed commentary in position/TB documents*: Rejected — documents grow unboundedly, rollup requires aggregation across document types, violates MongoDB 16MB document limit risk
- *Single "activities" collection*: Rejected — polymorphic queries are slower, different retention policies per activity type

### D4: Commentary Rollup Strategy

**Decision**: On-demand computation with caching. Rollup is calculated server-side when requested and cached in a materialized field on the parent entity. Cache is invalidated when any child commentary changes (via WebSocket event trigger).

**Rollup flow**:
1. Reviewer adds commentary at L3 (position level) with break category and amount
2. Backend writes to `commentary` collection and broadcasts `COMMENTARY_ADDED` WebSocket event
3. When L2 (trial balance) or L1 (scorecard) view is loaded, backend runs an aggregation pipeline:
   ```
   commentary.aggregate([
     { $match: { entityReference: { $regex: "^FUND-001/" } } },
     { $group: { _id: "$breakCategory", totalAmount: { $sum: "$amount" }, entries: { $push: "$$ROOT" } } }
   ])
   ```
4. Result is cached with a TTL; any `COMMENTARY_ADDED` event for the same fund invalidates the cache

**Rationale**: Full materialization (writing rollups on every comment) adds write amplification and complexity. Pure on-demand computation is fast enough given MongoDB's aggregation pipeline performance (target: <2s for one fund), and caching handles repeated reads.

**Alternatives considered**:
- *Write-time materialization*: Rejected — every comment write triggers cascading updates to L2 and L1, complex rollback on edit/delete
- *Pure on-demand without cache*: Acceptable for small datasets but risks exceeding 2s target when a fund has hundreds of positions with commentary

### D5: Auto-Assignment Engine Architecture

**Decision**: Synchronous middleware within the validation pipeline and break detection flow, not a separate background job.

When the validation engine detects a break (share mismatch, price discrepancy, income variance), the auto-assignment logic runs inline:
1. Match break type to rule table (configurable in MongoDB)
2. Determine team and owner (round-robin from available team members)
3. Write `breakAssignment` record
4. Write `notification` record
5. Broadcast via WebSocket

**Rationale**: Auto-assignment must happen immediately when breaks are detected — not minutes later via a background queue. The rule evaluation is lightweight (lookup + round-robin counter) and doesn't warrant async infrastructure.

**Alternatives considered**:
- *Background Celery/RQ worker*: Rejected — adds Redis dependency, introduces latency between break detection and assignment, over-engineered for rule table lookup
- *Database trigger (MongoDB Change Streams)*: Rejected — adds operational complexity, harder to debug, same result achievable synchronously

### D6: Client Scorecard KD Column Generation

**Decision**: Dynamic column generation driven by the `knownDifferences` collection. The frontend queries active KD entries for the event and dynamically constructs AG-Grid column definitions.

**Flow**:
1. Backend endpoint returns active KD entries: `GET /api/events/{eventId}/known-differences?active=true`
2. Backend scorecard endpoint returns fund data with KD amounts as a dynamic key-value map:
   ```json
   {
     "fundAccount": "AC0001",
     "netAssetsDifference": 1234567.89,
     "kdAmounts": { "KD 1": 1449.32, "KD 2": -4.94, "KD 3": 34650.00 },
     "incumbentToResolve": -12154.70,
     "adjustedDifference": 1196518.63
   }
   ```
3. Frontend builds AG-Grid `columnDefs` dynamically from the KD list, inserting one column per active KD between the static columns

**Rationale**: KD entries differ between events and new ones can be added during the parallel. Hard-coding column definitions would require code changes for each event. Dynamic generation from the KD table matches the requirement for flexibility.

**Alternatives considered**:
- *Fixed KD columns (KD 1–5 always)*: Rejected — requirement explicitly states KD columns differ between events and new ones may be added during the parallel
- *Server-side column definition API*: Considered but unnecessary — the frontend already has the KD list and can build columns directly

### D7: Export Architecture

**Decision**: Server-side Excel generation using `openpyxl`; client-side PDF generation using browser print-to-PDF for the Client Scorecard.

**Excel flow**:
1. Frontend calls `POST /api/export/excel` with grid configuration (view type, filters, event context)
2. Backend queries the same data endpoints, applies formatting rules (RAG colors, number formats), generates .xlsx in memory
3. Returns as `StreamingResponse` with `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` content type

**PDF flow**:
- Client Scorecard uses a print-optimized CSS stylesheet. Browser's native print/PDF handles layout.
- No server-side PDF library needed initially.

**Rationale**: Server-side Excel preserves conditional formatting, merged cells, and commentary that client-side libraries (SheetJS) handle poorly. PDF generation for a single scorecard view doesn't warrant a server-side dependency (WeasyPrint, ReportLab) when browser print produces acceptable output.

**Alternatives considered**:
- *Client-side SheetJS/xlsx*: Rejected — limited formatting support, can't reproduce RAG conditional coloring accurately
- *Server-side PDF via WeasyPrint*: Deferred — adds system-level dependencies (cairo, pango), significant build complexity; browser print is sufficient for Phase 1

### D8: Frontend State Management for New Views

**Decision**: Extend the existing Context pattern. Add a `BreakResolutionContext` for shared state (selected break category filter, active KD list, notification count) and keep page-level state local.

**Rationale**: The codebase uses React Context exclusively (AuthContext, DrillDownContext). Introducing Redux or Zustand for this change would create two competing state management paradigms. The new shared state (break filters, KD list, notifications) is similar in scope to the existing DrillDownContext.

**Alternatives considered**:
- *Redux Toolkit*: Rejected — introduces new paradigm, additional dependency, existing patterns work fine for this scope
- *Per-page local state only*: Rejected — break category filter, notification count, and KD list need to be shared across multiple views within the drill-down hierarchy

### D9: RBAC Extension

**Decision**: Extend the existing `RolePermissions` interface and permission matrix with new screen entries and capabilities. Add two new roles: `CLIENT_STAKEHOLDER` and expand the existing 5 roles with new permissions.

**New permission entries**:
```typescript
screens: {
  // Existing...
  reviewerAllocation: ScreenAccess;
  navShareClass: ScreenAccess;
  navClientScorecard: ScreenAccess;
  navRagTracker: ScreenAccess;
  positionsShareBreaks: ScreenAccess;
  positionsPriceBreaks: ScreenAccess;
  positionsTaxLots: ScreenAccess;
  incomeDividends: ScreenAccess;
  incomeFixedIncome: ScreenAccess;
  derivativesForwards: ScreenAccess;
  derivativesFutures: ScreenAccess;
}
```

**Role mapping** (from requirements Section 12.4):
- `RECON_LEAD` → Conversion Manager (full access, roster management, sign-off)
- `FUND_ACCOUNTANT` → Fund Accountant (assigned funds, commentary, break categories)
- `PRICING_TEAM` → Pricing Analyst (price breaks, pricing commentary)
- `TRADE_CAPTURE_TEAM` → Trade Capture Analyst (share breaks, trade commentary)
- New `NAV_OPS_ANALYST` role for income/reclaim breaks
- New `CLIENT_STAKEHOLDER` role (read-only scorecard + RAG tracker)
- `AUDITOR` → unchanged (read-only all views + audit trail)

### D10: Route Structure for New Views

**Decision**: Extend the existing hierarchical route pattern under `/events/:eventId/`.

```
/events/:eventId/allocations                              # Reviewer Allocation
/events/:eventId/nav-dashboard                            # Existing (enhanced)
/events/:eventId/nav-dashboard/share-class/:account       # NAV Share Class
/events/:eventId/nav-dashboard/scorecard                  # Client Scorecard
/events/:eventId/nav-dashboard/rag-tracker                # RAG Status Tracker
/events/:eventId/funds/:account/trial-balance             # Existing (enhanced)
/events/:eventId/funds/:account/positions                 # Existing (enhanced - Full Portfolio)
/events/:eventId/funds/:account/positions/share-breaks    # Share Breaks
/events/:eventId/funds/:account/positions/price-breaks    # Price Breaks
/events/:eventId/funds/:account/positions/tax-lots        # Tax Lots
/events/:eventId/funds/:account/income/dividends          # Dividends
/events/:eventId/funds/:account/income/fixed-income       # Fixed Income
/events/:eventId/funds/:account/derivatives/forwards      # Forwards
/events/:eventId/funds/:account/derivatives/futures       # Futures
```

**Rationale**: Maintains the existing `events/:eventId/funds/:account` nesting. NAV-level views (share class, scorecard, RAG) are siblings of `nav-dashboard` since they operate at the event level. Fund-specific reconciliation views (positions, income, derivatives) nest under `funds/:account`.

## Risks / Trade-offs

**[Single main.py → Router migration]** → Existing endpoints in `main.py` will coexist with new router-based endpoints during transition. Mitigation: Leave existing endpoints in `main.py` untouched; only new endpoints use routers. Gradual migration can happen later.

**[WebSocket scalability]** → In-memory `ConnectionManager` doesn't support multi-process deployment. → Mitigation: Single-process deployment is sufficient for current scale (50 funds, <20 concurrent users). If horizontal scaling is needed later, switch to Redis pub/sub as the WebSocket backend.

**[Commentary rollup performance]** → Aggregation pipeline for funds with 500+ positions and deep commentary trees may approach the 2s target. → Mitigation: Compound indexes on `(reconciliationLevel, entityReference)`, limit rollup depth to 3 levels per query, cache aggressively with 60s TTL.

**[Dynamic KD columns in AG-Grid]** → Column definition changes at runtime can cause grid re-renders and lose scroll position. → Mitigation: Memoize column definitions, only regenerate when KD list actually changes (reference equality check).

**[openpyxl memory for large exports]** → Generating .xlsx for 1000+ rows with formatting in memory may use significant RAM. → Mitigation: Use `openpyxl`'s write-only/optimized mode for large datasets; stream response to avoid holding entire file in memory.

**[RBAC complexity growth]** → Adding 11 new screen entries and 2 new roles increases the permission matrix significantly. → Mitigation: Keep the existing matrix pattern (single source of truth in `permissions.ts`), add comprehensive tests for each role's access.

**[No email notifications in Phase 1]** → Auto-assignment without email means users must be actively using the app to see notifications. → Mitigation: In-app notification bell with unread count badge; email integration planned for Phase 2.

## Open Questions

1. **Reviewer availability source**: Should reviewer availability (leave/absence) be manually managed in the app or integrated with an external calendar system (Outlook/Google)?
2. **KD override audit granularity**: When a user manually overrides a KD column value in the scorecard, should the system preserve both the computed and override values, or replace the computed value?
3. **Commentary rollup editing**: Can a reviewer edit a rolled-up comment at L2 level, or must they always edit at the source level (L3/L4) and let it re-roll?
4. **Client Scorecard access**: Should the `CLIENT_STAKEHOLDER` role access the scorecard via the same app URL with restricted permissions, or via a separate read-only portal URL?
5. **RAG threshold configurability scope**: Are RAG thresholds (green ≤5bp, amber ≤50bp) global or configurable per event/fund?
