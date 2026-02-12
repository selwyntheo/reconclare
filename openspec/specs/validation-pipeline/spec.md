## ADDED Requirements

### Requirement: Sequential validation execution
When a user triggers "Run Validation" from the NAV Dashboard, the system SHALL execute 6 validation checks in dependency order for each fund in the event: (1) NAV to Ledger (dataNav → dataLedger, no dependency), (2) Ledger BS to INCST (dataLedger BS → dataLedger INCST, depends on check 1), (3) Ledger TF to Class (dataLedger TF → dataLedger Class, depends on check 1), (4) Ledger to Subledger (dataLedger → derivedSubLedgerRollup, depends on check 3 + rollup calculation), (5) Position to Lot (dataSubLedgerTrans → dataSubLedgerPosition, depends on check 4), (6) Basis Lot Check (dataSubLedgerTrans primary → non-primary, depends on check 5). The system SHALL respect check dependencies and not execute a check until its prerequisite checks have completed.

#### Scenario: Full validation run executes checks in order
- **WHEN** user triggers a validation run with all 6 checks selected for event EVT-001 on date 2026-02-10
- **THEN** the system SHALL execute checks 1 through 6 in dependency order for each fund, completing prerequisite checks before starting dependent ones

#### Scenario: Partial check suite skips dependent checks
- **WHEN** user selects only "NAV to Ledger" and "Ledger BS to INCST" in the check suite
- **THEN** the system SHALL execute only those 2 checks, with check 2 running after check 1 completes

#### Scenario: Check dependency failure halts downstream checks
- **WHEN** check 1 (NAV to Ledger) fails to execute (data error, not a validation break) for a fund
- **THEN** checks 2-6 SHALL be skipped for that fund with status "SKIPPED" and reason "dependency failed"

### Requirement: Validation progress tracking
The system SHALL provide real-time progress tracking during validation execution. Progress events SHALL include: which fund is currently being processed (e.g., "Processing fund 3 of 15"), which check is executing within that fund, and completion status per check (passed, failed, error). Progress SHALL be communicated to the frontend via SSE events on the event's SSE channel.

#### Scenario: Progress events sent during validation
- **WHEN** validation is running for event EVT-001 with 15 funds
- **THEN** the system SHALL emit SSE events including fund progress ("Processing fund 3 of 15...") and per-check completion status

#### Scenario: Frontend displays validation progress
- **WHEN** the Run Validation button is pressed and SSE events arrive
- **THEN** the NAV Dashboard SHALL show a progress bar with the current fund count and check status

### Requirement: Derived subledger rollup computation
The system SHALL compute the derivedSubLedgerRollup dataset at validation time using the GL account mapping rules. The rollup SHALL be computed per valuationDt, account, and eagleLedgerAcct. The computation SHALL map canonical model fields to GL account numbers with the following rules: Cash = direct ledger load (ledgerLoad=1), Investment Cost = posBookValueBase from dataSubLedgerPosition, Investment Urgl = posMarketValueBase - posBookValueBase from dataSubLedgerPosition, Interest RecPay = posIncomeBase from dataSubLedgerPosition, Futures Margin = ltdVariationMarginBase, Capital Subs = subscriptionBalance * -1, Capital Reds Pay = redemptionBalance / redemptionPayBase, Distribution = incomeDistribution / stcgDistribution / ltcgDistribution, Distribution Payable = distributionPayable * -1, Forward Cost = ABS(fwdBookValue), Forward URGL = fwdUnrealized, Income Unrealized = posIncomeMarket - posIncomeBase.

#### Scenario: Subledger rollup computed for Investment Cost
- **WHEN** the rollup computation runs for fund AC0002 on 2026-02-10
- **THEN** the Investment Cost subledger value SHALL equal the SUM of posBookValueBase from dataSubLedgerPosition for all positions mapped to the Investment Cost GL category

#### Scenario: Subledger rollup computed for Investment Urgl
- **WHEN** the rollup computation runs for fund AC0002
- **THEN** the Investment Urgl subledger value SHALL equal the SUM of (posMarketValueBase - posBookValueBase) from dataSubLedgerPosition for all positions mapped to the Investment Urgl GL category

#### Scenario: Subledger rollup computed for Capital Subs
- **WHEN** the rollup computation runs for fund AC0002
- **THEN** the Capital Subs subledger value SHALL equal subscriptionBalance * -1 (sign inversion per rule)

#### Scenario: Rollup results cached per validation run
- **WHEN** a validation run completes
- **THEN** the derived subledger rollup results SHALL be cached and available to both the Trial Balance grid (for subledger compare check) and the Position Drill-Down (for tie-out validation)

