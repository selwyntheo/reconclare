# CBI MMIF Filing Agent — API Tool Specification

> Complete API tool call definitions for the MMIF Filing Agent (docs/agent.md Section 7).
> Each tool maps to a REST endpoint with request/response schemas, MongoDB collections, and implementation status.

---

## Implementation Status Summary

| # | Tool | Status | New Work |
|---|------|--------|----------|
| 1 | `load_trial_balance` | Partial | MMIF-specific wrapper endpoint |
| 2 | `load_positions` | Partial | MMIF-specific wrapper endpoint |
| 3 | `load_shareholder_pivot` | New | Full endpoint + collection query |
| 4 | `load_nav` | Partial | MMIF-specific wrapper endpoint |
| 5 | `load_sma_mapping` | Partial | Fund-scoped wrapper |
| 6 | `load_workbook` | New | File upload + Excel parser |
| 7 | `validate_mmif_xml` | Exists | Fund-level wrapper only |
| 8 | `check_cbi_taxonomy` | New | Endpoint + reference data |
| 9 | `validate_isin` | New | Pure utility endpoint |
| 10 | `compute_variance` | Partial | Standalone lightweight endpoint |
| 11 | `trace_root_cause` | Exists | Per-account wrapper |
| 12 | `get_historical_breaks` | Partial | Cross-event query endpoint |
| 13 | `classify_break` | New | Standalone classification endpoint |
| 14 | `generate_filing_report` | Exists | Optional fresh-generation endpoint |
| 15 | `render_reconciliation_ui` | Exists | None — maps directly |
| 16 | `submit_mmif_filing` | New | Full endpoint + CBI integration |

---

## Category 1: Data Retrieval Tools

### Tool 1 — `load_trial_balance`

Loads the full Trial Balance for a fund and filing period with all GL accounts, beginning/ending balances, and net activity.

```
Endpoint:   GET /api/mmif/data/trial-balance
Query:      ?fund_id={fund_id}&period={period}
```

**Request Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fund_id` | string | Yes | Fund account identifier (e.g. `IE-UCITS-EQ-001`) |
| `period` | string | Yes | Filing period (e.g. `2026Q1`, `2026M03`) |

**Response Schema:**

```json
{
  "fundId": "IE-UCITS-EQ-001",
  "fundName": "Aria Global Equity UCITS",
  "period": "2026Q1",
  "baseCurrency": "EUR",
  "accounts": [
    {
      "glAccountNumber": "1000",
      "glDescription": "Investments at Market",
      "category": "ASSET",
      "startingBalance": 200000000.00,
      "netActivity": 10000000.00,
      "endingBalance": 210000000.00,
      "smaMapping": "dataSubLedgerPosition"
    }
  ],
  "totals": {
    "totalAssets": { "starting": 0.00, "ending": 0.00 },
    "totalLiabilities": { "starting": 0.00, "ending": 0.00 },
    "totalCapital": { "starting": 0.00, "ending": 0.00 },
    "totalIncome": { "starting": 0.00, "ending": 0.00 },
    "totalExpense": { "starting": 0.00, "ending": 0.00 },
    "totalRGL": { "starting": 0.00, "ending": 0.00 },
    "totalURGL": { "starting": 0.00, "ending": 0.00 },
    "tbBalance": 0.00
  }
}
```

**MongoDB Collections:**
- Reads: `mmifLedgerData` (filter: `{account: fund_id, filingPeriod: period}`)
- Fallback: `ledger` (filter: `{account: fund_id, valuationDt: period_end_date}`)

**GL Category Mapping:**

| Prefix | Category |
|--------|----------|
| `1xxx` | ASSET |
| `2xxx` | LIABILITY |
| `3xxx` | CAPITAL |
| `4xxx` | INCOME |
| `5xxx` | EXPENSE |
| `61xx` | RGL |
| `6xxx` (excl `61xx`) | URGL |

**Existing Partial Endpoints:**
- `GET /api/funds/{account}/trial-balance-compare` — conversion context (CPU vs INCUMBENT)
- `DatabaseTools.get_gl_trial_balance()` — SQL-based agent tool

---

### Tool 2 — `load_positions`

Returns Net Securities at Value from the positions/sub-ledger system, organized by SMA code.

```
Endpoint:   GET /api/mmif/data/positions
Query:      ?fund_id={fund_id}&period={period}
```

**Request Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fund_id` | string | Yes | Fund account identifier |
| `period` | string | Yes | Filing period |

**Response Schema:**

