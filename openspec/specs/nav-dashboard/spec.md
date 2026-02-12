## ADDED Requirements

### Requirement: NAV Dashboard route and breadcrumb
The system SHALL render the NAV Dashboard at route `/events/{eventId}/nav-dashboard?valuationDt={date}`. The breadcrumb SHALL display "Events > {Event Name}". The valuationDt query parameter SHALL default to the most recent available validation date if not specified.

#### Scenario: NAV Dashboard loads with event context
- **WHEN** user navigates to `/events/EVT-001/nav-dashboard`
- **THEN** the system SHALL load the NAV Dashboard for event EVT-001, display breadcrumb "Events > Vanguard Fixed Income Migration", and default the valuation date to the most recent available date

#### Scenario: NAV Dashboard loads with explicit valuation date
- **WHEN** user navigates to `/events/EVT-001/nav-dashboard?valuationDt=2026-02-10`
- **THEN** the system SHALL load NAV Compare data for the specified date 2026-02-10

### Requirement: Validation control panel
The system SHALL display a sticky Validation Control Panel at the top of the NAV Dashboard with: Valuation Date picker (defaults to most recent, calendar highlights dates with existing runs), Check Suite multi-select checkboxes (NAV to Ledger L0, Ledger BS to INCST L1, Ledger TF to Class L1, Position to Lot L2, Ledger to Subledger L2, Basis Lot Check L2 — all checked by default), Fund Filter (radio: All Funds or Selected Only with searchable fund picker), Run Validation primary button, and Schedule secondary button.

#### Scenario: Change valuation date refreshes grid
- **WHEN** user changes the valuation date from 2026-02-10 to 2026-02-09
- **THEN** the system SHALL refresh all grid data for the new date while preserving any fund selection

#### Scenario: Run Validation shows progress
- **WHEN** user clicks [Run Validation] with 15 funds selected
- **THEN** the button SHALL enter a loading state with progress bar showing "Processing fund N of 15..." and SHALL be disabled until the run completes

#### Scenario: Calendar highlights dates with validation runs
- **WHEN** user opens the valuation date picker
- **THEN** dates that have existing validation runs SHALL be highlighted with a dot indicator

### Requirement: NAV Compare grid
The system SHALL display an AG-Grid data grid showing the NAV Compare (TF) validation. The grid SHALL compare aggregate-of-all-classes Incumbent TNA vs BNY TNA for each fund. Columns SHALL include: Valuation Dt (YYYY-MM-DD), Account (portfolio ID), Account Name (from refFund), Incumbent TNA (decimal, #,##0.00), BNY TNA (decimal, #,##0.00), TNA Difference (Incumbent - BNY, red for negative), TNA Difference BP (basis points of Incumbent TNA), and Validation (traffic light icon: green=pass, amber=marginal, red=break). Default sort SHALL be validation status (breaks first) then absolute TNA Difference descending.

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

### Requirement: Expandable row cross-check validations
When a user expands a NAV Compare row via the chevron toggle, the system SHALL display two inline cross-check tables: Ledger BS Compare Check and Ledger INCST Compare Check.

#### Scenario: Expand row shows Ledger BS Compare Check
- **WHEN** user clicks the expand chevron on a fund row
- **THEN** an inline table SHALL appear showing Ledger BS Compare Check with columns: Incumbent TNA (from dataNav.netAssets incumbent), BNY TNA (from SUM of dataLedger.endingBalance where eagleClass='TF' and GL accounts starting with '1' or '2'), TNA Difference, and Validation status (traffic light)

#### Scenario: Expand row shows Ledger INCST Compare Check
- **WHEN** user clicks the expand chevron on a fund row
- **THEN** an inline table SHALL appear (below the BS check) showing Ledger INCST Compare Check with columns: Incumbent TNA (from dataLedger INCST filter), BNY TNA (from dataLedger BS filter), TNA Difference, and Validation status

#### Scenario: Cross-check expansion renders within performance target
- **WHEN** user expands a row
- **THEN** the cross-check tables SHALL render within 200ms

### Requirement: AI Commentary panel
The system SHALL display a collapsible right-hand panel (350px default width, resizable) showing AI agent commentary for the selected fund row. The panel SHALL include: Trend Summary (AI narrative of break trends across recent valuation dates), Pattern Recognition (links to similar breaks in other funds), Confidence Score (visual gauge with percentage), and Recommended Next Step (suggested drill-down path).

#### Scenario: AI panel shows analysis for selected fund
- **WHEN** user selects fund AC0002 which has a break
- **THEN** the AI panel SHALL display the AI analysis including root cause summary, confidence score gauge, and recommended next step (e.g., "Investigate Accrued Income in Trial Balance")

#### Scenario: AI panel collapses and expands
- **WHEN** user clicks the AI panel collapse toggle
- **THEN** the panel SHALL collapse to a narrow strip, and the grid SHALL expand to fill the available width

#### Scenario: AI panel updates within performance target
- **WHEN** user changes the selected fund row
- **THEN** the AI panel content SHALL update within 300ms

### Requirement: NAV Dashboard export
The system SHALL allow exporting the NAV Compare grid to Excel via right-click context menu.

#### Scenario: Export grid to Excel
- **WHEN** user right-clicks the grid and selects Export
- **THEN** the system SHALL download an Excel file containing all visible columns and rows from the NAV Compare grid

### Requirement: NAV Compare grid performance
The NAV Compare grid SHALL render within 1 second with up to 500 fund rows including validation status.

#### Scenario: Grid renders 500 rows within performance target
- **WHEN** the event has 500 funds
- **THEN** the grid SHALL complete rendering within 1 second
