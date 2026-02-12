## ADDED Requirements

### Requirement: Trial Balance route and breadcrumb
The system SHALL render the Trial Balance screen at route `/events/{eventId}/funds/{account}/trial-balance?valuationDt={date}`. The breadcrumb SHALL display "Events > {Event Name} > {Fund Name} > Trial Balance".

#### Scenario: Trial Balance loads with fund context
- **WHEN** user navigates to `/events/EVT-001/funds/AC0002/trial-balance?valuationDt=2026-02-10`
- **THEN** the system SHALL load the Trial Balance for fund AC0002 on date 2026-02-10 with breadcrumb "Events > Vanguard Fixed Income Migration > AC0002 Fund > Trial Balance"

### Requirement: Context header
The system SHALL display a fixed context header bar showing inherited filter state: Fund name and account (e.g., "AC0002 Fund (AC0002)"), Valuation Date, NAV Variance with amount, basis points, and traffic light indicator, and AI Status (Analyzing / Complete with confidence % / Needs Review).

#### Scenario: Context header shows NAV variance from parent
- **WHEN** user drills from NAV Dashboard where AC0002 has TNA Difference of ($17,857.00) at 7.99 bp
- **THEN** the context header SHALL display "NAV Variance: ($17,857.00) (7.99 bp)" with a red traffic light indicator

