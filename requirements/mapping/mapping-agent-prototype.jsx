import { useState, useEffect, useCallback, useRef } from "react";
import * as d3 from "d3";

// ─── Simulated Data ───
const INCUMBENT_COLUMNS = [
  { name: "FUND_ID", samples: ["ABC001", "DEF002", "GHI003", "JKL004", "MNO005"], dtype: "STRING" },
  { name: "VAL_DATE", samples: ["2026-02-13", "2026-02-13", "2026-02-14", "2026-02-14", "2026-02-13"], dtype: "DATE" },
  { name: "CUSIP", samples: ["912828YK0", "38259P706", "594918104", "037833100", "30303M102"], dtype: "STRING" },
  { name: "ISIN", samples: ["US912828YK04", "US38259P7069", "US5949181045", "US0378331005", "US30303M1027"], dtype: "STRING" },
  { name: "SEC_DESC", samples: ["US TREASURY 2.5% 02/28", "GOLD ETF TRUST", "MICROSOFT CORP", "APPLE INC", "META PLATFORMS"], dtype: "STRING" },
  { name: "SHARES_HELD", samples: ["50000.000000", "12500.000000", "8750.000000", "15000.000000", "6200.000000"], dtype: "DECIMAL" },
  { name: "MV_LOCAL", samples: ["4987500.00", "2843750.00", "3412500.00", "2565000.00", "3534200.00"], dtype: "DECIMAL" },
  { name: "MV_BASE", samples: ["4987500.00", "2843750.00", "3412500.00", "2565000.00", "3534200.00"], dtype: "DECIMAL" },
  { name: "BV_LOCAL", samples: ["5000000.00", "2800000.00", "3400000.00", "2500000.00", "3500000.00"], dtype: "DECIMAL" },
  { name: "BV_BASE", samples: ["5000000.00", "2800000.00", "3400000.00", "2500000.00", "3500000.00"], dtype: "DECIMAL" },
  { name: "ACCRUED_INT", samples: ["12345.67", "0.00", "0.00", "0.00", "0.00"], dtype: "DECIMAL" },
  { name: "UNREALIZED_GL", samples: ["-12500.00", "43750.00", "12500.00", "65000.00", "34200.00"], dtype: "DECIMAL" },
  { name: "CCY_CODE", samples: ["USD", "USD", "USD", "USD", "USD"], dtype: "STRING" },
  { name: "LONG_SHORT", samples: ["L", "L", "L", "L", "L"], dtype: "STRING" },
  { name: "ACCT_BASIS", samples: ["GAAP", "GAAP", "GAAP", "GAAP", "GAAP"], dtype: "STRING" },
  { name: "ORIG_FACE", samples: ["5000000.00", "", "", "", ""], dtype: "DECIMAL" },
  { name: "SETTLE_DT", samples: ["2026-02-15", "2026-02-15", "2026-02-15", "2026-02-15", "2026-02-15"], dtype: "DATE" },
  { name: "SECTOR_CODE", samples: ["GOV", "CMDTY", "TECH", "TECH", "TECH"], dtype: "STRING" },
  { name: "PRICE", samples: ["99.75", "227.50", "390.00", "171.00", "570.03"], dtype: "DECIMAL" },
  { name: "DAY_COUNT_CONV", samples: ["ACT/ACT", "", "", "", ""], dtype: "STRING" },
];

const CANONICAL_TABLES = {
  dataSubLedgerPosition: {
    description: "Position-level holdings with market values",
    fields: ["assetId", "marketValueLocal", "marketValueBase", "bookValueLocal", "bookValueBase", "shares", "accruedInterestLocal", "unrealizedGainLossLocal", "currency", "longShortInd", "originalFace", "price"],
  },
  dataDailyTransactions: {
    description: "Daily trade and corporate action activity",
    fields: ["assetId", "units", "currency", "amountLocal", "amountBase", "tradeDate", "settleDate", "tradedIntLocal", "longShortInd", "shares", "origCostLocal", "origCostBase"],
  },
  dataNav: {
    description: "Fund-level NAV and share class data",
    fields: ["account", "valuationDt", "netAssets", "sharesOutstanding", "navPerShare", "shareClass"],
  },
  dataLedger: {
    description: "General ledger balances by GL account",
    fields: ["account", "valuationDt", "glAccountNumber", "endingBalance", "acctBasis", "shareClass"],
  },
  refSecurity: {
    description: "Security master reference data",
    fields: ["assetId", "cusip", "isin", "sedol", "securityName", "securityType", "primaryAssetType", "maturityDate", "couponRate"],
  },
  refFund: {
    description: "Fund and portfolio reference data",
    fields: ["account", "accountName", "fundType", "baseCurrency", "inceptionDate"],
  },
};

