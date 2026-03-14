"""
Pydantic schemas for RECON-AI MongoDB documents.
Maps directly to canonical_model.md data model + UX spec application entities.
"""
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ══════════════════════════════════════════════════════════════
# Enums
# ══════════════════════════════════════════════════════════════

class EventType(str, Enum):
    CONVERSION = "CONVERSION"
    REGULATORY_FILING = "REGULATORY_FILING"


class EventStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PARALLEL = "PARALLEL"
    SIGNED_OFF = "SIGNED_OFF"
    COMPLETE = "COMPLETE"


class FundType(str, Enum):
    EQUITY = "EQUITY"
    FIXED_INCOME = "FIXED_INCOME"
    MULTI_ASSET = "MULTI_ASSET"
    MONEY_MARKET = "MONEY_MARKET"


# ══════════════════════════════════════════════════════════════
# MMIF Regulatory Filing Enums
# ══════════════════════════════════════════════════════════════

class MmifEventStatus(str, Enum):
    DRAFT = "DRAFT"
    MAPPING = "MAPPING"
    EXTRACTION = "EXTRACTION"
    RECONCILIATION = "RECONCILIATION"
    REVIEW = "REVIEW"
    FILED = "FILED"


class MmifFundType(str, Enum):
    UCITS = "UCITS"
    AIF = "AIF"
    MMF = "MMF"
    HEDGE = "HEDGE"


class MmifCheckType(str, Enum):
    VR_001 = "VR_001"  # Total Assets Tie-Out
    VR_002 = "VR_002"  # Equity Subtotal
    VR_003 = "VR_003"  # Debt Subtotal
    VR_004 = "VR_004"  # Cash Subtotal
    VR_005 = "VR_005"  # Derivative Net
    VR_006 = "VR_006"  # Opening = Prior Closing
    VR_007 = "VR_007"  # Balance Identity
    VR_008 = "VR_008"  # Accrued Income
    VR_009 = "VR_009"  # Fund Shares/Units
    VR_010 = "VR_010"  # P&L Quarter-Only
    VR_011 = "VR_011"  # FX Consistency
    VR_012 = "VR_012"  # ISIN Coverage
    VR_013 = "VR_013"  # Sec Lending Off-BS
    VR_014 = "VR_014"  # Short Position Sign
    VR_015 = "VR_015"  # Investor Decomposition
    VR_016 = "VR_016"  # BS Equation Check
    VR_017 = "VR_017"  # Net Income
    VR_018 = "VR_018"  # Net Gains/Losses
    VR_019 = "VR_019"  # Total PnL
    VR_020 = "VR_020"  # TB Overall Balance


class MmifSeverity(str, Enum):
    HARD = "HARD"
    SOFT = "SOFT"
    DERIVED = "DERIVED"
    ADVISORY = "ADVISORY"


class FilingFrequency(str, Enum):
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"


class MmifSection(str, Enum):
    PNL = "2"
    EQUITIES = "3.1"
    DEBT_SECURITIES = "3.2"
    PROPERTY = "3.3"
    SECURITIES_BORROWING = "3.4"
    CASH_DEPOSITS = "3.5"
    OTHER_ASSETS = "3.6"
    OVERDRAFTS = "4.1"
    DERIVATIVES = "4.2"
    TOTAL_ASSETS = "4.3"
    FUND_SHARES = "5.1"
    SECURITIES_LENDING = "5.2"
    LOANS = "5.3"
    OTHER_LIABILITIES = "5.4"


class FundStatus(str, Enum):
    PENDING = "PENDING"
    IN_PARALLEL = "IN_PARALLEL"
    PASSED = "PASSED"
    FAILED = "FAILED"
    SIGNED_OFF = "SIGNED_OFF"


class RunStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class CheckType(str, Enum):
    NAV_TO_LEDGER = "NAV_TO_LEDGER"
    LEDGER_BS_TO_INCST = "LEDGER_BS_TO_INCST"
    LEDGER_TF_TO_CLASS = "LEDGER_TF_TO_CLASS"
    POSITION_TO_LOT = "POSITION_TO_LOT"
    LEDGER_TO_SUBLEDGER = "LEDGER_TO_SUBLEDGER"
    BASIS_LOT_CHECK = "BASIS_LOT_CHECK"


