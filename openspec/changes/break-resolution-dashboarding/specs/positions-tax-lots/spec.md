## ADDED Requirements

### Requirement: Tax Lots Reconciliation route
The system SHALL render the Tax Lots Reconciliation view at route `/events/{eventId}/funds/{account}/positions/tax-lots?valuationDt={date}`. The view SHALL be accessible as a drilldown from the Full Portfolio positions view.

#### Scenario: Tax Lots loads for specific fund
- **WHEN** user navigates to `/events/EVT-001/funds/AC0001/positions/tax-lots?valuationDt=2026-02-10`
- **THEN** the system SHALL display lot-level position reconciliation for fund AC0001

### Requirement: Tax Lots grid columns
The Tax Lots grid SHALL display individual acquisition lots for each security position. Columns SHALL include: Valuation Date (Date), BNY Account (String), Incumbent Account (String), Primary Asset ID (String), Security Name (String), Asset Type (Enum), Lot ID / Transaction ID (String), Acquisition Date (Date), BNY Shares (Decimal, 6 decimal places), Incumbent Shares (Decimal, 6 decimal places), Shares Difference (Decimal), BNY Cost Basis Base (Decimal), Incumbent Cost Basis Base (Decimal), Cost Basis Difference Base (Decimal), BNY Cost Basis Local (Decimal), Incumbent Cost Basis Local (Decimal), Cost Basis Difference Local (Decimal), BNY Market Value Base (Decimal), Incumbent Market Value Base (Decimal), Market Value Difference Base (Decimal), BNY Gain/Loss (Decimal, Market Value - Cost Basis), Incumbent Gain/Loss (Decimal), Gain/Loss Difference (Decimal).

#### Scenario: Grid displays lot-level data
- **WHEN** security TEST001 has 3 acquisition lots
- **THEN** the grid SHALL display 3 rows for TEST001, one per lot, with BNY vs Incumbent comparison at the lot level

#### Scenario: Gain/Loss computed correctly
- **WHEN** a lot has BNY Market Value of 120,000 and BNY Cost Basis of 100,000
- **THEN** BNY Gain/Loss SHALL display 20,000

### Requirement: Tax Lots grouping by security
The Tax Lots grid SHALL support grouping by Primary Asset ID, showing a group header with the security name and aggregate lot totals, with individual lots as expandable child rows.

#### Scenario: Lots grouped by security
- **WHEN** the fund has 50 lots across 10 securities
- **THEN** the grid SHALL display 10 group headers, each expandable to show the individual lots for that security

### Requirement: Tax Lots tie-out to position level
The system SHALL validate that the sum of all lot-level values for a security ties to the position-level values in the Full Portfolio view. A warning SHALL be displayed for any security where lot totals do not match position totals.

#### Scenario: Lot totals tie to position
- **WHEN** the sum of lot shares for TEST001 equals the position shares for TEST001
- **THEN** the tie-out indicator SHALL show a green pass status

#### Scenario: Lot totals do not tie to position
- **WHEN** the sum of lot shares for TEST001 is 9,500 but the position shares are 10,000
- **THEN** the tie-out indicator SHALL show a warning with the 500-share discrepancy
