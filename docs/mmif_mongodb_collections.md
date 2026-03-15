# MMIF MongoDB Collections Reference

> Implementation-ready schema definitions for all MMIF (Monetary Market & Investment Fund) regulatory filing collections.

---

## Table of Contents

1. [Collection Overview](#1-collection-overview)
2. [Enums & Constants](#2-enums--constants)
3. [Collection Schemas](#3-collection-schemas)
   - [3.1 mmifEvents](#31-mmifevents)
   - [3.2 mmifValidationRuns](#32-mmifvalidationruns)
   - [3.3 mmifBreakRecords](#33-mmifbreakrecords)
   - [3.4 mmifMappingConfigs](#34-mmifmappingconfigs)
   - [3.5 mmifLedgerData](#35-mmifledgerdata)
   - [3.6 mmifSampleData](#36-mmifsampledata)
   - [3.7 mmifValidationRuleDefs](#37-mmifvalidationruledefs)
   - [3.8 mmifReconciliationDetails](#38-mmifreconciliationdetails)
   - [3.9 mmifAgentAnalysis](#39-mmifagentanalysis)
   - [3.10 mmifChatSessions](#310-mmifchatsessions)
   - [3.11 mmifActivityFeed](#311-mmifactivityfeed)
   - [3.12 mmifAttestations](#312-mmifattestations)
4. [Indexes](#4-indexes)
5. [Relationship Diagram](#5-relationship-diagram)
6. [Sample Seed Documents](#6-sample-seed-documents)

---

## 1. Collection Overview

| # | Collection | Purpose | Seed Count |
|---|-----------|---------|------------|
| 1 | `mmifEvents` | MMIF regulatory filing events | 3 |
| 2 | `mmifValidationRuns` | Validation execution results | 0 (created at runtime) |
| 3 | `mmifBreakRecords` | Individual break records from validation failures | 0 (created at runtime) |
| 4 | `mmifMappingConfigs` | Eagle GL-to-MMIF section mapping templates | 4 |
| 5 | `mmifLedgerData` | GL account ledger balances for cross-check rules | 16 |
| 6 | `mmifSampleData` | Pre-seeded Eagle/MMIF value pairs for validation rules | 17 |
| 7 | `mmifValidationRuleDefs` | DSL validation rule definitions (VR-001 to VR-020) | 20 |
| 8 | `mmifReconciliationDetails` | Per-fund reconciliation detail grids (5 tabs) | 3 |
| 9 | `mmifAgentAnalysis` | 6-agent AI analysis pipeline results | 1 |
| 10 | `mmifChatSessions` | AI chat session history | 0 (created at runtime) |
| 11 | `mmifActivityFeed` | MMIF-specific activity feed | 0 (reserved) |
| 12 | `mmifAttestations` | Attestation records | 0 (reserved, embedded in agentAnalysis) |

---

## 2. Enums & Constants

### MmifEventStatus (Event Lifecycle)
```
DRAFT -> MAPPING -> EXTRACTION -> RECONCILIATION -> REVIEW -> FILED
```

### MmifFundType
```
UCITS | AIF | MMF | HEDGE
```

### MmifSeverity (Validation Rule Severity)
```
HARD | SOFT | DERIVED | ADVISORY
```

### FilingFrequency
```
MONTHLY | QUARTERLY
```

### FundStatus
```
PENDING | IN_PARALLEL | PASSED | FAILED | SIGNED_OFF
```

### RunStatus (Validation Run)
```
QUEUED | RUNNING | COMPLETE | FAILED
```

### ValidationResultStatus
```
PASSED | FAILED | WARNING
```

### BreakState (Break Record Lifecycle)
```
DETECTED -> ANALYZING -> AI_PASSED -> HUMAN_REVIEW_PENDING -> IN_REVIEW ->
  APPROVED | MODIFIED | ESCALATED | ACTION_PENDING -> CLOSED -> RESOLVED
```

### ReviewAction (Human Annotation)
```
ACCEPT | MODIFY | REJECT
```

### RuleCategory
```
MMIF_TIEOUT | POSITION_CHECK | DATA_QUALITY | LEDGER_CROSS_CHECK
```

### MMIF Sections
```
2, 3, 3.1, 3.2, 3.3, 3.4, 3.5, 4, 4.1, 4.2, 4.3, 5, 5.1, 5.2, 5.3, 5.4
```

### Team Roles
```
FUND_ADMIN | FUND_ACCOUNTANT | RECON_LEAD
```

---

## 3. Collection Schemas

### 3.1 mmifEvents

Main event collection for MMIF regulatory filings.

```json
{
  "eventId": "string (unique)",
  "eventType": "REGULATORY_FILING",
  "eventName": "string",
  "regulatoryBody": "string (default: CBI)",
  "filingPeriod": "string (e.g. 2026Q1, 2026M03)",
  "filingDeadline": "string (ISO date: 2026-04-30)",
  "filingFrequency": "FilingFrequency",
  "status": "MmifEventStatus",
  "assignedTeam": [
    {
      "userId": "string",
      "name": "string",
      "role": "string (FUND_ADMIN | FUND_ACCOUNTANT | RECON_LEAD)"
    }
  ],
  "funds": [
    {
      "account": "string (e.g. IE-UCITS-EQ-001)",
      "fundName": "string",
      "fundType": "MmifFundType",
      "fundDomicile": "string (default: IE)",
      "cbiCode": "string | null",
      "shareClasses": ["string"],
      "status": "FundStatus",
      "lastRunTimestamp": "string (ISO datetime) | null",
      "breakCount": "int (default: 0)"
    }
  ],
  "breakTrend7d": ["int (7 values)"]
}
```

**eventId format:** `MMIF-{year}-{period}-{sequence}` (e.g. `MMIF-2026-Q1-001`)

---

### 3.2 mmifValidationRuns

Stores results of each validation execution.

```json
{
  "runId": "string (unique)",
  "eventId": "string -> mmifEvents.eventId",
  "filingPeriod": "string",
  "executionTime": "string (ISO datetime)",
  "checkSuite": ["string (ruleId values, e.g. VR_001)"],
  "status": "RunStatus",
  "durationMs": "int | null",
  "fundsPassed": "int | null",
  "fundsWarning": "int | null",
  "fundsFailed": "int | null",
  "results": [
    {
      "ruleId": "string (e.g. VR_001)",
      "ruleName": "string",
      "severity": "MmifSeverity",
      "mmifSection": "string | null",
      "fundAccount": "string -> mmifEvents.funds[].account",
      "fundName": "string",
      "status": "ValidationResultStatus",
      "lhsLabel": "string (e.g. Eagle Total Assets)",
      "lhsValue": "float",
      "rhsLabel": "string (e.g. MMIF Total Assets)",
      "rhsValue": "float",
      "variance": "float",
      "tolerance": "float",
      "breakCount": "int",
      "durationMs": "int"
    }
  ]
}
```

**runId format:** `MMIF-RUN-{uuid8}` (e.g. `MMIF-RUN-A1B2C3D4`)

---

### 3.3 mmifBreakRecords

Individual break records generated when validation rules fail.

```json
{
  "breakId": "string (unique)",
  "validationRunId": "string -> mmifValidationRuns.runId",
  "eventId": "string -> mmifEvents.eventId",
  "ruleId": "string (e.g. VR_001)",
  "ruleName": "string",
  "severity": "MmifSeverity",
  "mmifSection": "string | null",
  "fundAccount": "string -> mmifEvents.funds[].account",
  "fundName": "string",
  "lhsLabel": "string",
  "lhsValue": "float",
  "rhsLabel": "string",
  "rhsValue": "float",
  "variance": "float",
  "tolerance": "float",
  "state": "BreakState",
  "securityId": "string | null",
  "aiAnalysis": {
    "analysisId": "string",
    "rootCauseSummary": "string",
    "confidenceScore": "float (0-1)",
    "evidenceChain": [
      {
        "stepNumber": "int",
        "description": "string"
      }
    ],
    "breakCategory": "string",
    "similarBreaks": [
      {
        "breakId": "string",
        "fundName": "string",
        "date": "string",
        "variance": "float",
        "resolution": "string"
      }
    ],
    "recommendedActions": [
      {
        "id": "string",
        "description": "string"
      }
    ]
  },
  "humanAnnotation": {
    "annotationId": "string",
    "reviewerUserId": "string",
    "reviewerName": "string",
    "reviewerRole": "string",
    "action": "ReviewAction",
    "notes": "string",
    "resolutionCategory": "string | null",
    "timestamp": "string (ISO datetime)"
  }
}
```

**breakId format:** `MMIF-BRK-{uuid8}` (e.g. `MMIF-BRK-A1B2C3D4`)

> `aiAnalysis` and `humanAnnotation` are nullable embedded documents — initially `null`, populated when AI analysis runs or human reviews occur.

---

### 3.4 mmifMappingConfigs

Maps Eagle GL accounts to MMIF taxonomy sections. Stored as per-fund-type templates.

```json
{
  "configId": "string (unique)",
  "eventId": "string -> mmifEvents.eventId",
  "account": "string (fund type key: UCITS | AIF | MMF | HEDGE)",
  "fundType": "MmifFundType",
  "baseCurrency": "string (default: EUR)",
  "mappings": [
    {
      "eagleGlPattern": "string (e.g. 1000*, 1200*)",
      "eagleSourceTable": "string (e.g. dataSubLedgerPosition, dataLedger)",
      "eagleSourceField": "string (e.g. posMarketValueBase, endingBalance)",
      "mmifSection": "string (e.g. 3.1, 3.2, 3.5)",
      "mmifField": "string (e.g. closing_position, accrued_interest)",
      "instrumentType": "int | null (1=Equity, 2=Debt, 3=Property, 4=Derivatives, 5=Cash)",
      "codeType": "int (default: 1; 1=ISIN, 2=SEDOL, 3=CUSIP, 4=Internal, 5=Other)",
      "transformation": "string | null (e.g. NEGATE)",
      "signConvention": "int (1 or -1)",
      "isReported": "bool (default: true)",
      "notes": "string (default: empty)"
    }
  ],
  "counterpartyEnrichment": {
    "<counterparty_name>": {
      "sector": "string (e.g. S122)",
      "country": "string (e.g. IE, BE)"
    }
  },
  "investorClassification": {
    "<sector_code>": "string (description, e.g. S122: MFI)"
  },
  "unmappedAccounts": ["string (e.g. 1800*)"],
  "createdAt": "string (ISO datetime) | null",
  "updatedAt": "string (ISO datetime) | null"
}
```

**configId format:** `MMIF-TPL-{FUND_TYPE}` (e.g. `MMIF-TPL-UCITS`)

> The `account` field stores the fund type (e.g. "UCITS") when used as a template. One template applies to all funds of that type within the event.

---

### 3.5 mmifLedgerData

GL account ledger balances used by ledger cross-check validation rules (VR-016 to VR-020).

```json
{
  "account": "string -> mmifEvents.funds[].account",
  "filingPeriod": "string (e.g. 2026Q1)",
  "glAccountNumber": "string (e.g. 1000, 2000, 6100)",
  "glDescription": "string (e.g. Investments at Market)",
  "startingBalance": "float",
  "endingBalance": "float"
}
```

**GL Account Prefix Categories:**
| Prefix | Category |
|--------|----------|
| `1xxx` | Assets |
| `2xxx` | Liabilities |
| `3xxx` | Capital |
| `4xxx` | Income |
| `5xxx` | Expense |
| `61xx` | RGL (Realized Gains/Losses) |
| `6xxx` (excl. `61xx`) | URGL (Unrealized Gains/Losses) |

---

### 3.6 mmifSampleData

Pre-seeded Eagle/MMIF value pairs used by validation rules for comparison.

```json
{
  "account": "string -> mmifEvents.funds[].account",
  "filingPeriod": "string (e.g. 2026Q1)",
  "ruleId": "string (e.g. VR_001)",
  "eagleValue": "float",
  "mmifValue": "float",
  "lhsLabel": "string | null (optional, for cross-check rules)",
  "rhsLabel": "string | null (optional, for cross-check rules)"
}
```

> Queried by `{"account": ..., "filingPeriod": ..., "ruleId": ...}`.

---

### 3.7 mmifValidationRuleDefs

DSL-based validation rule definitions with CEL expressions.

```json
{
  "ruleId": "string (unique, e.g. VR_001)",
  "ruleName": "string (e.g. Total Assets Tie-Out)",
  "description": "string",
  "severity": "MmifSeverity",
  "tolerance": "float (default: 0.0)",
  "mmifSection": "string | null (e.g. 4.3, 3.1)",
  "category": "string | null (MMIF_TIEOUT | POSITION_CHECK | DATA_QUALITY | LEDGER_CROSS_CHECK)",
  "isDsl": "bool (always true)",
  "dataSource": "string (mmifLedgerData | mmifSampleData)",
  "lhs": {
    "label": "string (e.g. Eagle Total Assets)",
    "expr": "string (CEL expression, e.g. fieldValue(sample, 'eagleValue'))"
  },
  "rhs": {
    "label": "string (e.g. MMIF Total Assets)",
    "expr": "string (CEL expression, e.g. sumByPrefix(ledger, '1', 'endingBalance'))"
  },
  "version": "int (default: 1, incremented on update)",
  "isActive": "bool (default: true)",
  "createdBy": "string (default: system)",
  "createdAt": "string (ISO datetime) | null",
  "updatedAt": "string (ISO datetime) | null",
  "deletedAt": "string (ISO datetime) | null (soft delete)"
}
```

**CEL Built-in Functions:**
| Function | Signature | Description |
|----------|-----------|-------------|
| `fieldValue` | `fieldValue(sample, 'fieldName')` | Extract a field from sample data |
| `sumByPrefix` | `sumByPrefix(ledger, 'prefix', 'balanceField')` | Sum ledger entries by GL prefix |
| `abs` | `abs(value)` | Absolute value |
| `+`, `-`, `*`, `/` | arithmetic | Standard arithmetic operators |

**Active Rule Query Filter:**
```json
{"isActive": true, "deletedAt": null}
```

---

### 3.8 mmifReconciliationDetails

Per-fund reconciliation detail grids powering 5 tabs in the UI.

```json
{
  "eventId": "string -> mmifEvents.eventId",
  "account": "string -> mmifEvents.funds[].account",
  "fundName": "string",
  "filingPeriod": "string",

  "assetLiabilityRows": [
    {
      "account": "string (GL account, e.g. 1100-0000-0000-0000)",
      "description": "string (e.g. SECURITIES AT VALUE)",
      "category": "string (asset | liability)",
      "beginBal": "float | null",
      "netActivity": "float | null",
      "endBal": "float | null",
      "netSecValue": "float | null",
      "smaSource": "string | null (e.g. Positions)",
      "smaValue": "float | null",
      "variance": "float | null",
      "status": "string (match | break | review | na)"
    }
  ],

  "capitalRows": [
    {
      "account": "string (e.g. 3100-0000-0000-0000)",
      "description": "string (e.g. SUBSCRIPTIONS)",
      "beginBal": "float | null",
      "netActivity": "float | null",
      "endBal": "float | null"
    }
  ],

  "shareholderRows": [
    {
      "isin": "string (e.g. IE0003CU5OB7)",
      "openPosition": "float | null",
      "issued": "float | null",
      "redeemed": "float | null",
      "closePosition": "float | null",
      "matched": "bool (default: true)"
    }
  ],

  "navComparison": {
    "capitalTotals": "float",
    "pnlActivityFYE": "float",
    "capitalIncPeriodEnd": "float",
    "navFromSMA": "float",
    "navFromShareholderPivot": "float"
  },

  "ledgerCrossCheck": {
    "assets":      {"start": "float", "end": "float"},
    "liabilities": {"start": "float", "end": "float"},
    "capital":     {"start": "float", "end": "float"},
    "bsDiff":      {"start": "float", "end": "float"},
    "income":      {"start": "float", "end": "float"},
    "expense":     {"start": "float", "end": "float"},
    "netIncome":   {"start": "float", "end": "float"},
    "rgl":         {"start": "float", "end": "float"},
    "urgl":        {"start": "float", "end": "float"},
    "netGL":       {"start": "float", "end": "float"},
    "totalPnL":    {"start": "float", "end": "float"},
    "tbBalanced":  {"start": "float", "end": "float"}
  }
}
```

**UI Tab Mapping:**
| Tab | Data Source |
|-----|-----------|
| Tab 0: Asset & Liability | `assetLiabilityRows` |
| Tab 1: Capital | `capitalRows` |
| Tab 2: Shareholder | `shareholderRows` |
| Tab 3: NAV Tie-Out | `navComparison` |
| Tab 4: Ledger Cross Check | `ledgerCrossCheck` |

---

### 3.9 mmifAgentAnalysis

Results from the 6-agent AI analysis pipeline.

```json
{
  "eventId": "string -> mmifEvents.eventId",
  "phase": "string (COMPLETE | PENDING)",
  "overallConfidence": "float (0-100)",
  "rootCauseNarrative": "string (markdown)",

  "l0Findings": [
    {
      "agentName": "string (e.g. L0_TotalAssets)",
      "level": "string (e.g. L0)",
      "timestamp": "string (ISO datetime)",
      "description": "string",
      "evidence": "object (arbitrary)",
      "confidence": "float (0.0-1.0)",
      "recommendedAction": "string"
    }
  ],
  "l1Findings": ["...same shape as l0Findings"],
  "l2Findings": ["...same shape"],
  "l3Findings": ["...same shape"],
  "specialistFindings": ["...same shape"],

  "rootCauses": [
    {
      "agent": "string",
      "level": "string (e.g. L1)",
      "description": "string",
      "confidence": "float (0-100)"
    }
  ],

  "shouldEscalate": "bool",
  "attestationStatus": "string (CLEARED | BLOCKED | PENDING)",

  "attestationReport": {
    "attestationId": "string (e.g. ATT-2026-Q1-001)",
    "fundAccount": "string",
    "filingPeriod": "string",
    "totalRules": "int",
    "passed": "int",
    "warnings": "int",
    "failed": "int",
    "hardFailures": "int",
    "submissionClearance": "bool",
    "readinessScore": "int (0-100)",
    "ruleResults": [
      {
        "ruleId": "string",
        "ruleName": "string",
        "severity": "MmifSeverity",
        "status": "ValidationResultStatus",
        "variance": "float | null",
        "rootCause": "string | null",
        "confidence": "float | null"
      }
    ]
  },

  "pipelineSteps": [
    {
      "name": "string (e.g. supervisor_init, l0_total_assets)",
      "label": "string (e.g. Supervisor Init, L0: Total Assets)",
      "status": "string (pending | running | complete | warning | error | skipped)",
      "findingsCount": "int",
      "duration": "int (ms) | null"
    }
  ],

  "createdAt": "string (ISO datetime)"
}
```

**Agent Pipeline Steps (in order):**
1. `supervisor_init` — Supervisor Init
2. `l0_total_assets` — L0: Total Assets
3. `l1_equity_debt` — L1: Equity & Debt
4. `l2_cash_derivatives` — L2: Cash & Derivatives
5. `l3_pnl_nav` — L3: P&L & NAV
6. `specialist_cross_check` — Specialist: Cross Check
7. `supervisor_synthesis` — Supervisor Synthesis

---

### 3.10 mmifChatSessions

AI chat session history for conversational break analysis.

```json
{
  "sessionId": "string (unique)",
  "eventId": "string -> mmifEvents.eventId",
  "userId": "string | null",
  "userName": "string | null",
  "messages": [
    {
      "role": "string (user | assistant)",
      "content": "string",
      "timestamp": "string (ISO datetime)",
      "userId": "string | null (only on user messages)"
    }
  ],
  "createdAt": "string (ISO datetime)",
  "updatedAt": "string (ISO datetime)"
}
```

**sessionId format:** `MMIF-CHAT-{uuid12}` (e.g. `MMIF-CHAT-A1B2C3D4E5F6`)

> Messages are appended via MongoDB `$push` operator. `updatedAt` is refreshed on each new message.

---

### 3.11 mmifActivityFeed

MMIF-specific activity feed (reserved, follows same shape as core activity feed).

```json
{
  "id": "string",
  "type": "string (VALIDATION_RUN | AI_ANALYSIS | HUMAN_ANNOTATION | STATUS_CHANGE | BREAK_CATEGORIZED | SIGN_OFF | AUTO_ASSIGNMENT)",
  "message": "string",
  "eventId": "string | null",
  "timestamp": "string (ISO datetime)",
  "userId": "string | null",
  "userName": "string"
}
```

---

### 3.12 mmifAttestations

Reserved collection for standalone attestation records. Currently attestation data is embedded within `mmifAgentAnalysis.attestationReport`.

```json
{
  "attestationId": "string",
  "eventId": "string",
  "fundAccount": "string",
  "filingPeriod": "string",
  "submissionClearance": "bool",
  "readinessScore": "int (0-100)",
  "createdAt": "string (ISO datetime)"
}
```

---

## 4. Indexes

### Defined Indexes

| Collection | Fields | Type | Options |
|-----------|--------|------|---------|
| `mmifEvents` | `eventId` | Single | `unique: true`, `background: true` |
| `mmifEvents` | `(status, filingPeriod)` | Compound | `background: true` |
| `mmifValidationRuns` | `(eventId, filingPeriod)` | Compound | `background: true` |
| `mmifBreakRecords` | `(eventId, ruleId)` | Compound | `background: true` |
| `mmifMappingConfigs` | `(eventId, account)` | Compound | `unique: true`, `background: true` |

### Recommended Additional Indexes

| Collection | Fields | Rationale |
|-----------|--------|-----------|
| `mmifLedgerData` | `(account, filingPeriod)` | Queried per-fund per-period |
| `mmifSampleData` | `(account, filingPeriod, ruleId)` | Queried per-fund per-period per-rule |
| `mmifReconciliationDetails` | `(eventId, account)` | Queried per-fund per-event |
| `mmifAgentAnalysis` | `eventId` | Upserted/queried by eventId |
| `mmifChatSessions` | `sessionId` | Primary lookup key |
| `mmifChatSessions` | `eventId` | List sessions per event |
| `mmifValidationRuleDefs` | `(ruleId, isActive)` | Rule lookup with active filter |

---

## 5. Relationship Diagram

```
mmifEvents (eventId PK)
│
├──► mmifValidationRuns.eventId
│     │
│     └──► mmifBreakRecords.validationRunId
│
├──► mmifBreakRecords.eventId
│
├──► mmifMappingConfigs.eventId
│
├──► mmifReconciliationDetails.eventId
│
├──► mmifAgentAnalysis.eventId
│
├──► mmifChatSessions.eventId
│
└──► mmifActivityFeed.eventId

mmifEvents.funds[].account
│
├──► mmifBreakRecords.fundAccount
├──► mmifSampleData.account
├──► mmifLedgerData.account
└──► mmifReconciliationDetails.account

mmifMappingConfigs.account
└──► Uses fundType as key (e.g. "UCITS", not individual fund account)

mmifValidationRuleDefs.ruleId
│
├──► mmifBreakRecords.ruleId
├──► mmifSampleData.ruleId
├──► mmifValidationRuns.checkSuite[]
└──► mmifValidationRuns.results[].ruleId
```

---

## 6. Sample Seed Documents

### 6.1 mmifEvents

```json
{
  "eventId": "MMIF-2026-Q1-001",
  "eventType": "REGULATORY_FILING",
  "eventName": "Q1 2026 CBI Filing — Irish UCITS Range",
  "regulatoryBody": "CBI",
  "filingPeriod": "2026Q1",
  "filingDeadline": "2026-04-30",
  "filingFrequency": "QUARTERLY",
  "status": "RECONCILIATION",
  "assignedTeam": [
    {"userId": "u-fad", "name": "Claire O'Brien", "role": "FUND_ADMIN"},
    {"userId": "u-fa1", "name": "Emma Walsh", "role": "FUND_ACCOUNTANT"},
    {"userId": "u-rl1", "name": "Declan Murphy", "role": "RECON_LEAD"}
  ],
  "funds": [
    {
      "account": "IE-UCITS-EQ-001",
      "fundName": "Aria Global Equity UCITS",
      "fundType": "UCITS",
      "fundDomicile": "IE",
      "cbiCode": "C12345",
      "shareClasses": ["A-EUR", "B-USD", "I-GBP"],
      "status": "FAILED",
      "lastRunTimestamp": "2026-03-10T14:30:00Z",
      "breakCount": 3
    },
    {
      "account": "IE-UCITS-FI-002",
      "fundName": "Aria Euro Corporate Bond UCITS",
      "fundType": "UCITS",
      "fundDomicile": "IE",
      "cbiCode": "C12346",
      "shareClasses": ["A-EUR", "I-EUR"],
      "status": "PASSED",
      "lastRunTimestamp": "2026-03-10T14:32:00Z",
      "breakCount": 0
    }
  ],
  "breakTrend7d": [5, 4, 4, 3, 3, 3, 4]
}
```

### 6.2 mmifMappingConfigs (UCITS Template)

```json
{
  "configId": "MMIF-TPL-UCITS",
  "eventId": "MMIF-2026-Q1-001",
  "account": "UCITS",
  "fundType": "UCITS",
  "baseCurrency": "EUR",
  "mappings": [
    {
      "eagleGlPattern": "1000*",
      "eagleSourceTable": "dataSubLedgerPosition",
      "eagleSourceField": "posMarketValueBase",
      "mmifSection": "3.1",
      "mmifField": "closing_position",
      "instrumentType": 1,
      "codeType": 1,
      "transformation": null,
      "signConvention": 1,
      "isReported": true,
      "notes": "Equities mapped from sub-ledger positions"
    },
    {
      "eagleGlPattern": "1200*",
      "eagleSourceTable": "dataSubLedgerPosition",
      "eagleSourceField": "posMarketValueBase",
      "mmifSection": "3.2",
      "mmifField": "closing_position",
      "instrumentType": 2,
      "codeType": 1,
      "transformation": null,
      "signConvention": 1,
      "isReported": true,
      "notes": "Debt securities from sub-ledger"
    }
  ],
  "counterpartyEnrichment": {
    "AIB Group": {"sector": "S122", "country": "IE"},
    "KBC Bank": {"sector": "S122", "country": "BE"}
  },
  "investorClassification": {
    "S122": "MFI",
    "S125": "OFI"
  },
  "unmappedAccounts": [],
  "createdAt": "2026-03-01T00:00:00Z",
  "updatedAt": "2026-03-01T00:00:00Z"
}
```

### 6.3 mmifValidationRuleDefs

```json
{
  "ruleId": "VR_001",
  "ruleName": "Total Assets Tie-Out",
  "description": "Eagle total assets must equal MMIF Section 4.3 total assets",
  "severity": "HARD",
  "tolerance": 0.0,
  "mmifSection": "4.3",
  "category": "MMIF_TIEOUT",
  "isDsl": true,
  "dataSource": "mmifSampleData",
  "lhs": {
    "label": "Eagle Total Assets",
    "expr": "fieldValue(sample, 'eagleValue')"
  },
  "rhs": {
    "label": "MMIF Total Assets",
    "expr": "fieldValue(sample, 'mmifValue')"
  },
  "version": 1,
  "isActive": true,
  "createdBy": "system",
  "createdAt": "2026-03-01T00:00:00Z",
  "updatedAt": null,
  "deletedAt": null
}
```

### 6.4 mmifSampleData

```json
{
  "account": "IE-UCITS-EQ-001",
  "filingPeriod": "2026Q1",
  "ruleId": "VR_001",
  "eagleValue": 250000000.00,
  "mmifValue": 250000050.00
}
```

### 6.5 mmifLedgerData

```json
{
  "account": "IE-UCITS-EQ-001",
  "filingPeriod": "2026Q1",
  "glAccountNumber": "1000",
  "glDescription": "Investments at Market",
  "startingBalance": 200000000.00,
  "endingBalance": 210000000.00
}
```

### 6.6 mmifReconciliationDetails (partial)

```json
{
  "eventId": "MMIF-2026-Q1-001",
  "account": "IE-UCITS-EQ-001",
  "fundName": "Aria Global Equity UCITS",
  "filingPeriod": "2026Q1",
  "assetLiabilityRows": [
    {
      "account": "1100-0000-0000-0000",
      "description": "SECURITIES AT VALUE",
      "category": "asset",
      "beginBal": 195000000.00,
      "netActivity": 15250000.00,
      "endBal": 210250000.00,
      "netSecValue": 210250000.00,
      "smaSource": "Positions",
      "smaValue": 210250000.00,
      "variance": 0.00,
      "status": "match"
    }
  ],
  "capitalRows": [
    {
      "account": "3100-0000-0000-0000",
      "description": "SUBSCRIPTIONS",
      "beginBal": 180000000.00,
      "netActivity": 5000000.00,
      "endBal": 185000000.00
    }
  ],
  "shareholderRows": [
    {
      "isin": "IE0003CU5OB7",
      "openPosition": 1500000.00,
      "issued": 50000.00,
      "redeemed": -25000.00,
      "closePosition": 1525000.00,
      "matched": true
    }
  ],
  "navComparison": {
    "capitalTotals": 235000000.00,
    "pnlActivityFYE": 15250000.00,
    "capitalIncPeriodEnd": 250250000.00,
    "navFromSMA": 250250000.00,
    "navFromShareholderPivot": 250250000.00
  },
  "ledgerCrossCheck": {
    "assets":      {"start": 200000000.00, "end": 210000000.00},
    "liabilities": {"start": 10000000.00,  "end": 10500000.00},
    "capital":     {"start": 180000000.00, "end": 185000000.00},
    "bsDiff":      {"start": 10000000.00,  "end": 14500000.00},
    "income":      {"start": 0.00,         "end": 3200000.00},
    "expense":     {"start": 0.00,         "end": -1500000.00},
    "netIncome":   {"start": 0.00,         "end": 1700000.00},
    "rgl":         {"start": 0.00,         "end": 5800000.00},
    "urgl":        {"start": 0.00,         "end": 7000000.00},
    "netGL":       {"start": 0.00,         "end": 12800000.00},
    "totalPnL":    {"start": 0.00,         "end": 14500000.00},
    "tbBalanced":  {"start": 0.00,         "end": 0.00}
  }
}
```