### Requirement: Ledger BS Compare grid
The system SHALL display an AG-Grid data grid showing categorized GL account comparison between Incumbent and BNY. Each row SHALL represent a GL category. Columns SHALL include: Valuation Dt (YYYY-MM-DD), Account, Category (GL category label derived from eagleLedgerAcct mapping: Cash, Investment Cost, Investment Urgl, Futures Margin, Dividend RecPay, Interest RecPay, Expense RecPay, Capital Subs, Capital Reds Pay, Distribution, Distribution Payable, Forward Cost, Forward URGL, Income Unrealized), Incumbent Balance (SUM of endingBalance from incumbent source, #,##0.00), BNY Balance (SUM of endingBalance from BNY source, #,##0.00), Balance Diff (Incumbent - BNY, parenthesized if negative), Balance Diff BP (basis points of fund TNA), and Validation (traffic light: green if |diff| < threshold, else red).

#### Scenario: Grid displays categorized ledger balances
- **WHEN** Trial Balance loads for AC0002 on 2026-02-10
- **THEN** the grid SHALL display one row per GL category with Incumbent balances (userBank=incumbent) and BNY balances (userBank=BNY), each being the SUM of endingBalance for GL accounts mapped to that category

#### Scenario: Grid shows expected category rows
- **WHEN** Trial Balance loads for a fund with typical GL accounts
- **THEN** the grid SHALL show rows for at minimum: Cash, Investment Cost, Investment Urgl, Futures Margin, Dividend RecPay, Interest RecPay, Expense RecPay (additional categories appear as GL mapping data dictates)

#### Scenario: Double-click category drills into Position Drill-Down
- **WHEN** user double-clicks the "Investment Urgl" category row
- **THEN** the system SHALL navigate to `/events/{eventId}/funds/{account}/positions?valuationDt={date}&category=Investment%20Urgl`

### Requirement: Expandable row subledger compare check
When a user expands a category row via chevron, the system SHALL display an inline Subledger Compare Check table. This validates that the GL ending balance (LHS: dataLedger.endingBalance where eagleClass='TF' and isPrimaryBasis='Y') matches the derived subledger rollup value (RHS: derivedSubLedgerRollup.subLedgerValue where isPrimaryBasis='Y'). The table SHALL show columns: LHS (Ledger) value, RHS (Subledger) value, Difference (endingBalance - subLedgerValue), and Validation (traffic light).

#### Scenario: Expand category shows subledger check
- **WHEN** user expands the "Investment Cost" category row
- **THEN** an inline table SHALL appear showing the ledger endingBalance vs the derived subledger rollup value for Investment Cost, with the difference and a pass/fail indicator

#### Scenario: Subledger check shows break
- **WHEN** the Investment Cost ledger balance is $1,420,620.00 and the subledger rollup is $1,420,423.00
- **THEN** the subledger check SHALL show Difference = $197.00 with a red validation indicator

### Requirement: Reconciliation roll-up summary
The system SHALL display a summary footer row below the grid showing: Total Incumbent Balance (sum of all category incumbent balances), Total BNY Balance (sum of all category BNY balances), Total Variance (sum of all Balance Diff values), and a Tie-Out Validation check confirming the total variance equals the NAV TNA Difference from the parent screen. If it does not tie, a warning SHALL be displayed.

#### Scenario: Roll-up summary ties to NAV variance
- **WHEN** the sum of all category variances equals the NAV TNA Difference of ($17,857.00)
- **THEN** the tie-out indicator SHALL show a green pass status

#### Scenario: Roll-up summary shows tie-out warning
- **WHEN** the sum of all category variances is ($17,600.00) but the NAV TNA Difference is ($17,857.00)
- **THEN** the tie-out indicator SHALL show a warning with the ($257.00) discrepancy

### Requirement: NAV waterfall chart
The system SHALL display a waterfall chart (using Recharts BarChart) positioned above or alongside the grid, visually decomposing the NAV variance. The chart SHALL show: Starting bar for Incumbent NAV (full height, neutral color), Component bars for each GL category's variance contribution (green upward for positive, red downward for negative), and Ending bar for BNY NAV (full height, neutral color). The chart SHALL be interactive: clicking a bar highlights and scrolls to the corresponding grid row. On hover, tooltips SHALL show category name, amount, and percentage of total variance.

#### Scenario: Waterfall chart renders variance decomposition
- **WHEN** Trial Balance loads with categories Cash (+$4,168), Investment Cost (+$197), Investment Urgl (-$22,972.58)
- **THEN** the waterfall chart SHALL render a starting bar for Incumbent NAV, then component bars sized proportionally (Cash green upward, Investment Cost green upward, Investment Urgl red downward), ending with BNY NAV bar

#### Scenario: Click waterfall bar highlights grid row
- **WHEN** user clicks the "Investment Urgl" bar in the waterfall chart
- **THEN** the corresponding "Investment Urgl" row in the grid SHALL be highlighted and scrolled into view

#### Scenario: Waterfall chart tooltip on hover
- **WHEN** user hovers over the "Investment Urgl" bar
- **THEN** a tooltip SHALL display "Investment Urgl: ($22,972.58) — 128.6% of total variance"

#### Scenario: Waterfall chart renders within performance target
- **WHEN** the chart has up to 15 category bars
- **THEN** the chart SHALL render within 200ms

### Requirement: Trial Balance AI commentary
The AI Commentary panel at the Trial Balance level SHALL show category-level analysis: which categories are primary variance drivers, correlation of category breaks with position-level patterns, upward propagation commentary (how category variance flows to NAV-level break), and drill-down priority suggestions based on magnitude, confidence, and pattern matching.

#### Scenario: AI panel identifies primary variance driver
- **WHEN** Investment Urgl has the largest absolute variance of ($22,972.58)
- **THEN** the AI panel SHALL identify Investment Urgl as the primary variance driver and provide narrative context

### Requirement: Trial Balance export
The system SHALL allow exporting the full trial balance with all categories and subledger detail to Excel.

#### Scenario: Export trial balance to Excel
- **WHEN** user clicks Export to Excel
- **THEN** the system SHALL download an Excel file with all category rows, their balances, and subledger detail

### Requirement: Trial Balance performance
The Trial Balance screen SHALL load within 500ms with up to 30 GL categories and their balances.

#### Scenario: Screen loads within performance target
- **WHEN** the fund has 30 GL categories
- **THEN** the Trial Balance SHALL complete loading within 500ms