const MAPPING_RESULTS = [
  { source: "FUND_ID", target: "refFund.account", confidence: 0.96, status: "auto_approved", reasoning: "Unique fund identifier pattern matches account key field. Cross-referenced with xrefAccount confirms mapping." },
  { source: "VAL_DATE", target: "dataSubLedgerPosition.valuationDt", confidence: 0.99, status: "auto_approved", reasoning: "ISO date format matches valuationDt. All values are valid business dates within expected range." },
  { source: "CUSIP", target: "refSecurity.cusip", confidence: 0.98, status: "auto_approved", reasoning: "9-character alphanumeric format with valid check digits. All samples resolve in xrefSecurity." },
  { source: "ISIN", target: "refSecurity.isin", confidence: 0.97, status: "auto_approved", reasoning: "12-character ISIN format with country prefix US. Correlates with CUSIP column values." },
  { source: "SEC_DESC", target: "refSecurity.securityName", confidence: 0.94, status: "auto_approved", reasoning: "Free-text security descriptions matching standard naming conventions." },
  { source: "SHARES_HELD", target: "dataSubLedgerPosition.shares", confidence: 0.95, status: "pending", reasoning: "Decimal values with 6dp precision matching shares field spec. Sign convention confirmed positive for long positions." },
  { source: "MV_LOCAL", target: "dataSubLedgerPosition.marketValueLocal", confidence: 0.93, status: "pending", reasoning: "Market value in local currency. Validated: SHARES_HELD × PRICE ≈ MV_LOCAL confirms derivation." },
  { source: "MV_BASE", target: "dataSubLedgerPosition.marketValueBase", confidence: 0.93, status: "pending", reasoning: "Base currency market value. Matches MV_LOCAL since all samples are USD-denominated." },
  { source: "BV_LOCAL", target: "dataSubLedgerPosition.bookValueLocal", confidence: 0.91, status: "pending", reasoning: "Book value in local currency. Precision matches Decimal(18,2) target specification." },
  { source: "BV_BASE", target: "dataSubLedgerPosition.bookValueBase", confidence: 0.91, status: "pending", reasoning: "Base currency book value. Consistent with BV_LOCAL for USD-only portfolio." },
  { source: "ACCRUED_INT", target: "dataSubLedgerPosition.accruedInterestLocal", confidence: 0.89, status: "pending", reasoning: "Non-zero only for bond position (CUSIP 912828YK0). Consistent with fixed income accrual patterns." },
  { source: "UNREALIZED_GL", target: "dataSubLedgerPosition.unrealizedGainLossLocal", confidence: 0.90, status: "pending", reasoning: "Calculated as MV_LOCAL - BV_LOCAL. Sign convention matches: positive = gain, negative = loss." },
  { source: "CCY_CODE", target: "dataSubLedgerPosition.currency", confidence: 0.97, status: "auto_approved", reasoning: "ISO 4217 currency codes. All samples are valid 3-character codes." },
  { source: "LONG_SHORT", target: "dataSubLedgerPosition.longShortInd", confidence: 0.96, status: "auto_approved", reasoning: "Values 'L'/'S' directly match longShortInd enum. No transformation needed." },
  { source: "ACCT_BASIS", target: "dataSubLedgerPosition.acctBasis", confidence: 0.94, status: "auto_approved", reasoning: "Accounting basis codes (GAAP, TAX, etc.) match acctBasis field spec." },
  { source: "ORIG_FACE", target: "dataSubLedgerPosition.originalFace", confidence: 0.88, status: "pending", reasoning: "Original face value populated only for bonds/MBS. Nullable pattern matches optional field spec." },
  { source: "SETTLE_DT", target: "dataDailyTransactions.settleDate", confidence: 0.72, status: "flagged", reasoning: "Settlement date present on position report is unusual. May indicate expected settlement for pending trades, or could map to a position-level settlement date. Needs human review.", suggestions: ["dataDailyTransactions.settleDate", "dataSubLedgerPosition.settleDate (custom)"] },
  { source: "SECTOR_CODE", target: null, confidence: 0.45, status: "flagged", reasoning: "Sector classification code (GOV, CMDTY, TECH). No direct canonical equivalent. May map to refSecurity.primaryAssetType via xref lookup, or could be an enrichment field.", suggestions: ["refSecurity.primaryAssetType (via xref)", "enrichment.sectorClassification (new field)"] },
  { source: "PRICE", target: "dataSubLedgerPosition.price", confidence: 0.92, status: "pending", reasoning: "Unit price. Validated: SHARES_HELD × PRICE ≈ MV_LOCAL for all rows. Precision matches target." },
  { source: "DAY_COUNT_CONV", target: null, confidence: 0.40, status: "flagged", reasoning: "Day count convention (ACT/ACT, 30/360). This is a methodology attribute, not a position value. Maps to ElectronDSL rule configuration rather than a data field. Known Difference KD4 may apply if BNY uses different convention.", suggestions: ["ElectronDSL rule config (not a data mapping)", "refSecurity.dayCountConvention (custom extension)"] },
];

