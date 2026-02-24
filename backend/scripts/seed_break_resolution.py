"""
Seed data for Break Resolution & Dashboarding feature set.

Run: cd backend && python -m scripts.seed_break_resolution

Populates:
  - Known Differences (KD 1–5 Methodology + SC 1–2 samples)
  - Reviewer Allocations across parallel period dates
  - Break Assignments with sample categorizations
  - Commentary at L2 (position) and L1 (GL) levels
  - Notifications (sample auto-assignment notifications)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from db.mongodb import get_sync_db, COLLECTIONS

db = get_sync_db()

# ── Configuration ────────────────────────────────────────────
EVENT_ID = "EVT-001"
PARALLEL_DATES = [
    "2025-11-28", "2025-11-29", "2025-12-01", "2025-12-02", "2025-12-03",
    "2025-12-04", "2025-12-05", "2025-12-08", "2025-12-09", "2025-12-10",
]
FUNDS = [
    {"account": "FUND001", "name": "Global Equity Fund"},
    {"account": "FUND002", "name": "Fixed Income Bond Fund"},
    {"account": "FUND003", "name": "Multi-Asset Balanced Fund"},
    {"account": "FUND004", "name": "Money Market Fund"},
    {"account": "FUND005", "name": "Emerging Markets Equity Fund"},
]
NOW = datetime.utcnow().isoformat()


def seed_known_differences():
    """Seed KD 1–5 (Methodology) and SC 1–2 samples."""
    print("Seeding Known Differences...")
    kds = [
        {"reference": "KD-001", "type": "Methodology", "summary": "Accrual calculation methodology difference", "comment": "BNY accrues on T+1, Incumbent on T+0", "isActive": True, "eventId": EVENT_ID},
        {"reference": "KD-002", "type": "Methodology", "summary": "FX rate source difference", "comment": "BNY uses WM/Reuters 4pm fix; Incumbent uses Bloomberg mid", "isActive": True, "eventId": EVENT_ID},
        {"reference": "KD-003", "type": "Methodology", "summary": "NAV per share rounding difference", "comment": "BNY rounds to 4dp, Incumbent to 6dp", "isActive": True, "eventId": EVENT_ID},
        {"reference": "KD-004", "type": "Methodology", "summary": "Withholding tax reclaim timing", "comment": "BNY records reclaim on accrual basis; Incumbent on cash basis", "isActive": True, "eventId": EVENT_ID},
        {"reference": "KD-005", "type": "Methodology", "summary": "Amortisation calculation method", "comment": "BNY uses effective interest; Incumbent uses straight-line", "isActive": True, "eventId": EVENT_ID},
        {"reference": "SC-001", "type": "Scope", "summary": "Share class fee allocation", "comment": "Share class fee allocation pending alignment", "isActive": True, "eventId": EVENT_ID},
        {"reference": "SC-002", "type": "Scope", "summary": "Performance fee crystallisation frequency", "comment": "Monthly vs quarterly crystallisation", "isActive": True, "eventId": EVENT_ID},
    ]
    for kd in kds:
        kd["createdAt"] = NOW
        kd["updatedBy"] = "seed-script"
    db[COLLECTIONS["knownDifferences"]].delete_many({"eventId": EVENT_ID})
    db[COLLECTIONS["knownDifferences"]].insert_many(kds)
    print(f"  Inserted {len(kds)} KDs")


def seed_reviewer_allocations():
    """Seed reviewer allocations across parallel period dates."""
    print("Seeding Reviewer Allocations...")
    reviewers = ["Jane Doe", "Mark Chen", "Sarah Kim", "David Park", "Rachel Torres"]
    allocations = []
    for date in PARALLEL_DATES:
        for i, fund in enumerate(FUNDS):
            allocations.append({
                "eventId": EVENT_ID,
                "valuationDate": date,
                "bnyAccount": fund["account"],
                "fundName": fund["name"],
                "reviewer": reviewers[i % len(reviewers)],
                "reviewStatus": "NOT_STARTED" if date > "2025-12-03" else "IN_PROGRESS" if date > "2025-11-29" else "COMPLETE",
                "createdAt": NOW,
            })
    db[COLLECTIONS["reviewerAllocations"]].delete_many({"eventId": EVENT_ID})
    db[COLLECTIONS["reviewerAllocations"]].insert_many(allocations)
    print(f"  Inserted {len(allocations)} allocations")


def seed_break_assignments():
    """Seed break assignments with sample categorizations."""
    print("Seeding Break Assignments...")
    assignments = [
        # Share breaks
        {"entityReference": "FUND001/AAPL", "breakType": "SHARE", "breakCategory": "UNDER_INVESTIGATION", "assignedTeam": "TRADE_CAPTURE", "assignedOwner": "Sarah Kim", "breakAmount": 1500.00},
        {"entityReference": "FUND001/MSFT", "breakType": "SHARE", "breakCategory": "KNOWN_DIFFERENCE", "assignedTeam": "TRADE_CAPTURE", "assignedOwner": "Tom Zhao", "breakAmount": -250.00},
        # Price breaks
        {"entityReference": "FUND002/UST10Y", "breakType": "PRICE", "breakCategory": "BNY_TO_RESOLVE", "assignedTeam": "PRICING", "assignedOwner": "Mark Chen", "breakAmount": 3200.00},
        {"entityReference": "FUND003/TSLA", "breakType": "PRICE", "breakCategory": "INCUMBENT_TO_RESOLVE", "assignedTeam": "PRICING", "assignedOwner": "Amy Liu", "breakAmount": -8900.00},
        # Income breaks
        {"entityReference": "FUND001/AAPL/DIV", "breakType": "INCOME", "breakCategory": "KNOWN_DIFFERENCE", "assignedTeam": "INCOME", "assignedOwner": "Karen Wu", "breakAmount": 450.00},
        {"entityReference": "FUND002/UST10Y/COUPON", "breakType": "INCOME", "breakCategory": "MATCH", "assignedTeam": "INCOME", "assignedOwner": "Jason Miller", "breakAmount": 0.00},
        # Derivatives
        {"entityReference": "FUND003/FWD-EUR-USD", "breakType": "DERIVATIVE", "breakCategory": "BNY_TO_RESOLVE", "assignedTeam": "DERIVATIVES", "assignedOwner": "Alex Johnson", "breakAmount": 12500.00},
        {"entityReference": "FUND005/FUT-SP500", "breakType": "DERIVATIVE", "breakCategory": "UNDER_INVESTIGATION", "assignedTeam": "DERIVATIVES", "assignedOwner": "Maria Garcia", "breakAmount": -5600.00},
    ]
    for a in assignments:
        a["eventId"] = EVENT_ID
        a["valuationDate"] = "2025-12-01"
        a["reconciliationLevel"] = "L2_POSITION"
        a["reviewStatus"] = "NOT_STARTED"
        a["autoAssigned"] = True
        a["assignedAt"] = NOW
    db[COLLECTIONS["breakAssignments"]].delete_many({"eventId": EVENT_ID})
    db[COLLECTIONS["breakAssignments"]].insert_many(assignments)
    print(f"  Inserted {len(assignments)} break assignments")


def seed_commentary():
    """Seed commentary at L2 (position) and L1 (GL) levels."""
    print("Seeding Commentary...")
    comments = [
        {"reconciliationLevel": "L2_POSITION", "entityReference": "FUND001/AAPL", "breakCategory": "UNDER_INVESTIGATION", "amount": 1500.00, "text": "Investigating share difference — possible late trade settlement", "fundAccount": "FUND001"},
        {"reconciliationLevel": "L2_POSITION", "entityReference": "FUND001/MSFT", "breakCategory": "KNOWN_DIFFERENCE", "amount": -250.00, "text": "KD-001: Accrual timing difference — resolved via methodology alignment", "kdReference": "KD-001", "fundAccount": "FUND001"},
        {"reconciliationLevel": "L1_GL", "entityReference": "FUND002/SECURITIES_AT_VALUE", "breakCategory": "BNY_TO_RESOLVE", "amount": 3200.00, "text": "Price source difference on UST10Y — BNY using stale price", "fundAccount": "FUND002"},
        {"reconciliationLevel": "L2_POSITION", "entityReference": "FUND003/TSLA", "breakCategory": "INCUMBENT_TO_RESOLVE", "amount": -8900.00, "text": "Incumbent reported closing price from different exchange", "fundAccount": "FUND003"},
        {"reconciliationLevel": "L1_GL", "entityReference": "FUND001/DIVIDENDS_RECEIVABLE", "breakCategory": "KNOWN_DIFFERENCE", "amount": 450.00, "text": "KD-004: Withholding tax reclaim timing — accrual vs cash basis", "kdReference": "KD-004", "fundAccount": "FUND001"},
    ]
    for c in comments:
        c["eventId"] = EVENT_ID
        c["commentId"] = f"CMT-{comments.index(c) + 1:03d}"
        c["currency"] = "USD"
        c["createdBy"] = "seed-script"
        c["createdAt"] = NOW
        c["updatedAt"] = NOW
    db[COLLECTIONS["commentary"]].delete_many({"eventId": EVENT_ID})
    db[COLLECTIONS["commentary"]].insert_many(comments)
    print(f"  Inserted {len(comments)} commentary entries")


def seed_share_class_data():
    """Seed share class NAV data into navSummary for EVT-001 funds across parallel dates."""
    print("Seeding Share Class Data...")
    share_classes_by_fund = {
        "FUND001": [
            {"shareClass": "A", "shareClassDesc": "Class A - Retail"},
            {"shareClass": "I", "shareClassDesc": "Class I - Institutional"},
            {"shareClass": "R", "shareClassDesc": "Class R - Retirement"},
        ],
        "FUND002": [
            {"shareClass": "A", "shareClassDesc": "Class A - Retail"},
            {"shareClass": "I", "shareClassDesc": "Class I - Institutional"},
        ],
        "FUND003": [
            {"shareClass": "A", "shareClassDesc": "Class A - Retail"},
            {"shareClass": "I", "shareClassDesc": "Class I - Institutional"},
            {"shareClass": "F", "shareClassDesc": "Class F - Fee-Based"},
        ],
    }

    # Base NAV values per fund/share class
    base_navs = {
        "FUND001": {"A": 125000000.00, "I": 350000000.00, "R": 75000000.00},
        "FUND002": {"A": 200000000.00, "I": 500000000.00},
        "FUND003": {"A": 180000000.00, "I": 420000000.00, "F": 95000000.00},
    }

    # Small daily variations for realism
    daily_offsets = [0.0, 0.0012, -0.0008, 0.0015, -0.0003, 0.0021, -0.0011, 0.0007, 0.0018, -0.0005]

    records = []
    selected_dates = PARALLEL_DATES[:5]  # Use first 5 dates

    for fund_account, share_classes in share_classes_by_fund.items():
        fund_info = next((f for f in FUNDS if f["account"] == fund_account), None)
        if not fund_info:
            continue

        for sc in share_classes:
            base_nav = base_navs[fund_account][sc["shareClass"]]
            shares_outstanding = round(base_nav / 25.0, 2)  # ~$25 NAV per share

            for date_idx, val_date in enumerate(selected_dates):
                offset = daily_offsets[date_idx % len(daily_offsets)]
                bny_nav = round(base_nav * (1 + offset), 2)
                # Incumbent has a small additional variance to create realistic breaks
                incumbent_offset = offset + (0.00005 if date_idx % 3 == 0 else -0.00003 if date_idx % 3 == 1 else 0)
                incumbent_nav = round(base_nav * (1 + incumbent_offset), 2)

                bny_nav_per_share = round(bny_nav / shares_outstanding, 6)
                incumbent_nav_per_share = round(incumbent_nav / shares_outstanding, 6)

                # BNY record
                records.append({
                    "eventId": EVENT_ID,
                    "fundAccount": fund_account,
                    "fundName": fund_info["name"],
                    "shareClass": sc["shareClass"],
                    "shareClassDesc": sc["shareClassDesc"],
                    "valuationDate": val_date,
                    "source": "BNY",
                    "netAssets": bny_nav,
                    "navPerShare": bny_nav_per_share,
                    "sharesOutstanding": shares_outstanding,
                    "totalExpenseRatio": round(0.0045 + (0.001 if sc["shareClass"] == "A" else 0), 4),
                    "createdAt": NOW,
                })

                # Incumbent record
                records.append({
                    "eventId": EVENT_ID,
                    "fundAccount": fund_account,
                    "fundName": fund_info["name"],
                    "shareClass": sc["shareClass"],
                    "shareClassDesc": sc["shareClassDesc"],
                    "valuationDate": val_date,
                    "source": "INCUMBENT",
                    "netAssets": incumbent_nav,
                    "navPerShare": incumbent_nav_per_share,
                    "sharesOutstanding": shares_outstanding,
                    "totalExpenseRatio": round(0.0045 + (0.001 if sc["shareClass"] == "A" else 0), 4),
                    "createdAt": NOW,
                })

    # Clear existing share class records for this event
    db[COLLECTIONS["navSummary"]].delete_many({
        "eventId": EVENT_ID,
        "shareClass": {"$exists": True},
    })
    if records:
        db[COLLECTIONS["navSummary"]].insert_many(records)
    print(f"  Inserted {len(records)} share class NAV records")


def seed_notifications():
    """Seed sample auto-assignment notifications."""
    print("Seeding Notifications...")
    notifications = [
        {"assignedOwner": "Sarah Kim", "breakType": "SHARE", "entityReference": "FUND001/AAPL", "fundAccount": "FUND001", "fundName": "Global Equity Fund", "message": "New share break assigned: FUND001/AAPL in Global Equity Fund", "isRead": False},
        {"assignedOwner": "Mark Chen", "breakType": "PRICE", "entityReference": "FUND002/UST10Y", "fundAccount": "FUND002", "fundName": "Fixed Income Bond Fund", "message": "New price break assigned: FUND002/UST10Y in Fixed Income Bond Fund", "isRead": False},
        {"assignedOwner": "Alex Johnson", "breakType": "DERIVATIVE", "entityReference": "FUND003/FWD-EUR-USD", "fundAccount": "FUND003", "fundName": "Multi-Asset Balanced Fund", "message": "New derivative break assigned: FUND003/FWD-EUR-USD in Multi-Asset Balanced Fund", "isRead": True},
        {"assignedOwner": "Karen Wu", "breakType": "INCOME", "entityReference": "FUND001/AAPL/DIV", "fundAccount": "FUND001", "fundName": "Global Equity Fund", "message": "New income break assigned: FUND001/AAPL/DIV in Global Equity Fund", "isRead": False},
    ]
    for n in notifications:
        n["eventId"] = EVENT_ID
        n["channel"] = "IN_APP"
        n["createdAt"] = NOW
    db[COLLECTIONS["notifications"]].delete_many({"eventId": EVENT_ID})
    db[COLLECTIONS["notifications"]].insert_many(notifications)
    print(f"  Inserted {len(notifications)} notifications")


def main():
    print(f"=== Seeding Break Resolution data for event {EVENT_ID} ===\n")
    seed_known_differences()
    seed_reviewer_allocations()
    seed_break_assignments()
    seed_commentary()
    seed_notifications()
    seed_share_class_data()
    print(f"\n=== Seed complete ===")


if __name__ == "__main__":
    main()