```json
{
  "fundId": "IE-UCITS-EQ-001",
  "period": "2026Q1",
  "positions": [
    {
      "smaCode": "1100",
      "description": "Securities at Value",
      "longPositions": [
        {
          "assetId": "AAPL",
          "isin": "US0378331005",
          "securityName": "Apple Inc",
          "shares": 50000.00,
          "marketPrice": 175.25,
          "marketValueBase": 8762500.00,
          "bookValueBase": 7500000.00,
          "unrealizedGainLoss": 1262500.00,
          "instrumentType": 1,
          "codeType": 1
        }
      ],
      "shortPositions": [],
      "netSecuritiesAtValue": 8762500.00
    }
  ],
  "cashPositions": [
    {
      "currency": "EUR",
      "glAccount": "1110-1123",
      "balance": 14361.32
    }
  ],
  "otherAssets": [
    {
      "glAccount": "1130",
      "description": "Other Assets",
      "value": 7992.72
    }
  ],
  "totalNetSecuritiesAtValue": 0.00
}
```

**MongoDB Collections:**
- Reads: `dataSubLedgerPosition` (filter: `{account: fund_id}`)
- Cross-ref: `mmifMappingConfigs` (for SMA-to-GL mapping)

**Existing Partial Endpoints:**
- `GET /api/funds/{fund_account}/positions` — raw positions
- `DatabaseTools.get_positions()` — SQL-based agent tool

---

### Tool 3 — `load_shareholder_pivot`

Returns shareholder/capital activity organized by ISIN share class.

```
Endpoint:   GET /api/mmif/data/shareholder-pivot
Query:      ?fund_id={fund_id}&period={period}
```

**Request Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fund_id` | string | Yes | Fund account identifier |
| `period` | string | Yes | Filing period |

**Response Schema:**

```json
{
  "fundId": "IE-UCITS-EQ-001",
  "fundName": "Aria Global Equity UCITS",
  "period": "2026Q1",
  "shareClasses": [
    {
      "isin": "IE0003CU5OB7",
      "shareClassName": "Class A EUR",
      "openingPosition": 326510419.77,
      "issued": 521390.84,
      "redeemed": -1869534.78,
      "closingPosition": 328822360.53,
      "navToShareholders": true
    }
  ],
  "totals": {
    "openingPosition": 730294175.56,
    "issued": 51671913.62,
    "redeemed": -36337733.18,
    "closingPosition": 752432832.05
  },
  "allShareClassesTied": true
}
```

**MongoDB Collections:**
- Reads: `capitalStock` (filter: `{account: fund_id}`)
- Cross-ref: `mmifReconciliationDetails.shareholderRows`
- Cross-ref: `mmifEvents.funds[].shareClasses`

**Status:** New endpoint — no existing REST API for this data.

---

### Tool 4 — `load_nav`

Returns the official NAV from the fund accounting/pricing system.

```
Endpoint:   GET /api/mmif/data/nav
Query:      ?fund_id={fund_id}&period={period}
```

**Request Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fund_id` | string | Yes | Fund account identifier |
| `period` | string | Yes | Filing period |

**Response Schema:**

```json
{
  "fundId": "IE-UCITS-EQ-001",
  "fundName": "Aria Global Equity UCITS",
  "period": "2026Q1",
  "baseCurrency": "EUR",
  "navSources": {
    "tbCapitalPlusPnL": 730294175.59,
    "smaNetAssetValue": 752432832.02,
    "shareholderPivotClosing": 752432832.05
  },
  "variances": {
    "tbVsSma": -22138656.43,
    "smaVsShareholder": -0.03,
    "tbVsShareholder": -22138656.46
  },
  "threeWayTied": false,
  "smaVsShareholderTied": true,
  "navPerShareClass": [
    {
      "isin": "IE0003CU5OB7",
      "sharesOutstanding": 1525000.00,
      "navPerShare": 215.62,
      "totalNav": 328822360.53
    }
  ]
}
```

**MongoDB Collections:**
- Reads: `navSummary` (filter: `{account: fund_id}`)
- Cross-ref: `mmifReconciliationDetails.navComparison`

**Existing Partial Endpoints:**
- `GET /api/events/{event_id}/nav-compare` — conversion context
- `DatabaseTools.get_nav_comparison()` — SQL-based agent tool

---

### Tool 5 — `load_sma_mapping`

Returns the account-to-SMA mapping configuration for a fund (or fund type template).

```
Endpoint:   GET /api/mmif/data/sma-mapping
Query:      ?fund_id={fund_id}
```

