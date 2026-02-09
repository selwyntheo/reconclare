# RECON-AI Control Center

## Event-Driven Multi-Level Reconciliation User Experience Specification

| | |
|---|---|
| **Version:** | 1.0 |
| **Date:** | February 2026 |
| **Domain:** | Fund Administration |
| **Classification:** | Internal - Confidential |

**CONFIDENTIAL — For Internal Use Only**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Information Architecture](#2-information-architecture)
3. [UX Design Specification](#3-ux-design-specification)
4. [Workflow Specifications](#4-workflow-specifications)
5. [Data Model](#5-data-model)
6. [Technical Requirements](#6-technical-requirements)
7. [Security and Compliance](#7-security-and-compliance)
8. [Implementation Phases](#8-implementation-phases)
9. [Appendix](#9-appendix)

---

## 1. Executive Summary

### 1.1 Purpose

The RECON-AI Control Center is the primary operational interface for managing fund conversion events during the production parallel phase. It provides a unified view of multi-fund migration projects, enabling operations teams to execute validation checks, monitor AI-powered break analysis, and coordinate human review workflows across the entire conversion lifecycle.

### 1.2 Key Capabilities

- Event-level orchestration of fund conversion activities across multiple funds
- Date-driven validation execution with configurable check suites
- Real-time AI agent analysis with confidence scoring and pattern matching
- Human-in-the-loop annotation and approval workflows
- Audit-ready reporting with complete traceability

### 1.3 Target Users

| Role | Primary Activities | Access Level |
|---|---|---|
| Conversion Manager | Event creation, milestone tracking, sign-off | Full access |
| Fund Accountant | Validation execution, break review, annotation | Fund-level |
| Operations Analyst | AI analysis review, pattern curation | Analysis access |
| Auditor | Read-only access to reports and audit trails | View only |

---

## 2. Information Architecture

### 2.1 Core Entity Model

The Control Center organizes information around a three-tier hierarchy that reflects the operational reality of fund conversion projects.

#### 2.1.1 Event

An Event represents a cohesive conversion initiative, typically corresponding to a client relationship or fund family being migrated from an incumbent service provider to BNY.

- **Event ID:** Unique identifier (e.g., EVT-2026-001)
- **Event Name:** Descriptive name (e.g., "Vanguard Fixed Income Migration")
- **Incumbent Provider:** Source system (e.g., State Street, Northern Trust)
- **Target Go-Live Date:** Planned production cutover date
- **Status:** Draft, Active, Parallel, Signed-Off, Complete

#### 2.1.2 Fund

A Fund is an individual mutual fund or ETF being converted within an Event. Each fund has its own NAV cycle, share classes, and reconciliation requirements.

- **Fund ID:** Portfolio account identifier from the canonical model
- **Fund Name:** Legal fund name
- **Fund Type:** Equity, Fixed Income, Multi-Asset, Money Market
- **Share Classes:** List of share class identifiers
- **Status:** Pending, In Parallel, Passed, Failed, Signed-Off

#### 2.1.3 Validation Run

A Validation Run represents the execution of data validation checks for a specific valuation date across all funds in an Event.

- **Run ID:** Unique identifier with timestamp
- **Valuation Date:** The NAV date being validated
- **Check Suite:** Which validation rules were executed
- **Status:** Queued, Running, Complete, Failed

### 2.2 Validation Check Framework

The validation framework implements the multi-level reconciliation model, executing checks at each tier:

| Level | Check Name | Description | LHS | RHS |
|---|---|---|---|---|
| L0 | NAV to Ledger | NAV ties to GL balance sheet | dataNav | dataLedger |
| L1 | Ledger BS to INCST | Balance sheet ties to income statement | dataLedger | dataLedger |
| L1 | Ledger TF to Class | Total fund ties to share class rollup | dataLedger | dataLedger |
| L2 | Position to Lot | Position totals match lot-level sum | dataSubLedgerTrans | dataSubLedgerPosition |
| L2 | Ledger to Subledger | GL balances match derived subledger | dataLedger | derivedSubLedgerRollup |
| L2 | Basis Lot Check | Primary basis matches tax basis shares | dataSubLedgerTrans | dataSubLedgerTrans |

---

## 3. UX Design Specification

### 3.1 Design Principles

1. **Progressive Disclosure:** Start with event-level summary, drill into fund and break details on demand.
2. **Contextual Intelligence:** Surface AI insights at the moment of decision, not buried in separate reports.
3. **Confidence-First:** Always show confidence scores alongside AI recommendations to calibrate human trust.
4. **Audit Trail Native:** Every action and decision is logged and attributable by design.
5. **Keyboard-First:** Power users can navigate entirely via keyboard shortcuts for maximum efficiency.

### 3.2 Primary Views

#### 3.2.1 Event Dashboard (Home)

The Event Dashboard is the landing page providing a portfolio view of all active conversion events.

**Layout Structure:**

- **Header Bar:** Global navigation, user profile, notifications bell, quick search
- **Event Cards Grid:** Visual cards for each event showing status, fund count, and health indicators
- **Quick Filters:** Status filter, date range, assigned to me
- **Activity Feed (Right Panel):** Recent validation runs, AI analysis completions, human annotations

**Event Card Components:**

- Event name and ID
- Progress bar showing funds passed vs. total
- Status badge with color coding
- Sparkline showing 7-day break trend
- Quick action buttons: Run Validation, View Details

**Wireframe:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  RECON-AI Control Center              [Search] [Notifications] [User]│
├──────────────────────────────────────────────────────────────────────┤
│  Filter: [All Events] [Active] [Date Range] [My Events]             │
├─────────────────────────────────────────────────┬────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐       │  ACTIVITY FEED     │
│  │  EVT-2026-001   │  │  EVT-2026-002   │       │                    │
│  │  Vanguard FI    │  │  Fidelity Equity │       │  * Validation run  │
│  │  ████████░░ 80% │  │  ██████████ 100% │       │    completed for   │
│  │  12 funds pass  │  │  All passed      │       │    EVT-001         │
│  │  3 attention    │  │                  │       │    2 min ago       │
│  │  [Run] [Details]│  │  [View Report]   │       │                    │
│  └─────────────────┘  └─────────────────┘       │  * AI analysis     │
│                                                  │    complete         │
│  ┌─────────────────┐  ┌─────────────────┐       │    for Fund ABC    │
│  │  EVT-2026-003   │  │  EVT-2026-004   │       │    5 min ago       │
│  │  T. Rowe Price  │  │  American Funds  │       │                    │
│  │  ██░░░░░░░░ 20% │  │  Draft           │       │  [View All]        │
│  │  [Run] [Details]│  │  [Configure]     │       │                    │
│  └─────────────────┘  └─────────────────┘       │                    │
└─────────────────────────────────────────────────┴────────────────────┘
```

#### 3.2.2 Event Detail View

The Event Detail View provides comprehensive management of a single conversion event.

**Validation Control Panel:**

- **Date Picker:** Calendar control to select valuation date(s) for validation
- **Check Suite Selector:** Multi-select for which validation rules to execute
- **Fund Filter:** Option to run for all funds or selected subset
- **Run Validation Button:** Primary action with loading state
- **Schedule Button:** Set up recurring validation runs

**Fund Status Grid Columns:**

- **Fund Name** — Linked to fund drill-down view
- **Status** — Visual indicator: Green (Pass), Yellow (Warning), Red (Break)
- **Last Run** — Timestamp of most recent validation
- **Break Count** — Number of breaks with severity breakdown
- **AI Status** — Analyzing, Complete (X% confident), Needs Review
- **Human Review** — Pending, In Progress, Approved, Rejected

**Wireframe:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back   EVT-2026-001: Vanguard Fixed Income    [Status: Active]   │
├──────────────────────────────────────────────────────────────────────┤
│  Timeline: [*]────────[*]────────[○]────────[○]                      │
│            Parallel    Recon      Sign-off   Go-Live                 │
├──────────────────────────────────────────────────────────────────────┤
│  VALIDATION CONTROLS                                                 │
│  ┌────────────────┐  ┌────────────────────┐  ┌───────────────────┐  │
│  │ Valuation Date │  │ Check Suite        │  │ Fund Selection    │  │
│  │ [Feb 7, 2026]  │  │ [x] NAV to Ledger  │  │ (*) All Funds     │  │
│  │                │  │ [x] Ledger to Sub  │  │ ( ) Selected Only │  │
│  └────────────────┘  │ [x] Position Lot   │  └───────────────────┘  │
│                      └────────────────────┘                          │
│                      [>> RUN VALIDATION]  [Schedule]                 │
├──────────────────────────────────────────────────────────────────────┤
│  FUND STATUS                                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Fund Name        │Status│Last Run │Breaks│AI Status│Review    │  │
│  ├──────────────────┼──────┼─────────┼──────┼─────────┼──────────┤  │
│  │ VG Bond Index    │  ✓   │ 08:30AM │  0   │Complete │ Approved │  │
│  │ VG Corp Bond     │  !   │ 08:32AM │  2   │  89%    │ Pending  │  │
│  │ VG High Yield    │  X   │ 08:35AM │  5   │Analyzing│ Waiting  │  │
│  │ VG Treasury      │  ✓   │ 08:31AM │  0   │Complete │ Approved │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

#### 3.2.3 Validation Run View

Shows results of a specific validation execution, serving as the primary workspace for break analysis.

**Run Summary Header:**

- Valuation date, execution timestamp, and duration
- Overall result: Passed, Attention, Failed
- Count badges: X funds passed, Y with warnings, Z with breaks

**Validation Results Table:**

- Expandable rows grouped by validation check (NAV to Ledger, Position to Lot, etc.)
- Within each check, rows for each fund showing pass/fail status
- Expansion reveals individual break records with variance amounts
- Click-through to AI analysis panel for any break row

**AI Analysis Panel (Slide-out):**

- **Root Cause Summary:** Plain-language explanation in 2-3 sentences
- **Confidence Score:** Percentage with visual gauge (green >85%, yellow 70-85%, red <70%)
- **Evidence Chain:** Numbered steps showing the drill-down path from NAV to root cause
- **Break Classification:** Category and sub-category from taxonomy
- **Similar Historical Breaks:** Cards showing past breaks with same pattern
- **Recommended Actions:** Specific steps to resolve

#### 3.2.4 Fund Break Detail View

Deep-dive view for analyzing all breaks within a single fund.

**NAV Waterfall Chart:**

- Starting bar: Incumbent NAV
- Component bars: Each GL category's contribution
- Ending bar: CPU NAV
- Bars colored by break severity; click any bar to filter detail table

**Reconciliation Tree:**

- L0: NAV node with total variance
- L1: GL category nodes showing their contribution
- L2: Position nodes within each GL category
- L3: Transaction leaf nodes
- Node colors indicate status; expand/collapse all controls

**Transaction Detail Grid:**

- Side-by-side CPU vs. Incumbent values
- Variance column with conditional formatting
- Security, counterparty, trade date, settle date, amount fields
- Export to Excel functionality

**Wireframe:**

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← EVT-001 > VG High Yield Fund > Feb 7, 2026                       │
├───────────────────────────────────────────┬──────────────────────────┤
│  NAV WATERFALL                            │  AI ANALYSIS             │
│                                           │                          │
│  Incumbent NAV  ██████████████ $125.42M   │  ROOT CAUSE              │
│  Inv at Market  ────██─────── -$18,200    │  ─────────────           │
│  Accrued Income ────████───── +$24,500    │  Day count convention    │
│  Payables       ────█──────── -$2,100     │  mismatch: CPU uses      │
│  Receivables    ────██─────── +$4,200     │  ACT/ACT, Incumbent      │
│  CPU NAV        ██████████████ $125.428M  │  uses 30/360 for         │
│                                           │  CUSIP 789456123.        │
│  Total Variance: +$8,400                  │                          │
│                                           │  CONFIDENCE: 91%         │
├───────────────────────────────────────────│  [██████████████░]       │
│  RECONCILIATION TREE                      │                          │
│                                           │  EVIDENCE CHAIN          │
│  v L0: NAV ($8,400)                       │  ─────────────           │
│    v L1: Accrued Income ($24,500)         │  1. NAV variance of      │
│      v L2: Fixed Income Positions         │     $24.5K in Accrued    │
│        > CUSIP 789456123 ($15,200)        │     Income               │
│        > CUSIP 456789012 ($6,800)         │  2. Position 789456123   │
│      > L2: Equity Positions ($0)          │     has $15.2K diff      │
│    > L1: Investment at Market (-$18,200)  │  3. Day count: ACT/ACT   │
│    > L1: Receivables ($4,200)             │     = 32 days, 30/360    │
│                                           │     = 30 days            │
├───────────────────────────────────────────│                          │
│  TRANSACTION DETAIL                       │  SIMILAR BREAKS          │
│  ┌──────────────────────────────────────┐ │  ─────────────           │
│  │Security │CPU Accrual│Incumb │Var     │ │  * Fund DEF, Jan 2026   │
│  ├──────────┼──────────┼───────┼────────┤ │  * Fund GHI, Dec 2025   │
│  │789456123 │$42,350.00│$27,150│+$15.2K │ │                          │
│  │456789012 │$18,900.00│$12,100│+$6.8K  │ │  [Feedback: Good/Bad]   │
│  └──────────────────────────────────────┘ │                          │
└───────────────────────────────────────────┴──────────────────────────┘
```

#### 3.2.5 Human Review Workflow

The annotation and approval interface for human accountants.

**Review Queue:**

- Filtered list of breaks requiring human review
- Priority sorting by variance magnitude, confidence score, or age
- Batch selection for bulk actions
- Assignment controls for distributing work

**Annotation Interface:**

- **AI Analysis Display:** Read-only view of agent findings
- **Reviewer Actions:** Accept AI Analysis, Modify Root Cause, Reject and Escalate
- **Annotation Text Field:** Free-form notes explaining decision rationale
- **Resolution Category:** Dropdown matching break taxonomy
- **Audit Signature:** Reviewer name, timestamp, role automatically captured

---

## 4. Workflow Specifications

### 4.1 Daily Validation Workflow

The standard daily workflow for executing and reviewing validations:

1. **Login and Review Event Dashboard:** Conversion Manager reviews all active events, noting any with overnight alerts.
2. **Select Event and Set Valuation Date:** Navigate to specific event, select the valuation date using the date picker.
3. **Configure and Execute Validation:** Select appropriate check suite, optionally filter funds, click Run Validation.
4. **Monitor Validation Progress:** Real-time progress indicator shows funds being processed. Typical runtime: 2-5 minutes.
5. **Review Validation Results:** Examine results table, sorted by status (breaks first). Identify funds requiring attention.
6. **AI Analysis Triage:** For each fund with breaks, review AI analysis. Accept high-confidence (>85%), queue medium for review.
7. **Human Review Queue:** Fund Accountants process review queue, annotating each break with decision and rationale.
8. **Resolution Actions:** Create action items for breaks requiring system changes.
9. **Daily Sign-off:** Conversion Manager reviews completed analyses and approves daily reconciliation batch.

### 4.2 AI Agent Integration Points

| Integration Point | Agent Invoked | Trigger | Output |
|---|---|---|---|
| Validation Complete | Supervisor Agent | Break detected | Analysis initiated |
| Break Analysis | L0-L3 Level Agents | Supervisor dispatches | Root cause findings |
| Specialist Analysis | Pricing/Accrual/FX Agents | Domain-specific break | Detailed calculation |
| Pattern Matching | Pattern Agent | Analysis complete | Historical matches |
| Human Feedback | GraphRAG Update | Reviewer decision | Pattern enrichment |

### 4.3 State Machine: Break Lifecycle

Every break progresses through defined states with clear transitions:

```
┌─────────────┐
│  DETECTED   │ ─── Validation identifies variance
└──────┬──────┘
       │ Automatic
       v
┌─────────────┐
│  ANALYZING  │ ─── AI agents processing
└──────┬──────┘
       │ Agent complete
       v
┌───────────┴───────────┐
│                       │
Confidence ≥85%    Confidence <85%
│                       │
v                       v
┌─────────────┐   ┌─────────────┐
│  AI PASSED  │   │HUMAN REVIEW │ ─── In review queue
└──────┬──────┘   │   PENDING   │
       │          └──────┬──────┘
       │                 │ Analyst picks up
       │                 v
       │          ┌─────────────┐
       │          │  IN REVIEW  │ ─── Analyst working
       │          └──────┬──────┘
       │                 │
       │     ┌───────────┼───────────┐
       │     │           │           │
       │   Accept     Modify     Reject
       │     │           │           │
       │     v           v           v
       │  ┌───────────┐ ┌───────────┐ ┌───────────┐
       │  │ APPROVED  │ │ MODIFIED  │ │ ESCALATED │
       └─>│           │ │           │ │           │
          └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
                │             │             │
                └──────┬──────┴──────┬──────┘
                       │             │
                   Has action?   No action
                       │             │
                       v             v
                ┌───────────┐ ┌───────────┐
                │  ACTION   │ │  CLOSED   │
                │  PENDING  │ │           │
                └─────┬─────┘ └───────────┘
                      │
                  Action complete
                      v
                ┌───────────┐
                │  RESOLVED │
                └───────────┘
```

---

## 5. Data Model

### 5.1 Event Entity

| Field | Type | Required | Description |
|---|---|---|---|
| eventId | String | Yes | Unique event identifier |
| eventName | String | Yes | Descriptive event name |
| incumbentProvider | String | Yes | Source system provider name |
| status | Enum | Yes | DRAFT, ACTIVE, PARALLEL, SIGNED_OFF, COMPLETE |
| parallelStartDate | Date | No | First date of parallel processing |
| targetGoLiveDate | Date | Yes | Planned production cutover |
| assignedTeam | Array[User] | Yes | Team members assigned to event |
| funds | Array[Fund] | Yes | Funds included in this event |

### 5.2 Fund Entity

| Field | Type | Required | Description |
|---|---|---|---|
| account | String | Yes | Portfolio account ID (canonical model key) |
| fundName | String | Yes | Legal fund name |
| fundType | Enum | Yes | EQUITY, FIXED_INCOME, MULTI_ASSET, MONEY_MARKET |
| shareClasses | Array[String] | Yes | Share class identifiers |
| status | Enum | Yes | PENDING, IN_PARALLEL, PASSED, FAILED, SIGNED_OFF |

### 5.3 ValidationRun Entity

| Field | Type | Required | Description |
|---|---|---|---|
| runId | String | Yes | Unique run identifier |
| eventId | Ref[Event] | Yes | Parent event reference |
| valuationDt | Date | Yes | NAV date being validated |
| executionTime | Timestamp | Yes | When validation was triggered |
| checkSuite | Array[CheckType] | Yes | Which checks were executed |
| status | Enum | Yes | QUEUED, RUNNING, COMPLETE, FAILED |

### 5.4 BreakRecord Entity

| Field | Type | Required | Description |
|---|---|---|---|
| breakId | String | Yes | Unique break identifier |
| validationRunId | Ref[ValidationRun] | Yes | Parent validation run |
| fundAccount | String | Yes | Fund portfolio account |
| checkType | Enum | Yes | Which validation check found this |
| level | Enum | Yes | L0, L1, L2, L3 |
| lhsValue | Decimal | Yes | Left-hand side comparison value |
| rhsValue | Decimal | Yes | Right-hand side comparison value |
| variance | Decimal | Yes | Calculated difference |
| state | Enum | Yes | State machine status (see 4.3) |
| aiAnalysis | Ref[AIAnalysis] | No | AI agent analysis results |
| humanAnnotation | Ref[Annotation] | No | Human reviewer annotation |

### 5.5 AIAnalysis Entity

| Field | Type | Required | Description |
|---|---|---|---|
| analysisId | String | Yes | Unique analysis identifier |
| rootCauseSummary | String | Yes | Plain-language explanation |
| confidenceScore | Decimal | Yes | 0.0-1.0 confidence percentage |
| evidenceChain | Array[EvidenceStep] | Yes | Ordered reasoning steps |
| breakCategory | Enum | Yes | TIMING, METHODOLOGY, DATA, etc. |
| similarBreaks | Array[Ref[Break]] | No | Historical pattern matches |
| recommendedActions | Array[ActionItem] | No | Suggested resolution steps |

---

## 6. Technical Requirements

### 6.1 Frontend Technology Stack

| Component | Technology | Rationale |
|---|---|---|
| Framework | React 18+ | Aligned with existing CPU platform standards |
| State Management | Redux Toolkit + RTK Query | Caching, optimistic updates, real-time sync |
| Data Grid | AG-Grid Enterprise | High-performance grid with grouping, filtering, export |
| Charting | D3.js + Recharts | Custom waterfall charts, tree visualizations |
| UI Components | Radix UI + Tailwind CSS | Accessible primitives with custom styling |
| Real-time | WebSocket + SSE | Live validation progress, AI analysis updates |

### 6.2 Performance Requirements

| Metric | Target | Measurement |
|---|---|---|
| Initial Page Load | < 2 seconds | Time to First Contentful Paint |
| Event Dashboard Render | < 500ms | 50 events with status data |
| Validation Results Grid | < 1 second | 1000 rows with grouping |
| Real-time Update Latency | < 200ms | WebSocket message to UI update |
| AI Analysis Panel Load | < 300ms | After selecting a break |

### 6.3 Accessibility Requirements

- WCAG 2.1 AA compliance for all interactive elements
- Full keyboard navigation support with visible focus indicators
- Screen reader compatibility with ARIA labels and live regions
- Color contrast ratios meeting AA standards (4.5:1 for text)
- Alternative text for all data visualizations

---

## 7. Security and Compliance

### 7.1 Access Control

- Role-based access control (RBAC) aligned with existing CPU platform permissions
- Event-level access grants: users see only events they are assigned to
- Fund-level filtering: accountants see only their assigned fund families
- Audit-only role for external reviewers with no modification capabilities

### 7.2 Audit Trail

Every user action and system event is logged with:

- Timestamp (UTC with millisecond precision)
- User ID and role at time of action
- Action type (view, create, update, approve, reject, export)
- Entity affected (event, fund, validation run, break, annotation)
- Before/after values for modifications
- Client IP address and session ID

### 7.3 Data Classification

- All fund data classified as Confidential per organizational policy
- No PII processed; fund-level data contains no investor information
- LLM interactions use enterprise deployments with no data retention
- Export controls: PDF/Excel exports include confidentiality watermarks

---

## 8. Implementation Phases

| Phase | Duration | Deliverables | Success Criteria |
|---|---|---|---|
| Phase 1 | 4 weeks | Event Dashboard, Event Detail View, basic fund grid | Users can view events and trigger validations |
| Phase 2 | 4 weeks | Validation Run View, results grid with grouping | End-to-end validation workflow functional |
| Phase 3 | 6 weeks | Fund Break Detail, waterfall chart, AI panel integration | AI analysis visible for all breaks |
| Phase 4 | 4 weeks | Human Review Workflow, annotation interface | Complete human-in-the-loop process |
| Phase 5 | 3 weeks | Reporting, exports, audit trail views | Audit-ready reporting available |
| Phase 6 | 3 weeks | Performance optimization, accessibility audit | All NFRs met, production ready |

**Total estimated timeline: 24 weeks (6 months)**

---

## 9. Appendix

### 9.1 Glossary

| Term | Definition |
|---|---|
| Break | A variance detected during validation that exceeds defined tolerance thresholds |
| CPU | The internal BNY fund accounting platform code base |
| Event | A conversion initiative containing one or more funds being migrated |
| GraphRAG | Graph-based Retrieval Augmented Generation for knowledge-enhanced AI reasoning |
| Incumbent | The source service provider system from which funds are being migrated |
| LHS/RHS | Left-Hand Side / Right-Hand Side of a validation comparison |
| NAV | Net Asset Value — the per-share value of a fund |
| Parallel | The phase where both systems process simultaneously for comparison |
| Valuation Date | The business date for which NAV is calculated |

### 9.2 Related Documents

- RECON-AI Architecture Specification v1.0
- Fund Administration Canonical Data Model v2.0
- Data Validation Rules Specification
- CPU Platform Integration Guide
- ElectronDSL Rule Configuration Reference

---

**END OF DOCUMENT**

*RECON-AI Control Center UX Specification v1.0 — February 2026*