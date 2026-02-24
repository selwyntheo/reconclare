## 1. Foundation & Infrastructure

- [x] 1.1 Create backend router module structure (`backend/api/routers/`) with `__init__.py` and include routers in `main.py` via `app.include_router()`
- [x] 1.2 Add new MongoDB collections to `COLLECTIONS` dict in `mongodb.py`: `reviewerAllocations`, `knownDifferences`, `breakAssignments`, `notifications`, `commentary`, `auditLogs`
- [x] 1.3 Create compound indexes for new collections in the FastAPI lifespan startup: `(eventId, valuationDate)` on reviewerAllocations, `(eventId, isActive)` on knownDifferences, `(eventId, valuationDate, entityReference)` on breakAssignments, `(assignedOwner, isRead)` on notifications, `(reconciliationLevel, entityReference)` on commentary, `(eventId, action, timestamp)` on auditLogs
- [x] 1.4 Add TTL indexes: 90-day on `notifications.createdAt`, 1-year on `auditLogs.timestamp`
- [x] 1.5 Implement WebSocket `ConnectionManager` class in `backend/api/websocket.py` with per-event connection tracking, `connect()`, `disconnect()`, and `broadcast()` methods
- [x] 1.6 Add WebSocket endpoint `ws://host/ws/events/{eventId}` in `main.py` using the ConnectionManager
- [x] 1.7 Create frontend WebSocket hook `useWebSocket(eventId)` that establishes connection, handles reconnection, and dispatches message types (`ALLOCATION_CHANGED`, `BREAK_UPDATED`, `COMMENTARY_ADDED`, `STATUS_CHANGED`, `KD_OVERRIDE`)
- [x] 1.8 Add Pydantic schemas for new data models in `backend/db/schemas.py`: `ReviewerAllocation`, `KnownDifference`, `BreakAssignment`, `Notification`, `Commentary`, `AuditLog`
- [x] 1.9 Add TypeScript interfaces in `frontend/src/types/` for all new data models: `ReviewerAllocation`, `KnownDifference`, `BreakAssignment`, `BreakCategory`, `ReviewStatus`, `Notification`, `Commentary`, `AuditLog`
- [x] 1.10 Install backend dependency `openpyxl` and add to requirements.txt

## 2. RBAC Extension

- [x] 2.1 Add new roles `NAV_OPS_ANALYST` and `CLIENT_STAKEHOLDER` to `AppRole` type in `frontend/src/types/rbac.ts`
- [x] 2.2 Extend `RolePermissions.screens` interface with new screen entries: `reviewerAllocation`, `navShareClass`, `navClientScorecard`, `navRagTracker`, `positionsShareBreaks`, `positionsPriceBreaks`, `positionsTaxLots`, `incomeDividends`, `incomeFixedIncome`, `derivativesForwards`, `derivativesFutures`
- [x] 2.3 Define permission matrix entries in `frontend/src/config/permissions.ts` for all 7 roles across all new screens (visible, readOnly, canTriggerValidation, canSignOff)
- [x] 2.4 Add `canManageRoster`, `canOverrideKD`, and `canViewAuditTrail` permission flags to the role matrix
- [x] 2.5 Update `AuthContext.tsx` to include `NAV_OPS_ANALYST` and `CLIENT_STAKEHOLDER` in user info mapping
- [x] 2.6 Add permission helper functions: `canManageRoster(role)`, `canOverrideKD(role)`, `canViewAuditTrail(role)`

## 3. Break Categorization & Configuration

- [x] 3.1 Create `backend/api/routers/break_resolution.py` with endpoints for break category assignment: `PUT /api/breaks/{entityRef}/category`, `PUT /api/breaks/{entityRef}/team`, `GET /api/events/{eventId}/break-summary`
- [x] 3.2 Create `backend/api/routers/known_differences.py` with CRUD endpoints: `GET /api/events/{eventId}/known-differences`, `POST`, `PUT /{reference}`, `DELETE /{reference}`
- [x] 3.3 Implement seed data for pre-configured Known Differences (KD 1–5 Methodology entries) in the seed script
- [x] 3.4 Create shared React component `BreakCategorySelector` — dropdown with 5 color-coded category options
- [x] 3.5 Create shared React component `BreakTeamDropdown` — team selector that filters the owner sub-dropdown by team membership
- [x] 3.6 Create shared React component `ReviewStatusBadge` — color-coded badge (gray/amber/green) for Not Started / In Progress / Complete
- [x] 3.7 Add frontend API client functions in `api.ts`: `fetchKnownDifferences()`, `createKnownDifference()`, `updateKnownDifference()`, `updateBreakCategory()`, `updateBreakTeam()`

