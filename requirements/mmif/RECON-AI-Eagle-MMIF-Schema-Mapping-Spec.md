# RECON-AI: Eagle GL → MMIF Schema Mapping Layer

## Coding Specification for Claude Code Implementation

**Module:** `mmif-reconciliation`  
**Integration Point:** RECON-AI L0–L3 Hierarchy  
**Target System:** Eagle STAR/PACE  
**Regulatory Framework:** CBI MMIF (Resident Money Market & Investment Funds Return)  
**Version:** 1.0 | March 2026

---

## 1. Purpose & Context

### 1.1 What This Module Does

This module adds a new reconciliation type to RECON-AI that validates MMIF regulatory return data against Eagle's trial balance before CBI submission. It maps Eagle GL account structures to MMIF taxonomy sections, performs multi-level tie-out, and uses AI to analyze breaks.

### 1.2 Why MMIF Matters

The CBI's MMIF return is designed to answer a specific question: **what does the portfolio look like if we strip away investor movement noise?** The MMIF achieves this by requiring funds to report opening positions, closing positions, transactions (purchases/sales), and investor flows (issues/redemptions) separately. The CBI then *derives* valuation changes as a residual:

```
Valuation Change = Closing Position − Opening Position − Net Transactions
```

This means every data point must reconcile precisely — errors in any component corrupt the derived valuation signal that the CBI uses for systemic risk monitoring.

### 1.3 The Four-Component NAV Decomposition

```
ΔNAV = ΔValuation(market) + ΔValuation(FX) + Net Investor Flows + Net Income
```

| Component | MMIF Source | Eagle Source | Reported or Derived |
|-----------|-----------|-------------|-------------------|
| Valuation (market) | Residual from positions + transactions | posMarketValueBase − posBookValueBase movements | **Derived by CBI** |
| Valuation (FX) | Residual from base vs local CCY positions | FX rate differential on positions | **Derived by CBI** |
| Net Investor Flows | Section 5.1: Issues − Redemptions | dataNav: subscriptionBalance, redemptionBalance | **Reported directly** |
| Net Income | Section 2: P&L (accruals basis, quarter-only) | dataLedger: P&L accounts (eagleLedgerAcct starting with 3/4) | **Reported directly** |

### 1.4 Integration with Existing RECON-AI Hierarchy

The MMIF reconciliation maps to the existing L0–L3 structure:

| RECON-AI Level | MMIF Application | Existing Validation Rule |
|---------------|-----------------|------------------------|
| L0 — NAV | MMIF Section 4.3 Total Assets = TB Total Assets | Rule 1.1: NAV to Ledger |
| L1 — GL Category | MMIF worksheet subtotals = TB account group totals | Rule 1.3: Ledger TF to Class |
| L2 — Position | MMIF security-by-security = TB position-level | Rule 1.4: Position to Lot |
| L3 — Transaction | MMIF purchases/sales = TB transaction activity | Rule 1.5: Ledger to Subledger |

---

## 2. Canonical Model Integration

### 2.1 Core Tables Used

This module reads from the existing RECON-AI canonical model. No new tables are created — the MMIF mapping is a *view layer* over existing data.

**Primary data tables:**

| Table | Usage in MMIF Module |
|-------|---------------------|
| `dataNav` | NAV-level totals, subscription/redemption balances, distribution data |
| `dataLedger` | GL account balances (opening, closing, movements) by eagleLedgerAcct |
| `dataSubLedgerPosition` | Security-level positions: market value, book value, income, shares |
| `dataSubLedgerTrans` | Transaction/lot-level data: forward values, unsettled amounts |
| `dataDailyTransactions` | Period transaction activity for purchases/sales reconciliation |

**Reference tables:**

| Table | Usage in MMIF Module |
|-------|---------------------|
| `refSecurity` | ISIN, CUSIP, SEDOL, secType, issueDescription, maturityDate |
| `xrefAccount` | eagleActBasis, eagleSource, chartOfAccounts, accountBaseCurrency |
| `xrefSecurity` | Eagle-specific security cross-references |
| `eagleMaster` | eagleSecurityType, eaglePrimaryAssetType, eagleCurrency, eagleMaturityType |
| `eagleEntity` | entityBaseCurrency, entityLedgerProcessingFlag |

**Enrichment tables:**

| Table | Usage in MMIF Module |
|-------|---------------------|
| `convSecClassification` | Security classification type for MMIF instrument type mapping |
| `eagleSecClassification` | Eagle actual classification for instrument type derivation |
| `convGleanClassification` | GL account classification for MMIF section routing |

### 2.2 Derived SubLedger Rollup (Existing)

The existing `derivedSubLedgerRollup` calculation is the foundation for MMIF asset-side validation. Each rule maps canonical model fields to Eagle GL account numbers. The MMIF module extends these rules with MMIF section annotations.

**Existing rollup rules with MMIF section mapping:**

