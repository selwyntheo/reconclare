
⸻

Data Validation Rules

System: InvestOne / Eagle Conversion
Purpose: Multi-level reconciliation validation framework
Document Type: Technical Rule Specification

⸻

1. Validation Matrix (LHS vs RHS)

Each validation compares a Left-Hand Side (LHS) dataset to a Right-Hand Side (RHS) dataset using defined keys, comparison fields, and filters.

⸻

1.1 NAV to Ledger

LHS
	•	Source: dataNav
	•	Keys: valuationDt | account | class
	•	Displays: accountName
	•	Compares: netAssets
	•	Filter:

isPrimaryBasis = 'Y'



RHS
	•	Source: dataLedger
	•	Keys: valuationDt | account | class
	•	Displays: accountName
	•	Compares: endingBalance
	•	Filter:

isPrimaryBasis = 'Y'
AND eagleClass = 'TF'
AND (LEFT(eagleLedgerAcct,1) = '1' OR LEFT(eagleLedgerAcct,1) = '2')



⸻

1.2 Ledger BS to INCST

LHS
	•	Source: dataLedger
	•	Keys: valuationDt | account
	•	Displays: accountName
	•	Compares: endingBalance
	•	Filter:

isPrimaryBasis = 'Y'
AND eagleClass = 'TF'
AND (LEFT(eagleLedgerAcct,1) <> '1' AND LEFT(eagleLedgerAcct,1) <> '2')



RHS
	•	Source: dataLedger
	•	Keys: valuationDt | account
	•	Displays: accountName
	•	Compares: endingBalance
	•	Filter:

isPrimaryBasis = 'Y'
AND eagleClass = 'TF'
AND isSleeve <> 1



⸻

1.3 Ledger TF to Class

LHS
	•	Source: dataLedger
	•	Keys: valuationDt | account | glAccountNumber
	•	Displays: glDescription
	•	Compares: endingBalance
	•	Filter:

eagleClass = 'TF'
AND classLevel = 1
AND isSleeve = 0
AND isPrimaryBasis = 'Y'



RHS
	•	Source: dataLedger
	•	Keys: valuationDt | account | glAccountNumber
	•	Displays: glDescription
	•	Compares: endingBalance
	•	Filter:

eagleClass = 'TF'
AND isComposite = 1
AND isPrimaryBasis = 'Y'



⸻

1.4 Position to Lot

LHS
	•	Source: dataSubLedgerTrans
	•	Keys: valuationDt | account | class | assetid | longShort
	•	Displays: secType | issueDescription
	•	Compares:
	•	shares
	•	originalFace
	•	origCostLocal
	•	origCostBase
	•	bookValueLocal
	•	bookValueBase
	•	marketValueLocal
	•	marketValueBase

RHS
	•	Source: dataSubLedgerPosition
	•	Keys: valuationDt | account | class | assetid | longShort
	•	Displays: secType | issueDescription
	•	Compares:
	•	posShares
	•	posOriginalFace
	•	posOrigCostLocal
	•	posOrigCostBase
	•	posBookValueLocal
	•	posBookValueBase
	•	posMarketValueLocal
	•	posMarketValueBase

⸻

1.5 Ledger to Subledger

LHS
	•	Source: dataLedger
	•	Keys: valuationDt | account | eagleLedgerAcct
	•	Displays: ledgerDescription
	•	Compares: endingBalance
	•	Filter:

eagleClass = 'TF'
AND isPrimaryBasis = 'Y'



RHS
	•	Source: derivedSubLedgerRollup
	•	Keys: valuationDt | account | eagleLedgerAcct
	•	Displays: ledgerDescription
	•	Compares: subLedgerValue
	•	Filter:

isPrimaryBasis = 'Y'



⸻

1.6 Basis Lot Check

LHS
	•	Source: dataSubLedgerTrans
	•	Keys: valuationDt | account | class | assetid
	•	Displays: secType | issueDescription
	•	Compares: shares
	•	Filter:

isPrimaryBasis = 'Y'



RHS
	•	Source: dataSubLedgerTrans
	•	Keys: valuationDt | account | class | assetid
	•	Displays: secType | issueDescription
	•	Compares: shares
	•	Filter:

isPrimaryBasis <> 'Y'



⸻

2. Derived SubLedger Rollup Rules

These rules generate the derivedSubLedgerRollup dataset used in Ledger-to-Subledger validation.

⸻

2.1 Capital & Subscriptions

Rule Name	Source Table	Ledger Definition	Data Definition
Capital Subs	dataNav	3002000110	[subscriptionBalance] * -1
Capital Reds	dataNav	3002000210	[redemptionBalance]
Capital Reinvest	dataNav	3002000210	[reinvestedDistribution] * -1
Capital Subs Rec	dataNav	1005000300	[subscriptionRecBase]
Capital Reds Pay	dataNav	2005003500	[redemptionPayBase] * -1


⸻

2.2 Distribution

Rule Name	Ledger Definition	Data Definition
Dist Income	3004000100	[incomeDistribution]
Dist STCG	3004000120	[stcgDistribution]
Dist LTCG	3004000110	[ltcgDistribution]
Dist Payable	2006000700	[distributionPayable] * -1


⸻

2.3 Forwards

Rule Name	Source	Ledger	Data Definition
Forward Cost Rec	dataSubLedgerTrans	1007001100	ABS([fwdBookValue])
Forward Cost Pay	dataSubLedgerTrans	2005002900	ABS([fwdBookValue]) * -1
Forward URGL BS	dataSubLedgerTrans	1011000201	[fwdUnrealized]
Forward URGL INCST	dataSubLedgerTrans	4004000401	[fwdUnrealized] * -1


⸻

2.4 Repo (RPR)

Rule Name	Ledger	Data Definition
RPR Cost	[eagleRecPayLedger]	[transAmountBase]
RPR URGL BS	1011000300	[transMarketValue] - [transAmountBase]
RPR URGL INCST	3003000800	([transMarketValue] - [transAmountBase]) * -1


⸻

2.5 Securities

Rule Name	Ledger	Data Definition
Security Cost	[eagleCostLedgerAcct]	posBookValueBase
Security Interest	[eagleIntLedgerAcct]	posIncomeBase
Security URGL BS	1011000101	[posMarketValueBase] - [posBookValueBase]
Security URGL INCST	3003000301	([posMarketValueBase] - [posBookValueBase]) * -1


⸻

2.6 Ledger Load

Rule Name	Source	Ledger	Data Definition	Filter
Ledger Load	dataLedger	[eagleLedgerAcct]	endingBalance	ledgerLoad = 1


⸻

2.7 Futures & Income Unrealized

Rule Name	Ledger	Data Definition
Future URGL INCST	3003000500	[ltdVariationMarginBase]
Security Int URGL BS	1011000300	[posIncomeMarket] - [posIncomeBase]
Security Int URGL INCST	3003000800	([posIncomeMarket] - [posIncomeBase]) * -1


⸻

End of Document