## 4. Reviewer Allocation

- [x] 4.1 Create `backend/api/routers/allocations.py` with endpoints: `GET /api/events/{eventId}/allocations`, `GET /.../allocations/{date}`, `PUT /.../allocations`, `POST /.../allocations/copy`, `GET /api/users/reviewers`, `GET /.../allocations/audit`
- [x] 4.2 Implement allocation audit logging — write to `auditLogs` collection on every allocation change with previous/new reviewer, changed-by, timestamp
- [x] 4.3 Create `frontend/src/pages/ReviewerAllocation/ReviewerAllocation.tsx` — matrix grid page component with AG-Grid
- [x] 4.4 Implement matrix grid with dynamic date columns spanning parallel period, fund rows, and editable reviewer cells
- [x] 4.5 Implement inline cell editing with reviewer dropdown (filtered by availability), optimistic UI updates, and backend persistence
- [x] 4.6 Implement bulk assignment: row header click (all dates for fund), column header click (all funds for date)
- [x] 4.7 Implement copy allocations between dates UI with date picker modal
- [x] 4.8 Integrate WebSocket `ALLOCATION_CHANGED` broadcast on allocation mutations and real-time grid updates for other users
- [x] 4.9 Add API client functions: `fetchAllocations()`, `updateAllocations()`, `copyAllocations()`, `fetchReviewers()`

## 5. NAV Dashboard Enhancements

- [x] 5.1 Add Reviewer column to NAV Compare grid — fetch from allocations API for selected date, display reviewer name per fund row
- [x] 5.2 Add Review Status column to NAV Compare grid — color-coded badge per fund/date
- [x] 5.3 Add break category filter control above the grid — multi-select for break categories, filters fund rows by position-level break presence
- [x] 5.4 Add tab navigation above the grid for sub-views: "Fund Level" (current), "Share Class", "Client Scorecard", "RAG Status"
- [x] 5.5 Add share class action link per fund row that navigates to the Share Class Dashboard

## 6. NAV Share Class Dashboard

- [x] 6.1 Create `backend/api/routers/nav_views.py` with endpoint: `GET /api/events/{eventId}/funds/{account}/share-classes?valuationDt={date}`
- [x] 6.2 Create `frontend/src/pages/NavShareClass/NavShareClass.tsx` — AG-Grid page with 27 comparison columns (base + local currency, NAV per share, share movement)
- [x] 6.3 Implement NAV Per Share computation: BNY Net Assets / BNY Units for base and local currency
- [x] 6.4 Implement Prior Day NAV Data section — query prior valuation date data and display subordinate grid
- [x] 6.5 Implement Share Movement calculation: current day units minus prior day units
- [x] 6.6 Add API client function `fetchShareClasses()` and route `/events/:eventId/nav-dashboard/share-class/:account`

## 7. NAV Client Scorecard

- [x] 7.1 Add scorecard endpoint to `nav_views.py`: `GET /api/events/{eventId}/scorecard?valuationDt={date}` — returns fund data with `kdAmounts` dynamic key-value map and adjusted calculations
- [x] 7.2 Create `frontend/src/pages/NavClientScorecard/NavClientScorecard.tsx` — AG-Grid page with static columns + dynamically-generated KD columns
- [x] 7.3 Implement dynamic KD column generation: fetch active KDs, build AG-Grid `columnDefs` dynamically, memoize to prevent re-renders
- [x] 7.4 Implement Adjusted RAG calculation: Net Assets Difference minus all KD amounts minus Incumbent to Resolve; apply RAG thresholds to adjusted BP
- [x] 7.5 Implement manual KD override: editable KD cells with visual override indicator (bold/highlight), backend persistence via `PUT /api/events/{eventId}/scorecard/overrides`
- [x] 7.6 Implement audit logging for KD overrides — preserve computed value + override value
- [x] 7.7 Implement reviewer sign-off checkbox: permission-gated (`canApproveSignOff`), transitions Review Status to Complete, creates audit record
- [x] 7.8 Integrate rolled-up commentary from lower levels in the Comment column
- [x] 7.9 Implement scorecard Excel export with metadata header (event, date, timestamp, user) and RAG conditional formatting
- [x] 7.10 Implement print-optimized CSS for browser PDF export
- [x] 7.11 Add API client functions and route `/events/:eventId/nav-dashboard/scorecard`

## 8. NAV RAG Status Tracker

