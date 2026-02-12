## ADDED Requirements

### Requirement: Event cards grid display
The system SHALL render the Event Dashboard at route `/events` as the landing page. Each conversion event SHALL be displayed as a card in a responsive grid layout. Each card SHALL show: Event Name + ID (e.g., "EVT-2026-001: Vanguard Fixed Income Migration"), Status Badge (DRAFT=gray, ACTIVE=blue, PARALLEL=amber, SIGNED_OFF=green, COMPLETE=teal), Fund Progress Bar (horizontal bar with passed=green / attention=amber / failed=red segments and label "X of Y funds passed"), Incumbent Provider name, Target Go-Live date with countdown in days (e.g., "Mar 15, 2026 — 31 days"), 7-Day Break Trend sparkline showing total break count over trailing 7 valuation dates, Last Validation timestamp with relative label (e.g., "Today 08:35 AM"), and Quick Action buttons [Run Validation] (primary) and [View Details] (secondary).

#### Scenario: Dashboard loads with active events
- **WHEN** user navigates to `/events`
- **THEN** the system SHALL fetch all events and render one card per event in a responsive grid, sorted by status (ACTIVE/PARALLEL first) then by target go-live date ascending

#### Scenario: Event card displays fund progress
- **WHEN** an event has 15 funds with 12 passed, 2 attention, 1 failed
- **THEN** the card's Fund Progress Bar SHALL show green (80%), amber (13%), and red (7%) segments with label "12 of 15 funds passed"

#### Scenario: Event card displays break trend sparkline
- **WHEN** an event has break count data for the trailing 7 valuation dates
- **THEN** the card SHALL render a mini line chart (sparkline) showing the break count trend across those 7 dates

#### Scenario: Event card displays go-live countdown
- **WHEN** an event has targetGoLiveDate of "2026-03-15" and today is "2026-02-12"
- **THEN** the card SHALL display "Mar 15, 2026 — 31 days"

### Requirement: Quick filters bar
The system SHALL provide a quick filters bar above the event cards grid with: Status multi-select chips (DRAFT, ACTIVE, PARALLEL, SIGNED_OFF, COMPLETE), Date Range picker filtering by target go-live window, Assigned To Me toggle showing only events where the current user is on assignedTeam, and Search field for full-text search across event name, fund names, and incumbent provider.

#### Scenario: Filter events by status
- **WHEN** user selects "ACTIVE" and "PARALLEL" status chips
- **THEN** the grid SHALL display only events with status ACTIVE or PARALLEL

#### Scenario: Filter events by assigned to me
- **WHEN** user enables the "Assigned To Me" toggle
- **THEN** the grid SHALL display only events where the current user's userId appears in the event's assignedTeam array

#### Scenario: Search events by text
- **WHEN** user types "Vanguard" in the search field
- **THEN** the grid SHALL display only events whose eventName, fund names, or incumbentProvider contain "Vanguard" (case-insensitive)

### Requirement: Activity feed panel
The system SHALL display a chronological Activity Feed in a right-hand panel. The feed SHALL show: validation run completions with pass/fail summary, AI analysis completions with confidence score, human review actions (approved, modified, escalated), and status transitions (event or fund status changes). Each feed item SHALL be clickable and navigate to the relevant screen context. The feed SHALL update in real-time via SSE.

#### Scenario: Activity feed displays recent items
- **WHEN** the Event Dashboard loads
- **THEN** the system SHALL fetch and display the most recent 20 activity items scoped to the user's accessible events, sorted by timestamp descending

#### Scenario: Activity feed item click navigates to context
- **WHEN** user clicks an activity item for a validation run completion on event EVT-001
- **THEN** the system SHALL navigate to `/events/EVT-001/nav-dashboard`

#### Scenario: Activity feed updates in real-time
- **WHEN** a new validation run completes while the user is viewing the Event Dashboard
- **THEN** the new activity item SHALL appear at the top of the feed without page refresh

### Requirement: Event card navigation to NAV Dashboard
The system SHALL navigate to the NAV Dashboard when the user interacts with an event card.

#### Scenario: Click event card navigates to NAV Dashboard
- **WHEN** user clicks an event card for event EVT-001
- **THEN** the system SHALL navigate to `/events/EVT-001/nav-dashboard`

#### Scenario: Click View Details navigates to NAV Dashboard
- **WHEN** user clicks the [View Details] button on an event card for event EVT-001
- **THEN** the system SHALL navigate to `/events/EVT-001/nav-dashboard`

### Requirement: Run Validation action from Event Dashboard
The system SHALL open a validation configuration modal when the user clicks [Run Validation] on an event card. The modal SHALL include a date picker for valuation date, check suite multi-select (all 6 checks), and fund filter. Submitting the modal SHALL trigger validation execution.

#### Scenario: Run Validation opens configuration modal
- **WHEN** user clicks [Run Validation] on an event card
- **THEN** a modal overlay SHALL appear with date picker, check suite selector (all 6 checks checked by default), and fund filter (All Funds selected by default)

#### Scenario: Validation submitted from modal
- **WHEN** user configures the modal and clicks submit
- **THEN** the system SHALL call the validation execution API and remain on the Event Dashboard while the modal closes

### Requirement: Event Dashboard performance
The Event Dashboard SHALL load within 2 seconds (Time to First Contentful Paint) including event cards with status data.

#### Scenario: Dashboard loads within performance target
- **WHEN** the system has 20 events with fund roll-up data
- **THEN** the Event Dashboard SHALL achieve First Contentful Paint in under 2 seconds
