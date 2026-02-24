## ADDED Requirements

### Requirement: NAV Share Class Dashboard route
The system SHALL render the NAV Share Class Dashboard at route `/events/{eventId}/nav-dashboard/share-class/{account}?valuationDt={date}`. The breadcrumb SHALL display "Events > {Event Name} > NAV Dashboard > {Account Name} Share Classes".

#### Scenario: Share Class Dashboard loads with fund context
- **WHEN** user navigates to `/events/EVT-001/nav-dashboard/share-class/AC0001?valuationDt=2026-02-10`
- **THEN** the system SHALL load share class data for fund AC0001 on date 2026-02-10

### Requirement: Share Class comparison grid
The system SHALL display an AG-Grid showing share class level NAV decomposition. Columns SHALL include: Valuation Date (Date), BNY Account (String), Incumbent Account (String), Account Name (String), Account Base Currency (String), BNY Share Class (String, e.g., 1A, 2B), Incumbent Share Class (String), Share Class Name (String), Share Class Currency (String), BNY Units (Decimal), Incumbent Units (Decimal), Units Difference (Decimal), BNY Net Assets Base Currency (Decimal), Incumbent Net Assets Base Currency (Decimal), Net Assets Difference Base Currency (Decimal), BNY NAV Per Share Base (Decimal, computed: BNY Net Assets / BNY Units), Incumbent NAV Per Share Base (Decimal), Difference NAV Per Share Base (Decimal), BNY Net Assets Local Currency (Decimal), Incumbent Net Assets Local (Decimal), Net Assets Diff Local (Decimal), BNY NAV Per Share Local (Decimal), Incumbent NAV Per Share Local (Decimal), Diff NAV Per Share Local (Decimal), BNY Share Class % (Decimal), BNY Share Movement (Decimal, day-over-day unit change), and Validation (String).

#### Scenario: Grid displays share class data for a fund
- **WHEN** Share Class Dashboard loads for fund AC0001 with 3 share classes (1A, 2B, 3C)
- **THEN** the grid SHALL display 3 rows, one per share class, with BNY vs Incumbent comparison across all columns

#### Scenario: NAV Per Share computed correctly
- **WHEN** BNY Net Assets Base is 10,000,000 and BNY Units is 1,000,000
- **THEN** BNY NAV Per Share Base SHALL display 10.00

### Requirement: Prior Day NAV data section
The Share Class Dashboard SHALL include a subordinate Prior Day NAV Data section showing: Valuation Date, BNY Account, Incumbent Account, Account Name, Account Base Currency, BNY Share Class, Incumbent Share Class, Share Class Name, Share Class Currency, and BNY NAV Per Share (Base Currency) for the prior valuation date. This data is required to compute share class NAV movement between days.

#### Scenario: Prior day data displayed
- **WHEN** the selected valuation date is 2026-02-10
- **THEN** the Prior Day section SHALL display NAV Per Share data from 2026-02-09

#### Scenario: Share movement computed from prior day
- **WHEN** BNY Units on 2026-02-10 is 1,050,000 and BNY Units on 2026-02-09 is 1,000,000
- **THEN** BNY Share Movement SHALL display 50,000

### Requirement: Share Class Dashboard performance
The Share Class Dashboard SHALL load within 1 second with up to 200 share classes across 50 funds.

#### Scenario: Dashboard loads within performance target
- **WHEN** the event has 200 share classes
- **THEN** the grid SHALL complete rendering within 1 second

### Requirement: Share Class Dashboard navigation
The system SHALL allow navigating to the Share Class Dashboard from the NAV Fund Level Dashboard by clicking a fund row's share class action link.

#### Scenario: Navigate from Fund Level to Share Class
- **WHEN** user clicks the share class link on fund AC0001 in the NAV Dashboard
- **THEN** the system SHALL navigate to `/events/{eventId}/nav-dashboard/share-class/AC0001?valuationDt={date}`