**Request Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fund_id` | string | Yes | Fund account identifier or fund type (e.g. `UCITS`) |
| `event_id` | string | No | Optional event scope (defaults to latest) |

**Response Schema:**

```json
{
  "fundId": "IE-UCITS-EQ-001",
  "fundType": "UCITS",
  "configId": "MMIF-TPL-UCITS",
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
    }
  ],
  "counterpartyEnrichment": {
    "AIB Group": { "sector": "S122", "country": "IE" }
  },
  "investorClassification": {
    "S122": "MFI"
  },
  "unmappedAccounts": []
}
```

**MongoDB Collections:**
- Reads: `mmifMappingConfigs` (filter: `{account: fundType}` or `{eventId, account}`)

**Existing Partial Endpoints:**
- `GET /api/mmif/events/{event_id}/mapping?account=...`
- `GET /api/mmif/mapping-templates/{fund_type}`

---

### Tool 6 — `load_workbook`

Ingests a test harness Excel workbook and extracts all tabs into structured data.

```
Endpoint:   POST /api/mmif/data/workbook
Content-Type: multipart/form-data
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Excel workbook (.xlsx) |
| `fund_id` | string | No | Fund identifier override |

**Response Schema:**

```json
{
  "fileName": "Guggenheim_KY9_760001_GFI_Test_Pack_2.xlsx",
  "fundId": "760001",
  "fundName": "Guggenheim KY9",
  "tabs": {
    "toc": {
      "fundMetadata": {
        "fundName": "...",
        "fundId": "760001",
        "baseCurrency": "USD",
        "period": "2026Q1",
        "fundType": "UCITS"
      }
    },
    "quarterLedgerCapital": {
      "accounts": [
        {
          "glAccount": "3100",
          "description": "SUBSCRIPTIONS",
          "beginBal": 180000000.00,
          "netActivity": 5000000.00,
          "endBal": 185000000.00
        }
      ],
      "shareholderPivot": [
        {
          "isin": "IE0003CU5OB7",
          "openPosition": 326510419.77,
          "issued": 521390.84,
          "redeemed": -1869534.78,
          "closePosition": 328822360.53,
          "navMatch": true
        }
      ]
    },
    "quarterLedgerAssetLiability": {
      "accounts": [
        {
          "glAccount": "1100",
          "description": "SECURITIES AT VALUE",
          "category": "ASSET",
          "beginBal": 195000000.00,
          "netActivity": 15250000.00,
          "endBal": 210250000.00,
          "netSecuritiesAtValue": 210250000.00,
          "primaryCompare": 210250000.00,
          "primaryCheckResult": "-",
          "secondaryCompare": 210250000.00,
          "secondaryCheckResult": "-"
        }
      ]
    },
    "quarterLedgerPnL": {
      "accounts": [
        {
          "glAccount": "4100",
          "description": "DIVIDEND INCOME",
          "category": "INCOME",
          "beginBal": 0.00,
          "netActivity": 3200000.00,
          "endBal": 3200000.00
        }
      ]
    }
  },
  "rowCounts": {
    "toc": 1,
    "quarterLedgerCapital": 15,
    "quarterLedgerAssetLiability": 45,
    "quarterLedgerPnL": 20
  }
}
```

**MongoDB Collections:**
- Writes: None (transient) or optionally `mmifWorkbookData`
- Generates: Populates `mmifLedgerData` and `mmifSampleData` from parsed values

**Dependencies:** `openpyxl` or `pandas` for Excel parsing

**Status:** New endpoint — no existing implementation.

---

## Category 2: Validation Tools

### Tool 7 — `validate_mmif_xml`

Runs MMIF validation rules (VR-001 through VR-020) against fund data.

```
Endpoint:   POST /api/mmif/events/{event_id}/validate
```

**Request Body:**

```json
{
  "filingPeriod": "2026Q1",
  "checkSuite": ["VR_001", "VR_002", "VR_003"],
  "fundSelection": "all"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filingPeriod` | string | Yes | Filing period |
| `checkSuite` | string[] | Yes | List of rule IDs to execute |
| `fundSelection` | string | No | `"all"` or specific fund account |

**Response Schema:**

```json
{
  "runId": "MMIF-RUN-A1B2C3D4",
  "eventId": "MMIF-2026-Q1-001",
  "filingPeriod": "2026Q1",
  "executionTime": "2026-03-15T10:30:00Z",
  "status": "COMPLETE",
  "durationMs": 1250,
  "fundsPassed": 2,
  "fundsWarning": 1,
  "fundsFailed": 1,
  "results": [
    {
      "ruleId": "VR_001",
      "ruleName": "Total Assets Tie-Out",
      "severity": "HARD",
      "mmifSection": "4.3",
      "fundAccount": "IE-UCITS-EQ-001",
      "fundName": "Aria Global Equity UCITS",
      "status": "FAILED",
      "lhsLabel": "Eagle Total Assets",
      "lhsValue": 250000000.00,
      "rhsLabel": "MMIF Total Assets",
      "rhsValue": 250000050.00,
      "variance": 50.00,
      "tolerance": 0.00,
      "breakCount": 1,
      "durationMs": 45
    }
  ]
}
```

