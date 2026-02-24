## ADDED Requirements

### Requirement: Price Breaks route
The system SHALL render the Price Breaks view at route `/events/{eventId}/funds/{account}/positions/price-breaks?valuationDt={date}`. The view SHALL also be accessible as a standalone reconciliation for all funds at `/events/{eventId}/positions/price-breaks?valuationDt={date}`.

#### Scenario: Price Breaks loads for specific fund
- **WHEN** user navigates to `/events/EVT-001/funds/AC0001/positions/price-breaks?valuationDt=2026-02-10`
- **THEN** the system SHALL display positions with price discrepancies for fund AC0001

#### Scenario: Price Breaks loads for all funds
- **WHEN** user navigates to `/events/EVT-001/positions/price-breaks?valuationDt=2026-02-10`
- **THEN** the system SHALL display positions with price discrepancies across all funds

### Requirement: Price Breaks filtering criteria
The Price Breaks view SHALL display only positions where there is a price discrepancy between BNY and Incumbent beyond the configured tolerance.

#### Scenario: Only price discrepancies shown
- **WHEN** the fund has 100 positions, 3 of which have price differences
- **THEN** the grid SHALL display only the 3 positions with price breaks

### Requirement: Price Breaks auto-assignment to BNY Pricing
All price breaks SHALL automatically have the Break Team Assignment set to "BNY Pricing" and a notification SHALL be sent to the BNY Pricing Team to review and add details on all price breaks.

#### Scenario: Auto-assignment on price break detection
- **WHEN** a price break is detected for TEST Security 1
- **THEN** the Break Team Assignment SHALL be auto-populated as "BNY Pricing", the Break Owner SHALL be assigned via round-robin from Pricing team members, and a notification SHALL be dispatched

### Requirement: Price Breaks grid columns
The Price Breaks grid SHALL include: Valuation Date, BNY/Incumbent Account, Account Name, Primary Asset ID, Security Name, Asset Type, BNY Trading Currency, Incumbent Trading Currency, BNY Shares, Incumbent Shares, BNY Price (Decimal), Incumbent Price (Decimal), Price Difference (Decimal, absolute), % Price Difference (Percent, computed: (BNY Price - Incumbent Price) / Incumbent Price * 100), BNY Base Market Value (Decimal), Incumbent Base Market Value (Decimal), Base Market Value Difference (Decimal), BNY Local Market Value (Decimal), Incumbent Local Market Value (Decimal), Local Market Value Difference (Decimal), Break Team Assignment (String), Break Owner (String), Break Category (Enum), and Comment (Text).

#### Scenario: Price break with percentage calculation
- **WHEN** BNY Price is 12.50 and Incumbent Price is 12.00 for an equity
- **THEN** Price Difference SHALL display 0.50, % Price Difference SHALL display -4.17%, and Base Market Value Difference SHALL reflect the price impact on total holdings

#### Scenario: Bond price break example
- **WHEN** BNY Price is 100.96 and Incumbent Price is 100.10 for a fixed income security with 1,000,000 face value
- **THEN** Price Difference SHALL display 0.86, % Price Difference SHALL display -0.86%, and the Base Market Value Difference SHALL display -8,600.00

### Requirement: Price Breaks resolution tracking
Each price break row SHALL support editable Break Team Assignment, Break Owner, Break Category, and Comment fields for resolution tracking. Changes SHALL be persisted and audit-logged.

#### Scenario: Reviewer categorizes price break as Known Difference
- **WHEN** a pricing analyst sets Break Category to "Known Difference" and adds comment "KD 4 Bond Pricing matrix differences"
- **THEN** the system SHALL save the categorization, link to the KD 4 reference, and create an audit record
