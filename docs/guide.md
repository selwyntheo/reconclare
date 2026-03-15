## New Event Configuration — Step-by-Step Guide

### Regulatory Filing (MMIF/CBI)

**1. Create the Event**
From the **Event Dashboard**, click **+ New Event** and select **Regulatory Filing**. Enter:
- Event name (e.g., "Q2 2026 CBI Filing — Irish UCITS Range")
- Regulator: CBI
- Filing period: 2026Q2
- Filing frequency: Quarterly / Monthly
- Filing deadline

**2. Add Funds**
Upload or select funds for the filing scope. Each fund requires:
- **Account code** (e.g., IE-UCITS-EQ-001)
- **Fund name**
- **Fund type** (UCITS, AIF, MMF, or HEDGE)
- **Domicile** and **CBI code**
- **Share classes** (ISIN list)

Funds can be bulk-imported from Eagle via CSV or selected from the fund master.

**3. Configure Mapping Templates**
Navigate to the **Mapping Config** tab. One template card appears per fund type in your event (e.g., UCITS Template — 12 funds, MMF Template — 3 funds).

For each fund type:
- Click **Edit Template** to open the mapping editor
- Define GL-to-MMIF section mappings (Eagle GL pattern → MMIF section + field)
- Configure **Counterparty Enrichment** (entity → sector code + country)
- Configure **Investor Classification** (sector code → label)
- Review unmapped accounts
- Click **Save Configuration**

Use **Reset to Defaults** to load the pre-built template for that fund type.

**4. Set Up Validation Rules**
In the **Validation Rules** tab, review rules VR-001 through VR-020. Each rule defines a tie-out between Eagle accounting data and MMIF reported data. To add a custom rule:
- Click **+ New Rule**
- Define rule ID, name, severity (HARD/SOFT), MMIF section, and tolerance
- Write the validation expression using the CEL-based DSL editor or use **AI Assist** to generate from plain English

**5. Run Validation**
Click the **Run Validation** FAB to execute all active rules against the event's fund data. The engine compares Eagle trial balance values to MMIF reported values.

**6. Review Breaks**
- Expand rule rows in **Validation Rules** to see which funds are breaking
- Click a fund row to drill down to the **Breaks by Fund** tab with that fund pre-selected
- Use the side-by-side view across 5 sub-tabs (Asset & Liability, Capital, Shareholder, NAV Tie-Out, Ledger Cross Check) to investigate variances

**7. Run AI Analysis**
Switch to **Agent Analysis** and click **Run Analysis**. The 6-agent pipeline investigates root causes and produces an attestation report with pass/fail per rule.

**8. File**
Once all HARD breaks are resolved, advance the event status through: DRAFT → MAPPING → EXTRACTION → RECONCILIATION → REVIEW → **FILED**.

---

### Conversion Event (Incumbent → Eagle)

**1. Create the Event**
From the **Event Dashboard**, click **+ New Event** and select **Conversion**. Enter:
- Event name (e.g., "Vanguard Fixed Income Migration")
- Source custodian (From): e.g., State Street
- Target custodian (To): Eagle
- Go-live date
- Parallel run period

**2. Add Funds**
Define the fund list being migrated. Each fund requires:
- **Account code**
- **Fund name**
- **Fund type** and **domicile**
- **Share classes**

For external conversions (custodian-to-custodian), both incumbent and Eagle data sources are configured. For internal conversions (system upgrade), only the Eagle data source is needed.

**3. Configure Ledger & GL Mapping**
Use the **Ledger Mapping** and **GL Account Mapping** pages to map:
- Incumbent chart of accounts → Eagle chart of accounts
- Classification codes → Eagle classification codes

**4. Run Parallel Reconciliation**
During the parallel run period, the reconciliation engine compares positions, balances, and transactions between the incumbent system and Eagle across:
- **Position Drill-Down** — Security-level position reconciliation
- **NAV Dashboard** — Fund-level NAV comparison
- **Income & Dividends** — Accrual and distribution matching

**5. Review & Resolve Breaks**
Use the **Human Review** queue to investigate and resolve breaks. Each break can be:
- Approved (valid difference)
- Rejected (requires correction)
- Escalated to Recon Lead

**6. Sign Off**
Once all critical breaks are resolved and parallel runs match within tolerance, the event moves to **Active** status and the conversion is complete.