const AGENT_LOG = [
  { time: "00:00", type: "system", msg: "Session initialized. File: SS_PositionReport_20260213.xlsx" },
  { time: "00:01", type: "tool", msg: "→ inspect_source_file(file_id='f-8a2c', sample_rows=5)" },
  { time: "00:02", type: "result", msg: "Detected: State Street | Position Report | 20 columns | 847 rows" },
  { time: "00:03", type: "tool", msg: "→ search_templates('State Street', fund_type='Multi-Asset')" },
  { time: "00:04", type: "result", msg: "Found 2 templates. Best match: 'SS-MultiAsset-Positions-v3' (confidence: 0.87)" },
  { time: "00:05", type: "think", msg: "Template confidence 0.87 < 0.90 threshold. Proceeding with column-by-column mapping using template as reference." },
  { time: "00:06", type: "plan", msg: "Mapping plan: 12 cols → dataSubLedgerPosition, 4 cols → refSecurity, 2 cols → refFund, 2 cols → needs analysis" },
  { time: "00:08", type: "tool", msg: "→ analyze_column_samples('FUND_ID', ['ABC001','DEF002',...])" },
  { time: "00:08", type: "result", msg: "Classification: FUND_ID (confidence: 0.96). Pattern: alphanumeric, 6-char." },
  { time: "00:09", type: "tool", msg: "→ search_canonical_model('fund account identifier')" },
  { time: "00:09", type: "tool", msg: "→ validate_mapping('FUND_ID', 'refFund', 'account', [...])" },
  { time: "00:10", type: "mapping", msg: "✓ FUND_ID → refFund.account (0.96) — Auto-approved" },
  { time: "00:11", type: "mapping", msg: "✓ VAL_DATE → dataSubLedgerPosition.valuationDt (0.99) — Auto-approved" },
  { time: "00:12", type: "mapping", msg: "✓ CUSIP → refSecurity.cusip (0.98) — Auto-approved" },
  { time: "00:13", type: "mapping", msg: "✓ ISIN → refSecurity.isin (0.97) — Auto-approved" },
  { time: "00:14", type: "mapping", msg: "✓ SEC_DESC → refSecurity.securityName (0.94) — Auto-approved" },
  { time: "00:16", type: "tool", msg: "→ analyze_column_samples('MV_LOCAL', ['4987500.00',...])" },
  { time: "00:16", type: "result", msg: "Classification: CURRENCY_AMOUNT / LOCAL_CURRENCY (confidence: 0.92)" },
  { time: "00:17", type: "think", msg: "Cross-validating: SHARES_HELD × PRICE ≈ MV_LOCAL. Confirmed derivation relationship." },
  { time: "00:20", type: "mapping", msg: "○ MV_LOCAL → dataSubLedgerPosition.marketValueLocal (0.93) — Pending review" },
  { time: "00:25", type: "tool", msg: "→ analyze_column_samples('SECTOR_CODE', ['GOV','CMDTY','TECH',...])" },
  { time: "00:25", type: "result", msg: "Classification: ACCOUNTING_CODE / SECTOR (confidence: 0.45). No direct canonical match." },
  { time: "00:26", type: "tool", msg: "→ get_xref_lookup('GOV', 'ASSET_TYPE', 'STATE_STREET')" },
  { time: "00:26", type: "result", msg: "Partial match: 'GOV' → 'GOVERNMENT' in refSecurity.primaryAssetType" },
  { time: "00:27", type: "flag", msg: "⚠ SECTOR_CODE — Flagged for review. No direct canonical equivalent." },
  { time: "00:28", type: "tool", msg: "→ analyze_column_samples('DAY_COUNT_CONV', ['ACT/ACT','',...])" },
  { time: "00:28", type: "think", msg: "Day count convention is a methodology attribute. Maps to ElectronDSL config, not data field. Known Difference KD4 may apply." },
  { time: "00:29", type: "flag", msg: "⚠ DAY_COUNT_CONV — Flagged. Methodology attribute, not data mapping. KD4 reference noted." },
  { time: "00:30", type: "system", msg: "Phase 2 complete. 17/20 mapped, 3 flagged for review." },
];

