## Why

The RECON-AI platform currently supports event management, NAV-level comparison, trial balance reconciliation, and position drill-down — but lacks the complete break resolution lifecycle needed for production fund conversions. The ACE Fund Onboarding conversion requires daily reviewer allocation, break categorization with team assignment, known difference tracking, client-facing scorecards with adjusted RAG, and reconciliation views for income and derivatives asset classes. Without these capabilities, conversion managers cannot track green days, assign breaks to responsible teams, or produce client-reportable reconciliation status.

## What Changes

- **Reviewer Allocation**: New roster management module for daily reviewer-to-fund assignment with matrix grid, bulk operations, and audit logging
- **Break Categorization & Team Assignment**: Taxonomy of break categories (Known Difference, BNY to Resolve, Incumbent to Resolve, Under Investigation, Match) with review status workflow and team-to-owner routing
- **Known Differences Configuration**: Configurable library of documented methodology/processing differences with standard commentary templates that feed into Client Scorecard KD columns
- **NAV Share Class Dashboard**: New granular share class decomposition view with per-share NAV, local/base currency comparison, and prior day movement analysis
- **NAV Client Scorecard**: New client-facing adjusted RAG view subtracting Known Differences from raw NAV differences to calculate adjusted basis points for green day determination
- **NAV RAG Status Tracker**: New day-over-day matrix view tracking adjusted BP across the parallel period for conversion readiness monitoring
- **Positions Share Breaks**: New filtered view of share mismatches with auto-assignment to BNY Trade Capture and match status tracking
- **Positions Price Breaks**: New filtered view of pricing discrepancies with auto-assignment to BNY Pricing team
- **Positions Tax Lots**: New lot-level reconciliation for cost basis, acquisition date, and per-lot gain/loss
- **Income Reconciliation**: New dividend and fixed income reconciliation views (high-level aggregation + detailed drilldown by security/fund) with XD date, rates, withholding, and reclaim analysis
- **Derivatives Reconciliation**: New forwards (FX) and futures reconciliation views with contract-level comparison
- **Auto-Assignment & Notification Engine**: Intelligent break routing rules that auto-populate team assignments based on break type with in-app/email notifications
- **Commentary Rollup**: Bottom-up commentary flow from transaction level (L4) through positions (L3) → trial balance (L2) → client scorecard (L1) creating coherent narratives at every level
- **Export & Audit Trail**: Excel/PDF export for all grid views with metadata headers; comprehensive audit trail for all reviewer actions, break assignments, commentary, and KD overrides
- **Enhanced NAV Dashboard**: Existing NAV dashboard gains reviewer column, review status, and break category filtering
- **Enhanced Trial Balance**: Existing TB gains structured multi-line commentary organized by break category, and sidebar BS/P&L cross-check summary
- **Enhanced Position Drill-Down**: Existing position view gains break team, owner, category, and comment resolution columns
- **Enhanced Navigation**: New routes for all new views integrated into the drill-down hierarchy

## Capabilities

