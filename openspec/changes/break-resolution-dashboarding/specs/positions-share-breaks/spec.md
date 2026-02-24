## ADDED Requirements

### Requirement: Share Breaks route
The system SHALL render the Share Breaks view at route `/events/{eventId}/funds/{account}/positions/share-breaks?valuationDt={date}`. The view SHALL also be accessible as a standalone reconciliation for all funds at `/events/{eventId}/positions/share-breaks?valuationDt={date}`.

#### Scenario: Share Breaks loads for specific fund
- **WHEN** user navigates to `/events/EVT-001/funds/AC0001/positions/share-breaks?valuationDt=2026-02-10`
- **THEN** the system SHALL display positions with share mismatches for fund AC0001

#### Scenario: Share Breaks loads for all funds
- **WHEN** user navigates to `/events/EVT-001/positions/share-breaks?valuationDt=2026-02-10`
- **THEN** the system SHALL display positions with share mismatches across all funds in the event

### Requirement: Share Breaks filtering criteria
The Share Breaks view SHALL display only positions where there is a share break (BNY Shares != Incumbent Shares beyond tolerance). The view SHALL be accessible as a drilldown from the Positions Full Portfolio reconciliation.

#### Scenario: Only share mismatches shown
- **WHEN** the fund has 100 positions, 5 of which have share differences
- **THEN** the grid SHALL display only the 5 positions with share breaks

### Requirement: Share Breaks match status column
The Share Breaks grid SHALL include a Match Status column indicating: "Match" (values reconcile), "BNY Only" (position exists only in BNY), "Incumbent Only" (position exists only in Incumbent), or "Matched with Differences" (position exists in both but shares differ).

#### Scenario: BNY Only position detected
- **WHEN** a position exists in BNY with 10,000 shares but has no corresponding Incumbent record
- **THEN** the Match Status SHALL display "BNY Only"

#### Scenario: Matched with Differences
- **WHEN** BNY shows 10,000 shares and Incumbent shows 9,500 shares for the same security
- **THEN** the Match Status SHALL display "Matched with Differences" and Shares Difference SHALL show 500

### Requirement: Share Breaks auto-assignment to BNY Trade Capture
All share breaks SHALL automatically have the Break Team Assignment set to "BNY Trade Capture" and a notification SHALL be sent to the BNY Trade Capture team to review and add details on all share breaks.

#### Scenario: Auto-assignment on share break detection
- **WHEN** a share break is detected for position TEST001
- **THEN** the Break Team Assignment SHALL be auto-populated as "BNY Trade Capture", the Break Owner SHALL be assigned via round-robin from Trade Capture team members, and a notification SHALL be dispatched

### Requirement: Share Breaks grid columns
The Share Breaks grid SHALL include all columns from the Full Portfolio Reconciliation (Valuation Date, BNY/Incumbent Account, Primary Asset ID, Security Name, Asset Type, Trading Currency, BNY Shares, Incumbent Shares, Shares Difference, BNY Price, Incumbent Price, BNY Market Value, Incumbent Market Value, Market Value Difference) plus: Match Status (Enum), Break Team Assignment (String), Break Owner (String), Break Category (Enum), and Comment (Text).

#### Scenario: Grid displays share break with resolution columns
- **WHEN** the Share Breaks view loads with 5 share mismatches
- **THEN** each row SHALL show the position comparison data plus the match status, auto-assigned team ("BNY Trade Capture"), owner, break category, and comment fields
