## ADDED Requirements

### Requirement: Forwards Reconciliation route
The system SHALL render the Forwards Reconciliation at route `/events/{eventId}/funds/{account}/derivatives/forwards?valuationDt={date}`. The view SHALL also be accessible as a standalone reconciliation for all funds at `/events/{eventId}/derivatives/forwards?valuationDt={date}`.

#### Scenario: Forwards loads for specific fund
- **WHEN** user navigates to `/events/EVT-001/funds/AC0001/derivatives/forwards?valuationDt=2026-02-10`
- **THEN** the system SHALL display FX forward reconciliation for fund AC0001

#### Scenario: Forwards loads for all funds
- **WHEN** user navigates to `/events/EVT-001/derivatives/forwards?valuationDt=2026-02-10`
- **THEN** the system SHALL display forward reconciliation across all funds

### Requirement: Forwards grid columns
The Forwards grid SHALL display one row per forward contract. Columns SHALL include: Valuation Date (Date), Match Status (Enum), BNY Account (String), Incumbent Account (String), Buy Currency (String), Sell Currency (String), Asset Type (Enum: "Forward"), Trade Date (Date), Settlement Date (Date), Buy Amount (Decimal), Sell Amount (Decimal), BNY Unrealised Gain/Loss (Decimal), Incumbent Unrealised Gain/Loss (Decimal), Unrealised G/L Difference (Decimal), Reviewer (String), Break Team Assignment (String), Break Owner (String), Break Category (Enum), and Comment (Text).

#### Scenario: Forward contract comparison displayed
- **WHEN** a EUR/USD forward has BNY Unrealised G/L of 806,171.84 and Incumbent Unrealised G/L of 806,166.90
- **THEN** the Unrealised G/L Difference SHALL display -4.94

#### Scenario: Forward with KD commentary
- **WHEN** a forward break is categorized as "Known Difference" with comment referencing KD 2
- **THEN** the Break Category SHALL display "Known Difference" and the Comment SHALL contain "KD 2 Forward FX rate differences"

### Requirement: Futures Reconciliation route
The system SHALL render the Futures Reconciliation at route `/events/{eventId}/funds/{account}/derivatives/futures?valuationDt={date}`. The view SHALL also be accessible as a standalone reconciliation for all funds.

#### Scenario: Futures loads for specific fund
- **WHEN** user navigates to `/events/EVT-001/funds/AC0001/derivatives/futures?valuationDt=2026-02-10`
- **THEN** the system SHALL display futures reconciliation for fund AC0001

### Requirement: Futures grid columns
The Futures grid SHALL display one row per futures contract. Columns SHALL include: Valuation Date (Date), Match Status (Enum), BNY Account (String), Incumbent Account (String), Primary Asset ID (String), Security Name (String), Asset Type (Enum: "Future"), BNY Trading Currency (String), Incumbent Trading Currency (String), BNY Contract Size (Decimal), Incumbent Contract Size (Decimal), BNY Maturity Date (Date), Incumbent Maturity Date (Date), BNY Contracts (Decimal), Incumbent Contracts (Decimal), Contracts Difference (Decimal), BNY Price (Decimal), Incumbent Price (Decimal), Price Difference (Decimal), % Price Difference (Percent), BNY Base Cost (Decimal), Incumbent Base Cost (Decimal), Base Cost Difference (Decimal), BNY Base Market Value (Decimal), Incumbent Base Market Value (Decimal), Market Value Difference (Decimal), Reviewer (String), Break Team Assignment (String), Break Owner (String), Break Category (Enum), and Comment (Text).

#### Scenario: Futures contract comparison displayed
- **WHEN** a futures contract FUT INDEX has BNY Price 4,500.00 and Incumbent Price 4,498.50
- **THEN** Price Difference SHALL display 1.50 and % Price Difference SHALL display 0.03%

#### Scenario: Futures contract size mismatch
- **WHEN** BNY Contract Size is 50 and Incumbent Contract Size is 100 for the same future
- **THEN** the Contract Size columns SHALL highlight the mismatch for investigation

### Requirement: Derivatives break resolution tracking
Both Forwards and Futures grids SHALL include editable Break Team Assignment, Break Owner, Break Category, and Comment fields. Changes SHALL be persisted and audit-logged.

#### Scenario: Forward break assigned to FA Conversions
- **WHEN** a reviewer assigns a forward break to team "FA Conversions" with owner "Conv User 1"
- **THEN** the system SHALL save the assignment and create an audit record

### Requirement: Derivatives reconciliation performance
The Derivatives reconciliation views SHALL load within 1 second with up to 500 forward contracts or 200 futures contracts.

#### Scenario: Forwards grid loads within performance target
- **WHEN** the fund has 500 forward contracts
- **THEN** the grid SHALL complete rendering within 1 second
