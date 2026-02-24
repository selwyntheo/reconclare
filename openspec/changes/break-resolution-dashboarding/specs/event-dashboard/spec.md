## ADDED Requirements

### Requirement: Event card reviewer allocation summary
Each event card SHALL display a reviewer allocation summary showing the count of funds with assigned reviewers vs total funds for the current/most recent valuation date. The format SHALL be "X of Y reviewers assigned".

#### Scenario: Event card shows reviewer allocation progress
- **WHEN** event EVT-001 has 15 funds and 12 have reviewers assigned for the most recent valuation date
- **THEN** the event card SHALL display "12 of 15 reviewers assigned"

#### Scenario: Event card shows full allocation
- **WHEN** all 15 funds have reviewers assigned
- **THEN** the event card SHALL display "15 of 15 reviewers assigned" with a green indicator

### Requirement: Event card break category distribution
The Fund Progress Bar on each event card SHALL be enhanced to show break category distribution. In addition to the existing passed/attention/failed segments, the bar SHALL include tooltips showing the count of breaks by category (Known Difference, BNY to Resolve, Incumbent to Resolve, Under Investigation) when the user hovers.

#### Scenario: Break category tooltip on progress bar
- **WHEN** user hovers over the Fund Progress Bar for event EVT-001
- **THEN** a tooltip SHALL display: "Known Difference: 12, BNY to Resolve: 5, Incumbent to Resolve: 2, Under Investigation: 3"

### Requirement: Event card review status summary
Each event card SHALL display a review completion indicator showing the percentage of fund/date combinations with Review Status "Complete" for the most recent valuation date.

#### Scenario: Review completion displayed
- **WHEN** 10 of 15 funds have Review Status "Complete" for the latest valuation date
- **THEN** the event card SHALL display "67% reviewed" with a progress indicator

### Requirement: Activity feed break resolution events
The Activity Feed SHALL include break resolution events: reviewer allocation changes, break category assignments, review status transitions (Complete sign-offs), and auto-assignment notifications. Each activity item SHALL include the user who made the change and a link to the relevant reconciliation view.

#### Scenario: Activity feed shows break categorization
- **WHEN** a reviewer categorizes a break as "Known Difference" for security TEST001 in fund AC0001
- **THEN** the Activity Feed SHALL display "Jane Doe categorized TEST001 break as Known Difference in AC0001" with a link to the position view

#### Scenario: Activity feed shows review completion
- **WHEN** a reviewer signs off fund AC0001 on date 2026-02-10
- **THEN** the Activity Feed SHALL display "Jane Doe completed review for AC0001 (2026-02-10)" with a link to the scorecard

### Requirement: Event Dashboard navigation to Reviewer Allocation
Each event card SHALL include a "Roster" action button or link that navigates to the Reviewer Allocation screen for that event.

#### Scenario: Navigate to Reviewer Allocation
- **WHEN** user clicks the "Roster" link on event EVT-001
- **THEN** the system SHALL navigate to `/events/EVT-001/allocations`
