## ADDED Requirements

### Requirement: Trial Balance structured commentary
The Comments column in the Trial Balance SHALL support structured, multi-line commentary organized by Break Category. For each TB sub-classification, reviewers SHALL be able to add multiple comment entries, each tagged with a Break Category and a monetary amount. This provides a complete narrative of the difference for each line item.

#### Scenario: Structured commentary for Securities at Value
- **WHEN** the Securities at Value sub-classification has a difference of 1,201,400.00
- **THEN** the reviewer SHALL be able to add multiple tagged comments such as: Known Difference: -8,600 "KD 4 Bond Pricing matrix differences", BNY to Resolve: 60,000 "unrealised difference due to trade timing", Under Investigation: -750,000 "equity pricing under review by BNY pricing"

#### Scenario: Commentary entries sum to sub-classification difference
- **WHEN** multiple commentary entries are added to a TB sub-classification
- **THEN** the system SHALL display the sum of commentary amounts alongside the total difference to indicate how much of the variance has been explained

### Requirement: Trial Balance sidebar BS/P&L summary
The Trial Balance view SHALL include a sidebar panel showing cross-check summary: BNY Balance Sheet total vs Incumbent Balance Sheet total and their difference, BNY P&L total vs Incumbent P&L total and their difference, and BNY (Balance Sheet minus P&L) vs Incumbent (Balance Sheet minus P&L) with the difference. This cross-check validates that the balance sheet and income statement are internally consistent.

#### Scenario: Sidebar displays BS/P&L cross-check
- **WHEN** the Trial Balance loads for fund AC0001
- **THEN** the sidebar SHALL display BNY BS Total, Incumbent BS Total, BS Difference, BNY P&L Total, Incumbent P&L Total, P&L Difference, and the net cross-check

#### Scenario: Sidebar highlights cross-check discrepancy
- **WHEN** BS minus P&L for BNY does not equal BS minus P&L for Incumbent
- **THEN** the sidebar SHALL highlight the discrepancy with a warning indicator

### Requirement: Expanded TB sub-classification taxonomy
The Trial Balance grid SHALL support the expanded sub-classification taxonomy: Cash, Dividends Receivable, Fixed Interest Receivable, Foreign Exchange, Futures Variation Margin, Reclaims Receivable, Securities at Value, Accrued Expenses, Prior Undistributed G/L, Redemptions, Subscriptions, Expenses, Withholding, Dividends, Fixed Interest, Futures, Investments, and Net Exchange G/L. Each sub-classification SHALL be categorized under its parent TB Classification (Assets, Liabilities, Capital, Expenses, Income, Realised, Unrealised) and TB Category (Balance Sheet or P&L).

#### Scenario: Sub-classifications grouped by category
- **WHEN** the Trial Balance loads
- **THEN** the grid SHALL display sub-classifications grouped under their parent classification (e.g., Cash, Securities at Value, Dividends Receivable under "Assets")

#### Scenario: TB Category column shows Balance Sheet or P&L
- **WHEN** the sub-classification is "Securities at Value"
- **THEN** the TB Category SHALL display "Balance Sheet" and TB Classification SHALL display "Assets"

### Requirement: Trial Balance break resolution columns
The Trial Balance grid SHALL include additional columns for break resolution: Break Team Assignment (String), Break Owner (String), Break Category (Enum), and an expanded Comments column supporting the structured multi-line commentary pattern.

#### Scenario: TB row has break resolution columns
- **WHEN** the Trial Balance grid loads
- **THEN** each sub-classification row SHALL display editable Break Team, Break Owner, Break Category, and structured Comments columns

## MODIFIED Requirements

### Requirement: Ledger BS Compare grid
The system SHALL display an AG-Grid data grid showing categorized GL account comparison between Incumbent and BNY. Each row SHALL represent a GL sub-classification. Columns SHALL include: Valuation Dt (YYYY-MM-DD), Account, TB Category (Enum: "Balance Sheet" or "P&L"), TB Classification (Enum: Assets, Liabilities, Capital, Expenses, Income, Realised, Unrealised), TB Sub Classification (String — expanded taxonomy: Cash, Dividends Receivable, Fixed Interest Receivable, Foreign Exchange, Futures Variation Margin, Reclaims Receivable, Securities at Value, Accrued Expenses, Prior Undistributed G/L, Redemptions, Subscriptions, Expenses, Withholding, Dividends, Fixed Interest, Futures, Investments, Net Exchange G/L), Incumbent Balance (SUM of endingBalance from incumbent source, #,##0.00), BNY Balance (SUM of endingBalance from BNY source, #,##0.00), Balance Diff (Incumbent - BNY, parenthesized if negative), Balance Diff BP (basis points of fund TNA), Validation (traffic light), Break Team Assignment (String), Break Owner (String), Break Category (Enum), and Comments (structured multi-line with break category tags and amounts).

#### Scenario: Grid displays categorized ledger balances
- **WHEN** Trial Balance loads for AC0002 on 2026-02-10
- **THEN** the grid SHALL display one row per GL sub-classification with Incumbent balances (userBank=incumbent) and BNY balances (userBank=BNY), each being the SUM of endingBalance for GL accounts mapped to that sub-classification

#### Scenario: Grid shows expanded sub-classification rows
- **WHEN** Trial Balance loads for a fund with typical GL accounts
- **THEN** the grid SHALL show rows for at minimum: Cash, Securities at Value, Dividends Receivable, Fixed Interest Receivable, Foreign Exchange, Futures Variation Margin, Reclaims Receivable, Accrued Expenses (additional sub-classifications appear as GL mapping data dictates)

#### Scenario: Double-click sub-classification drills into Position Drill-Down
- **WHEN** user double-clicks the "Securities at Value" sub-classification row
- **THEN** the system SHALL navigate to `/events/{eventId}/funds/{account}/positions?valuationDt={date}&category=Securities%20at%20Value`

#### Scenario: Structured commentary editing in grid
- **WHEN** user clicks the Comments cell for "Securities at Value"
- **THEN** a commentary editor SHALL open allowing multiple entries each tagged with Break Category and amount