class BreakState(str, Enum):
    DETECTED = "DETECTED"
    ANALYZING = "ANALYZING"
    AI_PASSED = "AI_PASSED"
    HUMAN_REVIEW_PENDING = "HUMAN_REVIEW_PENDING"
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"
    MODIFIED = "MODIFIED"
    ESCALATED = "ESCALATED"
    ACTION_PENDING = "ACTION_PENDING"
    CLOSED = "CLOSED"
    RESOLVED = "RESOLVED"


class BreakCategory(str, Enum):
    TIMING = "TIMING"
    METHODOLOGY = "METHODOLOGY"
    DATA = "DATA"
    PRICING = "PRICING"
    FX = "FX"
    ACCRUAL = "ACCRUAL"
    CORPORATE_ACTION = "CORPORATE_ACTION"
    POSITION = "POSITION"
    MAPPING = "MAPPING"
    UNKNOWN = "UNKNOWN"


class ReviewAction(str, Enum):
    ACCEPT = "ACCEPT"
    MODIFY = "MODIFY"
    REJECT = "REJECT"


class ValidationResultStatus(str, Enum):
    PASSED = "PASSED"
    FAILED = "FAILED"
    WARNING = "WARNING"


# ══════════════════════════════════════════════════════════════
# Canonical Data Model Schemas (from canonical_model.md)
# ══════════════════════════════════════════════════════════════

class DailyTransaction(BaseModel):
    """§1.1 dataDailyTransactions"""
    eventId: str
    valuationDt: str
    userBank: str
    account: str
    acctBasis: str
    shareClass: str
    assetId: str
    longShortInd: str
    transactionId: str
    transCode: str
    units: float
    currency: str
    amountLocal: float
    amountBase: float
    tradeDate: str
    settleDate: Optional[str] = None
    tradedIntLocal: Optional[float] = None
    tradedIntBase: Optional[float] = None
    shares: Optional[float] = None
    originalFace: Optional[float] = None
    origCostLocal: Optional[float] = None
    origCostBase: Optional[float] = None
    bookValueLocal: Optional[float] = None
    bookValueBase: Optional[float] = None
    lotTradeDate: Optional[str] = None
    lotSettleDate: Optional[str] = None


class RefSecurity(BaseModel):
    """§2.1 refSecurity"""
    assetId: str
    valuationDt: str
    userBank: str
    cusip: Optional[str] = None
    sedol: Optional[str] = None
    isin: Optional[str] = None
    ticker: Optional[str] = None
    secType: str
    issueDescription: str
    assetCurrency: str
    countryCode: Optional[str] = None
    issueDate: Optional[str] = None
    maturityDt: Optional[str] = None
    couponRate: Optional[float] = None
    dayCount: Optional[str] = None
    nextCallDate: Optional[str] = None
    callPrice: Optional[float] = None
    amortMethod: Optional[str] = None
    factor: Optional[float] = None
    firstCouponDate: Optional[str] = None
    lastCouponDate: Optional[str] = None
    paymentFrequency: Optional[str] = None
    divFrequency: Optional[str] = None


class RefFund(BaseModel):
    """§2.5 refFund"""
    account: str
    accountName: str


class RefLedger(BaseModel):
    """§2.4 refLedger"""
    glAccountNumber: str
    glDescription: str
    glCategory: str


class SubLedgerPosition(BaseModel):
    """§3.1 dataSubLedgerPosition"""
    userBank: str
    account: str
    acctBasis: str
    shareClass: str
    assetId: str
    longShortInd: str
    posShares: float
    posOriginalFace: Optional[float] = None
    posOrigCostLocal: float = 0
    posOrigCostBase: float = 0
    posBookValueLocal: float = 0
    posBookValueBase: float = 0
    posMarketValueLocal: float = 0
    posMarketValueBase: float = 0
    posMarketPrice: float = 0
    posUnrealizedLocal: Optional[float] = None
    posUnrealizedBase: Optional[float] = None
    posIncomeLocal: Optional[float] = None
    posIncomeBase: Optional[float] = None
    posIncomeCurrency: Optional[str] = None
    valuationDt: Optional[str] = None


