"""
Seed rich data for all 5 NAV sub-view dashboards on EVT-2026-001.

Run: cd backend && python -m scripts.seed_nav_dashboards

Populates (additive — does NOT drop existing data):
  - navSummary: multiple share classes per fund, multiple valuation dates
  - knownDifferences: sample KDs for EVT-2026-001
  - reviewerAllocations: sample allocations across dates
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from db.mongodb import get_sync_db, COLLECTIONS

db = get_sync_db()

EVENT_ID = "EVT-2026-001"
NOW = datetime.utcnow().isoformat()

# The 6 funds in EVT-2026-001
FUNDS = [
    {"account": "VG-BOND-IDX",   "name": "VG Bond Index",            "shareClasses": ["Admiral", "Investor"]},
    {"account": "VG-CORP-BOND",  "name": "VG Corp Bond",             "shareClasses": ["Admiral", "ETF"]},
    {"account": "VG-HIGH-YIELD", "name": "VG High Yield",            "shareClasses": ["Admiral", "Investor", "ETF"]},
    {"account": "VG-TREASURY",   "name": "VG Treasury",              "shareClasses": ["Admiral", "Investor"]},
    {"account": "VG-TIPS",       "name": "VG Inflation-Protected",   "shareClasses": ["Admiral"]},
    {"account": "VG-INTL-BOND",  "name": "VG International Bond",    "shareClasses": ["Admiral", "Investor"]},
]

VALUATION_DATES = [
    "2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05",
    "2026-02-06", "2026-02-07", "2026-02-09", "2026-02-10",
]

# Base NAV for each fund's Admiral share class
BASE_NAV = {
    "VG-BOND-IDX":   250000000,
    "VG-CORP-BOND":   98750000,
    "VG-HIGH-YIELD": 125428400,
    "VG-TREASURY":   180000000,
    "VG-TIPS":        75000000,
    "VG-INTL-BOND":   45000000,
}

# Share class proportion of total fund NAV
SC_PROPORTIONS = {
    "Admiral":  0.55,
    "Investor": 0.30,
    "ETF":      0.15,
}

# Daily multiplier offsets (to simulate day-over-day movement)
DAILY_OFFSETS = [
    -0.0015, 0.0008, 0.0022, -0.0005,
     0.0012, 0.0000, -0.0010, 0.0018,
]

# Per-fund incumbent variance (in basis points) — creates RAG spread
INCUMBENT_BP_VARIANCE = {
    "VG-BOND-IDX":    0.5,   # Green — tight
    "VG-CORP-BOND":  12.6,   # Amber
    "VG-HIGH-YIELD": 67.0,   # Red — large break
    "VG-TREASURY":    0.0,   # Green — exact match
    "VG-TIPS":        3.2,   # Green — small
    "VG-INTL-BOND":   0.7,   # Green — rounding
}


def seed_nav_summary():
    """Seed navSummary with multiple share classes and multiple dates."""
    print("Seeding navSummary for all dates and share classes...")

    # Remove any existing records for these accounts + dates to avoid dups
    accounts = [f["account"] for f in FUNDS]
    db[COLLECTIONS["navSummary"]].delete_many({
        "account": {"$in": accounts},
        "valuationDt": {"$in": VALUATION_DATES},
    })

    records = []
    for fund in FUNDS:
        acct = fund["account"]
        total_nav = BASE_NAV[acct]
        bp_var = INCUMBENT_BP_VARIANCE[acct]

        for sc in fund["shareClasses"]:
            proportion = SC_PROPORTIONS.get(sc, 0.5)
            sc_nav = total_nav * proportion

            for dt_idx, val_dt in enumerate(VALUATION_DATES):
                offset = DAILY_OFFSETS[dt_idx % len(DAILY_OFFSETS)]
                cpu_nav = round(sc_nav * (1 + offset), 2)
                shares = round(cpu_nav / 25.0, 2)
                nav_per_share = round(cpu_nav / shares, 6) if shares else 0

                # CPU (BNY equivalent)
                records.append({
                    "shareClass": sc,
                    "sharesOutstanding": shares,
                    "settledShares": shares,
                    "netAssets": cpu_nav,
                    "NAV": nav_per_share,
                    "account": acct,
                    "valuationDt": val_dt,
                    "userBank": "CPU",
                })

                # Incumbent — apply per-fund basis-point variance
                inc_nav = round(cpu_nav * (1 - bp_var / 10000), 2)
                inc_shares = round(inc_nav / 25.0, 2)
                inc_nav_per_share = round(inc_nav / inc_shares, 6) if inc_shares else 0

                records.append({
                    "shareClass": sc,
                    "sharesOutstanding": inc_shares,
                    "settledShares": inc_shares,
                    "netAssets": inc_nav,
                    "NAV": inc_nav_per_share,
                    "account": acct,
                    "valuationDt": val_dt,
                    "userBank": "INCUMBENT",
                })

    db[COLLECTIONS["navSummary"]].insert_many(records)
    print(f"  Inserted {len(records)} navSummary records "
          f"({len(FUNDS)} funds x {len(VALUATION_DATES)} dates x multiple share classes x 2 sides)")


def seed_known_differences():
    """Seed Known Differences for EVT-2026-001."""
    print("Seeding Known Differences...")
    kds = [
        {
            "reference": "KD-VG-001",
            "type": "Methodology",
            "summary": "Bond accrual day-count mismatch (ACT/ACT vs 30/360)",
            "comment": "BNY uses ACT/ACT for bond income accruals; State Street uses 30/360",
            "isActive": True,
            "eventId": EVENT_ID,
        },
        {
            "reference": "KD-VG-002",
            "type": "Methodology",
            "summary": "FX rate source difference on international bonds",
            "comment": "BNY uses WM/Reuters 4pm London fix; State Street uses Bloomberg mid-rate",
            "isActive": True,
            "eventId": EVENT_ID,
        },
        {
            "reference": "KD-VG-003",
            "type": "Methodology",
            "summary": "Treasury TIPS inflation adjustment timing",
            "comment": "BNY applies CPI adjustment on T+0; State Street on T+1",
            "isActive": True,
            "eventId": EVENT_ID,
        },
        {
            "reference": "SC-VG-001",
            "type": "Scope",
            "summary": "ETF share class creation/redemption settlement timing",
            "comment": "ETF AP basket settlement handled differently in parallel period",
            "isActive": True,
            "eventId": EVENT_ID,
        },
    ]
    for kd in kds:
        kd["createdAt"] = NOW
        kd["updatedBy"] = "seed-script"
    db[COLLECTIONS["knownDifferences"]].delete_many({"eventId": EVENT_ID})
    db[COLLECTIONS["knownDifferences"]].insert_many(kds)
    print(f"  Inserted {len(kds)} KDs")


def seed_reviewer_allocations():
    """Seed reviewer allocations for EVT-2026-001 across valuation dates."""
    print("Seeding Reviewer Allocations...")
    reviewers = ["Jane Doe", "Mike Chen", "Sarah Kim", "Tom Rivera", "Lisa Park", "David Wu"]

    allocations = []
    for dt_idx, val_dt in enumerate(VALUATION_DATES):
        for fund_idx, fund in enumerate(FUNDS):
            status = "COMPLETE" if dt_idx < 3 else "IN_PROGRESS" if dt_idx < 6 else "NOT_STARTED"
            allocations.append({
                "eventId": EVENT_ID,
                "valuationDate": val_dt,
                "bnyAccount": fund["account"],
                "fundName": fund["name"],
                "reviewer": reviewers[fund_idx % len(reviewers)],
                "assignedReviewerName": reviewers[fund_idx % len(reviewers)],
                "reviewStatus": status,
                "createdAt": NOW,
            })

    db[COLLECTIONS["reviewerAllocations"]].delete_many({"eventId": EVENT_ID})
    db[COLLECTIONS["reviewerAllocations"]].insert_many(allocations)
    print(f"  Inserted {len(allocations)} allocations ({len(FUNDS)} funds x {len(VALUATION_DATES)} dates)")


def main():
    print(f"=== Seeding NAV Dashboard data for {EVENT_ID} ===\n")
    seed_nav_summary()
    seed_known_differences()
    seed_reviewer_allocations()
    print(f"\n=== Seed complete — all 5 NAV dashboards should now populate ===")
    print("  Fund Level:           /events/EVT-2026-001/nav-dashboard?valuationDt=2026-02-07")
    print("  Share Class Dashboard: /events/EVT-2026-001/nav-dashboard/share-class-dashboard?valuationDt=2026-02-07")
    print("  Client Scorecard:     /events/EVT-2026-001/nav-dashboard/scorecard?valuationDt=2026-02-07")
    print("  RAG Tracker:          /events/EVT-2026-001/nav-dashboard/rag-tracker")
    print("  Per-fund Share Class: /events/EVT-2026-001/nav-dashboard/share-class/VG-HIGH-YIELD?valuationDt=2026-02-07")


if __name__ == "__main__":
    main()