**MongoDB Collections:**
- Reads: `mmifEvents`, `mmifSampleData`, `mmifLedgerData`, `mmifValidationRuleDefs`
- Writes: `mmifValidationRuns`, `mmifBreakRecords`

**Existing Endpoint:** Fully implemented at `POST /api/mmif/events/{event_id}/validate`

**Agent-Specific Wrapper:**
For per-fund calls, pass `fundSelection` as the specific fund account:
```
POST /api/mmif/tools/validate?fund_id={fund_id}&period={period}
```

---

### Tool 8 — `check_cbi_taxonomy`

Validates a field value against CBI taxonomy reference codes.

```
Endpoint:   GET /api/mmif/taxonomy/check
Query:      ?field={field}&value={value}
```

**Request Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `field` | string | Yes | Taxonomy field name |
| `value` | string | Yes | Value to validate |

**Supported Fields:**

| Field | Description | Valid Values (examples) |
|-------|-------------|----------------------|
| `country` | ISO 3166-1 alpha-2 country code | `IE`, `DE`, `FR`, `US`, `GB` |
| `sector` | ESA 2010 institutional sector | `S11`, `S121`, `S122`, `S123`, `S124`, `S125`, `S126`, `S127`, `S128`, `S129`, `S13`, `S14`, `S15`, `S2` |
| `code_type` | Security identifier type | `1` (ISIN), `2` (SEDOL), `3` (CUSIP), `4` (Internal), `5` (Other) |
| `instrument_type` | MMIF instrument classification | `1` (Equity), `2` (Debt), `3` (Property), `4` (Derivatives), `5` (Cash) |
| `currency` | ISO 4217 currency code | `EUR`, `USD`, `GBP`, `CHF`, `JPY` |
| `filing_frequency` | Filing cadence | `MONTHLY`, `QUARTERLY` |

**Response Schema:**

```json
{
  "field": "sector",
  "value": "S122",
  "valid": true,
  "description": "Monetary Financial Institutions (MFI)",
  "cbiReference": "ESA 2010 Institutional Sector Classification"
}
```

**Error Response (invalid):**

```json
{
  "field": "sector",
  "value": "S999",
  "valid": false,
  "description": null,
  "suggestion": "Valid sector codes: S11, S121, S122, ...",
  "cbiReference": "ESA 2010 Institutional Sector Classification"
}
```

**MongoDB Collections:** None — static reference data (can be hardcoded or loaded from a `cbiTaxonomyRef` collection)

**Status:** New endpoint.

---

### Tool 9 — `validate_isin`

Validates ISIN format and check digit using the Luhn algorithm.

```
Endpoint:   GET /api/mmif/validate/isin
Query:      ?code={isin_code}
```

**Request Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | ISIN code to validate (e.g. `IE0003CU5OB7`) |

**Response Schema:**

```json
{
  "isin": "IE0003CU5OB7",
  "valid": true,
  "countryCode": "IE",
  "countryName": "Ireland",
  "nsin": "0003CU5OB",
  "checkDigit": 7,
  "checkDigitValid": true,
  "formatValid": true
}
```

**Error Response:**

```json
{
  "isin": "IE0003CU5OB9",
  "valid": false,
  "countryCode": "IE",
  "countryName": "Ireland",
  "nsin": "0003CU5OB",
  "checkDigit": 9,
  "checkDigitValid": false,
  "expectedCheckDigit": 7,
  "formatValid": true
}
```

**Validation Rules:**
1. Length must be exactly 12 characters
2. First 2 characters: ISO 3166-1 alpha-2 country code (letters)
3. Characters 3-11: NSIN (alphanumeric, 9 characters)
4. Character 12: Check digit (Luhn mod-10 on numeric conversion)

**MongoDB Collections:** None — pure utility function

**Status:** New endpoint.

---

## Category 3: Analysis Tools

### Tool 10 — `compute_variance`

Computes variance between two values, classifies materiality, and returns pass/fail status.

```
Endpoint:   POST /api/mmif/tools/compute-variance
```

**Request Body:**

```json
{
  "tbValue": 250000000.00,
  "compareValue": 250000050.00,
  "tolerance": 0.01,
  "severity": "HARD",
  "nav": 752432832.02
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tbValue` | float | Yes | Trial Balance / LHS value |
| `compareValue` | float | Yes | Compare / RHS value |
| `tolerance` | float | Yes | Absolute tolerance threshold |
| `severity` | string | No | `HARD` / `SOFT` / `DERIVED` / `ADVISORY` (default: `SOFT`) |
| `nav` | float | No | Fund NAV for relative materiality calculation |

**Response Schema:**

