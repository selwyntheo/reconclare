## MMIF Reconciliation — User Guide
1. Open an MMIF Event
From the Event Dashboard, click the Regulatory Filing tab to filter MMIF events. Select an event card (e.g., "Q1 2026 CBI Filing — Irish UCITS") to open the reconciliation workspace.

The event header displays the filing period, regulator, and two KPI cards: Total Funds in scope and Total Breaks detected. A severity strip below summarizes break counts by type (HARD / SOFT).

2. Review Validation Rules (Tab 0)
The Validation Rules tab lists all active rules (VR-001 through VR-020). Each row shows:

Rule ID & Name — e.g., VR-001 "Total Assets Tie-Out"
Severity — HARD (blocking) or SOFT (warning)
MMIF Section — the CBI reporting section being validated (e.g., 4.3)
Break Count — number of funds failing this rule
Description — the tie-out logic being enforced
To edit a rule's CEL expression, click the pencil icon on any row. Use the AI Assist button to generate rule logic from a plain-English description.

3. Execute Validation
Click the Run Validation button (bottom-right FAB) to execute all rules against the current event's fund data. The engine compares MMIF reported values against Eagle (Fund Accounting) trial balance data and flags variances as breaks.

4. Drill Down to Breaks by Fund
Rows with breaks are clickable. Click any rule row with a break count > 0 to drill down:

The view switches to the Breaks by Fund tab automatically
The fund with the first detected break is pre-selected in the dropdown
A traceability banner appears showing: Rule ID → Rule Name → MMIF Section → Fund Name
Use the Select Fund dropdown (Autocomplete) to switch between funds — searchable by name, account, type, or domicile. Each option shows break count and processing status.

5. Analyze Breaks by Fund (Tab 1)
The break detail view presents a side-by-side comparison across five sub-tabs:

Sub-Tab	What It Shows
Asset & Liability	TB balances vs MMIF positions with variance highlighting
Capital	Subscriptions, redemptions, distributions reconciliation
Shareholder	Share class ISIN positions — open, issued, redeemed, close
NAV Tie-Out	Capital + PnL vs NAV from SMA vs Shareholder Pivot
Ledger Cross Check	Full TB balance proof: Assets − Liabilities − Capital = 0
Each row displays a Break or Tied status chip. Use the Split / TB / MMIF toggle to switch between side-by-side and single-source views.

6. Run AI Analysis (Tab: Agent Analysis)
Switch to the Agent Analysis tab to invoke the 6-agent pipeline:

Click Run Analysis to start the automated investigation
The pipeline executes: L0 Scan → L1 Section Deep-Dive → L2 Cross-Section → L3 Temporal → Specialist → Attestation
Review the AI Analysis Report with root causes, severity ratings, and recommended remediation actions
The Attestation Report shows pass/fail for each validation rule with confidence scores
The traceability banner persists throughout, linking every finding back to the originating MMIF section and fund.