"""
Seed MongoDB with sample data matching the canonical data model.

Creates:
- Reference data (refFund, refSecurity, refLedger, refTransCode, refSecType)
- Events with funds (matching the existing mock data structure)
- Canonical data for CPU and Incumbent systems:
  - navSummary, ledger, dataSubLedgerPosition, dataSubLedgerTrans, dataDailyTransactions
- Intentional variances between CPU and Incumbent to produce breaks during validation
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from config.settings import settings
from db.mongodb import COLLECTIONS


def seed_database():
    client = MongoClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB]

    print("🗑️  Clearing existing data...")
    for coll_name in COLLECTIONS.values():
        db[coll_name].drop()

    print("📦 Seeding reference data...")
    seed_reference_data(db)

    print("📦 Seeding ledger-subledger reference data...")
    seed_ledger_subledger_reference_data(db)

    print("📦 Seeding events...")
    seed_events(db)

    print("📦 Seeding canonical data (CPU + Incumbent)...")
    seed_canonical_data(db)

    print("📦 Seeding GL Account Mapping reference data...")
    seed_gl_account_mapping_data(db)

    print("📦 Seeding Classification Mapping data...")
    seed_classification_mapping_data(db)

    print("✅ Seed complete!")
    client.close()


# ══════════════════════════════════════════════════════════════
# Reference Data
# ══════════════════════════════════════════════════════════════

def seed_reference_data(db):
    # refFund
    funds = [
        {"account": "VG-BOND-IDX", "accountName": "VG Bond Index"},
        {"account": "VG-CORP-BOND", "accountName": "VG Corp Bond"},
        {"account": "VG-HIGH-YIELD", "accountName": "VG High Yield"},
        {"account": "VG-TREASURY", "accountName": "VG Treasury"},
        {"account": "VG-TIPS", "accountName": "VG Inflation-Protected"},
        {"account": "VG-INTL-BOND", "accountName": "VG International Bond"},
        {"account": "FID-GROWTH", "accountName": "Fidelity Growth"},
        {"account": "FID-VALUE", "accountName": "Fidelity Value"},
        {"account": "FID-BALANCED", "accountName": "Fidelity Balanced"},
        {"account": "TRP-BLUE-CHIP", "accountName": "T. Rowe Blue Chip Growth"},
        {"account": "TRP-INTL-STOCK", "accountName": "T. Rowe Intl Stock"},
        {"account": "TRP-NEW-INCOME", "accountName": "T. Rowe New Income"},
        {"account": "TRP-SCIENCE", "accountName": "T. Rowe Science & Tech"},
        {"account": "TRP-MONEY-MKT", "accountName": "T. Rowe Money Market"},
        {"account": "AF-GROWTH-AM", "accountName": "Growth Fund of America"},
        {"account": "AF-INCOME", "accountName": "American Income Fund"},
    ]
    db[COLLECTIONS["refFund"]].insert_many(funds)

    # refLedger
    ledger_accounts = [
        {"glAccountNumber": "1000", "glDescription": "Investment at Market", "glCategory": "ASSET"},
        {"glAccountNumber": "1100", "glDescription": "Cash and Equivalents", "glCategory": "ASSET"},
        {"glAccountNumber": "1200", "glDescription": "Receivables", "glCategory": "ASSET"},
        {"glAccountNumber": "1300", "glDescription": "Accrued Income", "glCategory": "ASSET"},
        {"glAccountNumber": "2000", "glDescription": "Payables", "glCategory": "LIABILITY"},
        {"glAccountNumber": "2100", "glDescription": "Distribution Payable", "glCategory": "LIABILITY"},
        {"glAccountNumber": "3000", "glDescription": "Net Assets", "glCategory": "EQUITY"},
        {"glAccountNumber": "3100", "glDescription": "Capital Stock", "glCategory": "EQUITY"},
        {"glAccountNumber": "4000", "glDescription": "Investment Income", "glCategory": "INCOME"},
        {"glAccountNumber": "4100", "glDescription": "Realized Gains", "glCategory": "INCOME"},
        {"glAccountNumber": "5000", "glDescription": "Management Fees", "glCategory": "EXPENSE"},
        {"glAccountNumber": "5100", "glDescription": "Custody Fees", "glCategory": "EXPENSE"},
    ]
    db[COLLECTIONS["refLedger"]].insert_many(ledger_accounts)

    # refSecType
    sec_types = [
        {"secType": "EQUITY", "secTypeDescription": "Common Stock"},
        {"secType": "BOND", "secTypeDescription": "Corporate Bond"},
        {"secType": "GOVT", "secTypeDescription": "Government Bond"},
        {"secType": "MBS", "secTypeDescription": "Mortgage-Backed Security"},
        {"secType": "FX_FWD", "secTypeDescription": "Foreign Exchange Forward"},
    ]
    db[COLLECTIONS["refSecType"]].insert_many(sec_types)

    # refTransCode
    trans_codes = [
        {"transCode": "BUY", "transCodeDescription": "Purchase"},
        {"transCode": "SELL", "transCodeDescription": "Sale"},
        {"transCode": "DIV", "transCodeDescription": "Dividend"},
        {"transCode": "INT", "transCodeDescription": "Interest"},
        {"transCode": "MAT", "transCodeDescription": "Maturity"},
    ]
    db[COLLECTIONS["refTransCode"]].insert_many(trans_codes)

    # refSecurity — securities used across funds
    securities = [
        {
            "assetId": "789456123", "valuationDt": "2026-02-07", "userBank": "CPU",
            "cusip": "789456123", "secType": "BOND", "issueDescription": "XYZ Corp 4.5% 2030",
            "assetCurrency": "USD", "countryCode": "US", "couponRate": 0.045,
            "dayCount": "ACT/ACT", "maturityDt": "2030-06-15", "paymentFrequency": "S",
        },
        {
            "assetId": "456789012", "valuationDt": "2026-02-07", "userBank": "CPU",
            "cusip": "456789012", "secType": "BOND", "issueDescription": "ABC Inc 3.75% 2028",
            "assetCurrency": "USD", "countryCode": "US", "couponRate": 0.0375,
            "dayCount": "30/360", "maturityDt": "2028-03-01", "paymentFrequency": "S",
        },
        {
            "assetId": "111222333", "valuationDt": "2026-02-07", "userBank": "CPU",
            "cusip": "111222333", "secType": "BOND", "issueDescription": "DEF Ltd 5.0% 2032",
            "assetCurrency": "USD", "countryCode": "US", "couponRate": 0.05,
            "dayCount": "ACT/ACT", "maturityDt": "2032-09-01", "paymentFrequency": "S",
        },
        {
            "assetId": "321654987", "valuationDt": "2026-02-07", "userBank": "CPU",
            "cusip": "321654987", "secType": "BOND", "issueDescription": "GHI Corp FRN 2027",
            "assetCurrency": "USD", "countryCode": "US", "couponRate": 0.055,
            "dayCount": "ACT/360", "maturityDt": "2027-12-15", "paymentFrequency": "Q",
        },
        {
            "assetId": "AAPL", "valuationDt": "2026-02-07", "userBank": "CPU",
            "ticker": "AAPL", "secType": "EQUITY", "issueDescription": "Apple Inc",
            "assetCurrency": "USD", "countryCode": "US",
        },
        {
            "assetId": "MSFT", "valuationDt": "2026-02-07", "userBank": "CPU",
            "ticker": "MSFT", "secType": "EQUITY", "issueDescription": "Microsoft Corp",
            "assetCurrency": "USD", "countryCode": "US",
        },
        {
            "assetId": "GOOGL", "valuationDt": "2026-02-07", "userBank": "CPU",
            "ticker": "GOOGL", "secType": "EQUITY", "issueDescription": "Alphabet Inc",
            "assetCurrency": "USD", "countryCode": "US",
        },
        {
            "assetId": "UST10Y", "valuationDt": "2026-02-07", "userBank": "CPU",
            "cusip": "912828ZT6", "secType": "GOVT", "issueDescription": "US Treasury 10Y 3.5%",
            "assetCurrency": "USD", "countryCode": "US", "couponRate": 0.035,
            "dayCount": "ACT/ACT", "maturityDt": "2035-02-15", "paymentFrequency": "S",
        },
    ]
    db[COLLECTIONS["refSecurity"]].insert_many(securities)


# ══════════════════════════════════════════════════════════════
# Ledger to Subledger Reference Data (per spec ledger_subledger.md)
# ══════════════════════════════════════════════════════════════

def seed_ledger_subledger_reference_data(db):
    """
    Seed reference data for Ledger to Subledger validation.
    Categories from Appendix A, GL mappings from Section 3.2.
    """

    # ── Ledger Categories (Appendix A) ────────────────────────
    ledger_categories = [
        {"categoryName": "Cash", "subledgerSupported": True, "primaryDataSource": "Position (CU secType)", "description": "Cash and cash equivalent balances", "displayOrder": 1},
        {"categoryName": "Investment Cost", "subledgerSupported": True, "primaryDataSource": "Position (book value)", "description": "Book/cost value of security positions", "displayOrder": 2},
        {"categoryName": "Holdings Unrealized", "subledgerSupported": True, "primaryDataSource": "Position (unrealized G/L)", "description": "Unrealized gain/loss on positions (BS side)", "displayOrder": 3},
        {"categoryName": "Future Margin", "subledgerSupported": True, "primaryDataSource": "Position (variation margin)", "description": "Futures variation margin and deposits", "displayOrder": 4},
        {"categoryName": "Dividend RecPay", "subledgerSupported": True, "primaryDataSource": "Unsettled transactions", "description": "Accrued dividend receivables", "displayOrder": 5},
        {"categoryName": "Reclaim RecPay", "subledgerSupported": True, "primaryDataSource": "Unsettled transactions", "description": "Tax reclaim receivables", "displayOrder": 6},
        {"categoryName": "Interest RecPay", "subledgerSupported": True, "primaryDataSource": "Position income + unsettled", "description": "Accrued interest receivables/payables", "displayOrder": 7},
        {"categoryName": "Swap Income RecPay", "subledgerSupported": True, "primaryDataSource": "Position income (swaps)", "description": "Accrued swap income", "displayOrder": 8},
        {"categoryName": "Investment RecPay", "subledgerSupported": True, "primaryDataSource": "Unsettled transactions", "description": "Securities sold/purchased receivables/payables", "displayOrder": 9},
        {"categoryName": "Subscription Rec", "subledgerSupported": True, "primaryDataSource": "Capital stock data", "description": "Capital shares receivable", "displayOrder": 10},
        {"categoryName": "Expense RecPay", "subledgerSupported": False, "primaryDataSource": None, "description": "Prepaid/accrued expenses", "displayOrder": 11},
        {"categoryName": "Capital", "subledgerSupported": False, "primaryDataSource": None, "description": "Capital stock balances", "displayOrder": 12},
        {"categoryName": "Realized GL", "subledgerSupported": False, "primaryDataSource": None, "description": "Realized gains/losses", "displayOrder": 13},
        {"categoryName": "Unrealized INCST", "subledgerSupported": True, "primaryDataSource": "Position (unrealized inverse)", "description": "Unrealized gain/loss (Income Statement side)", "displayOrder": 14},
        {"categoryName": "Income", "subledgerSupported": False, "primaryDataSource": None, "description": "Income statement - revenue", "displayOrder": 15},
        {"categoryName": "Expenses", "subledgerSupported": False, "primaryDataSource": None, "description": "Income statement - expenses", "displayOrder": 16},
        {"categoryName": "Distribution Pay", "subledgerSupported": False, "primaryDataSource": None, "description": "Distribution payables", "displayOrder": 17},
    ]
    db["refLedgerCategory"].insert_many(ledger_categories)

    # ── GL Account to Category Mapping (Section 3.2 - InvestOne MUFG) ────
    gl_category_mappings = [
        # Investment Cost - ASSETS
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S0010", "glAccountDescription": "CASH & CASH EQUIVALENTS", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Investment Cost"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S0075", "glAccountDescription": "COMMON STOCKS", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Investment Cost"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S0200", "glAccountDescription": "MUTUAL FUNDS", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Investment Cost"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S6000", "glAccountDescription": "U.S. GOVERNMENT/AGENCY OBLIGATIONS", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Investment Cost"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S0000", "glAccountDescription": "UNCLASSIFIED", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Investment Cost"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S0090", "glAccountDescription": "MISCELLANEOUS ASSETS", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Investment Cost"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S0160", "glAccountDescription": "FOREIGN RIGHTS", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Investment Cost"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S0080", "glAccountDescription": "U.S. GOVERNMENT & AGENCIES", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Investment Cost"},

        # Holdings Unrealized - ASSETS
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S0075URGL", "glAccountDescription": "COMMON STOCKS-URGL", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Holdings Unrealized"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S0200URGL", "glAccountDescription": "MUTUAL FUNDS-URGL", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Holdings Unrealized"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S6000URGL", "glAccountDescription": "U.S. GOVERNMENT/AGENCY OBLIGATIONS-URGL", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Holdings Unrealized"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "1100URGL", "glAccountDescription": "FOREIGN CURRENCY HOLDINGS-URGL", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Holdings Unrealized"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S0000URGL", "glAccountDescription": "UNCLASSIFIED-URGL", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Holdings Unrealized"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S0090URGL", "glAccountDescription": "MISCELLANEOUS ASSETS-URGL", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Holdings Unrealized"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "S0160URGL", "glAccountDescription": "FOREIGN RIGHTS-URGL", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Holdings Unrealized"},

        # Cash - ASSETS
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "1050", "glAccountDescription": "CASH", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Cash"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "1100", "glAccountDescription": "FOREIGN CURRENCY HOLDINGS", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Cash"},

        # Interest RecPay - ASSETS
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "AI0010", "glAccountDescription": "ACCRUED CASH & CASH EQUIVALENTS INCOME", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Interest RecPay"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "AI0080", "glAccountDescription": "ACCRUED U.S. GOVERNMENT & AGENCIES INTEREST", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Interest RecPay"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "1450", "glAccountDescription": "OTHER INCOME RECEIVABLE", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Interest RecPay"},

        # Dividend RecPay - ASSETS
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "AI0075", "glAccountDescription": "ACCRUED COMMON STOCK DIVIDEND INCOME", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Dividend RecPay"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "AI0650", "glAccountDescription": "ACCRUED DIVIDENDS", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Dividend RecPay"},

        # Reclaim RecPay - ASSETS
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "1550", "glAccountDescription": "RECLAIMS RECEIVABLE", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Reclaim RecPay"},

        # Expense RecPay - ASSETS
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "P09600025", "glAccountDescription": "PREPAID FUND OF FUNDS MANAGEMENT FEE WAIVER", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Expense RecPay"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "P20120000", "glAccountDescription": "PREPAID FUND ADMINISTRATION / TA REIMBURSEMENT", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Expense RecPay"},

        # Future Margin - ASSETS
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "1650", "glAccountDescription": "APP/DEP FUTURES", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Future Margin"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "1650URGL", "glAccountDescription": "APP/DEP FUTURES-URGL", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Future Margin"},

        # Swap Income RecPay - ASSETS
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "AI0501", "glAccountDescription": "ACCRUED SWAP DIVIDENDS", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Swap Income RecPay"},

        # Investment RecPay - ASSETS
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "1250", "glAccountDescription": "SECURITIES SOLD RECEIVABLE", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Investment RecPay"},

        # Subscription Rec - ASSETS
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "1300", "glAccountDescription": "CAPITAL SHARES RECEIVABLE", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Subscription Rec"},

        # Generic GL accounts used by seeded fund data
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "1000", "glAccountDescription": "INVESTMENT AT MARKET", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Investment Cost"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "1200", "glAccountDescription": "RECEIVABLES", "ledgerSection": "ASSETS", "bsIncst": "BS", "conversionCategory": "Interest RecPay"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "2000", "glAccountDescription": "PAYABLES", "ledgerSection": "LIABILITIES", "bsIncst": "BS", "conversionCategory": "Expense RecPay"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "2100", "glAccountDescription": "DISTRIBUTION PAYABLE", "ledgerSection": "LIABILITIES", "bsIncst": "BS", "conversionCategory": "Distribution Pay"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "3000", "glAccountDescription": "NET ASSETS", "ledgerSection": "EQUITY", "bsIncst": "BS", "conversionCategory": "Capital"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "3100", "glAccountDescription": "CAPITAL STOCK", "ledgerSection": "EQUITY", "bsIncst": "BS", "conversionCategory": "Capital"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "4000", "glAccountDescription": "INVESTMENT INCOME", "ledgerSection": "INCOME", "bsIncst": "INCST", "conversionCategory": "Income"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "4100", "glAccountDescription": "REALIZED GAINS", "ledgerSection": "INCOME", "bsIncst": "INCST", "conversionCategory": "Realized GL"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "5000", "glAccountDescription": "MANAGEMENT FEES", "ledgerSection": "EXPENSE", "bsIncst": "INCST", "conversionCategory": "Expenses"},
        {"chartOfAccounts": "investone mufg", "glAccountNumber": "5100", "glAccountDescription": "CUSTODY FEES", "ledgerSection": "EXPENSE", "bsIncst": "INCST", "conversionCategory": "Expenses"},
    ]
    db["refGLCategoryMapping"].insert_many(gl_category_mappings)

    # ── Transaction Code to Category Mapping (Section 8.3) ────
    trans_code_mappings = [
        {"transCode": "DIV", "conversionCategory": "Dividend RecPay", "fieldUsed": "transAmountBase", "description": "Dividend payment"},
        {"transCode": "RECL", "conversionCategory": "Reclaim RecPay", "fieldUsed": "transAmountBase", "description": "Tax reclaim"},
        {"transCode": "RECL-", "conversionCategory": "Reclaim RecPay", "fieldUsed": "transAmountBase", "description": "Tax reclaim reversal"},
        {"transCode": "RECL+", "conversionCategory": "Reclaim RecPay", "fieldUsed": "transAmountBase", "description": "Tax reclaim adjustment"},
        {"transCode": "BUY", "conversionCategory": "Investment RecPay", "fieldUsed": "transAmountBase", "description": "Security purchase"},
        {"transCode": "SELL", "conversionCategory": "Investment RecPay", "fieldUsed": "transAmountBase", "description": "Security sale"},
        {"transCode": "COVER", "conversionCategory": "Investment RecPay", "fieldUsed": "transAmountBase", "description": "Short cover"},
        {"transCode": "INT", "conversionCategory": "Interest RecPay", "fieldUsed": "transAmountBase", "description": "Interest payment"},
    ]
    db["refTransCodeCategoryMapping"].insert_many(trans_code_mappings)

    print(f"  Seeded {len(ledger_categories)} ledger categories")
    print(f"  Seeded {len(gl_category_mappings)} GL account mappings")
    print(f"  Seeded {len(trans_code_mappings)} transaction code mappings")


# ══════════════════════════════════════════════════════════════
# Events (matching UX mock data)
# ══════════════════════════════════════════════════════════════

def seed_events(db):
    events = [
        {
            "eventId": "EVT-2026-001",
            "eventName": "Vanguard Fixed Income Migration",
            "incumbentProvider": "State Street",
            "status": "PARALLEL",
            "parallelStartDate": "2026-01-15",
            "targetGoLiveDate": "2026-04-01",
            "assignedTeam": [
                {"userId": "u1", "name": "Jane Doe", "role": "CONVERSION_MANAGER"},
                {"userId": "u2", "name": "Mike Chen", "role": "FUND_ACCOUNTANT"},
                {"userId": "u3", "name": "Sarah Kim", "role": "OPERATIONS_ANALYST"},
            ],
            "funds": [
                {"account": "VG-BOND-IDX", "fundName": "VG Bond Index", "fundType": "FIXED_INCOME", "shareClasses": ["Admiral", "Investor"], "status": "PENDING", "breakCount": 0},
                {"account": "VG-CORP-BOND", "fundName": "VG Corp Bond", "fundType": "FIXED_INCOME", "shareClasses": ["Admiral", "ETF"], "status": "PENDING", "breakCount": 0},
                {"account": "VG-HIGH-YIELD", "fundName": "VG High Yield", "fundType": "FIXED_INCOME", "shareClasses": ["Admiral", "Investor", "ETF"], "status": "PENDING", "breakCount": 0},
                {"account": "VG-TREASURY", "fundName": "VG Treasury", "fundType": "FIXED_INCOME", "shareClasses": ["Admiral", "Investor"], "status": "PENDING", "breakCount": 0},
                {"account": "VG-TIPS", "fundName": "VG Inflation-Protected", "fundType": "FIXED_INCOME", "shareClasses": ["Admiral"], "status": "PENDING", "breakCount": 0},
                {"account": "VG-INTL-BOND", "fundName": "VG International Bond", "fundType": "FIXED_INCOME", "shareClasses": ["Admiral", "Investor"], "status": "PENDING", "breakCount": 0},
            ],
            "breakTrend7d": [0, 0, 0, 0, 0, 0, 0],
        },
        {
            "eventId": "EVT-2026-002",
            "eventName": "Fidelity Equity Suite",
            "incumbentProvider": "Northern Trust",
            "status": "ACTIVE",
            "parallelStartDate": "2025-11-01",
            "targetGoLiveDate": "2026-02-15",
            "assignedTeam": [
                {"userId": "u1", "name": "Jane Doe", "role": "CONVERSION_MANAGER"},
                {"userId": "u4", "name": "Tom Rivera", "role": "FUND_ACCOUNTANT"},
            ],
            "funds": [
                {"account": "FID-GROWTH", "fundName": "Fidelity Growth", "fundType": "EQUITY", "shareClasses": ["K", "Retail"], "status": "PENDING", "breakCount": 0},
                {"account": "FID-VALUE", "fundName": "Fidelity Value", "fundType": "EQUITY", "shareClasses": ["K", "Retail"], "status": "PENDING", "breakCount": 0},
                {"account": "FID-BALANCED", "fundName": "Fidelity Balanced", "fundType": "MULTI_ASSET", "shareClasses": ["K"], "status": "PENDING", "breakCount": 0},
            ],
            "breakTrend7d": [0, 0, 0, 0, 0, 0, 0],
        },
        {
            "eventId": "EVT-2026-003",
            "eventName": "T. Rowe Price Multi-Strategy",
            "incumbentProvider": "BNP Paribas",
            "status": "ACTIVE",
            "parallelStartDate": "2026-02-01",
            "targetGoLiveDate": "2026-06-15",
            "assignedTeam": [
                {"userId": "u5", "name": "Lisa Park", "role": "CONVERSION_MANAGER"},
                {"userId": "u6", "name": "David Wu", "role": "FUND_ACCOUNTANT"},
                {"userId": "u3", "name": "Sarah Kim", "role": "OPERATIONS_ANALYST"},
            ],
            "funds": [
                {"account": "TRP-BLUE-CHIP", "fundName": "T. Rowe Blue Chip Growth", "fundType": "EQUITY", "shareClasses": ["I", "Advisor"], "status": "PENDING", "breakCount": 0},
                {"account": "TRP-INTL-STOCK", "fundName": "T. Rowe Intl Stock", "fundType": "EQUITY", "shareClasses": ["I"], "status": "PENDING", "breakCount": 0},
                {"account": "TRP-NEW-INCOME", "fundName": "T. Rowe New Income", "fundType": "FIXED_INCOME", "shareClasses": ["I", "Advisor"], "status": "PENDING", "breakCount": 0},
                {"account": "TRP-SCIENCE", "fundName": "T. Rowe Science & Tech", "fundType": "EQUITY", "shareClasses": ["I"], "status": "PENDING", "breakCount": 0},
                {"account": "TRP-MONEY-MKT", "fundName": "T. Rowe Money Market", "fundType": "MONEY_MARKET", "shareClasses": ["I"], "status": "PENDING", "breakCount": 0},
            ],
            "breakTrend7d": [0, 0, 0, 0, 0, 0, 0],
        },
        {
            "eventId": "EVT-2026-004",
            "eventName": "American Funds Conversion",
            "incumbentProvider": "JP Morgan",
            "status": "DRAFT",
            "targetGoLiveDate": "2026-09-01",
            "assignedTeam": [
                {"userId": "u5", "name": "Lisa Park", "role": "CONVERSION_MANAGER"},
            ],
            "funds": [
                {"account": "AF-GROWTH-AM", "fundName": "Growth Fund of America", "fundType": "EQUITY", "shareClasses": ["R6", "A", "C"], "status": "PENDING", "breakCount": 0},
                {"account": "AF-INCOME", "fundName": "American Income Fund", "fundType": "FIXED_INCOME", "shareClasses": ["R6", "A"], "status": "PENDING", "breakCount": 0},
            ],
            "breakTrend7d": [0, 0, 0, 0, 0, 0, 0],
        },
    ]
    db[COLLECTIONS["events"]].insert_many(events)


# ══════════════════════════════════════════════════════════════
# Canonical Data — CPU and Incumbent
# ══════════════════════════════════════════════════════════════

def seed_canonical_data(db):
    """
    Seed canonical data for CPU and Incumbent systems.
    Intentional variances are introduced to produce breaks during validation.
    """
    val_dt = "2026-02-07"

    # ── VG High Yield (will have breaks) ─────────────────────
    _seed_fund_data(db, val_dt, "VG-HIGH-YIELD", "EVT-2026-001",
        cpu_nav=125428400, inc_nav=125420000,
        positions=[
            {"assetId": "789456123", "shares": 100000, "mv": 42350000, "bv": 40000000, "income": 24500, "price": 423.50},
            {"assetId": "456789012", "shares": 50000, "mv": 49375000, "bv": 48000000, "income": 6800, "price": 987.50},
            {"assetId": "111222333", "shares": 30000, "mv": 25500000, "bv": 24000000, "income": 2500, "price": 850.00},
        ],
        # Incumbent has different accrued income (day count mismatch)
        inc_positions=[
            {"assetId": "789456123", "shares": 100000, "mv": 42350000, "bv": 40000000, "income": 9300, "price": 423.50},
            {"assetId": "456789012", "shares": 50000, "mv": 49375000, "bv": 48000000, "income": 0, "price": 987.50},
            {"assetId": "111222333", "shares": 30000, "mv": 25500000, "bv": 24000000, "income": 0, "price": 850.00},
        ],
        ledger_cpu=[
            {"gl": "1000", "bal": 117225000},  # Investment at Market
            {"gl": "1100", "bal": 2500000},     # Cash
            {"gl": "1200", "bal": 4204200},     # Receivables
            {"gl": "1300", "bal": 33800},        # Accrued Income (higher in CPU due to ACT/ACT)
            {"gl": "2000", "bal": -2102100},    # Payables
            {"gl": "3000", "bal": -125428400},  # Net Assets
            {"gl": "4000", "bal": 3567500},     # Investment Income
        ],
        ledger_inc=[
            {"gl": "1000", "bal": 117225000},
            {"gl": "1100", "bal": 2500000},
            {"gl": "1200", "bal": 4200000},     # Slightly different receivables
            {"gl": "1300", "bal": 9300},         # Lower accrued income (30/360)
            {"gl": "2000", "bal": -2100000},
            {"gl": "3000", "bal": -125420000},  # Different NAV
            {"gl": "4000", "bal": 3585700},
        ],
    )

    # ── VG Corp Bond (will have breaks — pricing) ────────────
    _seed_fund_data(db, val_dt, "VG-CORP-BOND", "EVT-2026-001",
        cpu_nav=98750000, inc_nav=98737550,
        positions=[
            {"assetId": "456789012", "shares": 50000, "mv": 49375000, "bv": 48000000, "income": 4200, "price": 987.50},
            {"assetId": "321654987", "shares": 40000, "mv": 42100000, "bv": 41000000, "income": 8200, "price": 1052.50},
        ],
        inc_positions=[
            {"assetId": "456789012", "shares": 50000, "mv": 49362550, "bv": 48000000, "income": 4200, "price": 987.25},
            {"assetId": "321654987", "shares": 40000, "mv": 42100000, "bv": 41000000, "income": 0, "price": 1052.50},
        ],
        ledger_cpu=[
            {"gl": "1000", "bal": 91475000},
            {"gl": "1100", "bal": 3200000},
            {"gl": "1200", "bal": 2100000},
            {"gl": "1300", "bal": 12400},
            {"gl": "2000", "bal": -1050000},
            {"gl": "3000", "bal": -98750000},
            {"gl": "4000", "bal": 3012600},
        ],
        ledger_inc=[
            {"gl": "1000", "bal": 91462550},
            {"gl": "1100", "bal": 3200000},
            {"gl": "1200", "bal": 2100000},
            {"gl": "1300", "bal": 4200},
            {"gl": "2000", "bal": -1050000},
            {"gl": "3000", "bal": -98737550},
            {"gl": "4000", "bal": 3020800},
        ],
    )

    # ── VG Bond Index (clean — no breaks) ────────────────────
    _seed_fund_data(db, val_dt, "VG-BOND-IDX", "EVT-2026-001",
        cpu_nav=250000000, inc_nav=250000000,
        positions=[
            {"assetId": "UST10Y", "shares": 200000, "mv": 200000000, "bv": 195000000, "income": 12000, "price": 1000.00},
            {"assetId": "789456123", "shares": 50000, "mv": 50000000, "bv": 48000000, "income": 5000, "price": 1000.00},
        ],
        inc_positions=[
            {"assetId": "UST10Y", "shares": 200000, "mv": 200000000, "bv": 195000000, "income": 12000, "price": 1000.00},
            {"assetId": "789456123", "shares": 50000, "mv": 50000000, "bv": 48000000, "income": 5000, "price": 1000.00},
        ],
        ledger_cpu=[
            {"gl": "1000", "bal": 250000000},
            {"gl": "1100", "bal": 5000000},
            {"gl": "1200", "bal": 1000000},
            {"gl": "1300", "bal": 17000},
            {"gl": "2000", "bal": -500000},
            {"gl": "3000", "bal": -250000000},
            {"gl": "4000", "bal": -5517000},
        ],
        ledger_inc=[
            {"gl": "1000", "bal": 250000000},
            {"gl": "1100", "bal": 5000000},
            {"gl": "1200", "bal": 1000000},
            {"gl": "1300", "bal": 17000},
            {"gl": "2000", "bal": -500000},
            {"gl": "3000", "bal": -250000000},
            {"gl": "4000", "bal": -5517000},
        ],
    )

    # ── VG Treasury (clean) ──────────────────────────────────
    _seed_fund_data(db, val_dt, "VG-TREASURY", "EVT-2026-001",
        cpu_nav=180000000, inc_nav=180000000,
        positions=[
            {"assetId": "UST10Y", "shares": 180000, "mv": 180000000, "bv": 175000000, "income": 8000, "price": 1000.00},
        ],
        inc_positions=[
            {"assetId": "UST10Y", "shares": 180000, "mv": 180000000, "bv": 175000000, "income": 8000, "price": 1000.00},
        ],
        ledger_cpu=[
            {"gl": "1000", "bal": 180000000},
            {"gl": "1100", "bal": 3000000},
            {"gl": "1200", "bal": 500000},
            {"gl": "1300", "bal": 8000},
            {"gl": "2000", "bal": -300000},
            {"gl": "3000", "bal": -180000000},
            {"gl": "4000", "bal": -3208000},
        ],
        ledger_inc=[
            {"gl": "1000", "bal": 180000000},
            {"gl": "1100", "bal": 3000000},
            {"gl": "1200", "bal": 500000},
            {"gl": "1300", "bal": 8000},
            {"gl": "2000", "bal": -300000},
            {"gl": "3000", "bal": -180000000},
            {"gl": "4000", "bal": -3208000},
        ],
    )

    # ── VG TIPS (clean) ──────────────────────────────────────
    _seed_fund_data(db, val_dt, "VG-TIPS", "EVT-2026-001",
        cpu_nav=75000000, inc_nav=75000000,
        positions=[
            {"assetId": "UST10Y", "shares": 75000, "mv": 75000000, "bv": 73000000, "income": 3000, "price": 1000.00},
        ],
        inc_positions=[
            {"assetId": "UST10Y", "shares": 75000, "mv": 75000000, "bv": 73000000, "income": 3000, "price": 1000.00},
        ],
        ledger_cpu=[
            {"gl": "1000", "bal": 75000000},
            {"gl": "1100", "bal": 1000000},
            {"gl": "1200", "bal": 200000},
            {"gl": "1300", "bal": 3000},
            {"gl": "2000", "bal": -100000},
            {"gl": "3000", "bal": -75000000},
            {"gl": "4000", "bal": -1103000},
        ],
        ledger_inc=[
            {"gl": "1000", "bal": 75000000},
            {"gl": "1100", "bal": 1000000},
            {"gl": "1200", "bal": 200000},
            {"gl": "1300", "bal": 3000},
            {"gl": "2000", "bal": -100000},
            {"gl": "3000", "bal": -75000000},
            {"gl": "4000", "bal": -1103000},
        ],
    )

    # ── VG Intl Bond (minor rounding — warning level) ────────
    _seed_fund_data(db, val_dt, "VG-INTL-BOND", "EVT-2026-001",
        cpu_nav=45000000.03, inc_nav=45000000,
        positions=[
            {"assetId": "789456123", "shares": 45000, "mv": 45000000.03, "bv": 43000000, "income": 2000, "price": 1000.00},
        ],
        inc_positions=[
            {"assetId": "789456123", "shares": 45000, "mv": 45000000, "bv": 43000000, "income": 2000, "price": 1000.00},
        ],
        ledger_cpu=[
            {"gl": "1000", "bal": 45000000.03},
            {"gl": "1100", "bal": 800000},
            {"gl": "1200", "bal": 150000},
            {"gl": "1300", "bal": 2000},
            {"gl": "2000", "bal": -80000},
            {"gl": "3000", "bal": -45000000.03},
            {"gl": "4000", "bal": -872000},
        ],
        ledger_inc=[
            {"gl": "1000", "bal": 45000000},
            {"gl": "1100", "bal": 800000},
            {"gl": "1200", "bal": 150000},
            {"gl": "1300", "bal": 2000},
            {"gl": "2000", "bal": -80000},
            {"gl": "3000", "bal": -45000000},
            {"gl": "4000", "bal": -872000},
        ],
    )

    # ── Fidelity Growth (equity — clean) ─────────────────────
    _seed_fund_data(db, val_dt, "FID-GROWTH", "EVT-2026-002",
        cpu_nav=500000000, inc_nav=500000000,
        positions=[
            {"assetId": "AAPL", "shares": 500000, "mv": 200000000, "bv": 180000000, "income": 0, "price": 400.00},
            {"assetId": "MSFT", "shares": 400000, "mv": 180000000, "bv": 160000000, "income": 0, "price": 450.00},
            {"assetId": "GOOGL", "shares": 300000, "mv": 120000000, "bv": 100000000, "income": 0, "price": 400.00},
        ],
        inc_positions=[
            {"assetId": "AAPL", "shares": 500000, "mv": 200000000, "bv": 180000000, "income": 0, "price": 400.00},
            {"assetId": "MSFT", "shares": 400000, "mv": 180000000, "bv": 160000000, "income": 0, "price": 450.00},
            {"assetId": "GOOGL", "shares": 300000, "mv": 120000000, "bv": 100000000, "income": 0, "price": 400.00},
        ],
        ledger_cpu=[
            {"gl": "1000", "bal": 500000000},
            {"gl": "1100", "bal": 10000000},
            {"gl": "2000", "bal": -2000000},
            {"gl": "3000", "bal": -500000000},
            {"gl": "4000", "bal": -8000000},
        ],
        ledger_inc=[
            {"gl": "1000", "bal": 500000000},
            {"gl": "1100", "bal": 10000000},
            {"gl": "2000", "bal": -2000000},
            {"gl": "3000", "bal": -500000000},
            {"gl": "4000", "bal": -8000000},
        ],
    )

    # ── T. Rowe Blue Chip (will have breaks) ─────────────────
    _seed_fund_data(db, val_dt, "TRP-BLUE-CHIP", "EVT-2026-003",
        cpu_nav=320000000, inc_nav=319985000,
        positions=[
            {"assetId": "AAPL", "shares": 300000, "mv": 120000000, "bv": 110000000, "income": 0, "price": 400.00},
            {"assetId": "MSFT", "shares": 250000, "mv": 112500000, "bv": 100000000, "income": 0, "price": 450.00},
            {"assetId": "GOOGL", "shares": 200000, "mv": 80000000, "bv": 70000000, "income": 0, "price": 400.00},
        ],
        inc_positions=[
            {"assetId": "AAPL", "shares": 300000, "mv": 119985000, "bv": 110000000, "income": 0, "price": 399.95},
            {"assetId": "MSFT", "shares": 250000, "mv": 112500000, "bv": 100000000, "income": 0, "price": 450.00},
            {"assetId": "GOOGL", "shares": 200000, "mv": 80000000, "bv": 70000000, "income": 0, "price": 400.00},
        ],
        ledger_cpu=[
            {"gl": "1000", "bal": 312500000},
            {"gl": "1100", "bal": 8000000},
            {"gl": "1200", "bal": 1500000},
            {"gl": "2000", "bal": -1000000},
            {"gl": "3000", "bal": -320000000},
            {"gl": "4000", "bal": -1000000},
        ],
        ledger_inc=[
            {"gl": "1000", "bal": 312485000},
            {"gl": "1100", "bal": 8000000},
            {"gl": "1200", "bal": 1500000},
            {"gl": "2000", "bal": -1000000},
            {"gl": "3000", "bal": -319985000},
            {"gl": "4000", "bal": -1000000},
        ],
    )

    print(f"  Seeded canonical data for 8 funds")

    # Seed Ledger to Subledger sample data (per spec Section 2.2)
    print("📦 Seeding ledger-subledger sample data...")
    seed_ledger_subledger_sample_data(db)


def seed_ledger_subledger_sample_data(db):
    """
    Seed sample data matching the spec examples (Section 2.2, 2.3, 4.2, 5.2, 7.2).
    Creates Account 1 with full ledger-subledger data.
    """
    val_dt = "2026-02-07"
    account = "1"
    event_id = "EVT-2026-001"
    user_bank = "CPU"
    share_class = "Admiral"

    # ── Create Account 1 in refFund ────────────────────────────
    db[COLLECTIONS["refFund"]].update_one(
        {"account": account},
        {"$set": {"account": account, "accountName": "Sample Account 1"}},
        upsert=True
    )

    # ── Ledger entries matching spec Section 2.2 ────────────────
    # Map from categories to GL accounts and balances
    ledger_entries = [
        # Cash
        {"gl": "1050", "bal": 7892.64, "cat": "Cash"},
        # Investment Cost (S0075 - Common Stocks)
        {"gl": "S0075", "bal": 637687.80, "cat": "Investment Cost"},
        {"gl": "S0200", "bal": 138225.53, "cat": "Investment Cost"},  # Mutual Funds
        {"gl": "S6000", "bal": 124636.99, "cat": "Investment Cost"},  # Treasury
        {"gl": "S0080", "bal": 900449.58, "cat": "Investment Cost"},  # US Govt
        {"gl": "S0090", "bal": 15202.30, "cat": "Investment Cost"},  # Misc
        # Holdings Unrealized (URGL accounts)
        {"gl": "1100URGL", "bal": 35.37, "cat": "Holdings Unrealized"},  # FX
        {"gl": "S0200URGL", "bal": 1094.21, "cat": "Holdings Unrealized"},  # MF
        {"gl": "S0075URGL", "bal": 373979.86, "cat": "Holdings Unrealized"},  # Stocks
        {"gl": "S6000URGL", "bal": 5.55, "cat": "Holdings Unrealized"},  # Treasury
        # Future Margin (with variance -97.50)
        {"gl": "1650", "bal": 11777.97, "cat": "Future Margin"},
        # Dividend RecPay
        {"gl": "AI0075", "bal": 682.98, "cat": "Dividend RecPay"},
        # Reclaim RecPay
        {"gl": "1550", "bal": 17066.67, "cat": "Reclaim RecPay"},
        # Interest RecPay
        {"gl": "AI0010", "bal": 90.88, "cat": "Interest RecPay"},
        # Expense RecPay (not supported)
        {"gl": "P09600025", "bal": -6916.90, "cat": "Expense RecPay"},
        # Capital (not supported)
        {"gl": "3100", "bal": -2950315.49, "cat": "Capital"},
        # Realized GL (not supported - using placeholder)
        {"gl": "4100", "bal": 1157761.61, "cat": "Realized GL"},
        # Unrealized INCST
        {"gl": "S0075INCST", "bal": -406900.39, "cat": "Unrealized INCST"},
        # Income (not supported)
        {"gl": "4000", "bal": -61780.76, "cat": "Income"},
        # Expenses (not supported)
        {"gl": "5000", "bal": 39323.60, "cat": "Expenses"},
    ]

    for entry in ledger_entries:
        db[COLLECTIONS["ledger"]].insert_one({
            "eventId": event_id,
            "valuationDt": val_dt,
            "userBank": user_bank,
            "account": account,
            "acctBasis": "PRIMARY",
            "shareClass": share_class,
            "glAccountNumber": entry["gl"],
            "endingBalance": entry["bal"],
        })

    # ── Positions matching spec Section 5.2 ────────────────────
    # Security reference data
    securities = [
        {"assetId": "USD-CASH", "secType": "CU", "issueDescription": "US Dollar Cash"},
        {"assetId": "GUGG-USD-I", "secType": "MF", "issueDescription": "GUGG ULTRA SHORT DUR I"},
        {"assetId": "GUGG-STRAT-II", "secType": "MF", "issueDescription": "GUGGENHEIM STRATEGY II"},
        {"assetId": "AAPL", "secType": "S", "issueDescription": "Apple Inc"},
        {"assetId": "MSFT", "secType": "S", "issueDescription": "Microsoft Corp"},
        {"assetId": "UST-10Y", "secType": "TI", "issueDescription": "US Treasury 10Y"},
        {"assetId": "CORP-BOND-A", "secType": "CA", "issueDescription": "Corporate Bond A"},
        {"assetId": "REPO-001", "secType": "RP", "issueDescription": "Repo Agreement 001"},
        {"assetId": "FUT-SP500", "secType": "FT", "issueDescription": "S&P 500 Futures"},
    ]

    for sec in securities:
        db[COLLECTIONS["refSecurity"]].update_one(
            {"assetId": sec["assetId"], "valuationDt": val_dt, "userBank": user_bank},
            {"$set": {
                "assetId": sec["assetId"],
                "valuationDt": val_dt,
                "userBank": user_bank,
                "secType": sec["secType"],
                "issueDescription": sec["issueDescription"],
                "assetCurrency": "USD",
                "countryCode": "US",
            }},
            upsert=True
        )

    # Position data matching spec Section 5.2
    positions = [
        # Cash (CU) - Book value 7892.64, Unrealized 35.37
        {"assetId": "USD-CASH", "bv": 7892.64, "mv": 7928.01, "income": 0, "dailyVar": 0, "ltdVar": 0},
        # MF - GUGG ULTRA SHORT DUR I - Unrealized 983.79
        {"assetId": "GUGG-USD-I", "bv": 100000, "mv": 100983.79, "income": 0, "dailyVar": 0, "ltdVar": 0},
        # MF - GUGGENHEIM STRATEGY II - Unrealized 110.42
        {"assetId": "GUGG-STRAT-II", "bv": 38225.53, "mv": 38335.95, "income": 0, "dailyVar": 0, "ltdVar": 0},
        # S - Stocks - Unrealized 373979.86
        {"assetId": "AAPL", "bv": 300000, "mv": 450000, "income": 0, "dailyVar": 0, "ltdVar": 0},
        {"assetId": "MSFT", "bv": 337687.80, "mv": 561667.66, "income": 0, "dailyVar": 0, "ltdVar": 0},
        # TI - Treasury - Book 124636.99, Unrealized 5.55
        {"assetId": "UST-10Y", "bv": 124636.99, "mv": 124642.54, "income": 90.88, "dailyVar": 0, "ltdVar": 0},
        # CA - Corporate Actions - Book 15202.30
        {"assetId": "CORP-BOND-A", "bv": 15202.30, "mv": 15202.30, "income": 0, "dailyVar": 0, "ltdVar": 0},
        # RP - Repo - Book 900449.58
        {"assetId": "REPO-001", "bv": 900449.58, "mv": 900449.58, "income": 0, "dailyVar": 0, "ltdVar": 0},
        # FT - Futures - Daily Var 11894.60, LTD Var -19.13 = 11875.47 (causes variance!)
        {"assetId": "FUT-SP500", "bv": 0, "mv": 0, "income": 0, "dailyVar": 11894.60, "ltdVar": -19.13},
    ]

    for pos in positions:
        db[COLLECTIONS["dataSubLedgerPosition"]].insert_one({
            "valuationDt": val_dt,
            "userBank": user_bank,
            "account": account,
            "acctBasis": "PRIMARY",
            "shareClass": share_class,
            "assetId": pos["assetId"],
            "longShortInd": "L",
            "posShares": 1000,
            "posBookValueBase": pos["bv"],
            "posMarketValueBase": pos["mv"],
            "posBookValueLocal": pos["bv"],
            "posMarketValueLocal": pos["mv"],
            "posOrigCostBase": pos["bv"],
            "posOrigCostLocal": pos["bv"],
            "posMarketPrice": 100.00,
            "posIncomeBase": pos["income"],
            "posIncomeLocal": pos["income"],
            "dailyVariationMarginBase": pos["dailyVar"],
            "dailyVariationMarginLocal": pos["dailyVar"],
            "ltdVariationMarginBase": pos["ltdVar"],
            "ltdVariationMarginLocal": pos["ltdVar"],
        })

    # ── Unsettled Transactions matching spec Section 7.2 ────────
    unsettled_transactions = [
        # Dividend RecPay
        {"transCode": "DIV", "amount": 682.98},
        # Reclaim RecPay
        {"transCode": "RECL", "amount": 13982.74},
        {"transCode": "RECL-", "amount": -21.69},
        {"transCode": "RECL+", "amount": 3105.62},
    ]

    for i, txn in enumerate(unsettled_transactions):
        db[COLLECTIONS["dataSubLedgerTrans"]].insert_one({
            "valuationDt": val_dt,
            "userBank": user_bank,
            "account": account,
            "acctBasis": "PRIMARY",
            "shareClass": share_class,
            "assetId": f"TXN-{i}",
            "longShortInd": "L",
            "transactionId": f"TXN-{account}-{i}",
            "shares": 0,
            "origCostLocal": 0,
            "origCostBase": 0,
            "bookValueLocal": 0,
            "bookValueBase": 0,
            "marketValueLocal": 0,
            "marketValueBase": 0,
            "lotTradeDate": val_dt,
            "lotSettleDate": val_dt,
            "transCode": txn["transCode"],
            "transAmountBase": txn["amount"],
            "transAmountLocal": txn["amount"],
        })

    print(f"  Seeded ledger-subledger sample data for Account {account}")


def _seed_fund_data(
    db, val_dt, account, event_id,
    cpu_nav, inc_nav=None,
    positions=None, inc_positions=None,
    ledger_cpu=None, ledger_inc=None,
):
    """Seed canonical data for a single fund."""
    share_class = "Admiral"

    # NAV Summary — CPU
    db[COLLECTIONS["navSummary"]].insert_one({
        "shareClass": share_class,
        "sharesOutstanding": cpu_nav / 100,
        "settledShares": cpu_nav / 100,
        "netAssets": cpu_nav,
        "NAV": round(cpu_nav / (cpu_nav / 100), 4),
        "account": account,
        "valuationDt": val_dt,
        "userBank": "CPU",
    })

    # NAV Summary — Incumbent
    if inc_nav is not None:
        db[COLLECTIONS["navSummary"]].insert_one({
            "shareClass": share_class,
            "sharesOutstanding": inc_nav / 100,
            "settledShares": inc_nav / 100,
            "netAssets": inc_nav,
            "NAV": round(inc_nav / (inc_nav / 100), 4),
            "account": account,
            "valuationDt": val_dt,
            "userBank": "INCUMBENT",
        })

    # Positions — CPU
    if positions:
        for pos in positions:
            db[COLLECTIONS["dataSubLedgerPosition"]].insert_one({
                "userBank": "CPU",
                "account": account,
                "acctBasis": "PRIMARY",
                "shareClass": share_class,
                "assetId": pos["assetId"],
                "longShortInd": "L",
                "posShares": pos["shares"],
                "posMarketValueBase": pos["mv"],
                "posBookValueBase": pos["bv"],
                "posMarketPrice": pos["price"],
                "posIncomeBase": pos.get("income", 0),
                "posMarketValueLocal": pos["mv"],
                "posBookValueLocal": pos["bv"],
                "posOrigCostBase": pos["bv"],
                "posOrigCostLocal": pos["bv"],
                "valuationDt": val_dt,
            })

            # Also create lot-level data (matching positions for clean checks)
            db[COLLECTIONS["dataSubLedgerTrans"]].insert_one({
                "userBank": "CPU",
                "acctBasis": "PRIMARY",
                "shareClass": share_class,
                "assetId": pos["assetId"],
                "longShortInd": "L",
                "transactionId": f"LOT-{account}-{pos['assetId']}",
                "shares": pos["shares"],
                "origCostLocal": pos["bv"],
                "origCostBase": pos["bv"],
                "bookValueLocal": pos["bv"],
                "bookValueBase": pos["bv"],
                "marketValueLocal": pos["mv"],
                "marketValueBase": pos["mv"],
                "incomeLocal": pos.get("income", 0),
                "incomeBase": pos.get("income", 0),
                "account": account,
                "valuationDt": val_dt,
            })

    # Positions — Incumbent (if different)
    if inc_positions:
        for pos in inc_positions:
            db[COLLECTIONS["dataSubLedgerPosition"]].insert_one({
                "userBank": "INCUMBENT",
                "account": account,
                "acctBasis": "PRIMARY",
                "shareClass": share_class,
                "assetId": pos["assetId"],
                "longShortInd": "L",
                "posShares": pos["shares"],
                "posMarketValueBase": pos["mv"],
                "posBookValueBase": pos["bv"],
                "posMarketPrice": pos["price"],
                "posIncomeBase": pos.get("income", 0),
                "posMarketValueLocal": pos["mv"],
                "posBookValueLocal": pos["bv"],
                "posOrigCostBase": pos["bv"],
                "posOrigCostLocal": pos["bv"],
                "valuationDt": val_dt,
            })

            # Also create lot-level data for incumbent
            db[COLLECTIONS["dataSubLedgerTrans"]].insert_one({
                "userBank": "INCUMBENT",
                "acctBasis": "PRIMARY",
                "shareClass": share_class,
                "assetId": pos["assetId"],
                "longShortInd": "L",
                "transactionId": f"LOT-INC-{account}-{pos['assetId']}",
                "shares": pos["shares"],
                "origCostLocal": pos["bv"],
                "origCostBase": pos["bv"],
                "bookValueLocal": pos["bv"],
                "bookValueBase": pos["bv"],
                "marketValueLocal": pos["mv"],
                "marketValueBase": pos["mv"],
                "incomeLocal": pos.get("income", 0),
                "incomeBase": pos.get("income", 0),
                "account": account,
                "valuationDt": val_dt,
            })

    # Ledger — CPU
    if ledger_cpu:
        for entry in ledger_cpu:
            db[COLLECTIONS["ledger"]].insert_one({
                "eventId": event_id,
                "valuationDt": val_dt,
                "userBank": "CPU",
                "account": account,
                "acctBasis": "PRIMARY",
                "shareClass": share_class,
                "glAccountNumber": entry["gl"],
                "endingBalance": entry["bal"],
            })

    # Ledger — Incumbent
    if ledger_inc:
        for entry in ledger_inc:
            db[COLLECTIONS["ledger"]].insert_one({
                "eventId": event_id,
                "valuationDt": val_dt,
                "userBank": "INCUMBENT",
                "account": account,
                "acctBasis": "PRIMARY",
                "shareClass": share_class,
                "glAccountNumber": entry["gl"],
                "endingBalance": entry["bal"],
            })


def seed_gl_account_mapping_data(db):
    """
    Seed reference data for GL Account Mapping (Incumbent to Eagle).
    Creates sample accounts for multiple incumbent providers and Eagle.
    """

    # ── Incumbent GL Accounts (State Street) ──────────────────────
    state_street_accounts = [
        {"glAccountNumber": "1050", "glAccountDescription": "CASH", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "1100", "glAccountDescription": "FOREIGN CURRENCY HOLDINGS", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "1250", "glAccountDescription": "SECURITIES SOLD RECEIVABLE", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "1300", "glAccountDescription": "CAPITAL SHARES RECEIVABLE", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "1450", "glAccountDescription": "OTHER INCOME RECEIVABLE", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "1550", "glAccountDescription": "RECLAIMS RECEIVABLE", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "1650", "glAccountDescription": "APP/DEP FUTURES", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "S0010", "glAccountDescription": "CASH & CASH EQUIVALENTS", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "S0075", "glAccountDescription": "COMMON STOCKS", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "S0080", "glAccountDescription": "U.S. GOVERNMENT & AGENCIES", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "S0090", "glAccountDescription": "MISCELLANEOUS ASSETS", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "S0160", "glAccountDescription": "FOREIGN RIGHTS", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "S0200", "glAccountDescription": "MUTUAL FUNDS", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "S6000", "glAccountDescription": "U.S. GOVERNMENT/AGENCY OBLIGATIONS", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "S0075URGL", "glAccountDescription": "COMMON STOCKS-URGL", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "S0200URGL", "glAccountDescription": "MUTUAL FUNDS-URGL", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "1100URGL", "glAccountDescription": "FOREIGN CURRENCY HOLDINGS-URGL", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "AI0010", "glAccountDescription": "ACCRUED CASH & CASH EQUIVALENTS INCOME", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "AI0075", "glAccountDescription": "ACCRUED COMMON STOCK DIVIDEND INCOME", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "AI0080", "glAccountDescription": "ACCRUED U.S. GOVERNMENT & AGENCIES INTEREST", "ledgerSection": "ASSETS", "provider": "STATE_STREET"},
        {"glAccountNumber": "2050", "glAccountDescription": "ACCOUNTS PAYABLE", "ledgerSection": "LIABILITIES", "provider": "STATE_STREET"},
        {"glAccountNumber": "2100", "glAccountDescription": "SECURITIES PURCHASED PAYABLE", "ledgerSection": "LIABILITIES", "provider": "STATE_STREET"},
        {"glAccountNumber": "2200", "glAccountDescription": "CAPITAL SHARES PAYABLE", "ledgerSection": "LIABILITIES", "provider": "STATE_STREET"},
        {"glAccountNumber": "2300", "glAccountDescription": "DISTRIBUTIONS PAYABLE", "ledgerSection": "LIABILITIES", "provider": "STATE_STREET"},
        {"glAccountNumber": "2400", "glAccountDescription": "ACCRUED EXPENSES PAYABLE", "ledgerSection": "LIABILITIES", "provider": "STATE_STREET"},
        {"glAccountNumber": "3100", "glAccountDescription": "CAPITAL STOCK", "ledgerSection": "EQUITY", "provider": "STATE_STREET"},
        {"glAccountNumber": "3200", "glAccountDescription": "UNDISTRIBUTED NET INVESTMENT INCOME", "ledgerSection": "EQUITY", "provider": "STATE_STREET"},
        {"glAccountNumber": "3300", "glAccountDescription": "UNDISTRIBUTED REALIZED GAINS", "ledgerSection": "EQUITY", "provider": "STATE_STREET"},
        {"glAccountNumber": "3400", "glAccountDescription": "UNREALIZED APPRECIATION", "ledgerSection": "EQUITY", "provider": "STATE_STREET"},
        {"glAccountNumber": "4100", "glAccountDescription": "DIVIDEND INCOME", "ledgerSection": "INCOME", "provider": "STATE_STREET"},
        {"glAccountNumber": "4200", "glAccountDescription": "INTEREST INCOME", "ledgerSection": "INCOME", "provider": "STATE_STREET"},
        {"glAccountNumber": "4300", "glAccountDescription": "REALIZED GAINS ON SECURITIES", "ledgerSection": "INCOME", "provider": "STATE_STREET"},
        {"glAccountNumber": "5100", "glAccountDescription": "MANAGEMENT FEES", "ledgerSection": "EXPENSE", "provider": "STATE_STREET"},
        {"glAccountNumber": "5200", "glAccountDescription": "CUSTODY FEES", "ledgerSection": "EXPENSE", "provider": "STATE_STREET"},
        {"glAccountNumber": "5300", "glAccountDescription": "AUDIT FEES", "ledgerSection": "EXPENSE", "provider": "STATE_STREET"},
    ]

    # ── Incumbent GL Accounts (Northern Trust) ────────────────────
    northern_trust_accounts = [
        {"glAccountNumber": "NT-1010", "glAccountDescription": "CASH AND CASH EQUIVALENTS", "ledgerSection": "ASSETS", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-1020", "glAccountDescription": "FOREIGN CURRENCY", "ledgerSection": "ASSETS", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-1110", "glAccountDescription": "EQUITY SECURITIES AT MARKET", "ledgerSection": "ASSETS", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-1120", "glAccountDescription": "FIXED INCOME SECURITIES", "ledgerSection": "ASSETS", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-1130", "glAccountDescription": "DERIVATIVE ASSETS", "ledgerSection": "ASSETS", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-1210", "glAccountDescription": "INVESTMENT RECEIVABLE", "ledgerSection": "ASSETS", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-1220", "glAccountDescription": "DIVIDEND RECEIVABLE", "ledgerSection": "ASSETS", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-1230", "glAccountDescription": "INTEREST RECEIVABLE", "ledgerSection": "ASSETS", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-1240", "glAccountDescription": "TAX RECLAIM RECEIVABLE", "ledgerSection": "ASSETS", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-2010", "glAccountDescription": "INVESTMENT PAYABLE", "ledgerSection": "LIABILITIES", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-2020", "glAccountDescription": "MANAGEMENT FEE PAYABLE", "ledgerSection": "LIABILITIES", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-2030", "glAccountDescription": "DISTRIBUTION PAYABLE", "ledgerSection": "LIABILITIES", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-3010", "glAccountDescription": "SHAREHOLDER CAPITAL", "ledgerSection": "EQUITY", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-3020", "glAccountDescription": "RETAINED EARNINGS", "ledgerSection": "EQUITY", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-4010", "glAccountDescription": "DIVIDEND INCOME", "ledgerSection": "INCOME", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-4020", "glAccountDescription": "INTEREST INCOME", "ledgerSection": "INCOME", "provider": "NORTHERN_TRUST"},
        {"glAccountNumber": "NT-5010", "glAccountDescription": "MANAGEMENT EXPENSE", "ledgerSection": "EXPENSE", "provider": "NORTHERN_TRUST"},
    ]

    # ── Eagle GL Accounts ─────────────────────────────────────────
    eagle_accounts = [
        {"glAccountNumber": "EAGLE-1050", "glAccountDescription": "Cash Account", "ledgerSection": "ASSETS", "category": "Cash"},
        {"glAccountNumber": "EAGLE-1100", "glAccountDescription": "Foreign Currency Holdings", "ledgerSection": "ASSETS", "category": "Cash"},
        {"glAccountNumber": "EAGLE-1100A", "glAccountDescription": "FX Account - Major Currencies", "ledgerSection": "ASSETS", "category": "Cash"},
        {"glAccountNumber": "EAGLE-1100B", "glAccountDescription": "FX Account - Emerging Markets", "ledgerSection": "ASSETS", "category": "Cash"},
        {"glAccountNumber": "EAGLE-1250", "glAccountDescription": "Securities Sold Receivable", "ledgerSection": "ASSETS", "category": "Investment RecPay"},
        {"glAccountNumber": "EAGLE-1300", "glAccountDescription": "Capital Shares Receivable", "ledgerSection": "ASSETS", "category": "Subscription Rec"},
        {"glAccountNumber": "EAGLE-1450", "glAccountDescription": "Other Income Receivable", "ledgerSection": "ASSETS", "category": "Interest RecPay"},
        {"glAccountNumber": "EAGLE-1550", "glAccountDescription": "Tax Reclaims Receivable", "ledgerSection": "ASSETS", "category": "Reclaim RecPay"},
        {"glAccountNumber": "EAGLE-1650", "glAccountDescription": "Futures Margin", "ledgerSection": "ASSETS", "category": "Future Margin"},
        {"glAccountNumber": "EAGLE-S0075", "glAccountDescription": "Equity Securities", "ledgerSection": "ASSETS", "category": "Investment Cost"},
        {"glAccountNumber": "EAGLE-S0080", "glAccountDescription": "Government Securities", "ledgerSection": "ASSETS", "category": "Investment Cost"},
        {"glAccountNumber": "EAGLE-S0090", "glAccountDescription": "Other Investment Assets", "ledgerSection": "ASSETS", "category": "Investment Cost"},
        {"glAccountNumber": "EAGLE-S0200", "glAccountDescription": "Mutual Fund Holdings", "ledgerSection": "ASSETS", "category": "Investment Cost"},
        {"glAccountNumber": "EAGLE-S6000", "glAccountDescription": "Treasury Securities", "ledgerSection": "ASSETS", "category": "Investment Cost"},
        {"glAccountNumber": "EAGLE-URGL-EQ", "glAccountDescription": "Equity Unrealized Gain/Loss", "ledgerSection": "ASSETS", "category": "Holdings Unrealized"},
        {"glAccountNumber": "EAGLE-URGL-FI", "glAccountDescription": "Fixed Income Unrealized G/L", "ledgerSection": "ASSETS", "category": "Holdings Unrealized"},
        {"glAccountNumber": "EAGLE-URGL-FX", "glAccountDescription": "FX Unrealized Gain/Loss", "ledgerSection": "ASSETS", "category": "Holdings Unrealized"},
        {"glAccountNumber": "EAGLE-AI-DIV", "glAccountDescription": "Accrued Dividends", "ledgerSection": "ASSETS", "category": "Dividend RecPay"},
        {"glAccountNumber": "EAGLE-AI-INT", "glAccountDescription": "Accrued Interest", "ledgerSection": "ASSETS", "category": "Interest RecPay"},
        {"glAccountNumber": "EAGLE-2050", "glAccountDescription": "Accounts Payable", "ledgerSection": "LIABILITIES", "category": "Expense RecPay"},
        {"glAccountNumber": "EAGLE-2100", "glAccountDescription": "Securities Purchased Payable", "ledgerSection": "LIABILITIES", "category": "Investment RecPay"},
        {"glAccountNumber": "EAGLE-2200", "glAccountDescription": "Capital Shares Payable", "ledgerSection": "LIABILITIES", "category": "Subscription Rec"},
        {"glAccountNumber": "EAGLE-2300", "glAccountDescription": "Distributions Payable", "ledgerSection": "LIABILITIES", "category": "Distribution Pay"},
        {"glAccountNumber": "EAGLE-2400", "glAccountDescription": "Accrued Expenses", "ledgerSection": "LIABILITIES", "category": "Expense RecPay"},
        {"glAccountNumber": "EAGLE-3100", "glAccountDescription": "Capital Stock", "ledgerSection": "EQUITY", "category": "Capital"},
        {"glAccountNumber": "EAGLE-3200", "glAccountDescription": "Undistributed Net Income", "ledgerSection": "EQUITY", "category": "Capital"},
        {"glAccountNumber": "EAGLE-3300", "glAccountDescription": "Accumulated Realized Gains", "ledgerSection": "EQUITY", "category": "Realized GL"},
        {"glAccountNumber": "EAGLE-3400", "glAccountDescription": "Net Unrealized Appreciation", "ledgerSection": "EQUITY", "category": "Unrealized INCST"},
        {"glAccountNumber": "EAGLE-4100", "glAccountDescription": "Dividend Income", "ledgerSection": "INCOME", "category": "Income"},
        {"glAccountNumber": "EAGLE-4200", "glAccountDescription": "Interest Income", "ledgerSection": "INCOME", "category": "Income"},
        {"glAccountNumber": "EAGLE-4300", "glAccountDescription": "Realized Gains - Securities", "ledgerSection": "INCOME", "category": "Realized GL"},
        {"glAccountNumber": "EAGLE-4400", "glAccountDescription": "Realized Gains - FX", "ledgerSection": "INCOME", "category": "Realized GL"},
        {"glAccountNumber": "EAGLE-5100", "glAccountDescription": "Management Fees", "ledgerSection": "EXPENSE", "category": "Expenses"},
        {"glAccountNumber": "EAGLE-5200", "glAccountDescription": "Custody Fees", "ledgerSection": "EXPENSE", "category": "Expenses"},
        {"glAccountNumber": "EAGLE-5300", "glAccountDescription": "Audit Fees", "ledgerSection": "EXPENSE", "category": "Expenses"},
        {"glAccountNumber": "EAGLE-5400", "glAccountDescription": "Legal Fees", "ledgerSection": "EXPENSE", "category": "Expenses"},
    ]

    # Insert Incumbent accounts
    all_incumbent = state_street_accounts + northern_trust_accounts
    if all_incumbent:
        db[COLLECTIONS["refIncumbentGLAccounts"]].drop()
        db[COLLECTIONS["refIncumbentGLAccounts"]].insert_many(all_incumbent)
        print(f"  Seeded {len(all_incumbent)} incumbent GL accounts")

    # Insert Eagle accounts
    if eagle_accounts:
        db[COLLECTIONS["refEagleGLAccounts"]].drop()
        db[COLLECTIONS["refEagleGLAccounts"]].insert_many(eagle_accounts)
        print(f"  Seeded {len(eagle_accounts)} Eagle GL accounts")


# ══════════════════════════════════════════════════════════════
# Classification Mapping Data (per spec Section 10)
# ══════════════════════════════════════════════════════════════

def seed_classification_mapping_data(db):
    """
    Seed classification mapping tables from Process Flow Specification Section 10.
    - convAssetClassification (Section 10.2)
    - convTransClassification (Section 10.3)
    - convLedgerCategoryDerivation (Section 10.4)
    """

    # ── Asset Classification (Section 10.2) ────────────────────
    asset_classifications = [
        {"keySource": "investone", "keySecType": "S", "convAssetClass": "equity", "glCategoryImpact": "Investment Cost, Holdings Unrealized"},
        {"keySource": "investone", "keySecType": "MF", "convAssetClass": "mf", "glCategoryImpact": "Investment Cost, Holdings Unrealized"},
        {"keySource": "investone", "keySecType": "CA", "convAssetClass": "fixedIncome", "glCategoryImpact": "Investment Cost, Holdings Unrealized"},
        {"keySource": "investone", "keySecType": "TI", "convAssetClass": "fixedIncome", "glCategoryImpact": "Investment Cost, Holdings Unrealized"},
        {"keySource": "investone", "keySecType": "RP", "convAssetClass": "fixedIncome", "glCategoryImpact": "Investment Cost"},
        {"keySource": "investone", "keySecType": "CU", "convAssetClass": "cash", "glCategoryImpact": "Cash"},
        {"keySource": "investone", "keySecType": "FT", "convAssetClass": "future", "glCategoryImpact": "Future Margin"},
        {"keySource": "investone", "keySecType": "SW", "convAssetClass": "swapTrs", "glCategoryImpact": "Swap Income RecPay"},
        {"keySource": "eagle", "keySecType": "COM", "convAssetClass": "equity", "glCategoryImpact": "Investment Cost, Holdings Unrealized"},
        {"keySource": "eagle", "keySecType": "MUT", "convAssetClass": "mf", "glCategoryImpact": "Investment Cost, Holdings Unrealized"},
        {"keySource": "eagle", "keySecType": "CB", "convAssetClass": "fixedIncome", "glCategoryImpact": "Investment Cost, Holdings Unrealized"},
        {"keySource": "eagle", "keySecType": "GOV", "convAssetClass": "fixedIncome", "glCategoryImpact": "Investment Cost, Holdings Unrealized"},
        {"keySource": "eagle", "keySecType": "REPO", "convAssetClass": "fixedIncome", "glCategoryImpact": "Investment Cost"},
        {"keySource": "eagle", "keySecType": "CASH", "convAssetClass": "cash", "glCategoryImpact": "Cash"},
        {"keySource": "eagle", "keySecType": "FUT", "convAssetClass": "future", "glCategoryImpact": "Future Margin"},
        {"keySource": "eagle", "keySecType": "SWAP", "convAssetClass": "swapTrs", "glCategoryImpact": "Swap Income RecPay"},
    ]
    db[COLLECTIONS["convAssetClassification"]].insert_many(asset_classifications)
    print(f"  Seeded {len(asset_classifications)} asset classification mappings")

    # ── Transaction Classification (Section 10.3) ──────────────
    trans_classifications = [
        {"keySource": "investone", "keyTransCode": "BUY", "convTransClass": "longBuy", "recPayCategory": "Investment RecPay"},
        {"keySource": "investone", "keyTransCode": "SELL", "convTransClass": "longSell", "recPayCategory": "Investment RecPay"},
        {"keySource": "investone", "keyTransCode": "SHRT", "convTransClass": "shortSell", "recPayCategory": "Investment RecPay"},
        {"keySource": "investone", "keyTransCode": "COVER", "convTransClass": "buyCover", "recPayCategory": "Investment RecPay"},
        {"keySource": "investone", "keyTransCode": "DIV", "convTransClass": "dividend", "recPayCategory": "Dividend RecPay"},
        {"keySource": "investone", "keyTransCode": "DIV-", "convTransClass": "dividendNeg", "recPayCategory": "Dividend RecPay"},
        {"keySource": "investone", "keyTransCode": "DIVADJ", "convTransClass": "dividendPosAdj", "recPayCategory": "Dividend RecPay"},
        {"keySource": "investone", "keyTransCode": "WHT", "convTransClass": "divWHT", "recPayCategory": "Dividend RecPay"},
        {"keySource": "investone", "keyTransCode": "CPN", "convTransClass": "coupon", "recPayCategory": "Interest RecPay"},
        {"keySource": "investone", "keyTransCode": "RECL", "convTransClass": "reclaim", "recPayCategory": "Reclaim RecPay"},
        {"keySource": "investone", "keyTransCode": "RECL-", "convTransClass": "reclaimNeg", "recPayCategory": "Reclaim RecPay"},
    ]
    db[COLLECTIONS["convTransClassification"]].insert_many(trans_classifications)
    print(f"  Seeded {len(trans_classifications)} transaction classification mappings")

    # ── Ledger Category Derivation (Section 10.4) ──────────────
    ledger_category_derivations = [
        # Transaction-class rows (derivationType: "transaction")
        {"derivationType": "transaction", "convTransClass": "longBuy", "amntConvCategory": "Investment RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "longSell", "amntConvCategory": "Investment RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "shortSell", "amntConvCategory": "Investment RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "buyCover", "amntConvCategory": "Investment RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "dividend", "amntConvCategory": "Dividend RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "dividendNeg", "amntConvCategory": "Dividend RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "dividendPosAdj", "amntConvCategory": "Dividend RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "divWHT", "amntConvCategory": "Dividend RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "coupon", "amntConvCategory": "Interest RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "shortCoupon", "amntConvCategory": "Interest RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "reclaim", "amntConvCategory": "Reclaim RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "reclaimNeg", "amntConvCategory": "Reclaim RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "securityLending", "amntConvCategory": "Interest RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "securityLendingNeg", "amntConvCategory": "Interest RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "paydown", "amntConvCategory": "Investment RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "payup", "amntConvCategory": "Investment RecPay", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "futurePay", "amntConvCategory": "Future Margin", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        {"derivationType": "transaction", "convTransClass": "futureRec", "amntConvCategory": "Future Margin", "urglBsConvCategory": None, "intRecPayConvCat": None, "intUrglIncstConvCat": None},
        # Asset-class rows (derivationType: "asset")
        {"derivationType": "asset", "convAssetClass": "equity", "costConvCat": "Investment Cost", "urglBsConvCat": "Holdings Unrealized", "dailyMarginCat": None, "intRecPayCat": None, "intUrglIncstCat": "Unrealized INCST"},
        {"derivationType": "asset", "convAssetClass": "fixedIncome", "costConvCat": "Investment Cost", "urglBsConvCat": "Holdings Unrealized", "dailyMarginCat": None, "intRecPayCat": "Interest RecPay", "intUrglIncstCat": "Unrealized INCST"},
        {"derivationType": "asset", "convAssetClass": "cash", "costConvCat": "Cash", "urglBsConvCat": "Holdings Unrealized", "dailyMarginCat": None, "intRecPayCat": "Interest RecPay", "intUrglIncstCat": "Unrealized INCST"},
        {"derivationType": "asset", "convAssetClass": "future", "costConvCat": None, "urglBsConvCat": None, "dailyMarginCat": "Future Margin", "intRecPayCat": None, "intUrglIncstCat": None},
        {"derivationType": "asset", "convAssetClass": "mf", "costConvCat": "Investment Cost", "urglBsConvCat": "Holdings Unrealized", "dailyMarginCat": None, "intRecPayCat": None, "intUrglIncstCat": "Unrealized INCST"},
    ]
    db[COLLECTIONS["convLedgerCategoryDerivation"]].insert_many(ledger_category_derivations)
    print(f"  Seeded {len(ledger_category_derivations)} ledger category derivation mappings")


if __name__ == "__main__":
    seed_database()
