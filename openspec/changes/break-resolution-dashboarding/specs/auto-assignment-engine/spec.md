## ADDED Requirements

### Requirement: Auto-assignment rule table
The system SHALL maintain a configurable rule table mapping break triggers to team assignments. Rules SHALL include: "Share break detected on any position" → BNY Trade Capture (TC User round-robin), "Price break detected on any position" → BNY Pricing (Pricing User round-robin), "Income withholding break" → BNY NAV Ops (NAV User 1), "Reclaim missing at BNY" → BNY NAV Ops (NAV User 1), "Corporate action mismatch" → BNY Corporate Actions (CA User 1), "All values match within tolerance" → Match (no assignment). The rule table SHALL be stored in MongoDB and configurable by Conversion Managers.

#### Scenario: Rule table lookup for share break
- **WHEN** a share break is detected for position TEST001
- **THEN** the auto-assignment engine SHALL look up the "Share break" trigger and assign to "BNY Trade Capture"

#### Scenario: Rule table lookup for price break
- **WHEN** a price break is detected for position BOND001
- **THEN** the auto-assignment engine SHALL look up the "Price break" trigger and assign to "BNY Pricing"

#### Scenario: Match auto-categorized without assignment
- **WHEN** all values for a position match within tolerance
- **THEN** the system SHALL auto-categorize as "Match" with no team assignment or notification

### Requirement: Round-robin owner assignment
When auto-assigning a break owner within a team, the system SHALL use round-robin distribution among available team members. The round-robin counter SHALL be maintained per team per event to ensure even distribution.

#### Scenario: Round-robin distributes breaks evenly
- **WHEN** 6 share breaks are detected and BNY Trade Capture has 3 team members (TC User 1, TC User 2, TC User 3)
- **THEN** each team member SHALL be assigned 2 breaks

#### Scenario: Round-robin skips unavailable members
- **WHEN** TC User 2 is marked as unavailable (on leave)
- **THEN** the round-robin SHALL skip TC User 2 and distribute among TC User 1 and TC User 3

### Requirement: Auto-assignment execution timing
Auto-assignment SHALL execute synchronously during break detection within the validation pipeline. When the validation engine identifies a break, the auto-assignment logic SHALL run inline before the break record is committed.

#### Scenario: Auto-assignment fires during validation
- **WHEN** a validation run detects 10 share breaks and 5 price breaks
- **THEN** all 10 share breaks SHALL have team="BNY Trade Capture" and all 5 price breaks SHALL have team="BNY Pricing" before the validation results are returned

### Requirement: Notification dispatch on auto-assignment
When auto-assignment fires, the system SHALL create a notification record in the `notifications` collection and broadcast via WebSocket. The notification SHALL include: notificationId (UUID), eventId (String), fundAccount (String), breakType (Enum: SHARE_BREAK, PRICE_BREAK, INCOME_BREAK, RECLAIM_BREAK, CORP_ACTION), securityId (String), assignedTeam (String), assignedOwner (String), breakAmount (Decimal), valuationDate (Date), createdAt (DateTime), isRead (Boolean, default false), and channel (Enum: IN_APP).

#### Scenario: Notification created for share break
- **WHEN** a share break is auto-assigned to BNY Trade Capture for security TEST001
- **THEN** a notification record SHALL be created with breakType="SHARE_BREAK", assignedTeam="BNY Trade Capture", and channel="IN_APP"

#### Scenario: WebSocket notification broadcast
- **WHEN** a notification is created for TC User 1
- **THEN** the WebSocket SHALL broadcast the notification to TC User 1's active connections within 200ms

### Requirement: Notification API endpoints
The system SHALL expose: `GET /api/notifications` (list notifications for current user, filtered by isRead), `PUT /api/notifications/{notificationId}/read` (mark notification as read), and `GET /api/notifications/count` (return unread notification count for the current user).

#### Scenario: GET unread notifications
- **WHEN** client calls `GET /api/notifications?isRead=false`
- **THEN** the system SHALL return all unread notifications for the current user sorted by createdAt descending

#### Scenario: Mark notification as read
- **WHEN** client calls `PUT /api/notifications/NOTIF-001/read`
- **THEN** the notification's isRead SHALL be set to true

### Requirement: Notification bell UI component
The system SHALL display a notification bell icon in the application header showing the unread notification count as a badge. Clicking the bell SHALL open a notification panel listing recent notifications with break type, security, fund, and timestamp.

#### Scenario: Notification bell shows unread count
- **WHEN** the user has 5 unread notifications
- **THEN** the bell icon SHALL display a badge with "5"

#### Scenario: Click notification navigates to break
- **WHEN** user clicks a notification for a price break on security BOND001 in fund AC0001
- **THEN** the system SHALL navigate to the Price Breaks view filtered to fund AC0001