class SubLedgerTrans(BaseModel):
    """§4.1 dataSubLedgerTrans"""
    acctBasis: str
    shareClass: str
    assetId: str
    longShortInd: str
    transactionId: str
    shares: float
    originalFace: Optional[float] = None
    origCostLocal: float = 0
    origCostBase: float = 0
    bookValueLocal: float = 0
    bookValueBase: float = 0
    lotTradeDate: Optional[str] = None
    lotSettleDate: Optional[str] = None
    marketValueLocal: Optional[float] = None
    marketValueBase: Optional[float] = None
    incomeLocal: Optional[float] = None
    incomeBase: Optional[float] = None
    account: Optional[str] = None
    valuationDt: Optional[str] = None


class NAVSummary(BaseModel):
    """§5.1 NAV Summary"""
    shareClass: str
    sharesOutstanding: float
    settledShares: Optional[float] = None
    netAssets: float
    NAV: float
    dailyDistribution: Optional[float] = None
    dailyYield: Optional[float] = None
    account: Optional[str] = None
    valuationDt: Optional[str] = None
    userBank: Optional[str] = None


class Ledger(BaseModel):
    """§5.7 Ledger"""
    eventId: str
    valuationDt: str
    userBank: str
    account: str
    acctBasis: str
    shareClass: str
    glAccountNumber: str
    endingBalance: float


# ══════════════════════════════════════════════════════════════
# Application Entity Schemas (from UX spec §5)
# ══════════════════════════════════════════════════════════════

class TeamMember(BaseModel):
    userId: str
    name: str
    role: str


class FundDoc(BaseModel):
    """Fund within an event"""
    account: str
    fundName: str
    fundType: FundType
    shareClasses: list[str]
    status: FundStatus = FundStatus.PENDING
    lastRunTimestamp: Optional[str] = None
    breakCount: int = 0
    aiStatus: Optional[str] = None
    aiConfidence: Optional[float] = None
    humanReview: Optional[str] = None


class EventDoc(BaseModel):
    """Conversion Event document"""
    eventId: str
    eventType: EventType = EventType.CONVERSION
    eventName: str
    incumbentProvider: str
    status: EventStatus = EventStatus.DRAFT
    parallelStartDate: Optional[str] = None
    targetGoLiveDate: str
    assignedTeam: list[TeamMember] = []
    funds: list[FundDoc] = []
    breakTrend7d: list[int] = []


class EvidenceStep(BaseModel):
    stepNumber: int
    description: str


class SimilarBreak(BaseModel):
    breakId: str
    fundName: str
    date: str
    variance: float
    resolution: str


class ActionItem(BaseModel):
    id: str
    description: str


class AIAnalysisDoc(BaseModel):
    """AI Analysis result for a break"""
    analysisId: str
    rootCauseSummary: str
    confidenceScore: float
    evidenceChain: list[EvidenceStep] = []
    breakCategory: str
    similarBreaks: list[SimilarBreak] = []
    recommendedActions: list[ActionItem] = []


class HumanAnnotation(BaseModel):
    annotationId: str
    reviewerUserId: str
    reviewerName: str
    reviewerRole: str
    action: ReviewAction
    notes: str
    resolutionCategory: Optional[str] = None
    timestamp: str


class BreakRecordDoc(BaseModel):
    """Break record document"""
    breakId: str
    validationRunId: str
    fundAccount: str
    fundName: str
    checkType: str
    level: str
    lhsValue: float
    rhsValue: float
    variance: float
    state: BreakState = BreakState.DETECTED
    aiAnalysis: Optional[AIAnalysisDoc] = None
    humanAnnotation: Optional[HumanAnnotation] = None
    securityId: Optional[str] = None
    glCategory: Optional[str] = None


class ValidationResultDoc(BaseModel):
    """Validation result for a single fund within a run"""
    checkType: str
    checkName: str
    level: str
    fundAccount: str
    fundName: str
    status: ValidationResultStatus
    lhsRowCount: int = 0
    rhsRowCount: int = 0
    matchedCount: int = 0
    breakCount: int = 0
    totalVariance: float = 0
    maxVariance: float = 0
    durationMs: int = 0
    errorMessage: Optional[str] = None