| Rule Name | Eagle GL (eagleLedgerAcct) | Data Source | MMIF Section |
|-----------|---------------------------|-------------|-------------|
| Security Cost | `eagleCostLedgerAcct` | posBookValueBase | 3.1 (equity) / 3.2 (debt) |
| Security URGL BS | `1011000101` | posMarketValueBase − posBookValueBase | N/A (CBI derives) |
| Security URGL INCST | `3003000301` | (posMarketValueBase − posBookValueBase) × −1 | N/A (CBI derives) |
| Security Interest | `eagleIntLedgerAcct` | posIncomeBase | 3.6 (Accrued Income) |
| Security Int URGL BS | `1011000300` | posIncomeMarket − posIncomeBase | N/A (CBI derives) |
| Security Int URGL INCST | `3003000800` | (posIncomeMarket − posIncomeBase) × −1 | N/A (CBI derives) |
| Forward Cost Rec | `1007001100` | ABS(fwdBookValue) | 4.2 (Derivatives) |
| Forward Cost Pay | `2005002900` | ABS(fwdBookValue) × −1 | 4.2 (Derivatives) |
| Forward URGL BS | `1011000201` | fwdUnrealized | N/A (CBI derives) |
| Forward URGL INCST | `4004000401` | fwdUnrealized × −1 | N/A (CBI derives) |
| Future URGL INCST | `3003000500` | ltdVariationMarginBase | 4.2 (Derivatives) |
| RPR Cost | `eagleRecPayLedger` | transAmountBase | 3.4 / 5.2 (Sec Lending) |
| RPR URGL BS | `1011000300` | transMarketValue − transAmountBase | N/A (CBI derives) |
| RPR URGL INCST | `3003000800` | (transMarketValue − transAmountBase) × −1 | N/A (CBI derives) |
| Capital Subs | `3002000110` | subscriptionBalance × −1 | 5.1 (Fund Shares) |
| Capital Reds | `3002000210` | redemptionBalance | 5.1 (Fund Shares) |
| Capital Reinvest | `3002000210` | reinvestedDistribution × −1 | 5.1 (Fund Shares) |
| Capital Subs Rec | `1005000300` | subscriptionRecBase | 5.1 (Fund Shares) |
| Capital Reds Pay | `2005003500` | redemptionPayBase × −1 | 5.1 (Fund Shares) |
| Dist Income | `3004000100` | incomeDistribution | 5.5 (Other Liabilities) |
| Dist STCG | `3004000120` | stcgDistribution | 5.5 (Other Liabilities) |
| Dist LTCG | `3004000110` | ltcgDistribution | 5.5 (Other Liabilities) |
| Dist Payable | `2006000700` | distributionPayable × −1 | 5.5 (Other Liabilities) |
| Ledger Load | `eagleLedgerAcct` (where ledgerLoad = 1) | endingBalance | 3.5 (Cash) / 5.4 (Expenses) |

---

## 3. Eagle GL → MMIF Section Mapping

### 3.1 Mapping Architecture

The mapping is a three-layer lookup:

```
Eagle GL Account → TB Category → MMIF Section + Instrument Type
```

Layer 1 uses the existing `eagleLedgerAcct` patterns from the derived subledger rollup rules. Layer 2 groups these into the TB categories visible in the Trial Balance screen (Cash, Investment Cost, Investment Urgl, etc.). Layer 3 routes each category to the appropriate MMIF worksheet and instrument classification.

### 3.2 Asset Mappings

#### 3.2.1 Equities → MMIF Section 3.1

**Source:** `dataSubLedgerPosition` WHERE eagleSecurityType IN ('EQ', 'ETF', 'CIU', 'UCITS', 'MMF')

| TB Category | Eagle GL Pattern | MMIF Section | MMIF Instrument Type | Code Type | Valuation | Key Mapping Notes |
|------------|-----------------|-------------|---------------------|-----------|-----------|------------------|
| Investment Cost (Equity) | `eagleCostLedgerAcct` (equity positions) | 3.1 | 1=Listed Shares, 2=Unlisted, 8=UCITS CIU, 9=MMF CIU, 10=Non-UCITS CIU | ISIN preferred; Internal if unavailable | posMarketValueBase at quarter-end | Classify by eaglePrimaryAssetType; CIU subtype from convSecClassification |
| Investment Urgl (Equity) | `1011000101` (equity portion) | N/A | N/A | N/A | CBI derives | **Do NOT map to MMIF — unrealized is derived** |

**Instrument type classification logic:**

```python
def classify_equity_instrument(security: RefSecurity, eagle_master: EagleMaster) -> int:
    """
    Returns MMIF instrument type code for equity securities.
    Uses eagleSecurityType + convSecClassification for CIU subtyping.
    """
    sec_type = eagle_master.eagleSecurityType
    sec_class = security.convSecClassificationType
    
    if sec_type == 'MMF' or sec_class == 'MONEY_MARKET_FUND':
        return 9   # Equity in UCITS MMF
    elif sec_type in ('UCITS', 'CIU') and sec_class == 'UCITS':
        return 8   # Equity in UCITS (non-MMF)
    elif sec_type == 'CIU' and sec_class != 'UCITS':
        return 10  # Equity in Non-UCITS CIU
    elif sec_type == 'ETF':
        # ETFs map to listed shares unless they are CIU wrappers
        return 1   # Listed Shares (default for ETF)
    elif security.isin is not None:
        return 1   # Listed Shares
    else:
        return 2   # Unlisted Shares
```

**Dividends accrued (MMIF 3.1.5):**

Dividends accrued per security are captured via the Dividend RecPay TB category. Map unsettled dividend transactions from `dataDailyTransactions` WHERE transCode indicates dividend receivable. These must be reported at the security level in MMIF 3.1.5 OR aggregated in MMIF 3.6.

#### 3.2.2 Debt Securities → MMIF Section 3.2

**Source:** `dataSubLedgerPosition` WHERE eagleSecurityType IN ('GOVT', 'CORP', 'CP', 'ABS', 'CONVERT', 'ZERO', 'MBS', 'MUNI')

| TB Category | Eagle GL Pattern | MMIF Section | Valuation | Key Mapping Notes |
|------------|-----------------|-------------|-----------|------------------|
| Investment Cost (Debt) | `eagleCostLedgerAcct` (debt positions) | 3.2 | **Clean price** (excl accrued interest) | Eagle stores dirty price; must decompose: clean = posMarketValueBase − posIncomeBase |
| Interest RecPay | `eagleIntLedgerAcct` | 3.2 (line-level) or 3.6 (aggregate) | posIncomeBase | Accrued interest reported separately from position value |
| Investment Urgl (Debt) | `1011000101` (debt portion) | N/A | CBI derives | **Do NOT map — unrealized is derived** |
| Income Unrealized BS | `1011000300` | N/A | posIncomeMarket − posIncomeBase | **Do NOT map — CBI derives** |