```json
{
  "tbValue": 250000000.00,
  "compareValue": 250000050.00,
  "variance": 50.00,
  "varianceAbsolute": 50.00,
  "varianceRelative": 0.0000066,
  "varianceBps": 0.066,
  "tolerance": 0.01,
  "withinTolerance": false,
  "status": "FAILED",
  "materiality": {
    "level": "MINOR",
    "description": "1.00 – 1,000.00: Log, include in report, no block",
    "navImpactPct": 0.0000066,
    "action": "LOG_ONLY"
  }
}
```

**Materiality Levels (from agent spec Section 5.3):**

| Level | Range | Action |
|-------|-------|--------|
| `IMMATERIAL` | < 1.00 | Auto-clear, log only |
| `MINOR` | 1.00 – 1,000.00 | Log, include in report, no block |
| `MODERATE` | 1,000.01 – 0.01% of NAV | Require explanation |
| `MATERIAL` | 0.01% – 0.1% of NAV | Require supervisor review |
| `CRITICAL` | > 0.1% of NAV | Block filing, escalate immediately |

**MongoDB Collections:** None — pure computation

**Existing Partial:** `POST /api/mmif/validation-rules/test` (DSL rule tester includes variance computation)

---

### Tool 11 — `trace_root_cause`

Performs multi-level root cause analysis on a specific break.

```
Endpoint:   POST /api/mmif/tools/trace-root-cause
```

**Request Body:**

```json
{
  "fundId": "IE-UCITS-EQ-001",
  "account": "1100",
  "variance": 50.00,
  "period": "2026Q1",
  "eventId": "MMIF-2026-Q1-001",
  "breakId": "MMIF-BRK-A1B2C3D4"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fundId` | string | Yes | Fund account identifier |
| `account` | string | Yes | GL account number |
| `variance` | float | Yes | Observed variance amount |
| `period` | string | Yes | Filing period |
| `eventId` | string | No | Event ID for context |
| `breakId` | string | No | Specific break ID to trace |

**Response Schema:**

```json
{
  "fundId": "IE-UCITS-EQ-001",
  "account": "1100",
  "variance": 50.00,
  "traceLevel": "L3",
  "rootCause": {
    "classification": "PRICING",
    "confidence": "HIGH",
    "confidenceScore": 0.92,
    "description": "Market price differential between Eagle close price and MMIF valuation point",
    "impactOnNav": 0.0000066,
    "materialityLevel": "MINOR"
  },
  "drillDown": {
    "l0NavImpact": {
      "navBefore": 752432832.02,
      "adjustedNav": 752432782.02,
      "impact": -50.00,
      "impactBps": 0.066
    },
    "l1LedgerTrace": {
      "glAccount": "1100",
      "description": "Securities at Value",
      "tbEnding": 210250000.00,
      "positionsValue": 210249950.00,
      "variance": 50.00
    },
    "l2SubLedger": {
      "affectedSubLedger": "dataSubLedgerPosition",
      "positionCount": 145,
      "breakingPositions": 1,
      "positions": [
        {
          "assetId": "AAPL",
          "isin": "US0378331005",
          "eagleValue": 8762500.00,
          "mmifValue": 8762450.00,
          "variance": 50.00
        }
      ]
    },
    "l3Transactions": {
      "transactionCount": 3,
      "transactions": [
        {
          "transactionId": "TXN-001",
          "type": "PRICE_ADJUSTMENT",
          "amount": 50.00,
          "date": "2026-03-31",
          "description": "Late pricing adjustment for AAPL"
        }
      ]
    }
  },
  "similarHistoricalBreaks": [
    {
      "period": "2025Q4",
      "account": "1100",
      "variance": 35.00,
      "classification": "PRICING",
      "resolution": "Auto-cleared after T+1 pricing update"
    }
  ],
  "recommendedActions": [
    "Verify AAPL closing price source (Eagle vs MMIF provider)",
    "Check if T+1 pricing update resolves variance",
    "If persists, raise pricing discrepancy ticket with data vendor"
  ]
}
```

**MongoDB Collections:**
- Reads: `mmifBreakRecords`, `mmifEvents`, `mmifAgentAnalysis`, `dataSubLedgerPosition`, `dataDailyTransactions`
- Writes: `mmifAgentAnalysis` (updates findings)

**Existing Endpoint:** `POST /api/mmif/events/{event_id}/analyze` (event-level, all breaks)

**Agent Pipeline Steps Invoked:**
1. L0: NAV-level impact assessment
2. L1: Ledger account identification
3. L2: Sub-ledger position matching
4. L3: Transaction-level tracing
5. Break Analyst: Historical pattern matching

---

### Tool 12 — `get_historical_breaks`

Retrieves break history across multiple filing periods for pattern detection.

