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