> **CRITICAL:** The MMIF requires clean price (excluding accrued interest) for debt securities. Eagle typically stores positions at dirty price. The mapping must decompose:
> - MMIF closing position = posMarketValueBase − posIncomeBase
> - MMIF accrued interest (3.6 or line-level) = posIncomeBase
> 
> Failure to separate these causes both the position value AND accrued income to be wrong, which cascades into the CBI's derived valuation calculation.

**Additional debt-specific fields:**

| MMIF Field | Eagle Source | Notes |
|-----------|-------------|-------|
| Maturity Date | refSecurity.maturityDate | Mandatory for all debt; format DD/MM/YYYY; perpetuals leave blank |
| Investment Grade | Derived from credit rating | Map Eagle rating to MMIF Y/N per CBI schedule (Annex 3) |
| Yield to Maturity | Calculated per MMIF V12 formula | **Do NOT use Eagle's internal YTM** — use MMIF-specified formula |
| Original Maturity Bucket | Derived from issue date + maturity date | ECB statistical classification: <1Y, 1-2Y, >2Y |
| Nominal Currency | eagleMaster.eagleCurrency | Currency of issue, not base currency |

#### 3.2.3 Cash, Deposits & Loans → MMIF Section 3.5

**Source:** `dataLedger` WHERE ledgerLoad = 1 AND eagleLedgerAcct matches cash account patterns

| TB Category | Eagle GL Pattern | MMIF Section | Key Mapping Notes |
|------------|-----------------|-------------|------------------|
| Cash | Cash GL accounts (ledgerLoad = 1) | 3.5 | Direct from ledger; sector = MFI for bank accounts; country = bank domicile |
| Margin (Initial) | Margin GL accounts | 3.5 | Cash posted as collateral to clearinghouse |
| Margin (Variation) | Variation margin GL | 4.2 (netted) or 3.5 | **Depends on accounting policy**: settled VM = P&L in derivatives; posted VM = cash collateral |

**Counterparty enrichment:**

Cash accounts in the MMIF require sector and country attribution per ESA 2010 classifications. Eagle's bank account master may not carry these. The Schema Mapper must maintain a counterparty lookup:

```python
# Counterparty enrichment for cash positions
# Maps Eagle bank/broker identifiers to CBI sector/country codes
COUNTERPARTY_ENRICHMENT = {
    # bank_identifier: (cbi_sector_code, country_iso)
    'JPMORGAN_IE': ('S122', 'IE'),   # MFI, Ireland
    'CITI_US':     ('S122', 'US'),   # MFI, United States
    'EUROCLEAR':   ('S125', 'BE'),   # OFI, Belgium
    'LCH':         ('S125', 'GB'),   # OFI (CCP), United Kingdom
}
```

#### 3.2.4 Derivatives → MMIF Section 4.2

**Source:** `dataSubLedgerTrans` (forwards, swaps) + `dataSubLedgerPosition` (futures, options)

| TB Category | Eagle GL Pattern | MMIF Section | Key Mapping Notes |
|------------|-----------------|-------------|------------------|
| Forward Cost Rec | `1007001100` | 4.2 (asset if positive) | ABS(fwdBookValue); report one row per contract |
| Forward Cost Pay | `2005002900` | 4.2 (liability if negative) | ABS(fwdBookValue) × −1 |
| Forward URGL BS | `1011000201` | N/A | **CBI derives** |
| Forward URGL INCST | `4004000401` | N/A | **CBI derives** |
| Futures Margin | Futures GL accounts | 4.2 | ltdVariationMarginBase; notional amount mandatory |
| Future URGL INCST | `3003000500` | N/A | **CBI derives** |

**Derivative classification:**

| Eagle Security Type | MMIF Derivative Type | Long/Short Rule |
|--------------------|---------------------|----------------|
| FWD (FX Forward) | FX Forward | Long the bought currency leg |
| IRS (Interest Rate Swap) | Interest Rate Swap | Long the floating leg ONLY if other leg is fixed |
| CDS (Credit Default Swap) | Credit Default Swap | Long = protection buyer |
| OPT (Option) | Option | Long = holder; Short = writer |
| FUT (Future) | Listed Future | Long = positive contract position |

> **NOTE on swaps:** Per CBI worked examples, the long/short field (4.2.6.3) is only filled where the fund is long or short just one leg and the other leg represents fixed payments. If neither leg is fixed, leave blank.

#### 3.2.5 Securities Lending/Borrowing → MMIF Sections 3.4 & 5.2

**Source:** `dataSubLedgerTrans` WHERE transCode indicates repo/reverse repo/sec lending

| Flow | Eagle GL | MMIF Section | MMIF Treatment |
|------|----------|-------------|----------------|
| Reverse repo (cash out, securities in) | `eagleRecPayLedger` (RPR) | 3.4 (A-Securities Borrowing) | Cash = loan asset; securities received = OFF balance sheet |
| Repo (cash in, securities out) | Repo liability GL | 5.2 (L-Securities Lending) | Cash = deposit liability; securities lent = OFF balance sheet |
| Securities lent out | Equities/Debt worksheets (3.1.3/3.2.3) | 3.1.3 / 3.2.3 (totals only) | **Do NOT include in total assets** |
| Securities borrowed | Section 3.4 | 3.4 (totals only) | **Do NOT include in total assets** |
| Rehypothecation | Section 3.4 (additional totals) | 3.4 | Short sales of borrowed securities + re-collateralization |

> **COMMON BREAK:** Eagle may record securities lending collateral as both a position AND a cash movement, causing double-counting in total assets. The MMIF explicitly excludes securities from totals — only the cash element counts. Validation rule VR-013 catches this.

### 3.3 Liability Mappings

#### 3.3.1 Fund Shares/Units → MMIF Section 5.1

**Source:** `dataNav` (subscriptionBalance, redemptionBalance, reinvestedDistribution)

This is where investor flow data lives — the data the CBI uses to strip investor noise.

