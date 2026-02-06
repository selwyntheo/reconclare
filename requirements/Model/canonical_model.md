# Fund Administration Canonical Data Model - Complete Field Mapping

**Document Version:** 2.0  
**Last Updated:** February 6, 2026  
**Purpose:** Comprehensive field mapping for fund administration systems including Eagle, InvestOne, and other platforms

---

## Table of Contents

1. [Core Transaction Tables](#1-core-transaction-tables)
2. [Reference Data Tables](#2-reference-data-tables)
3. [Position and Holdings Tables](#3-position-and-holdings-tables)
4. [Subledger Tables](#4-subledger-tables)
5. [NAV and Fund Level Tables](#5-nav-and-fund-level-tables)
6. [Cross-Reference (xref) Tables](#6-cross-reference-xref-tables)
7. [Enrichment Tables](#7-enrichment-tables)
8. [System-Specific Fields](#8-system-specific-fields)
9. [Field Type Reference](#9-field-type-reference)

---

## 1. Core Transaction Tables

### 1.1 dataDailyTransactions

**Description:** Primary table for daily transaction data across all portfolios. Contains trade and corporate action activity.

**Table Type:** Core  
**Grain:** One row per transaction per valuation date  
**Update Frequency:** Daily

#### Key Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| eventId | Key | String | Id of the event being processed, contextual | Required, unique per processing event |
| valuationDt | Key | Date | Valuation or reporting date of the incumbent data file | Required, format: YYYY-MM-DD |
| userBank | Key | String | Source of reporting data | Required, valid source system code |
| account | Key | String | Portfolio account identifier | Required, must exist in refFund |
| acctBasis | Key | String | Code identifying the accounting basis | Required, valid accounting basis code |
| shareClass | Key | String | Class code/identifier | Required for multi-class funds |
| assetId | Key | String | Primary security identifier | Required, must exist in refSecurity |
| longShortInd | Key | String | Indicator of whether the transaction is long or short | Required, values: 'L', 'S' |
| transactionId | Key | String | Unique transaction or lot identifier | Required, unique within account/date |

#### Transaction Detail Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| transCode | Transaction | String | Code designating the type of transaction | Required, must exist in refTransCode |
| units | Transaction | Decimal | Units of the transaction | Required, precision: 18,6 |
| currency | Transaction | String | Currency of the transaction | Required, ISO 4217 currency code |
| amountLocal | Transaction | Decimal | Net local amount of the transaction | Required, precision: 18,2 |
| amountBase | Transaction | Decimal | Net traded base amount of the transaction | Required, precision: 18,2 |
| tradeDate | Transaction | Date | Trade date of the transaction | Required, format: YYYY-MM-DD |
| settleDate | Transaction | Date | Settle date of the transaction | Optional, format: YYYY-MM-DD |
| tradedIntLocal | Transaction | Decimal | Traded interest of the transaction (local) | Optional, precision: 18,2 |
| tradedIntBase | Transaction | Decimal | Traded interest of the transaction (base) | Optional, precision: 18,2 |

#### Additional Fields from Mapping

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| shares | Transaction | Decimal | Number of shares in transaction | Precision: 18,6 |
| originalFace | Transaction | Decimal | For factor based securities, original face | Optional, for bonds/MBS |
| origCostLocal | Transaction | Decimal | Original cost in local currency | Precision: 18,2 |
| origCostBase | Transaction | Decimal | Original cost in base currency | Precision: 18,2 |
| bookValueLocal | Transaction | Decimal | Book value in local currency | Precision: 18,2 |
| bookValueBase | Transaction | Decimal | Book value in base currency | Precision: 18,2 |
| lotTradeDate | Transaction | Date | Original acquisition trade date | Format: YYYY-MM-DD |
| lotSettleDate | Transaction | Date | Original settle date | Format: YYYY-MM-DD |

---

## 2. Reference Data Tables

### 2.1 refSecurity

**Description:** Master security reference data containing all security identifiers and characteristics.

**Table Type:** Reference  
**Grain:** One row per security  
**Update Frequency:** Real-time/Daily

#### Key Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| assetId | Key | String | Primary security identifier | Required, unique |
| valuationDt | Key | Date | Valuation or reporting date | Required, for temporal tracking |
| userBank | Key | String | Source of reporting data | Required |

#### Security Identifier Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| cusip | Key | String | CUSIP market identifier | 9 characters, North American securities |
| sedol | Key | String | SEDOL market identifier | 7 characters, primarily UK securities |
| isin | Key | String | ISIN market identifier | 12 characters, international standard |
| ticker | Key | String | Ticker market identifier | Exchange-specific ticker symbol |
| secType | Key | String | Security type indicator/code | Required, must exist in refSecType |

#### Security Descriptive Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| issueDescription | refSecurity | String | Security issue description/name | Required, max 255 chars |
| assetCurrency | refSecurity | String | Currency of security issue | Required, ISO 4217 code |
| countryCode | refSecurity | String | Country code of security issue | Required, ISO 3166-1 alpha-2 |

#### Fixed Income Specific Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| issueDate | refSecurity | Date | Issue date of security | Format: YYYY-MM-DD |
| maturityDt | refSecurity | Date | Maturity date of security | Format: YYYY-MM-DD |
| couponRate | refSecurity | Decimal | Coupon rate for the current valuation date | Precision: 10,6, expressed as decimal (0.05 = 5%) |
| dayCount | refSecurity | String | Day count code for security | Values: '30/360', 'ACT/ACT', 'ACT/360', etc. |
| nextCallDate | refSecurity | Date | Next call date | Format: YYYY-MM-DD |
| callPrice | refSecurity | Decimal | Next call price | Precision: 18,6 |
| amortMethod | refSecurity | String | Amortization method code | Values: 'SL' (Straight Line), 'EFF' (Effective) |
| factor | refSecurity | Decimal | Current factor of security | Precision: 18,10, for MBS/ABS |
| firstCouponDate | refSecurity | Date | First coupon date of the security | Format: YYYY-MM-DD |
| lastCouponDate | refSecurity | Date | Last coupon date of the security | Format: YYYY-MM-DD |
| paymentFrequency | refSecurity | String | Coupon payment frequency | Values: 'M', 'Q', 'S', 'A' |

#### Equity Specific Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| divFrequency | refSecurity | String | Dividend frequency | Values: 'M', 'Q', 'S', 'A' |

### 2.2 refSecType

**Description:** Security type classification reference table.

**Table Type:** Reference  
**Grain:** One row per security type  
**Update Frequency:** Infrequent

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| secType | Key | String | Security type indicator/code | Required, unique |
| secTypeDescription | refSecType | String | Description of security type | Required, max 255 chars |

**Common Security Types:**
- EQUITY - Common Stock
- BOND - Corporate Bond
- GOVT - Government Bond
- MBS - Mortgage-Backed Security
- FUTURE - Futures Contract
- OPTION - Options Contract
- FX_FWD - Foreign Exchange Forward

### 2.3 refTransCode

**Description:** Transaction code reference for all transaction types.

**Table Type:** Reference  
**Grain:** One row per transaction code  
**Update Frequency:** Infrequent

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| transCode | Key | String | Code designating the type of unsettled transaction | Required, unique |
| transCodeDescription | refTransCode | String | Description of the trans code | Required, max 255 chars |

**Common Transaction Codes:**
- BUY - Purchase
- SELL - Sale
- DIV - Dividend
- INT - Interest
- MAT - Maturity
- CALL - Call
- SPLIT - Stock Split
- SPINOFF - Spinoff

### 2.4 refLedger

**Description:** General ledger account chart of accounts.

**Table Type:** Reference  
**Grain:** One row per GL account  
**Update Frequency:** Infrequent

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| glAccountNumber | Key | String | Ledger account identifier | Required, unique |
| glDescription | refLedger | String | Ledger account description | Required, max 255 chars |
| glCategory | refLedger | String | Ledger account category (Assets, Liabilities, etc.) | Required, valid category |

**GL Categories:**
- ASSET - Assets
- LIABILITY - Liabilities
- EQUITY - Equity
- INCOME - Income
- EXPENSE - Expense

### 2.5 refFund

**Description:** Fund/Portfolio master reference data.

**Table Type:** Reference  
**Grain:** One row per fund/portfolio  
**Update Frequency:** Daily

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| account | Key | String | Portfolio account identifier | Required, unique |
| accountName | refFund | String | Portfolio name/description | Required, max 255 chars |

---

## 3. Position and Holdings Tables

### 3.1 dataSubLedgerPosition

**Description:** Position-level holdings data showing current positions with market values, income accruals, and unrealized gains/losses.

**Table Type:** Core  
**Grain:** One row per position per valuation date  
**Update Frequency:** Daily

#### Key Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| userBank | Key | String | Source of reporting data | Required |
| account | Key | String | Portfolio account identifier | Required, must exist in refFund |
| acctBasis | Key | String | Code identifying the accounting basis | Required |
| shareClass | Key | String | Class code/identifier | Required for multi-class funds |
| assetId | Key | String | Primary security identifier | Required, must exist in refSecurity |
| longShortInd | Key | String | Indicator of whether the lot is held long or short | Required, values: 'L', 'S' |

#### Position Quantity Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| posShares | Position | Decimal | Position shares, current face | Required, precision: 18,6 |
| posOriginalFace | Position | Decimal | Position original face | Optional, for factor securities, precision: 18,6 |

#### Position Cost Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| posOrigCostLocal | Position | Decimal | Position original local cost | Required, precision: 18,2 |
| posOrigCostBase | Position | Decimal | Position original base cost | Required, precision: 18,2 |
| posBookValueLocal | Position | Decimal | Position current amortized local cost | Required, precision: 18,2 |
| posBookValueBase | Position | Decimal | Position current amortized base cost | Required, precision: 18,2 |

#### Position Market Value Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| posMarketValueLocal | Position | Decimal | Position current local market value | Required, precision: 18,2 |
| posMarketValueBase | Position | Decimal | Position current base market value | Required, precision: 18,2 |
| posMarketPrice | Position | Decimal | Position current market price | Required, precision: 18,6 |
| posUnrealizedLocal | Position | Decimal | Position current local unrealized value | Calculated: posMarketValueLocal - posBookValueLocal |
| posUnrealizedBase | Position | Decimal | Position current base unrealized value | Calculated: posMarketValueBase - posBookValueBase |

#### Income Recognition Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| posIncomeLocal | Income RecPay | Decimal | Position net accrued income local, inclusive of withholding tax, reclaim, and deferred | Precision: 18,2 |
| posIncomeBase | Income RecPay | Decimal | Position net accrued income base, inclusive of fx unrealized | Precision: 18,2 |
| posIncomeMarket | Income RecPay | Decimal | Market value of position net accrued income base, inclusive of withholding tax, reclaim, and deferred | Precision: 18,2 |
| posInsTaxExpenseLocal | Income RecPay | Decimal | Local value of position withholding tax expense on accrued income | Precision: 18,2 |
| posInsTaxExpenseBase | Income RecPay | Decimal | Base value of position withholding tax expense on accrued income | Precision: 18,2 |
| posIncReclaimLocal | Income RecPay | Decimal | Local value of position reclaim receivable on accrued income | Precision: 18,2 |
| posIncReclaimBase | Income RecPay | Decimal | Base value of position reclaim receivable on accrued income | Precision: 18,2 |
| posIncDeferredLocal | Income RecPay | Decimal | Local value of position accrued period to date deferred income | Precision: 18,2 |
| posIncDeferredBase | Income RecPay | Decimal | Base value of position accrued period to date deferred income | Precision: 18,2 |
| posIncUnrealized | Income RecPay | Decimal | FX unrealized on position accrued income | Precision: 18,2 |
| posIncomeCurrency | Income RecPay | String | Position currency of accrued income | ISO 4217 currency code |
| posPrevCouponDt | Income RecPay | Date | The previous coupon date of the current position accrual period | Format: YYYY-MM-DD |
| posNextCouponDt | Income RecPay | Date | The next coupon date of the current position accrual period | Format: YYYY-MM-DD |

#### Daily Interest/Amortization Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| dailyInterestLocal | Income Delta | Decimal | Daily earned interest local | Precision: 18,2 |
| dailyInterestBase | Income Delta | Decimal | Daily earned interest base | Precision: 18,2 |
| dailyAmortLocal | Income Delta | Decimal | Daily earned net amortization (disc & premium) local | Precision: 18,2 |
| dailyAmortBase | Income Delta | Decimal | Daily earned net amortization (disc & premium) base | Precision: 18,2 |

#### Variation Margin Fields (Futures)

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| ltdVariationMarginLocal | Variation Margin | Decimal | Total life to date local unrealized on futures position | Precision: 18,2 |
| ltdVariationMarginBase | Variation Margin | Decimal | Total life to date base unrealized on futures position | Precision: 18,2 |
| dailyVariationMarginLocal | Variation Margin | Decimal | One day local unrealized variation margin on futures position | Precision: 18,2 |
| dailyVariationMarginBase | Variation Margin | Decimal | One day base unrealized variation margin on futures position | Precision: 18,2 |

---

## 4. Subledger Tables

### 4.1 dataSubLedgerTrans

**Description:** Lot-level transaction and position details including tax lot accounting information.

**Table Type:** Core  
**Grain:** One row per lot per valuation date  
**Update Frequency:** Daily

#### Key Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| acctBasis | Key | String | Code identifying the accounting basis | Required |
| shareClass | Key | String | Class code/identifier | Required |
| assetId | Key | String | Primary security identifier | Required |
| longShortInd | Key | String | Indicator of whether the lot is held long or short | Required |
| transactionId | Key | String | Unique transaction or lot identifier | Required, unique |

#### Lot Quantity Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| shares | Lot | Decimal | Number of shares held, current face | Required, precision: 18,6 |
| originalFace | Lot | Decimal | For factor based securities, the original face of the lot | Optional, precision: 18,6 |

#### Lot Cost Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| origCostLocal | Lot | Decimal | The original cost of the lot (current book value less amortization) | Required, precision: 18,2 |
| origCostBase | Lot | Decimal | The original cost of the lot (current book value less amortization) | Required, precision: 18,2 |
| bookValueLocal | Lot | Decimal | Current amortized cost of the lot | Required, precision: 18,2 |
| bookValueBase | Lot | Decimal | Current amortized cost of the lot | Required, precision: 18,2 |

#### Lot Trade Information

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| lotTradeDate | Lot | Date | Original acquisition trade date of the lot | Required, format: YYYY-MM-DD |
| lotSettleDate | Lot | Date | Original settled settle date of the lot | Required, format: YYYY-MM-DD |
| origTradePrice | Lot | Decimal | Original trade price of the lot, required for margin based securities | Precision: 18,6 |
| origTradeCommission | Lot | Decimal | Commission on original trade of the lot, required for margin based securities | Precision: 18,2 |
| origTradeXRate | Lot | Decimal | Fx rate on original trade of the lot, required for margin based securities | Precision: 18,10 |
| brokerCode | Lot | String | Lot broker code | Max 20 chars |

#### Lot Market Value Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| marketValueLocal | Lot | Decimal | Current market value of the lot | Required, precision: 18,2 |
| marketValueBase | Lot | Decimal | Current market value of the lot | Required, precision: 18,2 |

#### Forward Lot Specific Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| fwdLongCurrency | Lot | String | For forward lots, the receivable currency | ISO 4217 code |
| fwdShortCurrency | Lot | String | For forward lots, the payable currency | ISO 4217 code |
| fwdLongAmount | Lot | Decimal | For forward lots, the receivable amount | Precision: 18,2 |
| fwdShortAmount | Lot | Decimal | For forward lots, the payable amount | Precision: 18,2 |
| fwdBookValue | Lot | Decimal | For forward lots, the book cost of the forward | Precision: 18,2 |
| fwdUnrealized | Lot | Decimal | For forward lots, the total unrealized on the forward position | Precision: 18,2 |

#### Lot Income Fields

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| lotBasisUid | Lot | String | Unique identifier that ties together lots of different accounting basis | Max 50 chars |
| incomeLocal | Lot Income RecPay | Decimal | Current accrued income on the lot | Precision: 18,2 |
| incomeBase | Lot Income RecPay | Decimal | Current accrued income on the lot | Precision: 18,2 |
| incomeCurrency | Lot Income RecPay | String | Currency of the lot accrued income | ISO 4217 code |

#### Transaction RecPay Fields (Unsettled Transactions)

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| transCode | Transaction RecPay | String | Code designating the type of unsettled transaction | Must exist in refTransCode |
| transUnits | Transaction RecPay | Decimal | Units of the unsettled transaction | Precision: 18,6 |
| transCurrency | Transaction RecPay | String | Currency of the unsettled transaction | ISO 4217 code |
| transAmountLocal | Transaction RecPay | Decimal | Net local amount of the unsettled transaction | Precision: 18,2 |
| transAmountBase | Transaction RecPay | Decimal | Net traded base amount of the unsettled transaction | Precision: 18,2 |
| transTradeDate | Transaction RecPay | Date | Trade date of the transaction | Format: YYYY-MM-DD |
| transSettleDate | Transaction RecPay | Date | Settle date of the transaction | Format: YYYY-MM-DD |
| transMarketValue | Transaction RecPay | Decimal | Net current base amount of the unsettled transaction | Precision: 18,2 |
| transTradedIntLocal | Transaction RecPay | Decimal | Traded interest of the transaction | Precision: 18,2 |
| transTradedIntBase | Transaction RecPay | Decimal | Traded interest of the transaction | Precision: 18,2 |
| transTradedIntMarket | Transaction RecPay | Decimal | Base market value of traded interest | Precision: 18,2 |

---

## 5. NAV and Fund Level Tables

### 5.1 NAV Summary

**Description:** Net Asset Value summary data at the share class level.

**Table Type:** Core  
**Grain:** One row per share class per valuation date  
**Update Frequency:** Daily

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| shareClass | Key | String | Class code/identifier | Required |
| sharesOutstanding | NAV Summary | Decimal | Portfolio shares outstanding | Required, precision: 18,6 |
| settledShares | NAV Summary | Decimal | Portfolio settled/distribution shares outstanding | Required, precision: 18,6 |
| netAssets | NAV Summary | Decimal | Net assets in the base currency of the portfolio | Required, precision: 18,2 |
| NAV | NAV Summary | Decimal | Portfolio reported NAV (Net asset value) rounded to NAV precision | Required, precision: 18,4 |
| dailyDistribution | NAV Summary | Decimal | Daily portfolio distribution activity | Precision: 18,2 |
| dailyYield | NAV Summary | Decimal | Daily portfolio 1-day yield, primarily relevant for money market or other daily distributing accounts | Precision: 10,6 |

### 5.2 Capital Stock

**Description:** Capital stock activity tracking subscriptions, redemptions, and reinvestments.

**Table Type:** Core  
**Grain:** One row per share class per valuation date  
**Update Frequency:** Daily

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| subscriptionBalance | Capital Stock | Decimal | Ltd subscription capital balance | Precision: 18,2 |
| redemptionBalance | Capital Stock | Decimal | Ltd redemption capital balance | Precision: 18,2 |
| reinvestedDistribution | Capital Stock | Decimal | Ltd dividend reinvestment capital balance | Precision: 18,2 |

### 5.3 Distribution

**Description:** Distribution activity by type (income, short-term capital gains, long-term capital gains).

**Table Type:** Core  
**Grain:** One row per share class per valuation date  
**Update Frequency:** Daily

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| incomeDistribution | Distribution | Decimal | Total fund income distribution balance as ties to the ledger income statement | Precision: 18,2 |
| stcgDistribution | Distribution | Decimal | Total fund short term capital gain distribution balance as ties to the ledger income statement | Precision: 18,2 |
| ltcgDistribution | Distribution | Decimal | Total fund long term capital gain distribution balance as ties to the ledger income statement | Precision: 18,2 |

### 5.4 Capstock RecPay

**Description:** Unsettled capital stock receivables and payables.

**Table Type:** Core  
**Grain:** One row per share class per valuation date  
**Update Frequency:** Daily

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| subscriptionRecLocal | Capstock RecPay | Decimal | Local value of unsettled subscription receivable as of the valuation date | Precision: 18,2 |
| redemptionPayLocal | Capstock RecPay | Decimal | Local value of unsettled redemption payable as of the valuation date | Precision: 18,2 |
| subscriptionRecBase | Capstock RecPay | Decimal | Base value of unsettled subscription receivable as of the valuation date | Precision: 18,2 |
| redemptionPayBase | Capstock RecPay | Decimal | Base value of unsettled redemption payable as of the valuation date | Precision: 18,2 |

### 5.5 Distribution RecPay

**Description:** Unsettled distribution payables.

**Table Type:** Core  
**Grain:** One row per share class per valuation date  
**Update Frequency:** Daily

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| distributionPayable | Distribution RecPay | Decimal | Base value of unsettled distribution payable | Precision: 18,2 |

### 5.6 Merger

**Description:** Merger-related share activity.

**Table Type:** Core  
**Grain:** One row per merger event per valuation date  
**Update Frequency:** As needed

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| mergerShares | Merger | Decimal | Shares involved in merger activity | Precision: 18,6 |

### 5.7 Ledger

**Description:** General ledger balances at the account level.

**Table Type:** Core  
**Grain:** One row per GL account per valuation date  
**Update Frequency:** Daily

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| eventId | Key | String | Id of the event being processed, contextual | Required |
| valuationDt | Key | Date | Valuation or reporting date of the incumbent data file | Required |
| userBank | Key | String | Source of reporting data | Required |
| account | Key | String | Portfolio account identifier | Required |
| acctBasis | Key | String | Code identifying the accounting basis | Required |
| shareClass | Key | String | Class code/identifier | Required |
| glAccountNumber | Key | String | Ledger account identifier | Required |
| endingBalance | Ledger | Decimal | Closing balance of the ledger account for the valuation date | Required, precision: 18,2 |

---

## 6. Cross-Reference (xref) Tables

### 6.1 xrefAccount

**Description:** Cross-reference mapping for account-level attributes across systems.

**Table Type:** Cross-Reference  
**Grain:** One row per account per system  
**Update Frequency:** As needed

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| account | Key | String | Portfolio account identifier | Required |
| eagleActBasis | xrefAccount | String | Eagle system accounting basis code | Max 20 chars |
| eagleSource | xrefAccount | String | Eagle source system identifier | Max 20 chars |
| chartOfAccounts | xrefAccount | String | Chart of accounts identifier | Max 50 chars |
| accountBaseCurrency | xrefAccount | String | Base currency for the account | ISO 4217 code |
| eagleRegion | xrefAccount | String | Eagle region classification | Max 20 chars |
| ishtarClass | xrefAccount | String | Ishtar system class code | Max 20 chars |
| eagleClass | xrefAccount | String | Eagle class code | Max 20 chars |
| eagleClassLevelOverride | xrefAccount | String | Override for Eagle class level | Max 20 chars |

### 6.2 xrefSleeve

**Description:** Cross-reference for sleeve and composite account structures.

**Table Type:** Cross-Reference  
**Grain:** One row per account  
**Update Frequency:** As needed

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| account | Key | String | Portfolio account identifier | Required |
| isSleeve | xrefSleeve | String | Indicator if account is a sleeve | Values: 'Y', 'N' |
| isComposite | xrefSleeve | String | Indicator if account is a composite | Values: 'Y', 'N' |

### 6.3 xrefClass

**Description:** Cross-reference for share class mappings.

**Table Type:** Cross-Reference  
**Grain:** One row per share class  
**Update Frequency:** As needed

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| shareClass | Key | String | Class code/identifier | Required |
| eagleClassLevelOverride | xrefClass | String | Override for Eagle class level | Max 20 chars |
| parentAccount | xrefClass | String | Parent account identifier | Max 20 chars |
| isSleeve | xrefClass | String | Indicator if class is a sleeve | Values: 'Y', 'N' |
| isComposite | xrefClass | String | Indicator if class is a composite | Values: 'Y', 'N' |

### 6.4 xrefBrokerCode

**Description:** Cross-reference for broker code mappings across systems.

**Table Type:** Cross-Reference  
**Grain:** One row per broker  
**Update Frequency:** As needed

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| brokerCode | Key | String | Broker identifier | Required |
| eagleBrokerCode | xrefBrokerCode | String | Eagle system broker code | Max 20 chars |

### 6.5 xrefTransaction

**Description:** Cross-reference for transaction code mappings.

**Table Type:** Cross-Reference  
**Grain:** One row per transaction code per system  
**Update Frequency:** As needed

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| transCode | Key | String | Transaction code | Required |
| eagleLog | xrefTransaction | String | Eagle log transaction type | Max 20 chars |

---

## 7. Enrichment Tables

### 7.1 convTransClassification

**Description:** Transaction classification enrichment for cross-system conversion.

**Table Type:** Enrichment  
**Grain:** One row per transaction classification mapping  
**Update Frequency:** As needed

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| transCode | Key | String | Transaction code | Required |
| ishtarAccount | convTransClassification | String | Ishtar system account mapping | Max 50 chars |

### 7.2 convGleanClassification

**Description:** GL account classification enrichment for cross-system conversion.

**Table Type:** Enrichment  
**Grain:** One row per GL classification mapping  
**Update Frequency:** As needed

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| glAccountNumber | Key | String | GL account number | Required |
| eagleFiat | convGleanClassification | String | Eagle fiat currency indicator | Max 20 chars |
| ishtarLedgerAccount | convGleanClassification | String | Ishtar ledger account mapping | Max 50 chars |

### 7.3 convSecClassification

**Description:** Security classification enrichment for cross-system conversion.

**Table Type:** Enrichment  
**Grain:** One row per security classification mapping  
**Update Frequency:** As needed

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| assetId | Key | String | Security identifier | Required |
| convSecClassificationType | convSecClassification | String | Security classification type code | Max 50 chars |

### 7.4 eagleSecClassification

**Description:** Eagle-specific security classification enrichment.

**Table Type:** Enrichment  
**Grain:** One row per security in Eagle  
**Update Frequency:** Daily

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| assetId | Key | String | Security identifier | Required |
| eagleActual | eagleSecClassification | String | Eagle actual classification value | Max 50 chars |

---

## 8. System-Specific Fields

### 8.1 eagleEntity

**Description:** Eagle-specific entity-level attributes.

**Table Type:** System-Specific  
**Source System:** Eagle  
**Update Frequency:** Daily

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| account | Key | String | Portfolio account identifier | Required |
| entityBaseCurrency | eagleEntity | String | Base currency for the entity in Eagle | ISO 4217 code |
| entityProdSource | eagleEntity | String | Production source system | Max 20 chars |
| entityNature | eagleEntity | String | Nature of the entity | Max 20 chars |
| entityPeriodsDueValue | eagleEntity | String | Periods due value configuration | Max 50 chars |
| entityNullClass | eagleEntity | String | Null class handling | Max 20 chars |
| entityComposite | eagleEntity | String | Composite indicator | Values: 'Y', 'N' |
| entityParent | eagleEntity | String | Parent entity identifier | Max 20 chars |
| entityCashSleeve | eagleEntity | String | Cash sleeve configuration | Max 20 chars |
| entityLedgerProcessingFlag | eagleEntity | String | Ledger processing flag | Values: 'Y', 'N' |
| entityPartition | eagleEntity | String | Data partition identifier | Max 20 chars |

### 8.2 eagleMaster

**Description:** Eagle-specific master security attributes.

**Table Type:** System-Specific  
**Source System:** Eagle  
**Update Frequency:** Real-time

| Field Name | Field Type | Data Type | Definition | Business Rules |
|------------|-----------|-----------|------------|----------------|
| assetId | Key | String | Security identifier | Required |
| eagleCurrency | eagleMaster | String | Eagle currency code | ISO 4217 code |
| eagleMaturityType | eagleMaster | String | Eagle maturity type classification | Max 20 chars |
| eagleSecurityType | eagleMaster | String | Eagle security type code | Max 20 chars |
| eaglePrimaryAssetType | eagleMaster | String | Eagle primary asset type | Max 20 chars |
| eagleSecMaster | eagleMaster | String | Eagle security master identifier | Max 50 chars |
| eagleNonClassType | eagleMaster | String | Eagle non-classified type | Max 20 chars |
| eagleOpen | eagleMaster | String | Eagle open indicator | Values: 'Y', 'N' |
| eaglePension | eagleMaster | String | Eagle pension indicator | Values: 'Y', 'N' |
| eagleNonCoupDate | eagleMaster | Date | Eagle non-coupon date | Format: YYYY-MM-DD |
| eagleNature | eagleMaster | String | Eagle security nature | Max 20 chars |

---

## 9. Field Type Reference

### Field Type Categories

| Field Type | Description | Usage |
|------------|-------------|-------|
| Key | Primary key or part of composite key | Uniquely identifies records |
| Transaction | Transaction-level attributes | Describes individual transactions |
| Position | Position-level aggregates | Current holdings information |
| Lot | Lot-level details | Tax lot specific information |
| Income RecPay | Income recognition fields | Accrued income tracking |
| Income Delta | Daily income changes | Day-over-day income activity |
| Transaction RecPay | Unsettled transaction fields | Pending settlement tracking |
| Lot Income RecPay | Lot-level income | Income at tax lot level |
| NAV Summary | NAV calculation fields | Share class NAV components |
| Capital Stock | Capital activity | Subscriptions/redemptions |
| Distribution | Distribution tracking | Income and capital gain distributions |
| Capstock RecPay | Unsettled capital activity | Pending capital transactions |
| Distribution RecPay | Unsettled distributions | Pending distribution payments |
| Variation Margin | Futures margin | Daily variation margin for derivatives |
| Ledger | General ledger fields | GL account balances |
| Merger | Merger activity | Corporate action mergers |

### Data Type Specifications

| Data Type | Format | Precision | Example |
|-----------|--------|-----------|---------|
| String | VARCHAR | Variable (see field definition) | "AAPL", "US0378331005" |
| Date | YYYY-MM-DD | N/A | "2026-02-06" |
| Decimal | Numeric | Variable (see field definition) | 12345.67, 0.0550 |

**Decimal Precision Notation:**
- (18,2) = 18 total digits, 2 decimal places (for currency amounts)
- (18,6) = 18 total digits, 6 decimal places (for share quantities)
- (10,6) = 10 total digits, 6 decimal places (for rates/percentages)
- (18,10) = 18 total digits, 10 decimal places (for FX rates, factors)

---

## Appendix A: Common Calculation Rules

### NAV Per Share Calculation
```
NAV Per Share = Net Assets / Shares Outstanding
```

### Unrealized Gain/Loss
```
Unrealized Gain/Loss = Market Value - Book Value
```

### Daily Accrual (Simple)
```
Daily Accrual = (Principal × Annual Rate × Days) / Day Count Basis
```

### Amortization (Straight Line)
```
Daily Amortization = (Par Value - Cost) / Days to Maturity
```

### Variation Margin (Futures)
```
Daily Variation Margin = (Today's Settlement Price - Yesterday's Settlement Price) × Contract Size × Number of Contracts
```

---

## Appendix B: System Mapping Guide

### Source Systems
1. **Eagle** - Primary accounting system for positions, transactions, NAV
2. **InvestOne** - Alternative fund accounting platform
3. **Geneva** - Private equity/alternative investment accounting
4. **Investran** - Private equity partnership accounting

### Target Systems
1. **Ishtar** - Consolidated reporting platform
2. **Internal Reports** - Custom reporting solutions
3. **Data Warehouse** - Enterprise data lake

### Transformation Layers
1. **eagleInternal** - Eagle raw data extraction
2. **transform_eagleInternal** - Eagle data normalization
3. **ioInternal_reports** - InvestOne reporting layer
4. **transform_ioInternal** - InvestOne normalization
5. **ioH22Parse** - InvestOne historical data parser
6. **enrichment** - Cross-reference and classification enrichment
7. **static_mapping** - Static lookup tables
8. **enriched_data** - Final enriched canonical model

---

## Appendix C: Change Log

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-01-15 | Initial Team | Initial canonical model definition |
| 2.0 | 2026-02-06 | Selwyn Theo | Added cross-reference tables, enrichment layers, and system-specific fields from mapping analysis |

---

## Appendix D: Glossary

| Term | Definition |
|------|------------|
| Accounting Basis | The method of accounting used (e.g., GAAP, Tax, Regulatory) |
| Accrual | Income earned but not yet received |
| Base Currency | The primary currency for portfolio reporting |
| Book Value | The accounting value of an asset (cost adjusted for amortization) |
| CUSIP | Committee on Uniform Securities Identification Procedures - 9-character US security identifier |
| Day Count | The convention for calculating interest (e.g., 30/360, Actual/Actual) |
| Factor | Current outstanding principal as a percentage of original face (for MBS/ABS) |
| ISIN | International Securities Identification Number - 12-character global identifier |
| Lot | A tax lot representing a specific purchase of shares |
| NAV | Net Asset Value - value per share |
| RecPay | Receivables and Payables - unsettled amounts |
| SEDOL | Stock Exchange Daily Official List - 7-character UK/European identifier |
| Share Class | A specific class of fund shares with distinct fee structures or minimums |
| Sleeve | A sub-portfolio within a larger account structure |
| Variation Margin | Daily settlement of futures contract gains/losses |

---

**END OF DOCUMENT**