```
Endpoint:   GET /api/mmif/tools/historical-breaks
Query:      ?fund_id={fund_id}&account={account}&lookback={lookback_periods}
```

**Request Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `fund_id` | string | Yes | Fund account identifier |
| `account` | string | No | GL account number (omit for all accounts) |
| `lookback` | int | No | Number of prior periods to search (default: 4) |
| `rule_id` | string | No | Filter by specific rule ID |
| `severity` | string | No | Filter by severity |

**Response Schema:**

```json
{
  "fundId": "IE-UCITS-EQ-001",
  "account": "1100",
  "lookbackPeriods": 4,
  "totalBreaks": 3,
  "breaks": [
    {
      "breakId": "MMIF-BRK-PREV001",
      "eventId": "MMIF-2025-Q4-001",
      "period": "2025Q4",
      "ruleId": "VR_001",
      "ruleName": "Total Assets Tie-Out",
      "severity": "HARD",
      "fundAccount": "IE-UCITS-EQ-001",
      "lhsValue": 248000000.00,
      "rhsValue": 248000035.00,
      "variance": 35.00,
      "state": "RESOLVED",
      "classification": "PRICING",
      "resolution": "Auto-cleared after T+1 pricing update",
      "resolvedAt": "2025-12-31T16:00:00Z"
    }
  ],
  "patterns": {
    "recurringAccount": true,
    "recurringClassification": "PRICING",
    "averageVariance": 42.50,
    "autoResolvedPct": 66.7,
    "recommendation": "Recurring pricing variance on account 1100 — consider automated T+1 resolution workflow"
  }
}
```

**MongoDB Collections:**
- Reads: `mmifBreakRecords` (query across multiple eventIds)
- Cross-ref: `mmifEvents` (to map periods to eventIds)

**Existing Partial Endpoint:** `GET /api/mmif/events/{event_id}/breaks` (single event only)

---

### Tool 13 — `classify_break`

Applies the Break Classification Taxonomy to categorize a break.

```
Endpoint:   POST /api/mmif/tools/classify-break
```

**Request Body:**

```json
{
  "account": "1100",
  "accountDescription": "Securities at Value",
  "variance": 50.00,
  "fundId": "IE-UCITS-EQ-001",
  "period": "2026Q1",
  "context": {
    "tbValue": 210250000.00,
    "compareValue": 210249950.00,
    "compareSource": "PRIMARY",
    "smaMapping": "dataSubLedgerPosition",
    "nav": 752432832.02,
    "fundType": "UCITS"
  }
}
```

**Response Schema:**

```json
{
  "classification": "PRICING",
  "confidence": "HIGH",
  "confidenceScore": 0.92,
  "description": "Market price differential between accounting system and position valuation",
  "evidenceFactors": [
    "Variance is small relative to position size (0.000024%)",
    "Account 1100 maps to dataSubLedgerPosition (pricing-sensitive)",
    "Historical pattern shows similar pricing breaks in prior quarters",
    "No timing-related transactions found near period end"
  ],
  "alternativeClassifications": [
    {
      "classification": "ROUNDING",
      "confidence": "LOW",
      "confidenceScore": 0.15,
      "reason": "Variance exceeds typical rounding threshold"
    }
  ],
  "materialityLevel": "MINOR",
  "recommendedAction": "Verify pricing source. If T+1 update resolves, auto-clear."
}
```

**Break Classification Taxonomy (from agent spec Section 5.1):**

| Code | Classification | Description |
|------|---------------|-------------|
| `TIMING` | Timing Difference | Transaction posted in one system but not yet in another |
| `PRICING` | Pricing Variance | Different pricing sources or stale prices |
| `MAPPING` | Mapping Mismatch | Account mapping mismatch between TB and SMA/Positions |
| `DATA` | Data Quality | Missing data, corrupt values, failed interface |
| `METHODOLOGY` | Methodology Difference | Different calculation methods across systems |
| `CONFIG` | Configuration | System setup differences (rounding, precision, FX source) |
| `ROUNDING` | Rounding | Accumulated rounding differences, typically < 1.00 |

**MongoDB Collections:**
- Reads: `mmifBreakRecords` (historical patterns), `mmifMappingConfigs` (mapping context)

**Status:** New endpoint — currently runs inline within `MmifBreakAnalystAgent`

---

## Category 4: Reporting Tools

### Tool 14 — `generate_filing_report`

Produces the structured Filing Readiness Report.

```
Endpoint:   POST /api/mmif/tools/generate-report
```

**Request Body:**