| Field | Eagle Source (dataNav) | MMIF Field | Sign Convention |
|-------|----------------------|-----------|----------------|
| Opening shares outstanding | Prior quarter closing | 5.1 Opening Position | Positive |
| Issues (subscriptions) | subscriptionBalance | 5.1 Purchases (Issues) | Positive |
| Redemptions | redemptionBalance | 5.1 Sales (Redemptions) | Positive |
| Reinvested distributions | reinvestedDistribution | 5.1 Purchases (Issues) | Positive (added to issues) |
| Closing shares outstanding | Current quarter end | 5.1 Closing Position | Positive |

**Investor sector/country breakdown:**

The MMIF requires issues and redemptions broken down by investor sector (ESA 2010) and country. This data comes from the Transfer Agent (TA) system, not Eagle. The module must source this from TA feed data or a supplementary investor classification table.

```python
# Investor classification for MMIF 5.1 breakdown
# Required: sector + country for each subscription/redemption
INVESTOR_SECTORS = {
    'S11':  'Non-financial corporations',
    'S121': 'Central bank',
    'S122': 'Deposit-taking corporations (MFI)',
    'S123': 'Money market funds (MFI)',
    'S124': 'Non-MMF investment funds',
    'S125': 'Other financial intermediaries',
    'S126': 'Financial auxiliaries',
    'S127': 'Captive financial institutions',
    'S128': 'Insurance corporations',
    'S129': 'Pension funds',
    'S13':  'General government',
    'S14':  'Households',
    'S15':  'Non-profit institutions',
    'S2':   'Rest of world',
}
```

#### 3.3.2 Other Liabilities → MMIF Section 5.3–5.5

| TB Category | Eagle GL Pattern | MMIF Section | Key Mapping Notes |
|------------|-----------------|-------------|------------------|
| Expense RecPay | Expense payable GLs | 5.4 (Accrued Expenses) | Aggregate option: no s-by-s required |
| Dist Payable | `2006000700` | 5.5 (Other Liabilities) | distributionPayable × −1 |
| Bank Overdrafts | Overdraft GL accounts | 4.1 (A&L Overdraft) | Cannot net against positive cash (MMIF A.10) |
| Loan Liabilities | Loan liability GLs | 5.3 (Loan Liabilities) | Maturity date + counterparty sector/country required |

### 3.4 P&L Mappings → MMIF Section 2

**Source:** `dataLedger` WHERE LEFT(eagleLedgerAcct, 1) IN ('3', '4') — P&L accounts

| Eagle P&L Category | Eagle GL Pattern | MMIF Section 2 Item | Accrual Treatment | Key Mapping Notes |
|-------------------|-----------------|--------------------|--------------------|------------------|
| Dividend Income | `3003000xxx` income accounts | Realized Income | Accruals basis, **quarter-only** | Must match sum of security-level dividends in 3.1.5 |
| Interest Income (Bonds) | `3003000xxx` interest accounts | Realized Income | Accruals basis, **quarter-only** | Cross-check: consistent with clean/dirty price differential |
| Interest Income (Deposits) | Cash interest accounts | Realized Income | Accruals basis, **quarter-only** | Tie to deposit accrued interest in 3.5 or 3.6 |
| Rental Income | Property income accounts | Realized Income | Accruals basis, **quarter-only** | Property funds only; tie to 3.3 |
| Realized Gains/Losses | `3003000xxx` realized G/L | Realized Capital G/L | Per-security: sale proceeds − cost basis | Captured in transaction flows, NOT market movements |
| Unrealized Gains/Losses | `3003000301`, `1011000101` | **NOT REPORTED** | N/A | **CBI derives from balance sheet identity** |
| FX Gains/Losses | FX G/L accounts | **NOT REPORTED** | N/A | **CBI derives from FX rate movements on positions** |
| Management Fees | Expense accounts | Expenses | Quarter accrual (**not YTD**) | Must tie to 5.4 accrued expense balance |
| Performance Fees | Expense accounts | Expenses | Quarter accrual (**not YTD**) | Watch crystallization timing |
| Other Expenses | Other expense accounts | Expenses | Quarter accrual (**not YTD**) | Custody, admin, audit, legal, etc. |

> **CRITICAL — YTD TO QUARTERLY CONVERSION:**
> 
> Eagle's default P&L reports are **YTD cumulative**. The MMIF requires **quarter-only** figures. 
> 
> ```python
> mmif_quarter_pl = eagle_ytd_current_quarter - eagle_ytd_prior_quarter
> ```
> 
> Failure to perform this conversion is the #1 most common MMIF submission error for Eagle-based fund administrators. Validation rule VR-010 catches this by comparing the MMIF P&L figure against the TB quarter-only movement.

---

## 4. Validation Rules

### 4.1 Rule Definitions

