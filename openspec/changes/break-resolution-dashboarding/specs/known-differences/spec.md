## ADDED Requirements

### Requirement: Known Differences data model
The system SHALL store known difference records in the `knownDifferences` MongoDB collection. Each record SHALL contain: reference (String, unique per event, e.g., "KD 1", "SC 1"), type (Enum: "Methodology" or "Processing"), summary (String, short description), issueDescription (String, optional detailed explanation), comment (String, standard commentary template), isActive (Boolean), eventId (String, nullable — null means global), createdAt (DateTime), and updatedBy (String). The compound index on (eventId, isActive) SHALL ensure efficient queries for active KDs per event.

#### Scenario: KD record created
- **WHEN** a manager creates a known difference with reference "KD 1", type "Methodology", summary "Spot FX"
- **THEN** the system SHALL store the record with isActive=true and the standard commentary template

#### Scenario: KD scoped to specific event
- **WHEN** a KD is created with eventId="EVT-001"
- **THEN** the KD SHALL only appear in scorecard views for event EVT-001

#### Scenario: Global KD applies to all events
- **WHEN** a KD is created with eventId=null
- **THEN** the KD SHALL appear in scorecard views for all events

### Requirement: Pre-configured Known Differences
The system SHALL provide pre-configured KD entries: KD 1 (Methodology, "Spot FX", "KD 1 Net income variance due FX spot rate differences"), KD 2 (Methodology, "Forward FX", "KD 2 Forward FX rate differences"), KD 3 (Methodology, "Futures Pricing", "KD 3 Futures Pricing Differences"), KD 4 (Methodology, "Bond Pricing", "KD 4 Bond Pricing matrix differences"), KD 5 (Methodology, "Expenses", "KD 5 Expenses calculated on BNY NAV"). SC 1–8 entries SHALL be configurable Processing type entries. Custom entries SHALL be user-definable.

#### Scenario: Pre-configured KDs available on event creation
- **WHEN** a new event is created
- **THEN** the system SHALL make the 5 pre-configured Methodology KDs (KD 1–5) available as active entries

#### Scenario: Custom KD added during parallel
- **WHEN** a reviewer discovers a new processing difference during the parallel period
- **THEN** the reviewer SHALL be able to create a custom KD entry with a user-defined reference, type, summary, and standard commentary

### Requirement: Known Differences admin screen
The system SHALL provide a Known Differences configuration screen accessible to Conversion Managers. The screen SHALL display a table of all KD entries with inline editing for reference, type, summary, issue description, comment, and active status.

#### Scenario: Edit existing KD entry
- **WHEN** a manager updates the commentary for KD 1
- **THEN** the system SHALL save the change and all future references to KD 1's standard commentary SHALL use the updated text

#### Scenario: Deactivate KD entry
- **WHEN** a manager sets KD 3 to inactive
- **THEN** the KD 3 column SHALL no longer appear in the Client Scorecard for the associated event

### Requirement: Known Differences API endpoints
The system SHALL expose: `GET /api/events/{eventId}/known-differences` (list KDs for an event, optional `?active=true` filter), `POST /api/events/{eventId}/known-differences` (create new KD), `PUT /api/events/{eventId}/known-differences/{reference}` (update KD), and `DELETE /api/events/{eventId}/known-differences/{reference}` (soft-delete by setting isActive=false).

#### Scenario: GET active KDs for event
- **WHEN** client calls `GET /api/events/EVT-001/known-differences?active=true`
- **THEN** the system SHALL return all KD entries where isActive=true and (eventId="EVT-001" OR eventId=null)

#### Scenario: POST create new KD
- **WHEN** client calls `POST /api/events/EVT-001/known-differences` with reference "SC 1", type "Processing"
- **THEN** the system SHALL create the KD record and return it with a 201 status

### Requirement: KD standard commentary in reconciliation views
The system SHALL allow reviewers to apply standard commentary from KD entries when adding comments to individual reconciliation line items. A "Apply KD Commentary" button SHALL populate the comment field with the KD's standard comment template.

#### Scenario: Apply KD standard commentary to position comment
- **WHEN** a reviewer clicks "Apply KD Commentary" and selects "KD 4"
- **THEN** the comment field SHALL be populated with "KD 4 Bond Pricing matrix differences" and the knownDifferenceRef SHALL be set to "KD 4"

### Requirement: Dynamic KD column generation for Client Scorecard
Active KD entries SHALL dynamically generate columns in the NAV Client Scorecard. Each active KD SHALL produce a column showing the monetary amount attributable to that known difference per fund. KD columns SHALL be inserted between the static columns (Net Assets Difference and Adjusted Net Assets Difference).

#### Scenario: Dynamic columns reflect active KDs
- **WHEN** an event has 5 active KDs (KD 1–5)
- **THEN** the Client Scorecard grid SHALL display 5 KD columns between Net Assets Difference and Incumbent to Resolve

#### Scenario: New KD added during parallel creates new column
- **WHEN** a manager activates a new KD (SC 1) during the parallel period
- **THEN** the Client Scorecard SHALL display an additional column for SC 1 on the next page load
