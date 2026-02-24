## ADDED Requirements

### Requirement: Break category taxonomy
The system SHALL enforce a fixed set of break categories: "Known Difference" (known methodology or system difference agreed with client), "BNY to Resolve" (BNY processing/data issue), "Incumbent to Resolve" (incumbent processing/data issue), "Under Investigation" (root cause not yet determined), and "Match" (no variance, auto-assigned when values reconcile within tolerance).

#### Scenario: Break category applied to position
- **WHEN** a reviewer sets the break category for a position to "BNY to Resolve"
- **THEN** the system SHALL store the category and the position SHALL display with the "BNY to Resolve" label

#### Scenario: Match category auto-assigned
- **WHEN** a position has BNY and Incumbent values that reconcile within the configured tolerance
- **THEN** the system SHALL automatically assign the "Match" break category without reviewer intervention

#### Scenario: Under Investigation transitions to resolution
- **WHEN** a reviewer changes a break from "Under Investigation" to "Known Difference"
- **THEN** the system SHALL update the category and create an audit log entry recording the transition

### Requirement: Review status workflow
Each fund reconciliation for each valuation date SHALL carry a Review Status with three states: "Not Started" (gray — no reviewer has begun analysis, default state), "In Progress" (amber — reviewer is actively investigating), and "Complete" (green — all breaks categorized, commentary added, reviewer signed off). Status SHALL transition sequentially: Not Started → In Progress → Complete.

#### Scenario: Review status defaults to Not Started
- **WHEN** a new valuation date is created for a fund
- **THEN** the review status SHALL default to "Not Started" with a gray indicator

#### Scenario: Review status transitions to In Progress
- **WHEN** a reviewer opens the reconciliation for fund AC0001 on date 2026-02-10 and begins adding commentary
- **THEN** the review status SHALL transition to "In Progress" with an amber indicator

#### Scenario: Review status transitions to Complete
- **WHEN** a reviewer has categorized all breaks and clicks the sign-off control for fund AC0001 on 2026-02-10
- **THEN** the review status SHALL transition to "Complete" with a green indicator

### Requirement: Break team assignment configuration
The system SHALL maintain a configurable set of break team assignments: "FA Conversions" (default owner: Conv User 1), "BNY Trade Capture" (default owner: TC User 1), "BNY Pricing" (default owner: Pricing User 1), "BNY Corporate Actions" (default owner: CA User 1), "BNY NAV Ops" (default owner: NAV User 1), "Incumbent" (no default owner), and "Match" (no assignment needed). Each break team SHALL have a default owner and a list of team members for round-robin assignment.

#### Scenario: Break assigned to team with default owner
- **WHEN** a break is assigned to team "BNY Pricing"
- **THEN** the system SHALL set the break team to "BNY Pricing" and the default owner to "Pricing User 1"

#### Scenario: Break team reassigned
- **WHEN** a reviewer changes a break's team from "BNY Pricing" to "FA Conversions"
- **THEN** the system SHALL update the team, set the default owner to "Conv User 1", and create an audit log entry

### Requirement: Break category selector component
The system SHALL provide a reusable break category selector dropdown component that displays the 5 break categories with color-coded labels. The component SHALL be used across all reconciliation grid views (positions, income, derivatives, trial balance).

#### Scenario: Break category selector in position grid
- **WHEN** a reviewer clicks the break category cell for a position
- **THEN** a dropdown SHALL appear with 5 options (Known Difference, BNY to Resolve, Incumbent to Resolve, Under Investigation, Match) each with a distinct color indicator

### Requirement: Break team assignment dropdown component
The system SHALL provide a reusable break team assignment dropdown that displays configured teams and their members. When a team is selected, the owner dropdown SHALL filter to show only members of the selected team.

#### Scenario: Team selection filters owner dropdown
- **WHEN** a reviewer selects "BNY Pricing" in the team dropdown
- **THEN** the owner dropdown SHALL display only members of the BNY Pricing team