class ValidationRunDoc(BaseModel):
    """Validation run document"""
    runId: str
    eventId: str
    valuationDt: str
    executionTime: str
    checkSuite: list[str]
    status: RunStatus = RunStatus.QUEUED
    durationMs: Optional[int] = None
    fundsPassed: Optional[int] = None
    fundsWarning: Optional[int] = None
    fundsFailed: Optional[int] = None
    results: list[ValidationResultDoc] = []


class ActivityFeedItem(BaseModel):
    id: str
    type: str
    message: str
    eventId: Optional[str] = None
    timestamp: str
    userId: Optional[str] = None
    userName: str


# ══════════════════════════════════════════════════════════════
# API Request/Response Models
# ══════════════════════════════════════════════════════════════

class RunValidationRequest(BaseModel):
    eventId: str
    valuationDt: str
    checkSuite: list[str]
    fundSelection: str = "all"  # "all" or comma-separated accounts
    incumbentEventId: Optional[str] = None


class AnnotationRequest(BaseModel):
    breakId: str
    action: ReviewAction
    notes: str
    resolutionCategory: Optional[str] = None
    reviewerUserId: str = "u1"
    reviewerName: str = "Jane Doe"
    reviewerRole: str = "CONVERSION_MANAGER"
    reassignedToTeam: Optional[str] = None
    reassignReason: Optional[str] = None


# ══════════════════════════════════════════════════════════════
# GL Account Mapping Schemas (Incumbent to Eagle)
# ══════════════════════════════════════════════════════════════

class MappingType(str, Enum):
    ONE_TO_ONE = "ONE_TO_ONE"
    ONE_TO_MANY = "ONE_TO_MANY"
    MANY_TO_ONE = "MANY_TO_ONE"


class MappingStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class IncumbentGLAccount(BaseModel):
    """Reference data for Incumbent GL accounts"""
    glAccountNumber: str
    glAccountDescription: str
    ledgerSection: str  # ASSETS, LIABILITIES, EQUITY, INCOME, EXPENSE
    provider: str  # STATE_STREET, NORTHERN_TRUST, BNP_PARIBAS, JP_MORGAN


class EagleGLAccount(BaseModel):
    """Reference data for Eagle GL accounts"""
    glAccountNumber: str
    glAccountDescription: str
    ledgerSection: str
    category: Optional[str] = None


class GLAccountMappingDoc(BaseModel):
    """GL Account Mapping document - maps Incumbent GL to Eagle GL"""
    mappingId: str
    eventId: str
    sourceProvider: str
    sourceGlAccountNumber: str
    sourceGlAccountDescription: str
    sourceLedgerSection: str
    targetGlAccountNumber: str
    targetGlAccountDescription: str
    targetLedgerSection: str
    mappingType: MappingType = MappingType.ONE_TO_ONE
    splitWeight: float = 1.0  # For 1:N mappings, weights should sum to 1.0
    groupId: Optional[str] = None  # Groups related mappings (for 1:N or N:1)
    effectiveDate: Optional[str] = None
    status: MappingStatus = MappingStatus.DRAFT
    createdBy: str = "u1"
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class CreateMappingRequest(BaseModel):
    """Request to create a single GL mapping"""
    eventId: str
    sourceProvider: str
    sourceGlAccountNumber: str
    targetGlAccountNumber: str
    mappingType: MappingType = MappingType.ONE_TO_ONE
    splitWeight: float = 1.0
    groupId: Optional[str] = None
    effectiveDate: Optional[str] = None
    createdBy: str = "u1"


class UpdateMappingRequest(BaseModel):
    """Request to update an existing GL mapping"""
    mappingType: Optional[MappingType] = None
    splitWeight: Optional[float] = None
    groupId: Optional[str] = None
    effectiveDate: Optional[str] = None
    status: Optional[MappingStatus] = None


class BulkMappingRequest(BaseModel):
    """Request for bulk mapping operations"""
    mappings: list[CreateMappingRequest]


class BulkDeleteRequest(BaseModel):
    """Request for bulk delete operations"""
    mappingIds: list[str]


# ══════════════════════════════════════════════════════════════
# Break Resolution & Dashboarding Schemas
# ══════════════════════════════════════════════════════════════

