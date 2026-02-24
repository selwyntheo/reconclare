## ADDED Requirements

### Requirement: Position grid break resolution columns
The Position Compare grid SHALL include additional columns for break resolution tracking: Break Team Assignment (String — editable dropdown of configured teams), Break Owner (String — editable dropdown filtered by selected team), Break Category (Enum — editable dropdown with 5 categories), and Comment (Text — free-text explanation of the break and resolution actions).

#### Scenario: Break resolution columns displayed in position grid
- **WHEN** the Position Drill-Down loads for category "Investment Urgl"
- **THEN** each position row SHALL display editable Break Team Assignment, Break Owner, Break Category, and Comment columns alongside the existing comparison columns

#### Scenario: Reviewer updates break category for position
- **WHEN** a reviewer sets the Break Category for security BOND001 to "Known Difference" and adds comment "KD 4 Bond Pricing matrix differences"
- **THEN** the system SHALL save the categorization, display it in the grid, and create an audit record

#### Scenario: Break team selection filters owner dropdown
- **WHEN** a reviewer selects "BNY Pricing" in the Break Team dropdown for security TEST001
- **THEN** the Break Owner dropdown SHALL filter to show only BNY Pricing team members

### Requirement: Position grid auto-assignment integration
The Position Compare grid SHALL integrate with the auto-assignment engine. When break detection identifies share or price breaks, the Break Team and Break Owner columns SHALL be pre-populated based on auto-assignment rules.

#### Scenario: Auto-assigned break displayed in grid
- **WHEN** the auto-assignment engine has assigned a share break for TEST001 to "BNY Trade Capture" / "TC User 1"
- **THEN** the Break Team SHALL display "BNY Trade Capture" and Break Owner SHALL display "TC User 1" in the grid

#### Scenario: Reviewer overrides auto-assignment
- **WHEN** a reviewer changes the auto-assigned Break Team from "BNY Trade Capture" to "FA Conversions"
- **THEN** the system SHALL update the assignment, create an audit record, and dispatch a notification to the FA Conversions team

### Requirement: Full Portfolio reconciliation view
The Position Drill-Down SHALL support a "Full Portfolio" view mode accessible at `/events/{eventId}/funds/{account}/positions?valuationDt={date}` without a category filter. This view SHALL display all positions for a fund regardless of GL category, with all comparison columns visible. The Full Portfolio view SHALL include: Primary Asset ID, Security Name, Asset Type, BNY/Incumbent Trading Currency, BNY/Incumbent Shares, Shares Difference, BNY/Incumbent Price, Price Difference, % Price Difference, BNY/Incumbent Base Cost, Base Cost Difference, BNY/Incumbent Market Value, Base Market Value Difference, BNY/Incumbent Unrealised G/L, Unrealised G/L Difference, BNY/Incumbent Local Cost, Local Cost Difference, BNY/Incumbent Local Market Value, Local Market Value Difference, plus the break resolution columns (Break Team, Break Owner, Break Category, Comment).

#### Scenario: Full Portfolio displays all positions
- **WHEN** user navigates to `/events/EVT-001/funds/AC0001/positions?valuationDt=2026-02-10` without a category parameter
- **THEN** the grid SHALL display all positions for AC0001 with the full set of comparison columns

#### Scenario: Full Portfolio provides drilldown to filtered views
- **WHEN** user clicks a "Share Breaks" filter link in the Full Portfolio view
- **THEN** the system SHALL navigate to `/events/{eventId}/funds/{account}/positions/share-breaks?valuationDt={date}`

### Requirement: Position commentary with KD reference
Position-level comments SHALL support referencing Known Difference entries. When a reviewer applies a KD standard commentary, the knownDifferenceRef field SHALL be set, linking the comment to the KD entry for rollup purposes.

#### Scenario: Position comment with KD reference
- **WHEN** a reviewer applies KD 4 standard commentary to security BOND001
- **THEN** the commentary record SHALL have knownDifferenceRef="KD 4" and the comment text SHALL be pre-populated with "KD 4 Bond Pricing matrix differences"

### Requirement: Position grid WebSocket updates
When a break category, team assignment, or comment is changed by any user, the system SHALL broadcast the change via WebSocket. Other users viewing the same position grid SHALL see the update within 200ms.

#### Scenario: Real-time break update across users
- **WHEN** user A changes the Break Category for TEST001 to "BNY to Resolve"
- **THEN** user B viewing the same position grid SHALL see the Break Category update for TEST001 within 200ms
