## ADDED Requirements

### Requirement: Commentary data model
The system SHALL store commentary records in the `commentary` MongoDB collection. Each record SHALL contain: commentId (UUID), parentCommentId (UUID, nullable — for threaded replies), reconciliationLevel (Enum: L0_NAV, L1_GL, L2_POSITION, L3_TRANSACTION), entityReference (String — reference to the entity: fund account, GL sub-classification, security ID, or transaction ID), breakCategory (Enum — the break category this comment relates to), amount (Decimal — the monetary amount explained by this comment), text (String — free-text commentary), knownDifferenceRef (String, nullable — reference to KD entry if standard commentary was applied), authorId (String), createdAt (DateTime), and isRolledUp (Boolean — whether this comment has been included in a higher-level rollup).

#### Scenario: Commentary record created at position level
- **WHEN** a reviewer adds commentary for security TEST001 with breakCategory="BNY to Resolve" and amount=60,000
- **THEN** the system SHALL create a commentary record with reconciliationLevel="L2_POSITION", entityReference="AC0001/TEST001", and the specified category and amount

#### Scenario: Threaded reply to existing commentary
- **WHEN** a reviewer replies to comment CMT-001
- **THEN** the system SHALL create a new commentary record with parentCommentId="CMT-001"

### Requirement: Commentary rollup hierarchy
Commentary SHALL follow the reconciliation hierarchy and aggregate from the most granular level upward: Level 4 (L3_TRANSACTION) — individual transaction or tax lot comments. Level 3 (L2_POSITION) — security-level commentary aggregating transaction breaks. Level 2 (L1_GL) — GL line commentary aggregating position-level breaks with break category tags. Level 1 (L0_NAV) — fund-level commentary summarizing all KD amounts, BNY/Incumbent to resolve amounts, and investigation items with total impact.

#### Scenario: Position commentary rolls up to Trial Balance
- **WHEN** 3 position comments exist for securities mapped to "Securities at Value" TB sub-classification: Known Difference -8,600, BNY to Resolve 60,000, Under Investigation -750,000
- **THEN** the L1_GL rollup for "Securities at Value" SHALL aggregate these as: "Known Difference: -8,600 (KD 4 Bond Pricing); BNY to Resolve: 60,000 (trade timing); Under Investigation: -750,000 (equity pricing under review)"

#### Scenario: Trial Balance commentary rolls up to Scorecard
- **WHEN** multiple TB sub-classifications have commentary for fund AC0001
- **THEN** the L0_NAV rollup for AC0001 SHALL aggregate all TB-level commentary summarizing total KD amounts, BNY to Resolve, Incumbent to Resolve, and Under Investigation with total impact amounts

### Requirement: Commentary rollup computation
The system SHALL compute commentary rollup on-demand via a MongoDB aggregation pipeline when a higher-level view is loaded. The aggregation SHALL group by breakCategory, sum amounts, and collect commentary entries. The result SHALL be cached with a 60-second TTL. The cache SHALL be invalidated when any child commentary changes (triggered by the COMMENTARY_ADDED WebSocket event).

#### Scenario: Rollup computed on scorecard load
- **WHEN** user opens the Client Scorecard for fund AC0001
- **THEN** the system SHALL run the aggregation pipeline on commentary records where entityReference starts with "AC0001/", group by breakCategory, and return the summarized commentary

#### Scenario: Rollup cache invalidated on new comment
- **WHEN** a reviewer adds a new comment at position level for fund AC0001
- **THEN** the cached rollup for AC0001 SHALL be invalidated and recomputed on next access

#### Scenario: Rollup computation meets performance target
- **WHEN** fund AC0001 has 500 positions with commentary
- **THEN** the rollup computation SHALL complete within 2 seconds

### Requirement: Commentary API endpoints
The system SHALL expose: `GET /api/events/{eventId}/funds/{account}/commentary` (get commentary for a fund, optional level and entity filters), `POST /api/events/{eventId}/funds/{account}/commentary` (create new commentary), `PUT /api/commentary/{commentId}` (update existing commentary), `DELETE /api/commentary/{commentId}` (delete commentary), and `GET /api/events/{eventId}/funds/{account}/commentary/rollup?level={level}` (get rolled-up commentary for a specific hierarchy level).

#### Scenario: GET commentary for fund at position level
- **WHEN** client calls `GET /api/events/EVT-001/funds/AC0001/commentary?level=L2_POSITION`
- **THEN** the system SHALL return all position-level commentary records for fund AC0001

#### Scenario: GET rollup at GL level
- **WHEN** client calls `GET /api/events/EVT-001/funds/AC0001/commentary/rollup?level=L1_GL`
- **THEN** the system SHALL return aggregated commentary grouped by TB sub-classification and break category

### Requirement: Commentary WebSocket updates
When commentary is added, edited, or deleted, the system SHALL broadcast a `COMMENTARY_ADDED` WebSocket event to all users viewing the same event. The message SHALL include the eventId, fundAccount, reconciliationLevel, and entityReference.

#### Scenario: Real-time commentary update
- **WHEN** user A adds commentary for security TEST001 in fund AC0001
- **THEN** user B viewing the Trial Balance for AC0001 SHALL see the commentary count update within 200ms