- [x] 8.1 Add RAG tracker endpoint to `nav_views.py`: `GET /api/events/{eventId}/rag-tracker` — returns fund-by-date matrix of adjusted BP values
- [x] 8.2 Create `frontend/src/pages/NavRagTracker/NavRagTracker.tsx` — matrix grid with fund rows, date columns, BP values with RAG conditional formatting
- [x] 8.3 Implement conditional cell formatting: Green (#E2F0D9) for |BP| <= 5, Amber (#FFF2CC) for |BP| <= 50, Red (#FCE4EC) for |BP| > 50
- [x] 8.4 Implement configurable RAG thresholds per event via `GET /api/events/{eventId}/rag-thresholds` and `PUT` to update
- [x] 8.5 Implement cell click navigation to Client Scorecard filtered to specific fund/date
- [x] 8.6 Integrate WebSocket auto-refresh on KD override or break recategorization
- [x] 8.7 Add API client function and route `/events/:eventId/nav-dashboard/rag-tracker`

## 9. Trial Balance Enhancements

- [x] 9.1 Extend TB grid columns: add TB Category (Balance Sheet/P&L), TB Classification (Assets/Liabilities/Capital/etc.), and expanded Sub Classification taxonomy (Cash, Dividends Receivable, Securities at Value, etc.)
- [x] 9.2 Implement structured multi-line commentary editor component: multiple comment entries per row, each tagged with Break Category and monetary amount
- [x] 9.3 Add Break Team Assignment, Break Owner, and Break Category columns to TB grid
- [x] 9.4 Implement sidebar BS/P&L cross-check summary panel: BNY BS vs Incumbent BS, BNY P&L vs Incumbent P&L, net cross-check with warning on discrepancy
- [x] 9.5 Update TB API endpoint to return expanded sub-classification data and break resolution fields

## 10. Position Drill-Down Enhancements

- [x] 10.1 Add Break Team Assignment, Break Owner, Break Category, and Comment columns to the Position Compare grid
- [x] 10.2 Integrate auto-assignment display — show pre-populated team/owner from auto-assignment engine
- [x] 10.3 Implement editable break resolution fields with inline dropdowns and immediate persistence
- [x] 10.4 Implement Full Portfolio view mode (no category filter) at `/events/:eventId/funds/:account/positions` showing all comparison columns
- [x] 10.5 Add navigation links from Full Portfolio to filtered sub-views (Share Breaks, Price Breaks, Tax Lots)
- [x] 10.6 Implement KD reference linking in position-level comments (Apply KD Commentary button)
- [x] 10.7 Integrate WebSocket `BREAK_UPDATED` broadcast for real-time cross-user updates

## 11. Positions — Share Breaks

- [x] 11.1 Add share breaks endpoint to `backend/api/routers/positions_views.py`: `GET /api/events/{eventId}/funds/{account}/positions/share-breaks?valuationDt={date}` and event-wide `GET /api/events/{eventId}/positions/share-breaks`
- [x] 11.2 Implement filtering logic: return only positions where BNY Shares != Incumbent Shares beyond tolerance, or BNY Only / Incumbent Only
- [x] 11.3 Create `frontend/src/pages/PositionsShareBreaks/PositionsShareBreaks.tsx` — AG-Grid with comparison columns + Match Status + break resolution columns
- [x] 11.4 Implement Match Status computation: Match, BNY Only, Incumbent Only, Matched with Differences
- [x] 11.5 Add route and API client function for share breaks

## 12. Positions — Price Breaks

- [x] 12.1 Add price breaks endpoint to `positions_views.py`: `GET /api/events/{eventId}/funds/{account}/positions/price-breaks` and event-wide variant
- [x] 12.2 Implement filtering logic: return only positions where price difference exceeds tolerance
- [x] 12.3 Create `frontend/src/pages/PositionsPriceBreaks/PositionsPriceBreaks.tsx` — AG-Grid with price comparison, % Price Difference, market value impact, break resolution columns
- [x] 12.4 Implement % Price Difference computation: (BNY Price - Incumbent Price) / Incumbent Price * 100
- [x] 12.5 Add route and API client function for price breaks

## 13. Positions — Tax Lots

- [x] 13.1 Add tax lots endpoint to `positions_views.py`: `GET /api/events/{eventId}/funds/{account}/positions/tax-lots`
- [x] 13.2 Create `frontend/src/pages/PositionsTaxLots/PositionsTaxLots.tsx` — AG-Grid with lot-level columns, grouped by security
- [x] 13.3 Implement lot grouping with AG-Grid row grouping by Primary Asset ID
- [x] 13.4 Implement Gain/Loss computation: Market Value minus Cost Basis per lot
- [x] 13.5 Implement tie-out validation: sum of lot values vs position-level values with pass/fail indicator
- [x] 13.6 Add route and API client function for tax lots

## 14. Income — Dividends

- [x] 14.1 Create `backend/api/routers/income_views.py` with endpoints: `GET /api/events/{eventId}/funds/{account}/income/dividends` (high-level) and `GET /.../dividends/{assetId}/detail` (drilldown), plus event-wide variants
- [x] 14.2 Create `frontend/src/pages/IncomeDividends/IncomeDividends.tsx` — AG-Grid with high-level aggregated income columns (net, gross, withholding, reclaim in base + local currency)
- [x] 14.3 Implement expandable row drilldown (Security Level): individual dividend events by XD date and pay date with rate comparison
- [x] 14.4 Implement Fund Level drilldown view: all dividend events across all securities
- [x] 14.5 Implement ledger tie-back validation: Total Net Income Difference ties to Dividend RecPay TB sub-classification
- [x] 14.6 Add break resolution columns (Break Team, Owner, Category, Comment) to dividend grid
- [x] 14.7 Add routes (fund-scoped and event-scoped) and API client functions

## 15. Income — Fixed Income

- [x] 15.1 Add fixed income endpoints to `income_views.py`: `GET /api/events/{eventId}/funds/{account}/income/fixed-income` (high-level) and detail drilldown
- [x] 15.2 Create `frontend/src/pages/IncomeFixedIncome/IncomeFixedIncome.tsx` — AG-Grid following same pattern as dividends
- [x] 15.3 Implement coupon-specific drilldown columns: Prior Coupon Date, Next Coupon Date, Payment Frequency, BNY/Incumbent Coupon Rate, Coupon Rate Difference
- [x] 15.4 Add break resolution columns and routes (fund-scoped and event-scoped)

## 16. Derivatives — Forwards

- [x] 16.1 Create `backend/api/routers/derivatives_views.py` with endpoints: `GET /api/events/{eventId}/funds/{account}/derivatives/forwards` and event-wide variant
- [x] 16.2 Create `frontend/src/pages/DerivativesForwards/DerivativesForwards.tsx` — AG-Grid with forward contract columns (buy/sell currency, trade/settlement date, notional amounts, unrealised G/L comparison)
- [x] 16.3 Add break resolution columns and route

## 17. Derivatives — Futures

- [x] 17.1 Add futures endpoints to `derivatives_views.py`: `GET /api/events/{eventId}/funds/{account}/derivatives/futures` and event-wide variant
- [x] 17.2 Create `frontend/src/pages/DerivativesFutures/DerivativesFutures.tsx` — AG-Grid with futures contract columns (contract size, maturity, contracts, price, market value)
- [x] 17.3 Implement % Price Difference computation for futures
- [x] 17.4 Add break resolution columns and route

## 18. Auto-Assignment & Notification Engine

- [x] 18.1 Create `backend/api/routers/notifications.py` with endpoints: `GET /api/notifications`, `PUT /api/notifications/{id}/read`, `GET /api/notifications/count`
- [x] 18.2 Implement auto-assignment engine module `backend/services/auto_assignment.py`: rule table lookup, round-robin counter per team/event, break assignment record creation, notification record creation
- [x] 18.3 Integrate auto-assignment into the validation pipeline — call engine after break detection for share breaks, price breaks, income breaks, reclaim breaks
- [x] 18.4 Implement round-robin distribution logic with availability checks (skip unavailable team members)
- [x] 18.5 Implement WebSocket notification broadcast to assigned owners on auto-assignment
- [x] 18.6 Create frontend `NotificationBell` component — bell icon with unread count badge in MainLayout header
- [x] 18.7 Create notification dropdown panel — list recent notifications with break type, security, fund, timestamp; click navigates to relevant view
- [x] 18.8 Add API client functions: `fetchNotifications()`, `markNotificationRead()`, `fetchNotificationCount()`

## 19. Commentary Rollup

- [x] 19.1 Create `backend/api/routers/commentary.py` with CRUD endpoints: `GET /api/events/{eventId}/funds/{account}/commentary`, `POST`, `PUT /{commentId}`, `DELETE /{commentId}`
- [x] 19.2 Add rollup endpoint: `GET /api/events/{eventId}/funds/{account}/commentary/rollup?level={level}` — runs MongoDB aggregation pipeline grouping by breakCategory, summing amounts, collecting entries
- [x] 19.3 Implement rollup caching with 60-second TTL — cache invalidation on `COMMENTARY_ADDED` WebSocket events
- [x] 19.4 Implement commentary editor React component: multi-entry editor with break category tag, amount field, KD reference selector, and text area
- [x] 19.5 Integrate commentary display at all levels: position grid inline, TB structured comments, scorecard summary
- [x] 19.6 Implement WebSocket `COMMENTARY_ADDED` broadcast and real-time commentary count updates
- [x] 19.7 Add API client functions: `fetchCommentary()`, `createCommentary()`, `updateCommentary()`, `deleteCommentary()`, `fetchCommentaryRollup()`

## 20. Export & Audit Trail

- [x] 20.1 Create `backend/api/routers/export.py` with endpoint: `POST /api/export/excel` — accepts viewType, eventId, filters; generates .xlsx via openpyxl; returns StreamingResponse
- [x] 20.2 Implement Excel formatting: RAG conditional cell colors, number formats (#,##0.00), column widths, commentary inclusion, metadata header row
- [x] 20.3 Implement openpyxl write-only mode for large datasets (1000+ rows) to manage memory
- [x] 20.4 Create `backend/api/routers/audit.py` with endpoint: `GET /api/events/{eventId}/audit` — filtered by action, entity, date range, user; paginated
- [x] 20.5 Implement audit write utility function `log_audit(eventId, action, entityRef, prevValue, newValue, userId)` called from all mutation endpoints
- [x] 20.6 Integrate audit logging into all existing mutation flows: allocation changes, break category changes, team reassignments, review status changes, commentary edits, KD overrides
- [x] 20.7 Add export button component to all grid views (respecting RBAC `exportScope`)
- [x] 20.8 Add API client functions: `exportToExcel()`, `fetchAuditLogs()`

## 21. Navigation & Routing Integration

- [x] 21.1 Add all new routes to `frontend/src/App.tsx` with `React.lazy()` imports and `Suspense` fallbacks
- [x] 21.2 Extend `DrillDownProvider` context state with new view states: `shareClassView`, `scorecardView`, `ragTrackerView`, `positionSubView`, `incomeView`, `derivativesView`
- [x] 21.3 Implement context propagation rules for new navigation paths (NAV → Share Class, NAV → Scorecard, Positions → Sub-views, Fund → Income, Fund → Derivatives)
- [x] 21.4 Extend breadcrumb navigation to generate correct breadcrumb segments for all new routes
- [x] 21.5 Create `BreakResolutionContext` provider for shared state: selected break category filter, active KD list, notification count
- [x] 21.6 Integrate RBAC route guards: check `canAccessScreen()` before rendering new page components; redirect unauthorized users to `defaultRoute`

## 22. Event Dashboard Enhancements

- [x] 22.1 Add reviewer allocation summary to event cards: "X of Y reviewers assigned" fetched from allocations API
- [x] 22.2 Enhance Fund Progress Bar with break category distribution tooltip on hover
- [x] 22.3 Add review completion indicator: "N% reviewed" for most recent valuation date
- [x] 22.4 Add "Roster" action link on event cards navigating to `/events/:eventId/allocations`
- [x] 22.5 Extend Activity Feed with break resolution events: categorizations, sign-offs, auto-assignments

## 23. Seed Data & Demo Data

- [x] 23.1 Create seed data for reviewer allocations across parallel period dates
- [x] 23.2 Create seed data for known differences (KD 1–5 + SC 1–2 samples)
- [x] 23.3 Create seed data for break assignments with sample categorizations across positions, income, derivatives
- [x] 23.4 Create seed data for commentary at L2 (position) and L1 (GL) levels with break category tags and KD references
- [x] 23.5 Create seed data for notifications (sample auto-assignment notifications)
- [x] 23.6 Create seed data for share class NAV comparison, client scorecard, and RAG tracker views

## 24. Testing & Performance Validation

- [x] 24.1 Write backend unit tests for auto-assignment engine: rule matching, round-robin distribution, notification creation
- [x] 24.2 Write backend unit tests for commentary rollup aggregation pipeline
- [x] 24.3 Write backend unit tests for adjusted RAG calculation (scorecard)
- [x] 24.4 Write backend integration tests for all new API endpoints (allocations, KDs, breaks, commentary, notifications, export, audit)
- [x] 24.5 Write frontend component tests for shared components: BreakCategorySelector, BreakTeamDropdown, ReviewStatusBadge, NotificationBell, CommentaryEditor
- [x] 24.6 Validate performance targets: Fund Level <500ms, Share Class <1s, Scorecard <800ms, Full Portfolio <1.5s, Commentary Rollup <2s, WebSocket <200ms, Export <5s
- [x] 24.7 Write RBAC integration tests: verify each of 7 roles can access only permitted screens and actions