class ResolutionBreakCategory(str, Enum):
    KNOWN_DIFFERENCE = "Known Difference"
    BNY_TO_RESOLVE = "BNY to Resolve"
    INCUMBENT_TO_RESOLVE = "Incumbent to Resolve"
    UNDER_INVESTIGATION = "Under Investigation"
    MATCH = "Match"


class ReviewStatus(str, Enum):
    NOT_STARTED = "Not Started"
    IN_PROGRESS = "In Progress"
    COMPLETE = "Complete"


class KnownDifferenceType(str, Enum):
    METHODOLOGY = "Methodology"
    PROCESSING = "Processing"


class BreakTeam(str, Enum):
    FA_CONVERSIONS = "FA Conversions"
    BNY_TRADE_CAPTURE = "BNY Trade Capture"
    BNY_PRICING = "BNY Pricing"
    BNY_CORPORATE_ACTIONS = "BNY Corporate Actions"
    BNY_NAV_OPS = "BNY NAV Ops"
    INCUMBENT = "Incumbent"
    MATCH = "Match"


class ReconciliationLevel(str, Enum):
    L0_NAV = "L0_NAV"
    L1_GL = "L1_GL"
    L2_POSITION = "L2_POSITION"
    L3_TRANSACTION = "L3_TRANSACTION"


class BreakType(str, Enum):
    SHARE_BREAK = "SHARE_BREAK"
    PRICE_BREAK = "PRICE_BREAK"
    INCOME_BREAK = "INCOME_BREAK"
    RECLAIM_BREAK = "RECLAIM_BREAK"
    CORP_ACTION = "CORP_ACTION"


class NotificationChannel(str, Enum):
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"
    BOTH = "BOTH"


class ReviewerAllocationDoc(BaseModel):
    """Reviewer allocation record."""
    allocationId: str
    eventId: str
    bnyAccount: str
    incumbentAccount: str
    accountName: str
    valuationDate: str
    assignedReviewerId: str
    assignedReviewerName: str
    reviewStatus: ReviewStatus = ReviewStatus.NOT_STARTED
    createdBy: str
    updatedAt: str


class KnownDifferenceDoc(BaseModel):
    """Known Difference configuration entry."""
    reference: str
    type: KnownDifferenceType
    summary: str
    issueDescription: Optional[str] = None
    comment: str
    isActive: bool = True
    eventId: Optional[str] = None
    createdAt: str
    updatedBy: str


class BreakAssignmentDoc(BaseModel):
    """Break assignment record for resolution tracking."""
    eventId: str
    valuationDate: Optional[str] = None
    entityReference: str
    breakCategory: Optional[ResolutionBreakCategory] = None
    assignedTeam: Optional[str] = None
    assignedOwner: Optional[str] = None
    breakAmount: Optional[float] = None
    updatedAt: Optional[str] = None
    updatedBy: Optional[str] = None


class NotificationDoc(BaseModel):
    """In-app notification record."""
    notificationId: str
    eventId: str
    fundAccount: str
    breakType: BreakType
    securityId: Optional[str] = None
    assignedTeam: str
    assignedOwner: str
    breakAmount: Optional[float] = None
    valuationDate: Optional[str] = None
    createdAt: str
    isRead: bool = False
    channel: NotificationChannel = NotificationChannel.IN_APP


class CommentaryDoc(BaseModel):
    """Commentary record for break resolution."""
    commentId: str
    eventId: Optional[str] = None
    parentCommentId: Optional[str] = None
    reconciliationLevel: ReconciliationLevel
    entityReference: str
    breakCategory: Optional[ResolutionBreakCategory] = None
    amount: float = 0
    text: str
    knownDifferenceRef: Optional[str] = None
    authorId: str
    createdAt: str
    isRolledUp: bool = False


class AuditLogDoc(BaseModel):
    """Audit trail record."""
    eventId: str
    action: str
    entityReference: str
    previousValue: Optional[str] = None
    newValue: Optional[str] = None
    changedBy: str
    changedByName: Optional[str] = None
    timestamp: str
    metadata: Optional[dict] = None


# ══════════════════════════════════════════════════════════════
# MMIF Regulatory Filing Schemas
# ══════════════════════════════════════════════════════════════

