8) UX for accountants (what makes this usable)

1) Control Center
	•	match rate, break aging, materiality
	•	“new break patterns today” vs yesterday
	•	“config drift detected” banners (mapping version mismatches)

2) Break Explorer

Columns:
	•	fund / date / component / account group
	•	variance amount (base + local)
	•	break type + confidence
	•	“top candidate cause” + “open investigation”

3) Investigation Workspace

Tabs:
	•	Lineage Graph: NAV comp → postings → JE lines → subledger docs → events
	•	Side-by-side: Your chain vs incumbent chain
	•	Candidate Set: minimal explaining set (ranked)
	•	Hypothesis Tests: checkmarks with results (timing/mapping/FX/etc.)
	•	Evidence Log: every query run + outputs + config versions

4) One-click outcomes
	•	“Mark as config issue” → opens diff + recommended patch
	•	“Mark as incumbent timing difference” → records rationale + closes
	•	“Create correction JE proposal” → generates template and supporting evidence pack
