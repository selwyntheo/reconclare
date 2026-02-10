# Ledger to Subledger — Data Model Refinement

## Client Activation Design Specification

| | |
|---|---|
| **Source:** | Miro Board — Client Activation Design |
| **Author:** | Erich |
| **Classification:** | Internal Use Only |
| **System:** | InvestOne / Eagle Conversion |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Ledger to Subledger Validation View](#2-ledger-to-subledger-validation-view)
3. [Ledger Categorization](#3-ledger-categorization)
4. [Data Visualization & Drill-Down](#4-data-visualization--drill-down)
5. [Position Totals](#5-position-totals)
6. [Position Asset-Class Categorization](#6-position-asset-class-categorization)
7. [Unsettled Totals](#7-unsettled-totals)
8. [Transaction Categorization](#8-transaction-categorization)
9. [Derived Subledger Rollup Logic](#9-derived-subledger-rollup-logic)

---

## 1. Overview

This document captures the data model refinement for the **Ledger to Subledger** validation check within the RECON-AI Control Center. It defines how ledger account balances are categorized, how subledger values are derived from position and transaction data, and how the drill-down visualization enables users to navigate from summary-level variances to individual security and transaction records.

The Ledger to Subledger check validates that GL balances (from `dataLedger`) match derived subledger rollup values (from `derivedSubLedgerRollup`) for each account and ledger account combination.

---

## 2. Ledger to Subledger Validation View

### 2.1 Summary Grid

The primary validation view presents a grid comparing ledger balances against derived subledger values, grouped by account and category.

| Column | Description |
|---|---|
| `account` | Portfolio account identifier |
| `category` | Ledger conversion category (e.g., Cash, Investment Cost, Holdings Unrealized) |
| `subledgerSupported` | Whether this category has a derived subledger rollup (`Y`/`N`) |
| `ledger` | Ending balance from `dataLedger` |
| `sub-ledger` | Derived value from `derivedSubLedgerRollup` |
| `Variance` | Difference between ledger and sub-ledger values |

### 2.2 Sample Data — Account 1

| Account | Category | Supported | Ledger | Sub-Ledger | Variance |
|---|---|---|---|---|---|
| 1 | **Cash** | Y | 7,892.64 | 7,892.64 | 0.00 |
| 1 | Investment Cost | Y | 1,816,202.20 | 1,816,202.20 | 0.00 |
| 1 | Holdings Unrealized | Y | 375,114.99 | 375,114.99 | 0.00 |
| 1 | Future Margin | Y | 11,777.97 | 11,875.47 | **-97.50** |
| 1 | Dividend RecPay | Y | 682.98 | 682.98 | 0.00 |
| 1 | Reclaim RecPay | Y | 17,066.67 | 17,066.67 | 0.00 |
| 1 | Interest RecPay | Y | 90.88 | 90.88 | 0.00 |
| 1 | Expense RecPay | N | -6,916.90 | — | 0.00 |
| 1 | Capital | N | -2,950,315.49 | — | 0.00 |
| 1 | Realized GL | N | 1,157,761.61 | — | 0.00 |
| 1 | Unrealized INCST | Y | -406,900.39 | -406,900.39 | 0.00 |
| 1 | Income | N | -61,780.76 | — | 0.00 |
| 1 | Expenses | N | 39,323.60 | — | 0.00 |

### 2.3 Sample Data — Account 10

| Account | Category | Supported | Ledger | Sub-Ledger | Variance |
|---|---|---|---|---|---|
| 10 | Cash | Y | 122,604.83 | 122,604.83 | 0.00 |
| 10 | Investment Cost | Y | 281,028,560.86 | 281,028,560.86 | 0.00 |
| 10 | Interest RecPay | Y | 336,100.97 | 336,100.97 | 0.00 |
| 10 | Expense RecPay | N | -407,080.35 | — | 0.00 |
| 10 | Distribution Pay | N | -387,441.65 | — | 0.00 |

### 2.4 Totals Row

| | Ledger | Sub-Ledger | Variance |
|---|---|---|---|
| **Total** | 0.00 | 320,181,072.98 | -320,181,072.98 |

> **Note:** The total variance of -320,181,072.98 reflects that categories marked `subledgerSupported = N` do not have derived subledger values. The supported categories individually tie out (except Future Margin with -97.50 variance).

---

## 3. Ledger Categorization

### 3.1 Definition

Ledger categories are assigned to each GL account number to group them into meaningful reconciliation buckets. This mapping drives the Ledger to Subledger summary view and determines which rollup rules apply.

### 3.2 GL Account to Category Mapping (InvestOne MUFG)

| Chart of Accounts | GL Account Number | GL Account Description | Ledger Section | BS/INCST | Conversion Category |
|---|---|---|---|---|---|
| investone mufg | S0010 | CASH & CASH EQUIVALENTS | ASSETS | BS | Investment Cost |
| investone mufg | S0075 | COMMON STOCKS | ASSETS | BS | Investment Cost |
| investone mufg | S0075URGL | COMMON STOCKS-URGL | ASSETS | BS | Holdings Unrealized |
| investone mufg | S0200 | MUTUAL FUNDS | ASSETS | BS | Investment Cost |
| investone mufg | S0200URGL | MUTUAL FUNDS-URGL | ASSETS | BS | Holdings Unrealized |
| investone mufg | S6000 | U.S. GOVERNMENT/AGENCY OBLIGATIONS | ASSETS | BS | Investment Cost |
| investone mufg | S6000URGL | U.S. GOVERNMENT/AGENCY OBLIGATIONS-URGL | ASSETS | BS | Holdings Unrealized |
| investone mufg | 1050 | CASH | ASSETS | BS | Cash |
| investone mufg | 1100 | FOREIGN CURRENCY HOLDINGS | ASSETS | BS | Cash |
| investone mufg | 1100URGL | FOREIGN CURRENCY HOLDINGS-URGL | ASSETS | BS | Holdings Unrealized |
| investone mufg | AI0010 | ACCRUED CASH & CASH EQUIVALENTS INCOME | ASSETS | BS | Interest RecPay |
| investone mufg | AI0075 | ACCRUED COMMON STOCK DIVIDEND INCOME | ASSETS | BS | Dividend RecPay |
| investone mufg | AI0650 | ACCRUED DIVIDENDS | ASSETS | BS | Dividend RecPay |
| investone mufg | 1550 | RECLAIMS RECEIVABLE | ASSETS | BS | Reclaim RecPay |
| investone mufg | P09600025 | PREPAID FUND OF FUNDS MANAGEMENT FEE WAIVER | ASSETS | BS | Expense RecPay |
| investone mufg | P20120000 | PREPAID FUND ADMINISTRATION / TA REIMBURSEMENT | ASSETS | BS | Expense RecPay |
| investone mufg | 1650 | APP/DEP FUTURES | ASSETS | BS | Future Margin |
| investone mufg | 1650URGL | APP/DEP FUTURES-URGL | ASSETS | BS | Future Margin |
| investone mufg | S0000 | UNCLASSIFIED | ASSETS | BS | Investment Cost |
| investone mufg | S0000URGL | UNCLASSIFIED-URGL | ASSETS | BS | Holdings Unrealized |
| investone mufg | S0090 | MISCELLANEOUS ASSETS | ASSETS | BS | Investment Cost |
| investone mufg | S0090URGL | MISCELLANEOUS ASSETS-URGL | ASSETS | BS | Holdings Unrealized |
| investone mufg | S0160 | FOREIGN RIGHTS | ASSETS | BS | Investment Cost |
| investone mufg | S0160URGL | FOREIGN RIGHTS-URGL | ASSETS | BS | Holdings Unrealized |
| investone mufg | AI0501 | ACCRUED SWAP DIVIDENDS | ASSETS | BS | Swap Income RecPay |
| investone mufg | 1250 | SECURITIES SOLD RECEIVABLE | ASSETS | BS | Investment RecPay |
| investone mufg | S0080 | U.S. GOVERNMENT & AGENCIES | ASSETS | BS | Investment Cost |
| investone mufg | AI0080 | ACCRUED U.S. GOVERNMENT & AGENCIES INTEREST | ASSETS | BS | Interest RecPay |
| investone mufg | 1300 | CAPITAL SHARES RECEIVABLE | ASSETS | BS | Subscription Rec |
| investone mufg | 1450 | OTHER INCOME RECEIVABLE | ASSETS | BS | Interest RecPay |

### 3.3 Category Naming Convention

Categories follow a consistent naming pattern:

| Category | What It Represents | Subledger Supported |
|---|---|---|
| **Cash** | Cash and cash equivalent balances | Yes |
| **Investment Cost** | Book/cost value of security positions | Yes |
| **Holdings Unrealized** | Unrealized gain/loss on positions (BS side) | Yes |
| **Future Margin** | Futures variation margin and deposits | Yes |
| **Dividend RecPay** | Accrued dividend receivables | Yes |
| **Reclaim RecPay** | Tax reclaim receivables | Yes |
| **Interest RecPay** | Accrued interest receivables/payables | Yes |
| **Swap Income RecPay** | Accrued swap income | Yes |
| **Investment RecPay** | Securities sold/purchased receivables/payables | Yes |
| **Subscription Rec** | Capital shares receivable | Yes |
| **Expense RecPay** | Prepaid/accrued expenses | No |
| **Capital** | Capital stock balances | No |
| **Realized GL** | Realized gains/losses | No |
| **Unrealized INCST** | Unrealized gain/loss (Income Statement side) | Yes |
| **Income** | Income statement — revenue | No |
| **Expenses** | Income statement — expenses | No |
| **Distribution Pay** | Distribution payables | No |

---

## 4. Data Visualization & Drill-Down

### 4.1 Interaction Pattern

Selection of a category row in the Ledger to Subledger summary triggers a drill-down showing applicable ledger, position, and transaction records.

**Drill-Down Flow:**

```
Ledger to Subledger Summary (category level)
    │
    ├── Ledger Detail Panel
    │   Shows individual GL accounts within the selected category
    │
    ├── Position Totals Panel
    │   Shows position-level data rolled up by security type
    │
    └── Unsettled Totals Panel
        Shows unsettled transaction amounts by category and trans code
```

### 4.2 Example: Holdings Unrealized Drill-Down

When the user selects **"Holdings Unrealized"** (account 1, ledger value = 375,114.99, sub-ledger = 375,114.99):

#### Ledger Detail

| Account | BsIncst | Category | GL Account Number |
|---|---|---|---|
| 1 | BS | Holdings Unrealized | 1100URGL |
| 1 | BS | Holdings Unrealized | S0075URGL |
| 1 | BS | Holdings Unrealized | S0200URGL |
| 1 | BS | Holdings Unrealized | S6000URGL |

These are the four GL accounts that roll up into the "Holdings Unrealized" category for account 1.

#### Position Totals (for Holdings Unrealized)

Positions are grouped by security type (`secType`) and then by individual security (`issueDescription`).

| Account | Category | secType | Issue Description | Unrealized | Total |
|---|---|---|---|---|---|
| 1 | Holdings Unrealized | CU | — | 35.37 | 35.37 |
| 1 | Holdings Unrealized | MF | GUGG ULTRA SHORT DUR I | 983.79 | 983.79 |
| 1 | Holdings Unrealized | MF | GUGGENHEIM STRATEGY II | 110.42 | 110.42 |
| 1 | Holdings Unrealized | MF | **Total** | **1,094.21** | **1,094.21** |
| 1 | Holdings Unrealized | S | — | 373,979.86 | 373,979.86 |
| 1 | Holdings Unrealized | TI | — | 5.55 | 5.55 |
| | | | **Total** | **375,114.99** | **375,114.99** |

> The Position Totals panel confirms that the sum of unrealized values across all security types (375,114.99) matches both the ledger and sub-ledger values.

---

## 5. Position Totals

### 5.1 Structure

The Position Totals view shows position-level data aggregated by account, category, and security type, with drill-down to individual securities.

| Column | Description |
|---|---|
| `account` | Portfolio account identifier |
| `category` | Ledger conversion category |
| `secType` | Security type code (CU, FT, MF, S, TI, CA, RP, etc.) |
| `issueDescription` | Security name (at leaf level) |
| `Book Value` | Position book/cost value |
| `Unrealized` | Unrealized gain/loss |
| `Net Income` | Accrued income |
| `Daily Var Margin` | Daily variation margin (futures) |
| `Var Margin Urgl` | Variation margin unrealized |
| `Total` | Sum of applicable columns for the category |

### 5.2 Full Position Totals — Account 1

| Category | secType | Book Value | Unrealized | Net Income | Daily Var Margin | Var Margin Urgl | Total |
|---|---|---|---|---|---|---|---|
| **Cash** | CU | 7,892.64 | | | | | 7,892.64 |
| **Future Margin** | FT | | | | 11,894.60 | -19.13 | 11,875.47 |
| **Holdings Unrealized** | CU | | 35.37 | | | | 35.37 |
| Holdings Unrealized | MF | | 1,094.21 | | | | 1,094.21 |
| Holdings Unrealized | S | | 373,979.86 | | | | 373,979.86 |
| Holdings Unrealized | TI | | 5.55 | | | | 5.55 |
| **Interest RecPay** | RP | | | 90.88 | | | 90.88 |
| **Investment Cost** | CA | 15,202.30 | | | | | 15,202.30 |
| Investment Cost | MF | 138,225.53 | | | | | 138,225.53 |
| Investment Cost | RP | 900,449.58 | | | | | 900,449.58 |
| Investment Cost | S | 637,687.80 | | | | | 637,687.80 |
| Investment Cost | TI | 124,636.99 | | | | | 124,636.99 |
| **Unrealized INCST** | CU | | -35.37 | | | | -35.37 |

### 5.3 Column-to-Category Mapping

Each position field maps to a specific ledger conversion category:

| Position Field | Ledger Category |
|---|---|
| `posBookValueBase` | Investment Cost |
| `posMarketValueBase - posBookValueBase` (unrealized) | Holdings Unrealized |
| `(posMarketValueBase - posBookValueBase) * -1` | Unrealized INCST |
| `posIncomeBase` | Interest RecPay / Dividend RecPay |
| `dailyVariationMarginBase` | Future Margin |
| `ltdVariationMarginBase` | Future Margin |

---

## 6. Position Asset-Class Categorization

### 6.1 Definition

Ledger category assignments for specific position fields vary by asset type (security type). This determines which position value fields contribute to which ledger categories.

### 6.2 Position Fields by Category

The following position-level fields feed the derived subledger rollup:

- **cost** → `posBookValueBase` → Investment Cost
- **unrealized** → `posMarketValueBase - posBookValueBase` → Holdings Unrealized (BS)
- **unrealized incst** → `(posMarketValueBase - posBookValueBase) * -1` → Unrealized INCST
- **margin** → `ltdVariationMarginBase` → Future Margin (BS)
- **margin incst** → `ltdVariationMarginBase * -1` → Future Margin INCST
- **interest** → `posIncomeBase` → Interest RecPay / Dividend RecPay

---

## 7. Unsettled Totals

### 7.1 Structure

The Unsettled Totals view shows unsettled transaction amounts grouped by account, category, and transaction code.

| Column | Description |
|---|---|
| `account` | Portfolio account identifier |
| `category` | Ledger conversion category |
| `transCode` | Transaction code (DIV, RECL, RECL-, RECL+, BUY, SELL, COVER, etc.) |
| `Amount` | Unsettled transaction amount (`transAmountBase`) |

### 7.2 Sample Data

#### Account 1

| Category | Trans Code | Amount |
|---|---|---|
| **Dividend RecPay** | DIV | 682.98 |
| **Reclaim RecPay** | RECL | 13,982.74 |
| Reclaim RecPay | RECL- | -21.69 |
| Reclaim RecPay | RECL+ | 3,105.62 |
| | **Total** | **17,749.65** |

#### Account 12

| Category | Trans Code | Amount |
|---|---|---|
| Dividend RecPay | DIV | 2,990.43 |
| | **Total** | **2,990.43** |

#### Account 3

| Category | Trans Code | Amount |
|---|---|---|
| Dividend RecPay | DIV | 5,824.22 |
| **Investment RecPay** | BUY | -4,400,277.40 |
| Investment RecPay | COVER | 0.00 |
| Investment RecPay | SELL | 1,810,000.00 |

---

## 8. Transaction Categorization

### 8.1 Definition

Ledger category assignments for specific transaction fields, determined by transaction code. This defines how unsettled transactions contribute to the derived subledger rollup.

### 8.2 Transaction Fields

The following transaction-level fields feed the derived subledger rollup:

- **net amount base** → `transAmountBase` → mapped by trans code to appropriate category
- **unrealized** → `transMarketValue - transAmountBase` → Unrealized categories
- **unrealized incst** → `(transMarketValue - transAmountBase) * -1` → Unrealized INCST

### 8.3 Transaction Code to Category Mapping

| Trans Code | Category | Field Used |
|---|---|---|
| DIV | Dividend RecPay | transAmountBase |
| RECL, RECL-, RECL+ | Reclaim RecPay | transAmountBase |
| BUY, SELL, COVER | Investment RecPay | transAmountBase |
| INT | Interest RecPay | transAmountBase |

---

## 9. Derived Subledger Rollup Logic

### 9.1 Overview

The `derivedSubLedgerRollup` dataset is constructed by aggregating position-level and transaction-level data, mapped to ledger accounts via the categorization rules. Each category's subledger value is the sum of its constituent position fields and unsettled transaction amounts.

### 9.2 Rollup Formula by Category

| Category | Source | Formula |
|---|---|---|
| **Cash** | Position | `posBookValueBase` WHERE secType IN ('CU') |
| **Investment Cost** | Position | `posBookValueBase` WHERE secType NOT IN ('CU', 'FT') |
| **Holdings Unrealized** | Position | `posMarketValueBase - posBookValueBase` |
| **Future Margin** | Position | `ltdVariationMarginBase` + `dailyVariationMarginBase` |
| **Dividend RecPay** | Unsettled Trans | `SUM(transAmountBase)` WHERE transCode = 'DIV' |
| **Reclaim RecPay** | Unsettled Trans | `SUM(transAmountBase)` WHERE transCode IN ('RECL', 'RECL-', 'RECL+') |
| **Interest RecPay** | Position + Trans | `posIncomeBase` + unsettled interest transactions |
| **Investment RecPay** | Unsettled Trans | `SUM(transAmountBase)` WHERE transCode IN ('BUY', 'SELL', 'COVER') |
| **Unrealized INCST** | Position | `(posMarketValueBase - posBookValueBase) * -1` |

### 9.3 Validation Rule

For each account and category where `subledgerSupported = Y`:

```
Variance = Ledger(endingBalance) - SubLedger(derivedValue)
```

A variance of 0.00 indicates the ledger balance is fully explained by the underlying position and transaction data. Non-zero variances (e.g., Future Margin = -97.50) indicate breaks requiring investigation.

---

## Appendix A: Category List with Subledger Support

| # | Category | Subledger Supported | Primary Data Source |
|---|---|---|---|
| 1 | Cash | Yes | Position (CU secType) |
| 2 | Investment Cost | Yes | Position (book value) |
| 3 | Holdings Unrealized | Yes | Position (unrealized G/L) |
| 4 | Future Margin | Yes | Position (variation margin) |
| 5 | Dividend RecPay | Yes | Unsettled transactions |
| 6 | Reclaim RecPay | Yes | Unsettled transactions |
| 7 | Interest RecPay | Yes | Position income + unsettled |
| 8 | Swap Income RecPay | Yes | Position income (swaps) |
| 9 | Investment RecPay | Yes | Unsettled transactions |
| 10 | Subscription Rec | Yes | Capital stock data |
| 11 | Expense RecPay | No | — |
| 12 | Capital | No | — |
| 13 | Realized GL | No | — |
| 14 | Unrealized INCST | Yes | Position (unrealized inverse) |
| 15 | Income | No | — |
| 16 | Expenses | No | — |
| 17 | Distribution Pay | No | — |

---

## Appendix B: Security Type Codes

| Code | Description |
|---|---|
| CA | Corporate Actions / Callable |
| CU | Cash / Currency |
| FT | Futures |
| MF | Mutual Funds |
| RP | Repo / Repurchase |
| S | Stocks / Equities |
| TI | Treasury / Fixed Income |

---

**END OF DOCUMENT**

*Ledger to Subledger Data Model Refinement — Client Activation Design*