class MmifFundDoc(BaseModel):
    """Fund within an MMIF regulatory filing event."""
    account: str
    fundName: str
    fundType: MmifFundType
    fundDomicile: str = "IE"
    cbiCode: Optional[str] = None
    shareClasses: list[str] = []
    status: FundStatus = FundStatus.PENDING
    lastRunTimestamp: Optional[str] = None
    breakCount: int = 0


class MmifEventDoc(BaseModel):
    """MMIF Regulatory Filing Event document."""
    eventId: str
    eventType: EventType = EventType.REGULATORY_FILING
    eventName: str
    regulatoryBody: str = "CBI"
    filingPeriod: str  # e.g. "2026Q1"
    filingDeadline: str
    filingFrequency: FilingFrequency = FilingFrequency.QUARTERLY
    status: MmifEventStatus = MmifEventStatus.DRAFT
    assignedTeam: list[TeamMember] = []
    funds: list[MmifFundDoc] = []
    breakTrend7d: list[int] = []


class MmifValidationRule(BaseModel):
    """Definition of a single MMIF validation rule."""
    ruleId: str
    ruleName: str
    description: str
    severity: MmifSeverity
    tolerance: float = 0.0
    mmifSection: Optional[str] = None


class MmifValidationResultDoc(BaseModel):
    """Result of a single MMIF validation rule execution."""
    ruleId: str
    ruleName: str
    severity: MmifSeverity
    mmifSection: Optional[str] = None
    fundAccount: str
    fundName: str
    status: ValidationResultStatus
    lhsLabel: str = ""
    lhsValue: float = 0
    rhsLabel: str = ""
    rhsValue: float = 0
    variance: float = 0
    tolerance: float = 0
    breakCount: int = 0
    durationMs: int = 0


class MmifValidationRunDoc(BaseModel):
    """MMIF validation run document."""
    runId: str
    eventId: str
    filingPeriod: str
    executionTime: str
    checkSuite: list[str]  # VR_001 through VR_015
    status: RunStatus = RunStatus.QUEUED
    durationMs: Optional[int] = None
    fundsPassed: Optional[int] = None
    fundsWarning: Optional[int] = None
    fundsFailed: Optional[int] = None
    results: list[MmifValidationResultDoc] = []


class MmifBreakRecordDoc(BaseModel):
    """Break record specific to MMIF validation."""
    breakId: str
    validationRunId: str
    eventId: str
    ruleId: str
    ruleName: str
    severity: MmifSeverity
    mmifSection: Optional[str] = None
    fundAccount: str
    fundName: str
    lhsLabel: str
    lhsValue: float
    rhsLabel: str
    rhsValue: float
    variance: float
    tolerance: float
    state: BreakState = BreakState.DETECTED
    aiAnalysis: Optional[AIAnalysisDoc] = None
    humanAnnotation: Optional[HumanAnnotation] = None
    securityId: Optional[str] = None


class MmifFieldMappingDoc(BaseModel):
    """Individual Eagle GL to MMIF field mapping entry."""
    eagleGlPattern: str
    eagleSourceTable: str
    eagleSourceField: str
    mmifSection: str
    mmifField: str
    instrumentType: Optional[int] = None
    codeType: int = 1  # 1=ISIN, 2=SEDOL, 3=CUSIP, 4=Internal
    transformation: Optional[str] = None
    signConvention: int = 1
    isReported: bool = True
    notes: str = ""


class MmifMappingConfigDoc(BaseModel):
    """MMIF mapping configuration for a fund."""
    configId: str
    eventId: str
    account: str
    fundType: str
    baseCurrency: str = "EUR"
    mappings: list[MmifFieldMappingDoc] = []
    counterpartyEnrichment: dict = {}
    investorClassification: dict = {}
    unmappedAccounts: list[str] = []
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class MmifReconAccountRow(BaseModel):
    """Single GL account row in reconciliation detail (Accounting vs MMIF)."""
    account: str
    description: str
    category: str  # "asset" or "liability"
    beginBal: Optional[float] = None
    netActivity: Optional[float] = None
    endBal: Optional[float] = None
    netSecValue: Optional[float] = None
    smaSource: Optional[str] = None
    smaValue: Optional[float] = None
    variance: Optional[float] = None
    status: str = "na"  # match, break, review, na


class MmifReconCapitalRow(BaseModel):
    """Single capital account row in reconciliation detail."""
    account: str
    description: str
    beginBal: Optional[float] = None
    netActivity: Optional[float] = None
    endBal: Optional[float] = None


