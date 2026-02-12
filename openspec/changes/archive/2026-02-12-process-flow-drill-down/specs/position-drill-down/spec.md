## ADDED Requirements

### Requirement: Position Drill-Down route and breadcrumb
The system SHALL render the Position Drill-Down at route `/events/{eventId}/funds/{account}/positions?valuationDt={date}&category={category}`. The breadcrumb SHALL display "Events > {Event Name} > {Fund Name} > Trial Balance > {Category} Positions".

#### Scenario: Position Drill-Down loads with category context
- **WHEN** user navigates to `/events/EVT-001/funds/AC0002/positions?valuationDt=2026-02-10&category=Investment%20Urgl`
- **THEN** the system SHALL load positions filtered to the Investment Urgl category with breadcrumb "Events > Vanguard Fixed Income Migration > AC0002 Fund > Trial Balance > Investment Urgl Positions"

### Requirement: Position Drill-Down context header
The system SHALL display a fixed context header showing inherited context plus category filter: Fund name and account, Valuation Date, Category name (e.g., "Investment Urgl"), Category Variance with amount and basis points, and NAV Variance (total fund-level for reference).

#### Scenario: Context header shows category variance
- **WHEN** user drills from Trial Balance where Investment Urgl has Balance Diff of ($22,972.58) at 10.28 bp
- **THEN** the context header SHALL display "Category: Investment Urgl", "Category Variance: ($22,972.58) (10.28 bp)", and "NAV Variance: ($17,857.00)"

### Requirement: Position Compare grid with core columns
The system SHALL display an AG-Grid data grid comparing position-level data between Incumbent and BNY for the selected GL category. Core columns (present for all categories) SHALL include: Asset ID (from dataSubLedgerPosition.assetId), Security Type (from refSecurity.secType), Issue Description (from refSecurity.issueDescription), CUSIP (from refSecurity.cusip, 9-character), Long/Short indicator (L or S, centered), and Share Class.

#### Scenario: Grid displays positions for selected category
- **WHEN** Position Drill-Down loads for category "Investment Urgl"
- **THEN** the grid SHALL display positions from dataSubLedgerPosition joined Incumbent (userBank=incumbent) vs BNY (userBank=BNY) on (valuationDt, account, shareClass, assetId, longShortInd), filtered to positions mapped to the Investment Urgl GL category

### Requirement: Category-context-aware comparison columns
The Position Compare grid SHALL display different comparison columns depending on the GL category context. For each comparison field, the grid SHALL show three sub-columns: Incumbent value (userBank=incumbent), BNY value (userBank=BNY), and Variance (Incumbent - BNY, red if |variance| > threshold).

#### Scenario: Investment Cost category shows cost columns
- **WHEN** the category is "Investment Cost"
- **THEN** the comparison columns SHALL include: posBookValueLocal, posBookValueBase, posOrigCostLocal, posOrigCostBase, posShares, posOriginalFace — each as Incumbent/BNY/Variance tri-columns

#### Scenario: Investment Urgl category shows unrealized columns
- **WHEN** the category is "Investment Urgl"
- **THEN** the comparison columns SHALL include: posUnrealizedLocal, posUnrealizedBase (derived: posMarketValueBase - posBookValueBase), posMarketPrice, posMarketValueBase — each as Incumbent/BNY/Variance tri-columns

#### Scenario: Interest RecPay category shows income columns
- **WHEN** the category is "Interest RecPay"
- **THEN** the comparison columns SHALL include: posIncomeLocal, posIncomeBase, posIncomeMarket, posPrevCouponDt, posNextCouponDt, dailyInterestLocal, dailyInterestBase — each as Incumbent/BNY/Variance tri-columns

#### Scenario: Forward Cost/Urgl category shows forward columns
- **WHEN** the category is "Forward Cost" or "Forward URGL"
- **THEN** the comparison columns SHALL include: fwdLongAmount, fwdShortAmount, fwdBookValue, fwdUnrealized, fwdLongCurrency, fwdShortCurrency — each as Incumbent/BNY/Variance tri-columns

#### Scenario: Futures Margin category shows margin columns
- **WHEN** the category is "Futures Margin"
- **THEN** the comparison columns SHALL include: ltdVariationMarginLocal, ltdVariationMarginBase, dailyVariationMarginLocal, dailyVariationMarginBase — each as Incumbent/BNY/Variance tri-columns

#### Scenario: Dividend/Expense RecPay categories show transaction columns
- **WHEN** the category is "Dividend RecPay" or "Expense RecPay"
- **THEN** the comparison columns SHALL include unsettled transaction fields: transAmountLocal, transAmountBase, transTradeDate (for Dividend) or transCode (for Expense), transSettleDate — each as Incumbent/BNY/Variance tri-columns