Each rule has a severity: **Hard** (must pass for submission), **Soft** (warning for review), **Derived** (validates CBI's own logic), **Advisory** (data quality flag).

| Rule ID | Name | Description | Severity | Tolerance | Break Action |
|---------|------|-------------|----------|-----------|-------------|
| VR-001 | Total Assets Tie-Out | MMIF 4.3 Total Assets = TB Total Assets (base CCY) | Hard | 0.00 | Block submission |
| VR-002 | Equity Subtotal | Sum(3.1 closing) = TB equity account group | Hard | 0.01 | Per-security rounding |
| VR-003 | Debt Subtotal | Sum(3.2 closing) = TB fixed income group | Hard | 0.01 | Clean price basis |
| VR-004 | Cash Subtotal | Sum(3.5 closing) = TB cash/deposit group | Hard | 0.00 | Exact match |
| VR-005 | Derivative Net | Sum(4.2 net MtM) = TB derivative asset − liability | Soft | 0.05 | OTC netting |
| VR-006 | Opening = Prior Closing | Each security: MMIF opening = prior Q MMIF closing | Hard | 0.00 | Flags restatements |
| VR-007 | Balance Identity | Opening + Purchases − Sales + Valuation = Closing (per security) | Derived | N/A | CBI derives valuation |
| VR-008 | Accrued Income | 3.6 or line-level = TB accrued income accounts | Soft | 0.02 | Timing differences |
| VR-009 | Fund Shares/Units | 5.1 closing = TB shares outstanding × NAV per unit | Hard | 0.01 | Ties to TA records |
| VR-010 | P&L Quarter-Only | Section 2 = TB Q-only P&L (not YTD) | Hard | 0.01 | Eagle YTD trap |
| VR-011 | FX Consistency | All positions: FX rate at Q-end applied consistently | Soft | 0.10 | Rate source mismatch |
| VR-012 | ISIN Coverage | % of positions with valid ISIN | Advisory | >95% | Flag internal codes |
| VR-013 | Sec Lending Off-BS | 3.4/5.2 securities NOT in total assets/liabilities | Hard | 0.00 | Double-counting |
| VR-014 | Short Position Sign | Shorts = negative assets; transactions still positive | Hard | N/A | Eagle short flag |
| VR-015 | Investor Decomposition | ΔNAV = valuation + FX + net flows + income | Derived | 0.05 | Capstone check |

### 4.2 Rule Implementation

```python
from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import Optional

class Severity(Enum):
    HARD = "hard"           # Must pass for CBI submission
    SOFT = "soft"           # Warning for reviewer
    DERIVED = "derived"     # Validates CBI derivation logic
    ADVISORY = "advisory"   # Data quality flag

class BreakStatus(Enum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    INFO = "info"

@dataclass
class ValidationResult:
    rule_id: str
    rule_name: str
    severity: Severity
    status: BreakStatus
    lhs_value: Decimal
    rhs_value: Decimal
    difference: Decimal
    tolerance: Decimal
    message: str
    mmif_section: Optional[str] = None
    eagle_gl_pattern: Optional[str] = None
    
@dataclass
class MmifValidationContext:
    """
    Context assembled for a single fund's MMIF validation run.
    Mirrors the existing RECON-AI validation execution sequence
    (Process Flow Spec Section 7.1) with MMIF-specific extensions.
    """
    valuation_dt: str            # Quarter-end date
    account: str                 # Fund portfolio account
    account_base_currency: str   # From xrefAccount.accountBaseCurrency
    mmif_data: dict              # Parsed MMIF return (XML or Excel)
    tb_data: dict                # Trial balance from dataLedger
    positions: list              # From dataSubLedgerPosition
    transactions: list           # From dataSubLedgerTrans
    nav_data: dict               # From dataNav
    prior_mmif: Optional[dict]   # Prior quarter MMIF for VR-006
```

### 4.3 VR-015: Investor Decomposition Check (Capstone)

This is the check that proves the MMIF correctly separates portfolio return from investor noise:

```python
def validate_investor_decomposition(ctx: MmifValidationContext) -> ValidationResult:
    """
    VR-015: Validates the four-component NAV identity.
    
    ΔNAV = ΔValuation(market+FX) + Net Investor Flows + Net Income
    
    Where:
    - ΔNAV = MMIF 4.3 closing total assets - MMIF 4.3 opening total assets
    - Net Investor Flows = MMIF 5.1 issues - MMIF 5.1 redemptions
    - Net Income = MMIF Section 2 total income - total expenses
    - ΔValuation = residual (what CBI derives)
    
    The check: ΔNAV - Net Investor Flows - Net Income = ΔValuation
    Then validate ΔValuation is reasonable given market movements.
    """
    mmif = ctx.mmif_data
    
    # Extract components
    delta_nav = mmif['section_4_3']['closing_total_assets'] - mmif['section_4_3']['opening_total_assets']
    net_flows = mmif['section_5_1']['total_issues'] - mmif['section_5_1']['total_redemptions']
    net_income = mmif['section_2']['total_income'] - mmif['section_2']['total_expenses']
    
    # Derived valuation change (what CBI calculates)
    derived_valuation = delta_nav - net_flows - net_income
    
    # Cross-check: sum of per-security (closing - opening - purchases + sales) 
    # should equal derived_valuation
    security_level_valuation = Decimal('0')
    for sec in mmif['section_3_1']['securities'] + mmif['section_3_2']['securities']:
        sec_val = (
            sec['closing_position'] 
            - sec['opening_position'] 
            - sec.get('purchases', Decimal('0')) 
            + sec.get('sales', Decimal('0'))
        )
        security_level_valuation += sec_val
    
    difference = abs(derived_valuation - security_level_valuation)
    tolerance = Decimal('0.05')
    
    return ValidationResult(
        rule_id='VR-015',
        rule_name='Investor Decomposition',
        severity=Severity.DERIVED,
        status=BreakStatus.PASS if difference <= tolerance else BreakStatus.WARNING,
        lhs_value=derived_valuation,
        rhs_value=security_level_valuation,
        difference=difference,
        tolerance=tolerance,
        message=(
            f"NAV decomposition: ΔNAV={delta_nav}, Flows={net_flows}, "
            f"Income={net_income}, Derived Valuation={derived_valuation}. "
            f"Security-level valuation sum={security_level_valuation}. "
            f"Difference={difference}."
        ),
        mmif_section='4.3 / 5.1 / 2',
    )
```

---

## 5. Agent Pipeline Architecture

### 5.1 Overview

Six LangGraph agents execute sequentially. Each agent is a node with defined inputs/outputs. The pipeline integrates into the existing RECON-AI validation execution sequence (Process Flow Spec Section 7.1) as validation checks 7–12 (extending the existing 1–6).

```
┌─────────────────┐
│  Agent 1:        │     Eagle CoA + MMIF Taxonomy
│  Schema Mapper   │──→  Mapping Table: GL → MMIF Section
└────────┬────────┘
         │
┌────────▼────────┐
│  Agent 2:        │     Eagle TB + Mapping Table
│  Balance         │──→  MMIF-aligned balance set
│  Extractor       │     (opening, closing, movements per bucket)
└────────┬────────┘
         │
┌────────▼────────┐
│  Agent 3:        │     MMIF Return (XML or XLSX)
│  MMIF Parser     │──→  Structured MMIF data
└────────┬────────┘
         │
┌────────▼────────┐
│  Agent 4:        │     Balance set + MMIF data + VR-001..VR-015
│  Reconciliation  │──→  Break report: matched/unmatched/explained
│  Engine          │
└────────┬────────┘
         │
┌────────▼────────┐
│  Agent 5:        │     Break report + Neo4j patterns + market data
│  Break Analyst   │──→  Root cause analysis + confidence scores
│  (LLM-powered)   │
└────────┬────────┘
         │
┌────────▼────────┐
│  Agent 6:        │     Full results + break explanations
│  Attestation     │──→  Audit-ready attestation report
│  Generator       │     (ContextSubstrate governance gate)
└─────────────────┘
```

### 5.2 Agent 1: Schema Mapper (This Spec's Primary Deliverable)

**Purpose:** Maps fund-specific Eagle GL chart of accounts to MMIF sections.

**Inputs:**
- Eagle chart of accounts export (from `xrefAccount.chartOfAccounts`)
- MMIF taxonomy definition (XML schema from CBI)
- Fund prospectus metadata (fund type from `eagleEntity`)
- Canonical mapping table (Section 3 of this document)

**Outputs:**
- `MmifMappingConfig`: JSON configuration mapping each Eagle GL account to its MMIF section, instrument type, code type, and any transformation rules.

**Implementation approach:**
1. Start with the canonical mapping (Section 3 above) as the base config
2. For each fund, load its specific Eagle chart of accounts
3. Match GL accounts to canonical patterns using prefix matching on `eagleLedgerAcct`
4. For unmatched accounts, use LLM to classify based on GL description + fund type
5. Output a per-fund mapping config that the Balance Extractor consumes

```python
@dataclass
class MmifFieldMapping:
    """Single mapping from Eagle GL to MMIF field."""
    eagle_gl_pattern: str           # eagleLedgerAcct pattern or exact match
    eagle_source_table: str         # dataLedger | dataSubLedgerPosition | dataNav | etc.
    eagle_source_field: str         # The field to extract
    mmif_section: str               # e.g., '3.1', '3.2', '4.2', '5.1'
    mmif_field: str                 # e.g., 'closing_position', 'purchases'
    instrument_type: Optional[int]  # MMIF instrument type code (equities/debt)
    code_type: int                  # 1=ISIN, 2=SEDOL, 3=CUSIP, 4=Internal
    transformation: Optional[str]   # CEL expression for value transformation
    sign_convention: int            # 1=positive, -1=negate
    is_reported: bool               # True if reported to CBI; False if CBI derives
    notes: str                      # Human-readable mapping notes

@dataclass
class MmifMappingConfig:
    """Complete mapping config for a single fund."""
    account: str
    fund_type: str                  # UCITS, AIF, MMF, Hedge, etc.
    base_currency: str
    mappings: list[MmifFieldMapping]
    counterparty_enrichment: dict   # bank_id → (sector, country)
    investor_classification: dict   # For 5.1 sector/country breakdown
    unmapped_accounts: list[str]    # GL accounts with no MMIF mapping (flagged for review)
```

### 5.3 Agent 2: Balance Extractor

**Purpose:** Pulls Eagle TB data and applies Schema Mapper output to produce MMIF-aligned balances.

**Key operations:**
1. Extract `dataLedger` for the reporting quarter (opening + closing + movements)
2. Extract `dataSubLedgerPosition` for security-level positions
3. Extract `dataNav` for NAV/subscription/redemption data
4. Apply `MmifMappingConfig` to route each balance to MMIF sections
5. **Perform YTD→Quarter conversion for P&L** (critical for VR-010)
6. **Decompose dirty→clean price for debt** (critical for Section 3.2)
7. Output MMIF-aligned balance set ready for reconciliation

### 5.4 Agent 3: MMIF Parser

**Purpose:** Parses the MMIF return file (XML or Excel) into structured data.

**Design:** XML-first with Excel legacy adapter. The CBI is moving to XML from February 2026, so the parser must handle the new CBI/ECB XML taxonomy as the primary format.

```python
class MmifParser:
    """
    Parses MMIF returns into canonical internal representation.
    XML-first design; Excel adapter for legacy returns.
    """
    
    def parse(self, file_path: str) -> MmifReturn:
        if file_path.endswith('.xml'):
            return self._parse_xml(file_path)
        elif file_path.endswith(('.xlsx', '.xls')):
            return self._parse_excel(file_path)
        else:
            raise ValueError(f"Unsupported MMIF file format: {file_path}")
    
    def _parse_xml(self, path: str) -> MmifReturn:
        """Parse CBI/ECB taxonomy XML. Primary format from Feb 2026."""
        # Validate against CBI schema before parsing
        # Extract all sections into MmifReturn dataclass
        pass
    
    def _parse_excel(self, path: str) -> MmifReturn:
        """Parse legacy Excel template. Adapter for pre-2026 returns."""
        # Read worksheets: 3.1 A-Equities, 3.2 A-Debt, etc.
        # Map Excel column positions to MmifReturn fields
        pass

@dataclass
class MmifReturn:
    """Canonical representation of a parsed MMIF return."""
    fund_code: str              # CBI C-code
    admin_code: str             # CBI C-code for administrator
    quarter: str                # e.g., '2026Q1'
    base_currency: str
    section_1_register: dict    # Fund metadata
    section_2_pl: dict          # P&L data (quarter-only)
    section_3_1_equities: list  # Security-by-security equity positions
    section_3_2_debt: list      # Security-by-security debt positions
    section_3_3_property: list  # Property assets
    section_3_4_sec_borrowing: list  # Securities borrowing
    section_3_5_cash: list      # Cash, deposits, loans
    section_3_6_accrued_income: list  # Accrued income (if aggregate option)
    section_3_7_other_assets: list
    section_4_1_overdrafts: list
    section_4_2_derivatives: list
    section_4_3_totals: dict    # Total assets and liabilities
    section_5_1_fund_shares: dict  # Issues, redemptions by sector/country
    section_5_2_sec_lending: list
    section_5_3_loan_liabilities: list
    section_5_4_accrued_expenses: list
    section_5_5_other_liabilities: list
```

### 5.5 Agent 4: Reconciliation Engine

**Purpose:** Multi-level matching applying VR-001 through VR-015.

**Execution sequence (extends existing Process Flow Spec 7.1):**

| Order | Check | Screen | LHS → RHS |
|-------|-------|--------|----------|
| 7 | MMIF Total Assets (VR-001) | MMIF Dashboard | MMIF 4.3 → TB total assets |
| 8 | MMIF Category Subtotals (VR-002..VR-005) | MMIF Dashboard | MMIF section totals → TB account groups |
| 9 | MMIF Security Match (VR-006, VR-012, VR-014) | MMIF Positions | MMIF line items → TB positions by ISIN |
| 10 | MMIF Movement Reconciliation (VR-007, VR-010) | MMIF Movements | MMIF transactions → TB period activity |
| 11 | MMIF Cross-Checks (VR-008, VR-009, VR-011, VR-013) | MMIF Cross-Check | Cross-section consistency |
| 12 | MMIF Investor Decomposition (VR-015) | MMIF Summary | Four-component NAV identity |

### 5.6 Agent 5: Break Analyst (LLM-Powered)

**Purpose:** Root cause analysis using GraphRAG and the existing break pattern taxonomy.

**Integration with Known Differences taxonomy:**

The existing Known Differences framework (from the ACE Fund Onboarding workbook) maps directly to MMIF break archetypes:

| KD Code | Type | Summary | MMIF Impact |
|---------|------|---------|-------------|
| KD 1 | Methodology | Spot FX | FX rate source mismatch → VR-011 break |
| KD 2 | Methodology | Forward FX | Forward points calculation difference → VR-005 |
| KD 3 | Methodology | Futures Pricing | Futures settlement price source → VR-005 |
| KD 4 | Methodology | Bond Pricing | Clean vs dirty, pricing matrix → VR-003 |
| KD 5 | Methodology | Expenses | Expense accrual methodology → VR-010 |
| SC 1–8 | Processing | Various | Transaction timing, missing trades, etc. |

**Break categories for MMIF:**

| Category | Description | Resolution Owner | MMIF Rules Affected |
|----------|------------|-----------------|-------------------|
| Known Difference | Expected methodology difference (KD1–5) | Acknowledge, no action | VR-003, VR-005, VR-010, VR-011 |
| BNY to Resolve | BNY data issue | BNY NAV Ops | VR-001..VR-004, VR-009 |
| Incumbent to Resolve | Incumbent data issue | Incumbent admin | VR-006, VR-008 |
| Under Investigation | Root cause unknown | Conversion recon lead | Any |
| Match | No break | N/A | Pass |

### 5.7 Agent 6: Attestation Generator

**Purpose:** Produces structured attestation for audit trail and CBI submission evidence.

**Output format:**

```json
{
  "attestation_id": "MMIF-ATT-2026Q1-AC0001",
  "fund": "AC0001",
  "quarter": "2026Q1",
  "submission_date": "2026-04-15",
  "validation_summary": {
    "total_rules": 15,
    "passed": 13,
    "warnings": 1,
    "failed": 1,
    "hard_failures": 0
  },
  "submission_clearance": true,
  "breaks": [
    {
      "rule_id": "VR-011",
      "severity": "soft",
      "status": "warning",
      "difference": 0.08,
      "root_cause": "FX rate source mismatch (KD1): Eagle uses WMR 4pm fix, MMIF uses ECB reference rate",
      "confidence": 0.94,
      "resolution": "Known Difference - acknowledged"
    }
  ],
  "investor_decomposition": {
    "delta_nav": 1250000.00,
    "valuation_market": 890000.00,
    "valuation_fx": 35000.00,
    "net_investor_flows": 280000.00,
    "net_income": 45000.00,
    "status": "PASS"
  },
  "reviewer": null,
  "approved": false
}
```

**ContextSubstrate governance gate:**

The attestation integrates as a required gate in the CBI submission CI/CD pipeline. If any Hard rule fails, the gate blocks submission and routes to the designated reviewer per the Reviewer Allocation table (from ACE Fund Onboarding workbook).

---

## 6. MMIF Filing Requirements Summary

### 6.1 Key Deadlines (2026 Regime)

| Fund Type | Reporting Frequency | Deadline | Format |
|-----------|-------------------|----------|--------|
| Money Market Funds | Monthly (from Feb 2026) | T+8 business days | XML |
| Investment Funds | Quarterly (H1 2026), Monthly (from Jul 2026) | T+12 business days | XML |
| AML REQ (2024) | One-off | 27 Feb 2026 | XML |
| AML REQ (2025+) | Annual | Aug 2026, then annual | XML |

### 6.2 Filing Population

All Irish-domiciled funds classified as Investment Funds that have completed at least one non-zero monthly NAV return in a calendar quarter. Includes UCITS, AIFs, hedge funds, and MMFs. Only sub-funds report — NOT umbrella funds. Non-resident funds administered in Ireland do NOT report.

### 6.3 Penalties

Failure to submit accurately and on time: fines up to €200,000.

### 6.4 Key CBI Validation Behaviors

- The CBI's XML schema includes **reasonableness checks** that reject inconsistent data
- **Opening position must match prior quarter closing** — any discrepancy requires explanation
- CBI validates the **balance identity** (opening + transactions ± valuation = closing) per security
- All dates must be **DD/MM/YYYY** — American date formatting is rejected
- ISIN codes mandatory where available; internal codes only as last resort
- All amounts in **single units** (actual monetary amount, not thousands/millions)
- Up to **two decimal places** permitted

---

## 7. Implementation Roadmap

### Phase 1: Schema Mapper + Balance Extractor (Weeks 1–4)

- [ ] Implement `MmifMappingConfig` data model
- [ ] Build canonical mapping table from Section 3
- [ ] Implement GL pattern matching against `eagleLedgerAcct`
- [ ] Build LLM-assisted classification for unmapped accounts
- [ ] Implement Balance Extractor with YTD→Quarter conversion
- [ ] Implement dirty→clean price decomposition for debt
- [ ] Unit tests against sample Eagle TB data

### Phase 2: MMIF Parser + Reconciliation Engine (Weeks 5–8)

- [ ] Implement XML parser for CBI/ECB taxonomy
- [ ] Implement Excel parser for legacy format
- [ ] Build reconciliation engine executing VR-001 through VR-015
- [ ] Integrate with existing RECON-AI validation sequence (checks 7–12)
- [ ] Build MMIF-specific dashboard screens

### Phase 3: AI Analysis + Attestation (Weeks 9–12)

- [ ] Integrate break analyst with existing Known Differences taxonomy
- [ ] Build GraphRAG patterns for MMIF-specific break archetypes
- [ ] Implement attestation generator with ContextSubstrate gate
- [ ] Build Reviewer Allocation integration
- [ ] End-to-end testing with pilot funds

### Phase 4: Production + Geneva/InvestOne Expansion (Weeks 13–16)

- [ ] Production hardening and monitoring
- [ ] Expand Schema Mapper for Geneva chart of accounts
- [ ] Expand Schema Mapper for InvestOne chart of accounts
- [ ] Cross-client benchmarking: investor-stripped portfolio returns
- [ ] CBI schema update monitoring and auto-adaptation

---

## 8. File & Module Structure

```
recon-ai/
├── src/
│   ├── mmif/
│   │   ├── __init__.py
│   │   ├── models.py              # MmifMappingConfig, MmifReturn, ValidationResult
│   │   ├── schema_mapper.py       # Agent 1: Eagle GL → MMIF section mapping
│   │   ├── balance_extractor.py   # Agent 2: TB extraction + MMIF alignment
│   │   ├── mmif_parser.py         # Agent 3: XML/Excel parsing
│   │   ├── reconciliation.py      # Agent 4: VR-001..VR-015 execution
│   │   ├── break_analyst.py       # Agent 5: LLM break analysis
│   │   ├── attestation.py         # Agent 6: Report generation
│   │   ├── mappings/
│   │   │   ├── eagle_canonical.json    # Base Eagle → MMIF mapping table
│   │   │   ├── instrument_types.json   # MMIF instrument type classification
│   │   │   ├── sector_codes.json       # ESA 2010 sector codes
│   │   │   ├── country_codes.json      # ISO country codes
│   │   │   └── counterparty_enrichment.json
│   │   ├── schemas/
│   │   │   ├── cbi_mmif_taxonomy.xsd   # CBI XML schema
│   │   │   └── ecb_if_reporting.xsd    # ECB base schema
│   │   └── tests/
│   │       ├── test_schema_mapper.py
│   │       ├── test_balance_extractor.py
│   │       ├── test_mmif_parser.py
│   │       ├── test_reconciliation.py
│   │       ├── test_investor_decomposition.py
│   │       └── fixtures/
│   │           ├── sample_eagle_tb.json
│   │           ├── sample_mmif_return.xml
│   │           └── sample_mmif_return.xlsx
│   └── ...existing recon-ai modules...
```

---

## 9. Dependencies & Integration Points

### 9.1 Existing RECON-AI Dependencies

| Component | Integration |
|-----------|-----------|
| `dataLedger` queries | Reuse existing TB extraction; add MMIF section annotations |
| `derivedSubLedgerRollup` | Extend with MMIF section column; no logic changes |
| Validation execution sequence | Append checks 7–12 after existing 1–6 |
| Known Differences taxonomy | Map KD1–KD5 and SC1–SC8 to MMIF break archetypes |
| Reviewer Allocation | Reuse existing allocation table for MMIF attestation routing |
| GraphRAG / Neo4j | Add MMIF break pattern nodes to existing break pattern graph |
| ContextSubstrate | Register MMIF attestation as governance gate |

### 9.2 New External Dependencies

| Dependency | Purpose | Notes |
|-----------|---------|-------|
| CBI XML schema (XSD) | MMIF return validation | Download from CBI statistics portal; monitor for updates |
| ECB CSDB | Security reference data (ISIN → country, sector) | Via ISIN lookup; enriches MMIF reporting fields |
| Transfer Agent feed | Investor sector/country classification for 5.1 | Supplementary data not in Eagle |
| Market data feed | Reasonableness check for derived valuations | Optional but recommended for VR-015 |

---

## 10. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **View layer over canonical model** — no new tables | MMIF mapping is a transformation, not new data; keeps schema clean |
| **XML-first parser** — Excel as legacy adapter | CBI moving to XML Feb 2026; future-proof the implementation |
| **CEL for transformation rules** — matches existing RECON-AI pattern | Human-reviewable, non-Turing-complete; AI agents can generate safely |
| **Per-fund mapping config** — not one-size-fits-all | Eagle chart of accounts varies by fund; Schema Mapper adapts per fund |
| **Unrealized NOT reported** — critical design constraint | CBI derives valuation changes; the module must ensure components are correct so the derivation works |
| **YTD→Quarter conversion as explicit step** — not implicit | #1 error source; making it an explicit, auditable transformation prevents the most common submission failure |
| **Governance gate** — attestation blocks submission on Hard failures | Regulatory risk: €200K fine for incorrect/late submission |