// ─── Color system ───
const colors = {
  bg: "#0B0F1A",
  surface: "#111827",
  surfaceHover: "#1a2236",
  border: "#1E293B",
  borderActive: "#2E90FA",
  text: "#E2E8F0",
  textMuted: "#64748B",
  textDim: "#475569",
  accent: "#2E90FA",
  accentGlow: "rgba(46,144,250,0.15)",
  green: "#22C55E",
  greenDim: "rgba(34,197,94,0.12)",
  yellow: "#EAB308",
  yellowDim: "rgba(234,179,8,0.12)",
  red: "#EF4444",
  redDim: "rgba(239,68,68,0.12)",
  purple: "#A78BFA",
  purpleDim: "rgba(167,139,250,0.12)",
};

const statusColor = (s) => {
  if (s === "auto_approved") return colors.green;
  if (s === "pending") return colors.yellow;
  if (s === "flagged") return colors.red;
  return colors.textMuted;
};

const statusLabel = (s) => {
  if (s === "auto_approved") return "Auto-Approved";
  if (s === "pending") return "Pending Review";
  if (s === "flagged") return "Needs Review";
  return s;
};

const typeColor = (t) => {
  if (t === "tool") return colors.accent;
  if (t === "result") return colors.green;
  if (t === "mapping") return "#22C55E";
  if (t === "flag") return colors.yellow;
  if (t === "think") return colors.purple;
  if (t === "plan") return "#F97316";
  return colors.textMuted;
};

// ─── Components ───
const Badge = ({ color, bg, children }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
    color, background: bg, textTransform: "uppercase",
  }}>{children}</span>
);

