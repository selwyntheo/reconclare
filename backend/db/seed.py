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

    print("📦 Seeding events...")
    seed_events(db)

    print("📦 Seeding canonical data (CPU + Incumbent)...")
    seed_canonical_data(db)

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
        ledger_cpu=[
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
        ledger_cpu=[
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
        ledger_cpu=[
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
        ledger_cpu=[
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


if __name__ == "__main__":
    seed_database()
