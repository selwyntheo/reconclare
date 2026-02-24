## ADDED Requirements

### Requirement: NAV Dashboard reviewer column
The NAV Compare grid SHALL include an additional Reviewer column displaying the assigned reviewer name from the Reviewer Allocation roster for the selected valuation date and fund. The column SHALL be read-only and populated from the `reviewerAllocations` collection.

#### Scenario: Reviewer column populated from roster
- **WHEN** NAV Dashboard loads for event EVT-001 on date 2026-02-10 and fund AC0001 has reviewer "Jane Doe" assigned
- **THEN** the Reviewer column for the AC0001 row SHALL display "Jane Doe"

#### Scenario: Reviewer column shows empty when unassigned
- **WHEN** fund AC0002 has no reviewer allocation for date 2026-02-10
- **THEN** the Reviewer column for AC0002 SHALL display empty/unassigned indicator

### Requirement: NAV Dashboard review status indicator
The NAV Compare grid SHALL include a Review Status column showing the current review status (Not Started / In Progress / Complete) with color-coded badges: gray for Not Started, amber for In Progress, green for Complete.

#### Scenario: Review status displays correctly
- **WHEN** fund AC0001 has Review Status "In Progress" for date 2026-02-10
- **THEN** the Review Status column SHALL display an amber badge with "In Progress"

### Requirement: NAV Dashboard break category filter
The NAV Dashboard SHALL provide filtering capability to show only funds with specific break categories at the position level. A filter control SHALL allow selecting one or more break categories (Known Difference, BNY to Resolve, Incumbent to Resolve, Under Investigation) to narrow the fund list.

#### Scenario: Filter by BNY to Resolve breaks
- **WHEN** user selects "BNY to Resolve" in the break category filter
- **THEN** the grid SHALL display only funds that have at least one position-level break categorized as "BNY to Resolve"

#### Scenario: Clear filter shows all funds
- **WHEN** user clears the break category filter
- **THEN** the grid SHALL display all funds regardless of break categories

### Requirement: NAV Dashboard navigation to sub-views
The NAV Dashboard SHALL provide navigation links to the Share Class Dashboard, Client Scorecard, and RAG Status Tracker. These SHALL be accessible via tabs or navigation links above the grid.

#### Scenario: Navigate to Client Scorecard
- **WHEN** user clicks the "Client Scorecard" tab on the NAV Dashboard
- **THEN** the system SHALL navigate to `/events/{eventId}/nav-dashboard/scorecard?valuationDt={date}`

#### Scenario: Navigate to RAG Tracker
- **WHEN** user clicks the "RAG Status" tab on the NAV Dashboard
- **THEN** the system SHALL navigate to `/events/{eventId}/nav-dashboard/rag-tracker`

#### Scenario: Navigate to Share Class for a fund
- **WHEN** user clicks the share class action link on fund AC0001
- **THEN** the system SHALL navigate to `/events/{eventId}/nav-dashboard/share-class/AC0001?valuationDt={date}`

## MODIFIED Requirements

### Requirement: NAV Compare grid
The system SHALL display an AG-Grid data grid showing the NAV Compare (TF) validation. The grid SHALL compare aggregate-of-all-classes Incumbent TNA vs BNY TNA for each fund. Columns SHALL include: Valuation Dt (YYYY-MM-DD), Account (portfolio ID), Account Name (from refFund), Incumbent TNA (decimal, #,##0.00), BNY TNA (decimal, #,##0.00), TNA Difference (Incumbent - BNY, red for negative), TNA Difference BP (basis points of Incumbent TNA), Validation (traffic light icon: green=pass, amber=marginal, red=break), Reviewer (String — assigned reviewer from roster), and Review Status (Enum badge: Not Started gray / In Progress amber / Complete green). Default sort SHALL be validation status (breaks first) then absolute TNA Difference descending.

#### Scenario: Grid displays NAV comparison data
- **WHEN** NAV Dashboard loads for event EVT-001 on date 2026-02-10
- **THEN** the grid SHALL display one row per fund with Incumbent TNA from dataNav (userBank=incumbent), BNY TNA from dataNav (userBank=BNY), joined on valuationDt+account and aggregated across all classes

#### Scenario: Grid sorts breaks first
- **WHEN** the grid loads with 3 funds having breaks and 12 funds passing
- **THEN** the 3 break rows SHALL appear at the top, sorted by absolute TNA Difference descending, followed by passing rows

#### Scenario: Single-click selects row and updates AI panel
- **WHEN** user single-clicks a fund row for account AC0002
- **THEN** the row SHALL be visually selected and the AI Commentary panel SHALL update to show analysis for AC0002

#### Scenario: Double-click drills into Trial Balance
- **WHEN** user double-clicks a fund row for account AC0002
- **THEN** the system SHALL navigate to `/events/{eventId}/funds/AC0002/trial-balance?valuationDt={date}`

#### Scenario: Reviewer and Review Status columns displayed
- **WHEN** NAV Dashboard loads with reviewer allocations configured
- **THEN** each fund row SHALL show the Reviewer name and Review Status badge from the roster and break resolution data