### Requirement: Expandable row tax lot detail
When a user expands a position row, the system SHALL display a tax lot detail table showing individual lots from dataSubLedgerTrans. The table SHALL include columns: Transaction ID, Lot Trade Date (YYYY-MM-DD), Lot Settle Date (YYYY-MM-DD), Shares (6 decimal places), Original Face (6 decimal places), Orig Cost Local (#,##0.00), Orig Cost Base (#,##0.00), Book Value Local (#,##0.00), Book Value Base (#,##0.00), Market Value Local (#,##0.00), Market Value Base (#,##0.00), Income Local (#,##0.00), and Broker Code. Each lot row SHALL follow the Incumbent/BNY/Variance tri-column pattern joined on (valuationDt, account, shareClass, assetId, longShortInd, transactionId).

#### Scenario: Expand position shows tax lots
- **WHEN** user expands the position for CUSIP 789456123
- **THEN** an inline tax lot table SHALL appear showing all lots for that security with Incumbent vs BNY comparison per lot, fetched from dataSubLedgerTrans

#### Scenario: Tax lot expansion renders within performance target
- **WHEN** a position has 50 tax lots
- **THEN** the tax lot table SHALL render within 300ms

### Requirement: Basis lot check
The system SHALL provide a Basis Lot Check secondary validation accessible via a tab or toggle. This compares shares between the primary accounting basis (isPrimaryBasis='Y') and non-primary basis (isPrimaryBasis<>'Y') for each position. Any difference in shares by assetId indicates a tax lot accounting discrepancy.

#### Scenario: Toggle to basis lot check view
- **WHEN** user toggles to the Basis Lot Check tab
- **THEN** the grid SHALL switch to show positions with primary basis shares vs non-primary basis shares and their variance

#### Scenario: Basis lot discrepancy detected
- **WHEN** asset 789456123 has 10,000 shares on primary basis and 9,500 shares on non-primary basis
- **THEN** the basis lot check SHALL show a 500-share variance with a red validation indicator

### Requirement: Position roll-up tie-out validation
The system SHALL display a summary footer validating that the sum of all position-level variances ties to the GL category variance from the Trial Balance. The footer SHALL show: Sum of Position Variances (calculated from visible rows), GL Category Variance (inherited from Trial Balance), and Tie-Out pass/fail indicator.

#### Scenario: Position roll-up ties to GL category variance
- **WHEN** the sum of all position unrealized variances equals ($22,972.58) and the GL category variance is ($22,972.58)
- **THEN** the tie-out indicator SHALL show a green pass status

#### Scenario: Position roll-up does not tie
- **WHEN** the sum of position variances is ($22,500.00) but GL category variance is ($22,972.58)
- **THEN** the tie-out SHALL show a warning with the ($472.58) discrepancy, indicating possible unmapped positions or GL classification issues

### Requirement: Security reference detail modal
The system SHALL open a modal displaying security reference fields (from refSecurity) when the user clicks a security identifier (Asset ID or CUSIP) in the grid.

#### Scenario: Click CUSIP opens security detail modal
- **WHEN** user clicks the CUSIP link "789456123"
- **THEN** a modal SHALL appear showing refSecurity fields: secType, issueDescription, cusip, and other available reference data

### Requirement: Position Drill-Down AI commentary
The AI Commentary panel at the position level SHALL show the most granular analysis: position-level root cause per security (e.g., day count convention mismatch), lot-level anomaly detection (flags lots with unusual variances), cross-position pattern recognition (identifies shared root causes), resolution recommendations (specific action items), and per-position confidence scoring with evidence chain.

#### Scenario: AI panel shows position-level root cause
- **WHEN** user selects position CUSIP 789456123 with unrealized variance
- **THEN** the AI panel SHALL display specific root cause (e.g., "Day count convention mismatch. CPU uses ACT/ACT, Incumbent uses 30/360") with confidence score and evidence chain

#### Scenario: AI panel identifies cross-position pattern
- **WHEN** multiple bond positions share the same day count variance pattern
- **THEN** the AI panel SHALL note the pattern (e.g., "3 corporate bond positions affected by same day count convention difference")

### Requirement: Position Drill-Down export
The system SHALL allow exporting the position grid with lot-level detail for all expanded rows to Excel.

#### Scenario: Export positions to Excel
- **WHEN** user clicks Export to Excel
- **THEN** the system SHALL download an Excel file with all positions and their expanded lot detail

### Requirement: Request AI analysis action
The system SHALL allow the user to trigger AI agent analysis for a selected position or lot.

#### Scenario: Request AI analysis for position
- **WHEN** user clicks "Request Analysis" for a selected position
- **THEN** the system SHALL trigger AI analysis and update the AI panel when analysis completes

### Requirement: Position grid performance
The Position Compare grid SHALL render within 1 second with up to 1,000 positions with grouping.

#### Scenario: Grid renders 1000 positions within performance target
- **WHEN** the category contains 1,000 positions
- **THEN** the grid SHALL complete rendering within 1 second
