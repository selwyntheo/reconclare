## ADDED Requirements

### Requirement: Reviewer Allocation data model
The system SHALL store reviewer allocation records in the `reviewerAllocations` MongoDB collection. Each record SHALL contain: allocationId (UUID), eventId (String), bnyAccount (String), incumbentAccount (String), accountName (String), valuationDate (Date), assignedReviewerId (String), assignedReviewerName (String), createdBy (String), and updatedAt (DateTime). The compound index on (eventId, valuationDate) SHALL ensure efficient date-range queries.

#### Scenario: Allocation record created
- **WHEN** a manager assigns reviewer "Jane Doe" to fund AC0001 for date 2026-02-10 in event EVT-001
- **THEN** the system SHALL create a record with eventId="EVT-001", bnyAccount="AC0001", valuationDate="2026-02-10", assignedReviewerId="u-fa", assignedReviewerName="Jane Doe", createdBy with the current user's ID, and updatedAt with the current timestamp

#### Scenario: Allocation record uniqueness
- **WHEN** an allocation already exists for eventId="EVT-001", bnyAccount="AC0001", valuationDate="2026-02-10"
- **THEN** the system SHALL update the existing record rather than creating a duplicate

### Requirement: Reviewer Allocation matrix grid
The system SHALL render the Reviewer Allocation screen at route `/events/{eventId}/allocations` as a matrix-style grid. Rows SHALL represent fund accounts (keyed by BNY Account + Incumbent Account + Account Name). Columns SHALL span the parallel period dates. Each cell SHALL display the assigned reviewer username. The grid SHALL use AG-Grid with editable cells.

#### Scenario: Matrix grid displays allocation data
- **WHEN** user navigates to `/events/EVT-001/allocations`
- **THEN** the system SHALL display a matrix with one row per fund account and one column per parallel period date, each cell showing the assigned reviewer name

#### Scenario: Matrix grid covers full parallel period
- **WHEN** the event has parallel period dates from 2026-02-09 through 2026-02-20
- **THEN** the grid SHALL display 12 date columns (one per day) plus the fund identification columns

### Requirement: Inline cell editing for reviewer assignment
Clicking any cell in the allocation matrix SHALL open a dropdown of available reviewers filtered by team and availability. Changes SHALL be saved immediately with optimistic UI updates. All changes SHALL be audit-logged.

#### Scenario: Edit cell assigns reviewer
- **WHEN** user clicks a cell for fund AC0001 on date 2026-02-10 and selects "John Smith" from the dropdown
- **THEN** the cell SHALL immediately display "John Smith", the backend SHALL persist the allocation, and an audit record SHALL be created with the previous reviewer, new reviewer, changed-by user, and timestamp

#### Scenario: Reviewer dropdown shows available reviewers
- **WHEN** user clicks a cell to edit
- **THEN** the dropdown SHALL display all reviewers, with unavailable reviewers (on leave) visually dimmed

### Requirement: Bulk assignment operations
The system SHALL support bulk assignment of reviewers. Selecting a row header SHALL allow assigning a reviewer to all dates for that fund. Selecting a column header SHALL allow assigning a reviewer to all funds for that date.

#### Scenario: Bulk assign reviewer to all dates for a fund
- **WHEN** user selects the row header for fund AC0001 and chooses reviewer "Jane Doe"
- **THEN** all date cells for AC0001 SHALL be updated to "Jane Doe" and individual audit records SHALL be created for each changed cell

#### Scenario: Bulk assign reviewer to all funds for a date
- **WHEN** user selects the column header for date 2026-02-10 and chooses reviewer "John Smith"
- **THEN** all fund cells for 2026-02-10 SHALL be updated to "John Smith"

### Requirement: Copy allocations between dates
The system SHALL allow copying all allocations from one date to another via the API endpoint `POST /api/v1/events/{eventId}/allocations/copy`.

#### Scenario: Copy allocations from one date to another
- **WHEN** user copies allocations from 2026-02-10 to 2026-02-11
- **THEN** all fund-reviewer assignments from 2026-02-10 SHALL be duplicated for 2026-02-11, preserving each fund's reviewer

### Requirement: Reviewer Allocation API endpoints
The system SHALL expose the following REST endpoints: `GET /api/events/{eventId}/allocations` (retrieve all allocations, optional date range filter), `GET /api/events/{eventId}/allocations/{date}` (get allocations for a specific date), `PUT /api/events/{eventId}/allocations` (bulk update allocations), `POST /api/events/{eventId}/allocations/copy` (copy allocations between dates), `GET /api/users/reviewers` (list available reviewers with team and availability), `GET /api/events/{eventId}/allocations/audit` (retrieve allocation change history).

#### Scenario: GET allocations for an event
- **WHEN** client calls `GET /api/events/EVT-001/allocations?from=2026-02-09&to=2026-02-20`
- **THEN** the system SHALL return all allocation records for EVT-001 within the date range

#### Scenario: PUT bulk update allocations
- **WHEN** client calls `PUT /api/events/EVT-001/allocations` with an array of {allocationId, reviewerId} pairs
- **THEN** the system SHALL update each allocation and return the updated records

#### Scenario: GET available reviewers
- **WHEN** client calls `GET /api/users/reviewers`
- **THEN** the system SHALL return a list of reviewers with userId, userName, team, and availability status

### Requirement: Reviewer Allocation WebSocket updates
When a reviewer allocation changes, the system SHALL broadcast a `ALLOCATION_CHANGED` WebSocket message to all connected users viewing the same event. The message SHALL include the eventId, bnyAccount, valuationDate, and new reviewer details.

#### Scenario: Real-time allocation update
- **WHEN** user A changes the reviewer for AC0001 on 2026-02-10
- **THEN** user B viewing the same event SHALL see the cell update within 200ms without page refresh
