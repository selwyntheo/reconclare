## ADDED Requirements

### Requirement: Dividends High Level route
The system SHALL render the Dividends Reconciliation (High Level) at route `/events/{eventId}/funds/{account}/income/dividends?valuationDt={date}`. The view SHALL also be accessible as a standalone reconciliation for all funds at `/events/{eventId}/income/dividends?valuationDt={date}`.

#### Scenario: Dividends loads for specific fund
- **WHEN** user navigates to `/events/EVT-001/funds/AC0001/income/dividends?valuationDt=2026-02-10`
- **THEN** the system SHALL display high-level dividend reconciliation for fund AC0001

#### Scenario: Dividends loads for all funds
- **WHEN** user navigates to `/events/EVT-001/income/dividends?valuationDt=2026-02-10`
- **THEN** the system SHALL display dividend reconciliation across all funds in the event

### Requirement: Dividends High Level grid columns
The high-level Dividends grid SHALL display one row per security with aggregate unsettled/accrued dividend positions. Columns SHALL include: Valuation Date (Date), Match Status (Enum), BNY Account (String), Incumbent Account (String), Primary Asset ID (String), Security Name (String), BNY Income Currency (String), Incumbent Income Currency (String), BNY Net Income Base Currency (Decimal), Incumbent Net Income Base Currency (Decimal), Net Income Difference Base Currency (Decimal), BNY Gross Income Base (Decimal), Incumbent Gross Income Base (Decimal), Gross Income Difference Base (Decimal), BNY Withholding Base (Decimal), Incumbent Withholding Base (Decimal), Withholding Difference Base (Decimal), BNY Reclaim Base (Decimal), Incumbent Reclaim Base (Decimal), Reclaim Difference Base (Decimal), local currency equivalents for all above fields, Reviewer (String), Break Team Assignment (String), Break Owner (String), Break Category (Enum), and Comment (Text).

#### Scenario: High-level grid shows security aggregation
- **WHEN** security DIV001 has 3 unsettled dividends totaling 15,000 net income at BNY
- **THEN** the grid SHALL display one row for DIV001 with BNY Net Income Base of 15,000

### Requirement: Dividends tie-back to ledger
Total Net Income and Total Reclaim differences SHALL tie back to the Balance Sheet/Ledger variances for Unsettled/Accrued Dividend Income and Unsettled/Accrued Reclaim Differences in the Trial Balance.

#### Scenario: Net income ties to ledger
- **WHEN** total Net Income Difference across all dividend positions is 12,154.70
- **THEN** this amount SHALL tie to the Dividend RecPay TB sub-classification variance

### Requirement: Dividends Detailed Drilldown
The system SHALL provide two levels of detailed drilldown. Drilldown 1 (Security Level): clicking a security row SHALL show individual dividend events by XD date and pay date for that security. Drilldown 2 (Fund Level): an alternative view showing all dividend events across all securities for a fund. Detailed drilldown columns SHALL include all high-level columns plus: XD Date (Date), Pay Date (Date), BNY Dividend Rate (Decimal), Incumbent Dividend Rate (Decimal), Dividend Rate Difference (Decimal), BNY XD Shares (Decimal), Incumbent XD Shares (Decimal), and XD Shares Difference (Decimal).

#### Scenario: Security-level drilldown shows individual events
- **WHEN** user expands security DIV001 in the high-level grid
- **THEN** an inline table SHALL appear showing each dividend event for DIV001 with XD date, pay date, dividend rate, and XD shares comparison

#### Scenario: Dividend rate difference identified
- **WHEN** BNY Dividend Rate is 0.50 and Incumbent Dividend Rate is 0.48 for an event
- **THEN** the Dividend Rate Difference SHALL display 0.02, indicating a rate-driven income break

### Requirement: Fixed Income Reconciliation route
The system SHALL render the Fixed Income Reconciliation at route `/events/{eventId}/funds/{account}/income/fixed-income?valuationDt={date}`. The view SHALL also be accessible as a standalone reconciliation for all funds.

#### Scenario: Fixed Income loads for specific fund
- **WHEN** user navigates to `/events/EVT-001/funds/AC0001/income/fixed-income?valuationDt=2026-02-10`
- **THEN** the system SHALL display fixed income (coupon) reconciliation for fund AC0001

### Requirement: Fixed Income grid columns
The Fixed Income grid SHALL follow the same high-level and detailed drilldown pattern as dividends. The high-level view SHALL aggregate net income, gross income, and withholding by security. The detailed drilldown SHALL add coupon-specific columns: Prior Coupon Date (Date), Next Coupon Date (Date), Payment Frequency (String, e.g., "Semi-Annual", "Quarterly"), BNY Coupon Rate (Decimal), Incumbent Coupon Rate (Decimal), and Coupon Rate Difference (Decimal).

#### Scenario: Coupon rate difference identified
- **WHEN** BNY Coupon Rate is 0.05 and Incumbent Coupon Rate is 0.045 for a bond
- **THEN** the Coupon Rate Difference SHALL display 0.005, indicating a coupon-driven income break

#### Scenario: Payment frequency displayed
- **WHEN** a bond has semi-annual coupon payments
- **THEN** the Payment Frequency column SHALL display "Semi-Annual"

### Requirement: Income reconciliation break resolution
Both Dividends and Fixed Income grids SHALL include Break Team Assignment, Break Owner, Break Category, and Comment columns for resolution tracking. Income withholding breaks SHALL auto-assign to BNY NAV Ops.

#### Scenario: Withholding break auto-assigned to NAV Ops
- **WHEN** a withholding difference is detected for security DIV001
- **THEN** the Break Team Assignment SHALL be auto-populated as "BNY NAV Ops" and a notification SHALL be dispatched

### Requirement: Income reconciliation performance
The Income reconciliation views SHALL load within 1 second with up to 200 securities and their detailed drilldown data.

#### Scenario: Dividends grid loads within performance target
- **WHEN** the fund has 200 securities with dividend events
- **THEN** the high-level grid SHALL complete rendering within 1 second