const ConfidenceBar = ({ value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <div style={{ width: 48, height: 4, borderRadius: 2, background: colors.border, overflow: "hidden" }}>
      <div style={{
        width: `${value * 100}%`, height: "100%", borderRadius: 2,
        background: value >= 0.9 ? colors.green : value >= 0.7 ? colors.yellow : colors.red,
      }} />
    </div>
    <span style={{ fontSize: 11, color: colors.textMuted, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
      {(value * 100).toFixed(0)}%
    </span>
  </div>
);

export default function MappingAgent() {
  const [selectedCol, setSelectedCol] = useState(null);
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [visibleLogs, setVisibleLogs] = useState([]);
  const [visibleMappings, setVisibleMappings] = useState([]);
  const [activeTab, setActiveTab] = useState("mappings");
  const [phase, setPhase] = useState("idle");
  const logRef = useRef(null);
  const svgRef = useRef(null);

  const startAgent = useCallback(() => {
    setAgentRunning(true);
    setPhase("survey");
    setVisibleLogs([]);
    setVisibleMappings([]);
    setSelectedCol(null);
    setSelectedMapping(null);

    let logIdx = 0;
    let mapIdx = 0;
    const logInterval = setInterval(() => {
      if (logIdx < AGENT_LOG.length) {
        setVisibleLogs(prev => [...prev, AGENT_LOG[logIdx]]);
        const entry = AGENT_LOG[logIdx];
        if (entry.type === "plan") setPhase("mapping");
        if (entry.type === "mapping" || entry.type === "flag") {
          if (mapIdx < MAPPING_RESULTS.length) {
            setVisibleMappings(prev => [...prev, MAPPING_RESULTS[mapIdx]]);
            mapIdx++;
          }
        }
        logIdx++;
      } else {
        setPhase("review");
        setAgentRunning(false);
        clearInterval(logInterval);
      }
    }, 400);

    return () => clearInterval(logInterval);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [visibleLogs]);

  // Stats
  const mapped = visibleMappings.filter(m => m.status !== "flagged").length;
  const flagged = visibleMappings.filter(m => m.status === "flagged").length;
  const autoApproved = visibleMappings.filter(m => m.status === "auto_approved").length;
  const pending = visibleMappings.filter(m => m.status === "pending").length;
  const total = INCUMBENT_COLUMNS.length;
  const pct = total > 0 ? ((mapped + flagged) / total * 100) : 0;

  const detail = selectedMapping || (selectedCol ? MAPPING_RESULTS.find(m => m.source === selectedCol.name) : null);
  const detailCol = detail ? INCUMBENT_COLUMNS.find(c => c.name === detail.source) : selectedCol;

  return (
    <div style={{
      height: "100vh", width: "100vw", background: colors.bg, color: colors.text,
      fontFamily: "'Inter', -apple-system, sans-serif", display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* ─── Header ─── */}
      <div style={{
        height: 56, borderBottom: `1px solid ${colors.border}`, display: "flex",
        alignItems: "center", justifyContent: "space-between", padding: "0 20px",
        background: colors.surface, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${colors.accent}, #7C3AED)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff",
          }}>DI</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.3 }}>Document Intelligence</div>
            <div style={{ fontSize: 11, color: colors.textMuted }}>Mapping Agent</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, color: colors.textMuted }}>
            <span style={{ color: colors.text, fontWeight: 600 }}>SS_PositionReport_20260213.xlsx</span>
            <span style={{ margin: "0 8px", color: colors.border }}>|</span>
            State Street · Multi-Asset
          </div>
          {phase === "idle" && (
            <button onClick={startAgent} style={{
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              background: colors.accent, color: "#fff", fontSize: 13, fontWeight: 600,
              boxShadow: `0 0 20px ${colors.accentGlow}`,
              transition: "all 0.2s",
            }}>
              ▶ Start Mapping Agent
            </button>
          )}
          {agentRunning && (
            <Badge color={colors.accent} bg={colors.accentGlow}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.accent, animation: "pulse 1s infinite" }} />
              Agent Running — {phase === "survey" ? "Surveying" : "Mapping"}
            </Badge>
          )}
          {phase === "review" && (
            <Badge color={colors.green} bg={colors.greenDim}>✓ Ready for Review</Badge>
          )}
        </div>
      </div>

      {/* ─── Progress Bar ─── */}
      <div style={{
        height: 36, borderBottom: `1px solid ${colors.border}`, display: "flex",
        alignItems: "center", padding: "0 20px", gap: 16, background: colors.surface, flexShrink: 0,
      }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: colors.border, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 3, transition: "width 0.5s ease",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${colors.accent}, ${colors.green})`,
          }} />
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, flexShrink: 0 }}>
          <span style={{ color: colors.green }}>● {autoApproved} approved</span>
          <span style={{ color: colors.yellow }}>● {pending} pending</span>
          <span style={{ color: colors.red }}>● {flagged} flagged</span>
          <span style={{ color: colors.textMuted }}>{total - mapped - flagged} remaining</span>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ─── Left: Source File Panel ─── */}
        <div style={{
          width: 320, borderRight: `1px solid ${colors.border}`, display: "flex",
          flexDirection: "column", flexShrink: 0,
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: `1px solid ${colors.border}`,
            background: colors.surface, fontSize: 12, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span>Source Columns ({total})</span>
            <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 400 }}>Incumbent File</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {INCUMBENT_COLUMNS.map((col, i) => {
              const mapping = visibleMappings.find(m => m.source === col.name);
              const isSelected = selectedCol?.name === col.name;
              return (
                <div key={col.name}
                  onClick={() => { setSelectedCol(col); setSelectedMapping(mapping || null); }}
                  style={{
                    padding: "10px 16px", borderBottom: `1px solid ${colors.border}`,
                    cursor: "pointer", transition: "all 0.15s",
                    background: isSelected ? colors.accentGlow : "transparent",
                    borderLeft: isSelected ? `3px solid ${colors.accent}` : "3px solid transparent",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{
                      fontSize: 12.5, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                      color: mapping ? colors.text : colors.textMuted,
                    }}>{col.name}</span>
                    {mapping && (
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: statusColor(mapping.status),
                        boxShadow: `0 0 6px ${statusColor(mapping.status)}40`,
                      }} />
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: colors.textDim, marginTop: 2 }}>
                    {col.dtype} · {col.samples[0]}
                    {mapping && (
                      <span style={{ color: statusColor(mapping.status), marginLeft: 6 }}>
                        → {mapping.target || "unresolved"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Center: Mapping Canvas + Detail ─── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tabs */}
          <div style={{
            display: "flex", borderBottom: `1px solid ${colors.border}`, background: colors.surface, flexShrink: 0,
          }}>
            {["mappings", "detail", "agent"].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "10px 20px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: "none", background: "transparent", textTransform: "capitalize",
                color: activeTab === tab ? colors.accent : colors.textMuted,
                borderBottom: activeTab === tab ? `2px solid ${colors.accent}` : "2px solid transparent",
                transition: "all 0.15s",
              }}>{tab === "agent" ? "Agent Log" : tab === "detail" ? "Column Detail" : "Mapping Table"}</button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
            {activeTab === "mappings" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr 80px 100px", gap: 0, fontSize: 11, fontWeight: 600, color: colors.textMuted, padding: "0 0 8px 0", borderBottom: `1px solid ${colors.border}`, marginBottom: 4 }}>
                  <span>SOURCE</span><span></span><span>TARGET</span><span>CONF</span><span>STATUS</span>
                </div>
                {visibleMappings.map((m, i) => (
                  <div key={m.source}
                    onClick={() => { setSelectedMapping(m); setActiveTab("detail"); setSelectedCol(INCUMBENT_COLUMNS.find(c => c.name === m.source)); }}
                    style={{
                      display: "grid", gridTemplateColumns: "1fr 40px 1fr 80px 100px", gap: 0,
                      alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colors.border}`,
                      cursor: "pointer", transition: "background 0.15s",
                      animation: `fadeIn 0.3s ease ${i * 0.05}s both`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = colors.surfaceHover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{m.source}</span>
                    <span style={{ color: statusColor(m.status), fontSize: 14, textAlign: "center" }}>→</span>
                    <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500, color: m.target ? colors.text : colors.red }}>{m.target || "unresolved"}</span>
                    <ConfidenceBar value={m.confidence} />
                    <Badge color={statusColor(m.status)} bg={m.status === "auto_approved" ? colors.greenDim : m.status === "pending" ? colors.yellowDim : colors.redDim}>
                      {m.status === "auto_approved" ? "✓ Auto" : m.status === "pending" ? "○ Pending" : "⚠ Review"}
                    </Badge>
                  </div>
                ))}
                {visibleMappings.length === 0 && (
                  <div style={{ textAlign: "center", padding: "60px 0", color: colors.textMuted }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
                    <div style={{ fontSize: 14 }}>Start the mapping agent to begin</div>
                    <div style={{ fontSize: 12, marginTop: 4, color: colors.textDim }}>The agent will analyze each column and propose mappings to the canonical model</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "detail" && detailCol && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{detailCol.name}</span>
                  {detail && <Badge color={statusColor(detail.status)} bg={detail.status === "auto_approved" ? colors.greenDim : detail.status === "pending" ? colors.yellowDim : colors.redDim}>{statusLabel(detail.status)}</Badge>}
                </div>

                {/* Source info */}
                <div style={{ background: colors.surface, borderRadius: 8, border: `1px solid ${colors.border}`, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Source Column</div>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "6px 12px", fontSize: 12.5 }}>
                    <span style={{ color: colors.textMuted }}>Type</span><span>{detailCol.dtype}</span>
                    <span style={{ color: colors.textMuted }}>Samples</span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {detailCol.samples.map((s, i) => (
                        <span key={i} style={{
                          padding: "2px 6px", borderRadius: 3, background: colors.border, fontSize: 11,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>{s || "(empty)"}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Mapping info */}
                {detail && (
                  <div style={{ background: colors.surface, borderRadius: 8, border: `1px solid ${colors.border}`, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Mapping Decision</div>
                    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "6px 12px", fontSize: 12.5 }}>
                      <span style={{ color: colors.textMuted }}>Target</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: detail.target ? colors.accent : colors.red }}>{detail.target || "No mapping proposed"}</span>
                      <span style={{ color: colors.textMuted }}>Confidence</span><ConfidenceBar value={detail.confidence} />
                    </div>
                    <div style={{ marginTop: 12, padding: 12, background: colors.bg, borderRadius: 6, fontSize: 12, lineHeight: 1.6, color: colors.textMuted }}>
                      <span style={{ fontWeight: 600, color: colors.purple }}>Agent Reasoning: </span>{detail.reasoning}
                    </div>
                    {detail.suggestions && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: colors.yellow, marginBottom: 6 }}>Suggested Options:</div>
                        {detail.suggestions.map((s, i) => (
                          <div key={i} style={{
                            padding: "6px 10px", marginBottom: 4, borderRadius: 4,
                            background: colors.bg, border: `1px solid ${colors.border}`,
                            fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
                            cursor: "pointer", transition: "border-color 0.15s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = colors.accent}
                          onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}
                          >{s}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!detail && (
                  <div style={{ textAlign: "center", padding: "40px 0", color: colors.textMuted, fontSize: 13 }}>
                    This column hasn't been processed by the agent yet.
                  </div>
                )}
              </div>
            )}

            {activeTab === "detail" && !detailCol && (
              <div style={{ textAlign: "center", padding: "60px 0", color: colors.textMuted }}>
                <div style={{ fontSize: 13 }}>Select a column from the left panel or a mapping row to see details</div>
              </div>
            )}

            {activeTab === "agent" && (
              <div ref={logRef} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                {visibleLogs.map((log, i) => (
                  <div key={i} style={{
                    padding: "4px 0", display: "flex", gap: 8, animation: `fadeIn 0.2s ease`,
                    borderLeft: `2px solid ${typeColor(log.type)}20`,
                    paddingLeft: 10, marginBottom: 2,
                  }}>
                    <span style={{ color: colors.textDim, flexShrink: 0, width: 40 }}>{log.time}</span>
                    <span style={{ color: typeColor(log.type), flexShrink: 0, width: 54, fontSize: 10, fontWeight: 600, textTransform: "uppercase", paddingTop: 1 }}>{log.type}</span>
                    <span style={{ color: log.type === "think" ? colors.purple : colors.textMuted, lineHeight: 1.5 }}>{log.msg}</span>
                  </div>
                ))}
                {visibleLogs.length === 0 && (
                  <div style={{ textAlign: "center", padding: "60px 0", color: colors.textMuted, fontFamily: "Inter, sans-serif" }}>
                    <div style={{ fontSize: 13 }}>Agent log will appear here when the mapping agent starts</div>
                  </div>
                )}
                {agentRunning && (
                  <div style={{ padding: "8px 0", color: colors.accent, animation: "pulse 1s infinite" }}>
                    ▊ Processing...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Right: Canonical Model Panel ─── */}
        <div style={{
          width: 300, borderLeft: `1px solid ${colors.border}`, display: "flex",
          flexDirection: "column", flexShrink: 0,
        }}>
          <div style={{
            padding: "12px 16px", borderBottom: `1px solid ${colors.border}`,
            background: colors.surface, fontSize: 12, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span>Canonical Model</span>
            <span style={{ fontSize: 11, color: colors.textMuted, fontWeight: 400 }}>Target Schema</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {Object.entries(CANONICAL_TABLES).map(([tableName, table]) => {
              const mappedFields = visibleMappings.filter(m => m.target?.startsWith(tableName + ".")).map(m => m.target.split(".")[1]);
              return (
                <div key={tableName} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <div style={{ padding: "10px 16px", background: colors.surface }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: colors.accent }}>{tableName}</span>
                      {mappedFields.length > 0 && (
                        <span style={{ fontSize: 10, color: colors.green, fontWeight: 600 }}>{mappedFields.length} mapped</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: colors.textDim, marginTop: 2 }}>{table.description}</div>
                  </div>
                  <div style={{ padding: "4px 16px 8px" }}>
                    {table.fields.map(f => {
                      const isMapped = mappedFields.includes(f);
                      return (
                        <div key={f} style={{
                          fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                          padding: "3px 6px", marginBottom: 2, borderRadius: 3,
                          color: isMapped ? colors.green : colors.textDim,
                          background: isMapped ? colors.greenDim : "transparent",
                          transition: "all 0.3s",
                        }}>
                          {isMapped ? "✓ " : "  "}{f}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${colors.bg}; }
        ::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${colors.textDim}; }
      `}</style>
    </div>
  );
}