### Requirement: NAV Compare data endpoint
The system SHALL provide a backend endpoint `GET /api/events/{eventId}/nav-compare?valuationDt={date}` that returns NAV Compare data with Incumbent and BNY side-by-side. The endpoint SHALL join dataNav records (isPrimaryBasis='Y') for userBank=incumbent and userBank='BNY' on (valuationDt, account, class), aggregate by account (sum across all classes), and return: account, accountName (from refFund), incumbentTNA, bnyTNA, tnaDifference, tnaDifferenceBP, and validationStatus.

#### Scenario: NAV Compare endpoint returns fund comparison
- **WHEN** GET `/api/events/EVT-001/nav-compare?valuationDt=2026-02-10` is called
- **THEN** the response SHALL contain one record per fund with incumbent and BNY TNA values, their difference, basis points, and validation status

### Requirement: Cross-check data endpoint
The system SHALL provide a backend endpoint `GET /api/events/{eventId}/nav-compare/{account}/cross-checks?valuationDt={date}` that returns Ledger BS Compare Check and Ledger INCST Compare Check data for a specific fund.

#### Scenario: Cross-check endpoint returns BS and INCST checks
- **WHEN** GET `/api/events/EVT-001/nav-compare/AC0002/cross-checks?valuationDt=2026-02-10` is called
- **THEN** the response SHALL contain bsCheck (ledger BS sum vs NAV netAssets) and incstCheck (ledger INCST sum vs BS remainder) with their differences and validation statuses

### Requirement: Trial Balance comparison endpoint
The system SHALL provide a backend endpoint `GET /api/funds/{account}/trial-balance-compare?valuationDt={date}` that returns categorized ledger comparison data (Incumbent vs BNY) with each category's incumbent balance, BNY balance, difference, basis points, and validation status.

#### Scenario: Trial Balance endpoint returns category comparison
- **WHEN** GET `/api/funds/AC0002/trial-balance-compare?valuationDt=2026-02-10` is called
- **THEN** the response SHALL contain one record per GL category with incumbent and BNY balances, their difference, and validation status

### Requirement: Subledger check endpoint
The system SHALL provide a backend endpoint `GET /api/funds/{account}/trial-balance-compare/{category}/subledger-check?valuationDt={date}` returning the subledger compare check for a specific GL category (ledger endingBalance vs derived subledger rollup value).

#### Scenario: Subledger check endpoint returns comparison
- **WHEN** GET `/api/funds/AC0002/trial-balance-compare/Investment%20Cost/subledger-check?valuationDt=2026-02-10` is called
- **THEN** the response SHALL contain ledgerValue, subledgerValue, difference, and validationStatus

### Requirement: Position comparison endpoint
The system SHALL provide a backend endpoint `GET /api/funds/{account}/position-compare?valuationDt={date}&category={cat}` returning position-level comparison between Incumbent and BNY for the specified GL category, with comparison fields varying by category context.

#### Scenario: Position comparison returns category-specific fields
- **WHEN** GET `/api/funds/AC0002/position-compare?valuationDt=2026-02-10&category=Investment%20Urgl` is called
- **THEN** the response SHALL contain positions with unrealized-related comparison fields (posUnrealizedBase, posMarketValueBase, etc.) as Incumbent/BNY/Variance per field

### Requirement: Tax lot detail endpoint
The system SHALL provide a backend endpoint `GET /api/funds/{account}/position-compare/{assetId}/tax-lots?valuationDt={date}` returning Incumbent vs BNY tax lot comparison for a specific security.

#### Scenario: Tax lot endpoint returns lot comparison
- **WHEN** GET `/api/funds/AC0002/position-compare/789456123/tax-lots?valuationDt=2026-02-10` is called
- **THEN** the response SHALL contain individual tax lots joined on transactionId with Incumbent/BNY/Variance per field

### Requirement: Basis lot check endpoint
The system SHALL provide a backend endpoint `GET /api/funds/{account}/basis-lot-check?valuationDt={date}` returning the comparison of shares between primary basis (isPrimaryBasis='Y') and non-primary basis (isPrimaryBasis<>'Y') per asset.

#### Scenario: Basis lot check returns discrepancies
- **WHEN** GET `/api/funds/AC0002/basis-lot-check?valuationDt=2026-02-10` is called
- **THEN** the response SHALL contain positions with primaryShares, nonPrimaryShares, and shareVariance per assetId

### Requirement: SSE endpoint for real-time events
The system SHALL provide a backend endpoint `GET /api/events/{eventId}/sse` that streams Server-Sent Events scoped to the specified event. Events SHALL include validation run progress, validation completion, AI analysis completion, and status transitions.

#### Scenario: SSE endpoint streams validation progress
- **WHEN** a client connects to `/api/events/EVT-001/sse` and a validation run starts
- **THEN** the stream SHALL emit events with type "validation_progress" containing fund progress and check status

#### Scenario: SSE endpoint streams completion events
- **WHEN** a validation run completes for event EVT-001
- **THEN** the SSE stream SHALL emit an event with type "validation_complete" containing the run summary
