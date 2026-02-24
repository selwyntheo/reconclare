## ADDED Requirements

### Requirement: NAV RAG Status Tracker route
The system SHALL render the NAV RAG Status Tracker at route `/events/{eventId}/nav-dashboard/rag-tracker`. The breadcrumb SHALL display "Events > {Event Name} > RAG Status Tracker".

#### Scenario: RAG tracker loads
- **WHEN** user navigates to `/events/EVT-001/nav-dashboard/rag-tracker`
- **THEN** the system SHALL load the day-over-day RAG matrix for all funds in event EVT-001

### Requirement: RAG Status Tracker matrix grid
The system SHALL display a matrix grid where rows represent funds and columns represent consecutive parallel period dates. Each cell SHALL show the adjusted basis point difference. Columns SHALL include: PSP Fund ID (Integer), Eagle Fund ID (String), Fund Name (String), Category (String), Base Currency (String), date columns (one per parallel period date, showing adjusted BP difference), and Comment (Text — running commentary on trend).

#### Scenario: Matrix displays fund-by-date BP data
- **WHEN** event EVT-001 has 10 funds across a 12-day parallel period
- **THEN** the grid SHALL display 10 rows and 12 date columns plus identification and comment columns

### Requirement: RAG conditional cell formatting
Each date cell SHALL be conditionally formatted with background colors matching the RAG thresholds: Green (#E2F0D9) when |BP| <= 5.00, Amber (#FFF2CC) when 5.00 < |BP| <= 50.00, Red (#FCE4EC) when |BP| > 50.00. The RAG thresholds SHALL be configurable per event.

#### Scenario: Green cell for within-tolerance fund
- **WHEN** fund AC0001 on 2026-02-10 has adjusted BP of 2.50
- **THEN** the cell SHALL display "2.50" with green (#E2F0D9) background

#### Scenario: Red cell for break fund
- **WHEN** fund AC0002 on 2026-02-10 has adjusted BP of 75.00
- **THEN** the cell SHALL display "75.00" with red (#FCE4EC) background

#### Scenario: Configurable thresholds applied
- **WHEN** event EVT-001 has custom thresholds: green <= 3.00, amber <= 30.00
- **THEN** a fund with 4.50 BP SHALL display as amber (not green)

### Requirement: RAG Status Tracker auto-refresh
The RAG Status Tracker SHALL auto-refresh when adjusted differences are recalculated. When a KD override or break categorization changes the adjusted BP for any fund/date, the tracker SHALL update via WebSocket push.

#### Scenario: Real-time update on KD override
- **WHEN** user A overrides a KD value in the Client Scorecard affecting fund AC0001 on 2026-02-10
- **THEN** user B viewing the RAG Tracker SHALL see the cell for AC0001/2026-02-10 update within 200ms

### Requirement: RAG Status Tracker visual indicators
The tracker MAY display trend lines or sparklines alongside fund rows for quick pattern recognition of conversion readiness over time.

#### Scenario: Sparkline shows improvement trend
- **WHEN** fund AC0001 shows BP values decreasing from 45.00 to 3.50 over 5 days
- **THEN** a trend sparkline (if displayed) SHALL show a downward trajectory indicating improvement

### Requirement: RAG Status Tracker navigation
The system SHALL allow navigating to the RAG Status Tracker from the NAV Dashboard via a tab or link. Clicking a cell in the tracker SHALL navigate to the Client Scorecard filtered to that fund and date.

#### Scenario: Cell click navigates to scorecard
- **WHEN** user clicks the cell for fund AC0001 on date 2026-02-10
- **THEN** the system SHALL navigate to `/events/{eventId}/nav-dashboard/scorecard?valuationDt=2026-02-10&fund=AC0001`
