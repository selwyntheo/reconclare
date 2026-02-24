## ADDED Requirements

### Requirement: NAV Client Scorecard route
The system SHALL render the NAV Client Scorecard at route `/events/{eventId}/nav-dashboard/scorecard?valuationDt={date}`. The breadcrumb SHALL display "Events > {Event Name} > Client Scorecard".

#### Scenario: Client Scorecard loads
- **WHEN** user navigates to `/events/EVT-001/nav-dashboard/scorecard?valuationDt=2026-02-10`
- **THEN** the system SHALL load the scorecard for event EVT-001 on date 2026-02-10

### Requirement: Client Scorecard grid columns
The system SHALL display an AG-Grid with the following columns: Valuation Date (Date), BNY Account (String), Incumbent Account (String), Account Name (String), Account Base Currency (String), BNY Units (Decimal), Incumbent Units (Decimal), Units Difference (Decimal), BNY Net Assets (Decimal), Incumbent Net Assets (Decimal), Net Assets Difference (Decimal), Basis Points Difference (Decimal), RAG (Enum — raw unadjusted), dynamically-generated KD columns (one per active Known Difference), Incumbent to Resolve (Decimal), Adjusted Net Assets Difference (Decimal), Adjusted Basis Points Difference (Decimal), Adjusted RAG (Enum — client-reportable status), Under Investigation (Decimal), BNY to Resolve (Decimal), Other Differences (Decimal), Unexplained Differences (Decimal), Check (Checkbox — reviewer sign-off), Reviewer (String — from roster), Review Status (Enum: Not Started / In Progress / Complete), and Comment (Text).

#### Scenario: Scorecard displays fund data with KD columns
- **WHEN** event EVT-001 has 5 active KDs and 10 funds
- **THEN** the grid SHALL display 10 rows with static columns plus 5 dynamically-generated KD columns

### Requirement: Adjusted RAG calculation
The Adjusted Net Assets Difference SHALL be computed as: Net Assets Difference - KD 1 amount - KD 2 amount - ... - KD N amount - Incumbent to Resolve. The Adjusted Basis Points Difference SHALL be: Adjusted Net Assets Difference / Incumbent Net Assets * 10,000. The Adjusted RAG SHALL apply the same RAG thresholds to the adjusted basis points.

#### Scenario: Adjusted difference computed correctly
- **WHEN** Net Assets Difference is 1,234,567.89, KD 1 is 1,449.32, KD 2 is -4.94, KD 3 is 34,650.00, KD 4 is -8,600.00, KD 5 is -200.00, and Incumbent to Resolve is -12,154.70
- **THEN** Adjusted Net Assets Difference SHALL be 1,219,427.21

#### Scenario: Adjusted RAG turns green
- **WHEN** the Adjusted Basis Points Difference is 3.50 and the green threshold is |BP| <= 5.00
- **THEN** the Adjusted RAG SHALL display as Green (#E2F0D9)

### Requirement: Manual KD override capability
Users SHALL be able to manually override the system-computed KD column values in the scorecard. Overridden values SHALL be visually distinct (e.g., bold or highlighted). The system SHALL preserve both the computed value and the override value. All overrides SHALL be audit-logged.

#### Scenario: Override KD column value
- **WHEN** a reviewer overrides the KD 1 column for fund AC0001 from 1,449.32 to 1,500.00
- **THEN** the cell SHALL display 1,500.00 with a visual override indicator, the adjusted calculation SHALL use 1,500.00, and an audit record SHALL be created with the original and override values

#### Scenario: Revert KD override
- **WHEN** a reviewer reverts an overridden KD value
- **THEN** the cell SHALL return to the system-computed value and the override indicator SHALL be removed

### Requirement: Reviewer sign-off checkbox
The Check column SHALL provide a checkbox for reviewer sign-off. Checking the box SHALL transition the Review Status to "Complete" for that fund/date combination. Only users with the `canApproveSignOff` permission SHALL be able to check this box.

#### Scenario: Reviewer signs off
- **WHEN** a reviewer with sign-off permission checks the sign-off box for AC0001
- **THEN** the Review Status SHALL transition to "Complete" and an audit record SHALL be created

#### Scenario: Unauthorized sign-off attempt
- **WHEN** a user without sign-off permission attempts to check the box
- **THEN** the checkbox SHALL be disabled and a tooltip SHALL explain the permission requirement

### Requirement: Commentary flow from lower levels
The Comment field SHALL display a summary of commentary rolled up from lower-level reconciliations (Trial Balance, Positions, Income). The summary SHALL aggregate break category amounts and key commentary text from child entities.

#### Scenario: Rolled-up commentary displayed
- **WHEN** fund AC0001 has position-level commentary for 3 breaks totaling 1,800,000 in BNY to Resolve
- **THEN** the scorecard Comment field SHALL display a summary including "BNY to Resolve: 1,800,000" with key break descriptions

### Requirement: Client Scorecard performance
The Client Scorecard SHALL render within 800ms with 50 funds and 5+ dynamically-generated KD columns including adjusted calculations.

#### Scenario: Scorecard renders within performance target
- **WHEN** the event has 50 funds and 7 active KD columns
- **THEN** the scorecard SHALL complete rendering within 800ms

### Requirement: Client Scorecard export
The Client Scorecard SHALL support export to Excel (.xlsx) maintaining all conditional formatting and KD column values. The export SHALL include a metadata header with event name, valuation date, export timestamp, and exported-by user.

#### Scenario: Export scorecard to Excel
- **WHEN** user clicks Export to Excel on the scorecard
- **THEN** the system SHALL download an .xlsx file with all columns, RAG coloring, KD values, and a metadata header row