```json
{
  "fundId": "IE-UCITS-EQ-001",
  "period": "2026Q1",
  "eventId": "MMIF-2026-Q1-001",
  "results": {
    "l1Results": [
      { "ruleId": "VR-L1-001", "description": "TB Balanced", "value": 0.00, "tolerance": 0.00, "status": "PASS" }
    ],
    "l2Results": [
      { "account": "1100", "description": "Securities at Value", "tbValue": 210250000.00, "compareValue": 210250000.00, "variance": 0.00, "source": "PRIMARY", "status": "TIED" }
    ],
    "l3Findings": []
  }
}
```

**Response Schema:**

```json
{
  "reportId": "RPT-2026-Q1-001",
  "fundId": "IE-UCITS-EQ-001",
  "fundName": "Aria Global Equity UCITS",
  "period": "2026Q1",
  "baseCurrency": "EUR",
  "filingDeadline": "2026-04-30",
  "overallReadiness": 97,
  "decision": "PROCEED_WITH_REVIEW",
  "confidence": "HIGH",
  "confidenceScore": 95,
  "summary": {
    "l1ChecksTotal": 4,
    "l1ChecksPassed": 4,
    "l1ChecksFailed": 0,
    "l2AccountsChecked": 12,
    "l2AccountsTied": 11,
    "l2AccountsBreak": 1,
    "l2AccountsNA": 0,
    "l3FindingsCount": 2,
    "totalVariance": 0.02
  },
  "l1Report": [
    {
      "check": "VR-L1-001",
      "description": "TB Balanced",
      "result": 0.00,
      "tolerance": 0.00,
      "status": "PASS"
    }
  ],
  "l2Report": [
    {
      "account": "1100",
      "description": "Securities at Value",
      "tbValue": 848881324.95,
      "compareValue": 848188873.50,
      "variance": 0.02,
      "source": "SECONDARY",
      "status": "BREAK",
      "classification": "ROUNDING",
      "rootCause": "Immaterial rounding difference",
      "confidence": "HIGH",
      "action": "Auto-clear"
    }
  ],
  "ledgerCrossCheck": {
    "assets": { "starting": 0.00, "ending": 0.00 },
    "liabilities": { "starting": 0.00, "ending": 0.00 },
    "capital": { "starting": 0.00, "ending": 0.00 },
    "bsDiff": { "starting": 0.00, "ending": 0.00 },
    "income": { "starting": 0.00, "ending": 0.00 },
    "expense": { "starting": 0.00, "ending": 0.00 },
    "netIncome": { "starting": 0.00, "ending": 0.00 },
    "rgl": { "starting": 0.00, "ending": 0.00 },
    "urgl": { "starting": 0.00, "ending": 0.00 },
    "netGL": { "starting": 0.00, "ending": 0.00 },
    "totalPnL": { "starting": 0.00, "ending": 0.00 },
    "tbBalanced": { "starting": 0.00, "ending": 0.00 }
  },
  "navTieOut": {
    "tbCapitalPlusPnL": 730294175.59,
    "navFromSMA": 752432832.02,
    "shareholderPivot": 752432832.05,
    "smaVsShareholderVariance": 0.03
  },
  "narrative": "All Level 1 structural checks PASS. One immaterial secondary compare break..."
}
```

**Filing Decisions (from agent spec Section 4.5):**

| Readiness | Condition | Decision |
|-----------|-----------|----------|
| 100% | All L1 PASS, all L2 PASS | `PROCEED_TO_FILE` |
| 85-99% | All L1 PASS, some L2 WARN (within tolerance) | `PROCEED_WITH_REVIEW` |
| 50-84% | L2 breaks exceed 0.1% of NAV | `ESCALATE_TO_SUPERVISOR` |
| 0% | Any L1 FAIL | `BLOCK_FILING` |

**MongoDB Collections:**
- Reads: `mmifAgentAnalysis`, `mmifValidationRuns`, `mmifBreakRecords`, `mmifReconciliationDetails`

**Existing Endpoint:** `GET /api/mmif/events/{event_id}/attestation`

---

### Tool 15 — `render_reconciliation_ui`

Returns the side-by-side reconciliation comparison data for UI rendering.

```
Endpoint:   GET /api/mmif/events/{event_id}/reconciliation/{account}
```

**Request Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `event_id` | path | Yes | MMIF event ID |
| `account` | path | Yes | Fund account identifier |

**Response Schema:**

Returns the full `mmifReconciliationDetails` document (see `docs/mmif_mongodb_collections.md` Section 3.8 for complete schema).

Contains 5 tabs of data:
- `assetLiabilityRows` — GL accounts with TB vs Positions/SMA comparison
- `capitalRows` — Capital accounts with beginning/ending balances
- `shareholderRows` — Share class activity by ISIN
- `navComparison` — Three-way NAV tie-out
- `ledgerCrossCheck` — Full accounting equation verification