### New Capabilities
- `reviewer-allocation`: Daily roster management — matrix grid mapping reviewers to fund accounts across the parallel period, with bulk assignment, availability overlay, copy-forward, and allocation audit trail
- `break-categorization`: Break category taxonomy (KD, BNY to Resolve, Incumbent to Resolve, Under Investigation, Match), review status workflow (Not Started → In Progress → Complete), and break team assignment configuration (FA Conversions, BNY Trade Capture, BNY Pricing, BNY Corporate Actions, BNY NAV Ops, Incumbent)
- `known-differences`: Configurable KD/SC library with reference codes, type (Methodology/Processing), standard commentary templates, and event-scoping — feeds dynamic KD columns into Client Scorecard
- `nav-share-class`: Share class level NAV reconciliation dashboard with units, net assets, NAV per share in both base and local currency, share class percentage, share movement, and prior day NAV data for movement analysis
- `nav-client-scorecard`: Client-facing scorecard view with raw NAV differences, dynamically-generated KD columns (KD 1–5 + configurable), Incumbent to Resolve, adjusted net assets difference, adjusted basis points, adjusted RAG status, reviewer sign-off, and manual KD override capability
- `nav-rag-tracker`: Day-over-day matrix view — rows are funds, columns are parallel period dates, cells show adjusted BP color-coded by RAG thresholds — for tracking conversion readiness and green day streaks
- `positions-share-breaks`: Filtered position view showing only share mismatches with match status (Match, BNY Only, Incumbent Only, Matched with Differences), auto-assignment to BNY Trade Capture, and break resolution tracking
- `positions-price-breaks`: Filtered position view showing only price discrepancies with percentage price difference, base/local market value impact, auto-assignment to BNY Pricing team, and break resolution tracking
- `positions-tax-lots`: Lot-level position reconciliation showing individual acquisition lots per security with cost basis, acquisition date, and per-lot gain/loss comparison between BNY and Incumbent
- `income-reconciliation`: Dividend and fixed income reconciliation — high-level aggregation (net income, gross, withholding, reclaim by security) and detailed drilldown (individual dividend events by XD/pay date with rate comparison; coupon events with frequency and accrual)
- `derivatives-reconciliation`: FX forward reconciliation (buy/sell currency, trade/settlement date, notional amounts, unrealised G/L) and futures reconciliation (contract size, maturity, contracts, price, market value, margin)
- `auto-assignment-engine`: Rule-based auto-assignment engine that populates break team and owner based on break type triggers (share break → Trade Capture, price break → Pricing, income break → NAV Ops, etc.) with round-robin owner assignment and in-app/email notification dispatch
- `commentary-rollup`: Bottom-up commentary aggregation from L4 (transaction/lot) → L3 (position/income event) → L2 (trial balance sub-classification) → L1 (client scorecard) with break category tagging, monetary amount attribution, and KD reference linking
- `export-audit`: Excel (.xlsx) and PDF export for all grid views with conditional formatting, commentary, and metadata headers; comprehensive audit trail capturing all reviewer allocations, break category changes, team re-assignments, review status transitions, commentary edits, and KD overrides

### Modified Capabilities
- `nav-dashboard`: Add reviewer column from roster, review status indicator, and integration with break categorization for filtering/sorting by break severity
- `trial-balance`: Add structured multi-line commentary organized by break category per TB sub-classification (Section 6.2 pattern), sidebar BS/P&L cross-check summary panel, and expanded TB sub-classification taxonomy (Cash, Dividends Receivable, Fixed Interest Receivable, Foreign Exchange, Futures Variation Margin, Reclaims Receivable, Securities at Value, Accrued Expenses, etc.)
- `position-drill-down`: Add break team assignment, break owner, break category, and comment columns to the position grid for resolution tracking; integrate with auto-assignment engine
- `event-dashboard`: Add reviewer allocation summary to event cards; surface break category distribution in fund progress visualization
- `drill-down-navigation`: Add routes for new views (share class, client scorecard, RAG tracker, share breaks, price breaks, tax lots, income, derivatives, reviewer allocation) and extend breadcrumb/context propagation

## Impact

**Frontend**:
- 10+ new page components (share class, scorecard, RAG tracker, share/price breaks, tax lots, dividends, fixed income, forwards, futures, reviewer allocation)
- Enhanced AG-Grid configurations across all views with break resolution columns
- New shared components: break category selector, team assignment dropdown, commentary editor, KD column generator, review status badge, notification bell
- New routes and drill-down context extensions
- WebSocket integration for real-time multi-user updates (<200ms latency)

**Backend API**:
- ~25 new REST endpoints: reviewer allocation CRUD, known differences CRUD, break categorization, auto-assignment, commentary rollup, notification dispatch, export generation, audit trail queries
- New API resources: allocations, known-differences, break-assignments, notifications, commentary, audit-logs, scorecards, share-classes
- WebSocket server for real-time push updates

**Data Model**:
- New MongoDB collections: reviewer_allocations, known_differences, break_assignments, notifications, commentary, audit_logs
- Extended schemas: position records gain break fields, TB records gain structured commentary, NAV records gain reviewer/status fields

**Dependencies**:
- Excel export library (openpyxl or similar for server-side .xlsx generation)
- PDF generation library for client scorecard export
- WebSocket support (FastAPI WebSockets or Socket.IO)

**Performance Targets**:
- Fund Level Dashboard: <500ms (50 funds)
- Share Class Dashboard: <1s (200+ share classes)
- Client Scorecard: <800ms (50 funds, 5+ KD columns)
- Full Portfolio Grid: <1.5s (500+ positions)
- Commentary Rollup: <2s (full L4→L1 for one fund)
- Real-time updates: <200ms (WebSocket)
- Export to Excel: <5s (1000+ rows)
