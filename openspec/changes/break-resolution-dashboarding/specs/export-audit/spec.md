## ADDED Requirements

### Requirement: Excel export for all grid views
Every grid view in the application SHALL support export to Excel (.xlsx) maintaining all formatting, conditional coloring, and commentary. The export SHALL be generated server-side using openpyxl and returned as a streaming response.

#### Scenario: Export NAV Fund Level grid to Excel
- **WHEN** user triggers export on the NAV Fund Level Dashboard
- **THEN** the system SHALL generate an .xlsx file with all visible columns, rows, RAG color formatting, and number formats, and download it to the user's browser

#### Scenario: Export preserves conditional formatting
- **WHEN** a grid has cells with green (#E2F0D9), amber (#FFF2CC), and red (#FCE4EC) RAG coloring
- **THEN** the exported Excel file SHALL preserve the same conditional background colors on the corresponding cells

### Requirement: Export metadata header
All exported files SHALL include a metadata header section containing: Event Name, Valuation Date, Export Timestamp (ISO 8601), and Exported By (current user's name and role).

#### Scenario: Metadata header in exported file
- **WHEN** user "Jane Doe" (Fund Accountant) exports the Trial Balance for event "ACE Conversion" on 2026-02-10
- **THEN** the Excel file SHALL include a header row with "Event: ACE Conversion | Date: 2026-02-10 | Exported: 2026-02-10T14:30:00Z | By: Jane Doe (Fund Accountant)"

### Requirement: Export API endpoint
The system SHALL expose `POST /api/export/excel` accepting a JSON body with: viewType (String — the grid being exported), eventId (String), filters (Object — current grid filters), and format (Enum: "xlsx"). The endpoint SHALL return a `StreamingResponse` with content-type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

#### Scenario: Export API returns streaming response
- **WHEN** client calls `POST /api/export/excel` with viewType="client-scorecard" and eventId="EVT-001"
- **THEN** the system SHALL query the scorecard data, generate the .xlsx file, and return it as a streaming response

### Requirement: Export performance
Export generation SHALL complete within 5 seconds for any grid view with up to 1,000 rows.

#### Scenario: Export 1000-row grid within target
- **WHEN** the Full Portfolio grid has 1,000 positions
- **THEN** the Excel export SHALL complete generation and begin streaming within 5 seconds

### Requirement: Client Scorecard PDF export
The Client Scorecard SHALL additionally support export to PDF for client-facing reporting. PDF export SHALL use the browser's print-to-PDF with a print-optimized CSS stylesheet.

#### Scenario: Print-to-PDF for Client Scorecard
- **WHEN** user clicks "Export PDF" on the Client Scorecard
- **THEN** the browser SHALL open the print dialog with a print-optimized layout showing the scorecard data, KD columns, adjusted RAG, and metadata header

### Requirement: Audit trail data model
The system SHALL store audit records in the `auditLogs` MongoDB collection. Each record SHALL capture: auditId (UUID), eventId (String), action (Enum — the auditable action type), entityReference (String — what was changed), previousValue (Mixed — previous state), newValue (Mixed — new state), changedBy (String — userId), changedByName (String — display name), timestamp (DateTime), and metadata (Object — additional context). A TTL index on timestamp SHALL enforce a 1-year retention policy.

#### Scenario: Audit record for reviewer allocation change
- **WHEN** a manager changes the reviewer for AC0001 from "Jane Doe" to "John Smith" on 2026-02-10
- **THEN** the system SHALL create an audit record with action="ALLOCATION_CHANGED", previousValue="Jane Doe", newValue="John Smith", and the fund/date context

### Requirement: Auditable actions
The system SHALL create audit records for the following actions: Reviewer Allocation Change (fund, date, previous reviewer, new reviewer), Break Category Assignment (entity, previous category, new category), Break Team Re-Assignment (entity, previous team/owner, new team/owner), Review Status Change (fund, date, previous status, new status), Commentary Added/Edited (entity, comment text, break category, amount), Known Difference Created/Modified (KD reference, previous values, new values), and Client Scorecard KD Override (fund, date, KD column, system value, override value).

#### Scenario: Audit for break category change
- **WHEN** a reviewer changes a break category from "Under Investigation" to "Known Difference"
- **THEN** the system SHALL create an audit record with action="BREAK_CATEGORY_CHANGED", previousValue="Under Investigation", newValue="Known Difference"

#### Scenario: Audit for KD override
- **WHEN** a reviewer overrides KD 1 value from 1,449.32 to 1,500.00 in the scorecard
- **THEN** the system SHALL create an audit record with action="KD_OVERRIDE", previousValue=1449.32, newValue=1500.00, and the fund/date/KD column context

### Requirement: Audit trail query API
The system SHALL expose: `GET /api/events/{eventId}/audit` (list audit records, filtered by action type, entity, date range, and user), with pagination support (limit, offset).

#### Scenario: Query audit trail for a fund
- **WHEN** client calls `GET /api/events/EVT-001/audit?entity=AC0001&from=2026-02-09&to=2026-02-20`
- **THEN** the system SHALL return all audit records for fund AC0001 within the date range, sorted by timestamp descending

#### Scenario: Query audit trail by action type
- **WHEN** client calls `GET /api/events/EVT-001/audit?action=KD_OVERRIDE`
- **THEN** the system SHALL return only KD override audit records

### Requirement: Audit trail UI for Auditors
Users with the Auditor role SHALL have read-only access to the full audit trail. The audit trail SHALL be displayed as a searchable, filterable table within the application.

#### Scenario: Auditor views audit trail
- **WHEN** an Auditor navigates to the audit trail view
- **THEN** the system SHALL display all audit records with filters for action type, entity, date range, and user

### Requirement: RBAC for export
Export scope SHALL be controlled by the user's role. The existing `exportScope` permission SHALL determine which views a user can export: "all" (all views), "price-only" (price breaks only), "share-only" (share breaks only), "none" (no export access).

#### Scenario: Pricing team export restricted to price data
- **WHEN** a Pricing Team user attempts to export the Full Portfolio grid
- **THEN** the system SHALL deny the export and display a message indicating insufficient permissions

#### Scenario: Recon Lead exports any view
- **WHEN** a Recon Lead user exports the Client Scorecard
- **THEN** the system SHALL generate and download the export without restriction