class MmifReconShareholderRow(BaseModel):
    """Shareholder pivot row by ISIN."""
    isin: str
    openPosition: Optional[float] = None
    issued: Optional[float] = None
    redeemed: Optional[float] = None
    closePosition: Optional[float] = None
    matched: bool = True


class MmifReconLedgerItem(BaseModel):
    """Single start/end pair for ledger cross-check."""
    start: float
    end: float


class MmifReconNavComparison(BaseModel):
    """NAV tie-out comparison across three sources."""
    capitalTotals: float
    pnlActivityFYE: float
    capitalIncPeriodEnd: float
    navFromSMA: float
    navFromShareholderPivot: float


class MmifReconLedgerCrossCheck(BaseModel):
    """Full ledger cross-check grid."""
    assets: MmifReconLedgerItem
    liabilities: MmifReconLedgerItem
    capital: MmifReconLedgerItem
    bsDiff: MmifReconLedgerItem
    income: MmifReconLedgerItem
    expense: MmifReconLedgerItem
    netIncome: MmifReconLedgerItem
    rgl: MmifReconLedgerItem
    urgl: MmifReconLedgerItem
    netGL: MmifReconLedgerItem
    totalPnL: MmifReconLedgerItem
    tbBalanced: MmifReconLedgerItem


class MmifReconciliationDetailDoc(BaseModel):
    """Full per-fund reconciliation detail (Accounting vs MMIF side-by-side)."""
    eventId: str
    account: str
    fundName: str
    filingPeriod: str
    assetLiabilityRows: list[MmifReconAccountRow] = []
    capitalRows: list[MmifReconCapitalRow] = []
    shareholderRows: list[MmifReconShareholderRow] = []
    navComparison: Optional[MmifReconNavComparison] = None
    ledgerCrossCheck: Optional[MmifReconLedgerCrossCheck] = None


class RunMmifValidationRequest(BaseModel):
    """Request to run MMIF validation."""
    eventId: str
    filingPeriod: str
    checkSuite: list[str]
    fundSelection: str = "all"


class MmifSectionSummary(BaseModel):
    """Summary of a single MMIF section for the dashboard."""
    section: str
    sectionName: str
    eagleValue: float = 0
    mmifValue: float = 0
    variance: float = 0
    status: ValidationResultStatus = ValidationResultStatus.PASSED
    ruleId: Optional[str] = None


# ══════════════════════════════════════════════════════════════
# MMIF DSL Rule Definition Schemas
# ══════════════════════════════════════════════════════════════

class DslExpressionSide(BaseModel):
    """One side (LHS or RHS) of a DSL validation rule expression."""
    label: str
    expr: str


class MmifDslRuleDefDoc(BaseModel):
    """Dynamic MMIF validation rule definition backed by CEL expressions."""
    ruleId: str
    ruleName: str
    description: str
    severity: MmifSeverity
    tolerance: float = 0.0
    mmifSection: Optional[str] = None
    category: Optional[str] = None
    isDsl: bool = True
    dataSource: str = "mmifLedgerData"
    lhs: DslExpressionSide
    rhs: DslExpressionSide
    version: int = 1
    isActive: bool = True
    createdBy: str = "system"
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    deletedAt: Optional[str] = None


class DslExprValidateRequest(BaseModel):
    """Request to validate a CEL expression."""
    expression: str
    dataSource: Optional[str] = None


class DslExprValidateResponse(BaseModel):
    """Result of CEL expression validation."""
    isValid: bool
    error: Optional[str] = None


class DslRuleTestRequest(BaseModel):
    """Request to test a DSL rule against sample data."""
    ruleId: Optional[str] = None
    lhsExpr: str
    rhsExpr: str
    dataSource: str = "mmifLedgerData"
    fundAccount: str
    filingPeriod: str
    tolerance: float = 0.0
    severity: MmifSeverity = MmifSeverity.HARD


class DslRuleTestResponse(BaseModel):
    """Result of testing a DSL rule."""
    lhsValue: float
    rhsValue: float
    variance: float
    status: ValidationResultStatus
    lhsLabel: str = ""
    rhsLabel: str = ""
    error: Optional[str] = None