**MongoDB Collections:**
- Reads: `mmifReconciliationDetails` (filter: `{eventId, account}`)

**Status:** Fully implemented — no changes needed.

---

### Tool 16 — `submit_mmif_filing`

Submits validated MMIF XML to the CBI portal. **Requires explicit human confirmation.**

```
Endpoint:   POST /api/mmif/filing/submit
```

**Request Body:**

```json
{
  "fundId": "IE-UCITS-EQ-001",
  "period": "2026Q1",
  "eventId": "MMIF-2026-Q1-001",
  "xmlPayload": "<mmif:Return>...</mmif:Return>",
  "approvedBy": {
    "userId": "u-fad",
    "userName": "Claire O'Brien",
    "role": "FUND_ADMIN",
    "approvalTimestamp": "2026-04-15T14:30:00Z"
  },
  "attestationId": "ATT-2026-Q1-001",
  "filingReadinessScore": 97,
  "filingDecision": "PROCEED_WITH_REVIEW"
}
```

**Response Schema:**

```json
{
  "submissionId": "SUB-2026-Q1-001",
  "fundId": "IE-UCITS-EQ-001",
  "period": "2026Q1",
  "status": "SUBMITTED",
  "cbiReference": "CBI-REF-2026-04-15-12345",
  "submittedAt": "2026-04-15T14:35:00Z",
  "submittedBy": "Claire O'Brien",
  "xmlSize": 245000,
  "validationsPassed": true,
  "auditTrail": {
    "attestationId": "ATT-2026-Q1-001",
    "readinessScore": 97,
    "l1ChecksPassed": 4,
    "l2BreaksCleared": 1,
    "humanApproval": true,
    "approvalTimestamp": "2026-04-15T14:30:00Z"
  }
}
```

**Safety Rules:**
- MUST have `approvedBy` with valid user credentials
- MUST have `filingReadinessScore >= 85`
- MUST NOT submit if any Level 1 check is in FAIL state
- Agent NEVER calls this automatically — always requires human confirmation in the chat

**MongoDB Collections:**
- Reads: `mmifAgentAnalysis` (verify attestation), `mmifEvents` (verify status)
- Writes: `mmifFilingSubmissions` (new collection for audit trail)
- Updates: `mmifEvents.status` → `FILED`

**Status:** New endpoint — no existing implementation. Requires CBI portal integration.

---

## Appendix A: Escalation Actions by Tool

| Tool Response | Escalation |
|---------------|-----------|
| `validate_mmif_xml` returns L1 FAIL | Block filing, return `BLOCK_FILING` |
| `compute_variance` returns `CRITICAL` materiality | Escalate to management |
| `trace_root_cause` returns `INCONCLUSIVE` confidence | Flag for human review |
| `classify_break` returns no high-confidence match | Escalate to analyst |
| `generate_filing_report` returns readiness < 50% | Block + escalate to supervisor |
| `submit_mmif_filing` called without approval | Reject with error |

## Appendix B: MongoDB Collection Dependencies per Tool

| Tool | Reads | Writes |
|------|-------|--------|
| `load_trial_balance` | `mmifLedgerData`, `ledger` | — |
| `load_positions` | `dataSubLedgerPosition`, `mmifMappingConfigs` | — |
| `load_shareholder_pivot` | `capitalStock`, `mmifReconciliationDetails` | — |
| `load_nav` | `navSummary`, `mmifReconciliationDetails` | — |
| `load_sma_mapping` | `mmifMappingConfigs` | — |
| `load_workbook` | — | `mmifLedgerData`, `mmifSampleData` (optional) |
| `validate_mmif_xml` | `mmifEvents`, `mmifSampleData`, `mmifLedgerData`, `mmifValidationRuleDefs` | `mmifValidationRuns`, `mmifBreakRecords` |
| `check_cbi_taxonomy` | Static reference data | — |
| `validate_isin` | — | — |
| `compute_variance` | — | — |
| `trace_root_cause` | `mmifBreakRecords`, `mmifEvents`, `mmifAgentAnalysis`, `dataSubLedgerPosition`, `dataDailyTransactions` | `mmifAgentAnalysis` |
| `get_historical_breaks` | `mmifBreakRecords`, `mmifEvents` | — |
| `classify_break` | `mmifBreakRecords`, `mmifMappingConfigs` | — |
| `generate_filing_report` | `mmifAgentAnalysis`, `mmifValidationRuns`, `mmifBreakRecords`, `mmifReconciliationDetails` | — |
| `render_reconciliation_ui` | `mmifReconciliationDetails` | — |
| `submit_mmif_filing` | `mmifAgentAnalysis`, `mmifEvents` | `mmifFilingSubmissions`, `mmifEvents` |
