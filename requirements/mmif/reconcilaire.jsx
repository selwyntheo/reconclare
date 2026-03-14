import { useState, useEffect, useRef } from "react";

// ─── Theme & Constants ───────────────────────────────────────────────
const THEME = {
  bg: "#0B0E14",
  surface: "#111720",
  surfaceAlt: "#151C28",
  card: "#1A2233",
  cardHover: "#1E2840",
  border: "#1E2B3D",
  borderAccent: "#2A3A52",
  text: "#E8EDF5",
  textMuted: "#7B8BA3",
  textDim: "#4A5B73",
  accent: "#00C9A7",
  accentGlow: "rgba(0,201,167,0.15)",
  accentDim: "#00A88C",
  warn: "#FF6B6B",
  warnGlow: "rgba(255,107,107,0.12)",
  warnDim: "#CC5555",
  gold: "#FFB547",
  goldGlow: "rgba(255,181,71,0.12)",
  blue: "#4A90D9",
  blueGlow: "rgba(74,144,217,0.12)",
  purple: "#9B6DFF",
  purpleGlow: "rgba(155,109,255,0.1)",
  match: "#00C9A7",
  mismatch: "#FF6B6B",
  pending: "#FFB547",
};

const fmt = (n) => {
  if (n === null || n === undefined || n === "") return "—";
  const num = typeof n === "string" ? parseFloat(n.replace(/,/g, "")) : n;
  if (isNaN(num)) return "—";
  const isNeg = num < 0;
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return isNeg ? `(${formatted})` : formatted;
};

const fmtCompact = (n) => {
  if (n === null || n === undefined) return "—";
  const num = typeof n === "number" ? n : parseFloat(String(n).replace(/,/g, ""));
  if (isNaN(num)) return "—";
  const abs = Math.abs(num);
  const isNeg = num < 0;
  let result;
  if (abs >= 1e9) result = (abs / 1e9).toFixed(2) + "B";
  else if (abs >= 1e6) result = (abs / 1e6).toFixed(2) + "M";
  else if (abs >= 1e3) result = (abs / 1e3).toFixed(1) + "K";
  else result = abs.toFixed(2);
  return isNeg ? `(${result})` : result;
};

// ─── Data ────────────────────────────────────────────────────────────
const assetLiabilityData = [
  { account: "1100-0000-0000-0000", desc: "SECURITIES AT VALUE", beginBal: 822047324.90, netActivity: 26834000.05, endBal: 848881324.95, netSecValue: 848188873.50, sma: "Positions", smaValue: 848188873.50, checkPrimary: "-", smaSecondary: "Asset SMA", secValue: 848188873.52, checkSecondary: -0.02, category: "asset" },
  { account: "2710-0000-0000-0000", desc: "SHORT POSITION MKT VALUE", beginBal: 895350.89, netActivity: 202899.44, endBal: 692451.45, netSecValue: null, sma: "Positions", smaValue: null, checkPrimary: "-", smaSecondary: null, secValue: null, checkSecondary: null, category: "asset" },
  { account: "1110-0000-1044-0000", desc: "POUND STERLING", beginBal: null, netActivity: null, endBal: null, netSecValue: null, sma: "Positions", smaValue: null, checkPrimary: "-", smaSecondary: "Asset SMA", secValue: 0, checkSecondary: "-", category: "asset" },
  { account: "1110-0000-1108-0000", desc: "US DOLLAR", beginBal: 0.58, netActivity: null, endBal: 0.58, netSecValue: 0.58, sma: "Positions", smaValue: 0.58, checkPrimary: "-", smaSecondary: "Asset SMA", secValue: 0.58, checkSecondary: "-", category: "asset" },
  { account: "1110-0000-1123-0000", desc: "EURO", beginBal: 15403.73, netActivity: -1042.41, endBal: 14361.32, netSecValue: 14361.32, sma: "Positions", smaValue: 14361.32, checkPrimary: "-", smaSecondary: "Asset SMA", secValue: 14361.32, checkSecondary: "-", category: "asset" },
  { account: "1120-0000-0000-0000", desc: "CURRENCY ALLOWANCE", beginBal: null, netActivity: null, endBal: null, netSecValue: null, sma: null, smaValue: null, checkPrimary: null, smaSecondary: null, secValue: null, checkSecondary: null, category: "asset" },
  { account: "1130-0000-0000-0000", desc: "OTHER ASSETS", beginBal: 21983.28, netActivity: -13990.56, endBal: 7992.72, netSecValue: -1342237.32, sma: "Positions", smaValue: -1342237.32, checkPrimary: "-", smaSecondary: null, secValue: null, checkSecondary: null, category: "asset" },
  { account: "2500-0000-0000-0000", desc: "ACCRUED EXPENSE PAYABLE", beginBal: 1433912.77, netActivity: 83682.73, endBal: 1350230.04, netSecValue: null, sma: null, smaValue: null, checkPrimary: null, smaSecondary: null, secValue: null, checkSecondary: null, category: "liability" },
  { account: "1200-0000-0000-0000", desc: "CASH (INCOME)", beginBal: 188067798.22, netActivity: 7581487.35, endBal: 195649285.57, netSecValue: -2803758.16, sma: "Positions", smaValue: -2803758.16, checkPrimary: 0.00, smaSecondary: "Asset SMA", secValue: -2803758.16, checkSecondary: 0.00, category: "asset" },
];

const capitalData = [
  { account: "3100-0000-0000-0000", desc: "SUBSCRIPTIONS", beginBal: 2369973779.97, netActivity: -51653581.93, endBal: 2421627361.90, category: "capital" },
  { account: "3200-0000-0000-0000", desc: "SUBSCRIPTIONS EXCHANGED", beginBal: null, netActivity: null, endBal: null, category: "capital" },
  { account: "3400-0000-0000-0000", desc: "REDEMPTIONS", beginBal: -1782342540.33, netActivity: 36335714.11, endBal: -1818678254.44, category: "capital" },
  { account: "3500-0000-0000-0000", desc: "REDEMPTIONS EXCHANGED", beginBal: null, netActivity: null, endBal: null, category: "capital" },
  { account: "3650-0000-0000-0000", desc: "PRIOR UNDISTRIBUTED G/L", beginBal: -19247021.59, netActivity: null, endBal: -19247021.59, category: "capital" },
  { account: "3800-0000-0000-0000", desc: "DISTRIBUTED GAIN/LOSS", beginBal: null, netActivity: null, endBal: null, category: "capital" },
  { account: "3950-0000-0000-0000", desc: "PRIOR UNDIST. INCOME", beginBal: 161260052.48, netActivity: null, endBal: 161260052.48, category: "capital" },
  { account: "3981-0000-0000-0000", desc: "PRIOR CAPITAL EXPENSES", beginBal: -75.00, netActivity: null, endBal: -75.00, category: "capital" },
  { account: "3990-0000-0000-0000", desc: "SUSPENSE ACCOUNT", beginBal: null, netActivity: null, endBal: null, category: "capital" },
  { account: "3991-0000-0000-0000", desc: "DISTRIBUTED INCOME", beginBal: -2185366.57, netActivity: 730449.65, endBal: -2915816.22, category: "capital" },
];

const ledgerCrossCheck = {
  assets: { start: 1027204950.27, end: 1018182532.77, prefix: "1" },
  liabilities: { start: 296910774.68, end: 265749700.75, prefix: "2" },
  capital: { start: 727458828.96, end: 742046247.13, prefix: "3" },
  bsDiff: { start: 2835346.63, end: 10386584.89, label: "BS Diff (A-L-C)" },
  income: { start: 34481051.03, end: 43328690.54, prefix: "4" },
  expense: { start: 4230087.86, end: 5408656.66, prefix: "5" },
  netIncome: { start: 30250963.17, end: 37920033.88, label: "Net Income" },
  rgl: { start: 3792572.14, end: 2027147.39, prefix: "61" },
  urgl: { start: -31208188.68, end: -29560596.38, prefix: "6 (excl 61)" },
  netGL: { start: -27415616.54, end: -27533448.99, label: "Net GL (RGL+URGL)" },
  totalPnL: { start: 2835346.63, end: 10386584.89, label: "Total PnL" },
  tbBalanced: { start: 0.00, end: 0.00, label: "TB Overall Balanced?" },
};

const shareholderData = [
  { isin: "IE0003CU5OB7", openPos: 326510419.77, issued: 521390.84, redeemed: 1869534.78, closePos: 328822360.53 },
  { isin: "IE0008LG00S9", openPos: 3604.30, issued: 45.33, redeemed: null, closePos: 3640.19 },
  { isin: "IE000HT8G9M6", openPos: 10060421.18, issued: 442774.62, redeemed: 122865.32, closePos: 10481833.16 },
  { isin: "IE000MYB0L09", openPos: 15423067.89, issued: 310395.66, redeemed: 515114.05, closePos: 15299911.37 },
  { isin: "IE000NKWAOF4", openPos: 10088705.24, issued: 207214.14, redeemed: null, closePos: 10280424.99 },
  { isin: "IE000U70P266", openPos: 702786.64, issued: 38.06, redeemed: 30488.08, closePos: 667156.98 },
  { isin: "IE00BD5BCG86", openPos: 9416128.91, issued: 75827.07, redeemed: 215195.89, closePos: 9260904.10 },
  { isin: "IE00BD5BCH93", openPos: 11954.14, issued: 129.10, redeemed: null, closePos: 12051.11 },
];

const navComparison = {
  capitalTotals: 727458828.96,
  pnlActivityFYE: 2835346.63,
  capitalIncPeriodEnd: 730294175.59,
  navFromSMA: 752432832.02,
  navFromShareholderPivot: 752432832.05,
  matchSMA: true,
  matchShareholder: true,
};

// ─── Components ──────────────────────────────────────────────────────

const StatusPill = ({ status }) => {
  const colors = {
    match: { bg: "rgba(0,201,167,0.12)", text: "#00C9A7", border: "rgba(0,201,167,0.25)" },
    mismatch: { bg: "rgba(255,107,107,0.12)", text: "#FF6B6B", border: "rgba(255,107,107,0.25)" },
    pending: { bg: "rgba(255,181,71,0.1)", text: "#FFB547", border: "rgba(255,181,71,0.2)" },
    na: { bg: "rgba(75,95,120,0.15)", text: "#5A7090", border: "rgba(75,95,120,0.2)" },
  };
  const c = colors[status] || colors.na;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      letterSpacing: 0.5, textTransform: "uppercase",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: c.text,
        boxShadow: `0 0 6px ${c.text}`,
      }} />
      {status === "match" ? "Tied" : status === "mismatch" ? "Break" : status === "pending" ? "Review" : "N/A"}
    </span>
  );
};

const VarianceCell = ({ val }) => {
  if (val === null || val === undefined || val === "-" || val === "") return <span style={{ color: THEME.textDim }}>—</span>;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(num)) return <span style={{ color: THEME.textDim }}>—</span>;
  const isZero = Math.abs(num) < 0.01;
  return (
    <span style={{
      color: isZero ? THEME.match : THEME.mismatch,
      fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
      textShadow: isZero ? `0 0 8px ${THEME.accentGlow}` : `0 0 8px ${THEME.warnGlow}`,
    }}>
      {fmt(num)}
    </span>
  );
};

const NumberCell = ({ val, negative, highlight }) => {
  if (val === null || val === undefined) return <span style={{ color: THEME.textDim }}>—</span>;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  const isNeg = num < 0;
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
      color: highlight ? THEME.gold : isNeg ? "#E8827A" : THEME.text,
    }}>
      {fmt(val)}
    </span>
  );
};

const SectionHeader = ({ children, icon, color = THEME.accent }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10, padding: "12px 0",
    borderBottom: `1px solid ${THEME.border}`, marginBottom: 12,
  }}>
    <div style={{
      width: 28, height: 28, borderRadius: 6,
      background: `linear-gradient(135deg, ${color}22, ${color}08)`,
      border: `1px solid ${color}33`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14,
    }}>{icon}</div>
    <h3 style={{
      margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: 1.2,
      textTransform: "uppercase", color: THEME.text,
    }}>{children}</h3>
  </div>
);

const TabButton = ({ active, onClick, children, count }) => (
  <button onClick={onClick} style={{
    padding: "10px 20px", border: "none", cursor: "pointer",
    background: active ? `linear-gradient(135deg, ${THEME.accent}18, ${THEME.accent}08)` : "transparent",
    color: active ? THEME.accent : THEME.textMuted,
    borderBottom: active ? `2px solid ${THEME.accent}` : "2px solid transparent",
    fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: active ? 700 : 500,
    letterSpacing: 0.5, transition: "all 0.2s ease",
    display: "flex", alignItems: "center", gap: 8,
  }}>
    {children}
    {count !== undefined && (
      <span style={{
        fontSize: 10, padding: "2px 7px", borderRadius: 10,
        background: active ? THEME.accent + "22" : THEME.surfaceAlt,
        color: active ? THEME.accent : THEME.textDim,
        fontWeight: 700,
      }}>{count}</span>
    )}
  </button>
);

// ─── Main App ────────────────────────────────────────────────────────

export default function ReconcilAIre() {
  const [activeTab, setActiveTab] = useState("anl");
  const [selectedRow, setSelectedRow] = useState(null);
  const [showCrossCheck, setShowCrossCheck] = useState(true);
  const [viewMode, setViewMode] = useState("split"); // split | accounting | mmif
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
  }, []);

  const getStatus = (row) => {
    if (row.checkPrimary === null && row.checkSecondary === null) return "na";
    if (row.checkPrimary === "-" && (row.checkSecondary === "-" || row.checkSecondary === null)) return "match";
    if (typeof row.checkPrimary === "number" && Math.abs(row.checkPrimary) < 0.01) return "match";
    if (typeof row.checkSecondary === "number" && Math.abs(row.checkSecondary) < 0.01) return "match";
    if (typeof row.checkSecondary === "number" && Math.abs(row.checkSecondary) > 0.01) return "mismatch";
    return "pending";
  };

  const matchCount = assetLiabilityData.filter(r => getStatus(r) === "match").length;
  const breakCount = assetLiabilityData.filter(r => getStatus(r) === "mismatch").length;
  const totalChecks = assetLiabilityData.filter(r => getStatus(r) !== "na").length;

  const tableHeaderStyle = {
    padding: "10px 12px", fontSize: 10, fontWeight: 700, letterSpacing: 1,
    textTransform: "uppercase", color: THEME.textMuted,
    borderBottom: `1px solid ${THEME.border}`, textAlign: "right",
    whiteSpace: "nowrap", position: "sticky", top: 0,
    background: THEME.surface, zIndex: 2,
  };

  const cellStyle = {
    padding: "10px 12px", fontSize: 12, textAlign: "right",
    borderBottom: `1px solid ${THEME.border}08`,
    fontFamily: "'JetBrains Mono', monospace",
  };

  const renderANLTable = () => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1400 }}>
        <thead>
          <tr>
            <th style={{ ...tableHeaderStyle, textAlign: "left", minWidth: 90 }}>Account</th>
            <th style={{ ...tableHeaderStyle, textAlign: "left", minWidth: 170 }}>Description</th>
            {(viewMode === "split" || viewMode === "accounting") && (
              <>
                <th colSpan={3} style={{ ...tableHeaderStyle, textAlign: "center", color: THEME.blue, background: THEME.blue + "08", borderBottom: `2px solid ${THEME.blue}44` }}>
                  ◆ ACCOUNTING (Trial Balance)
                </th>
              </>
            )}
            {viewMode === "split" && (
              <th style={{ ...tableHeaderStyle, textAlign: "center", minWidth: 70, color: THEME.purple, background: THEME.purple + "08" }}>
                ⬌
              </th>
            )}
            {(viewMode === "split" || viewMode === "mmif") && (
              <>
                <th colSpan={3} style={{ ...tableHeaderStyle, textAlign: "center", color: THEME.gold, background: THEME.gold + "08", borderBottom: `2px solid ${THEME.gold}44` }}>
                  ◆ MMIF (Positions / SMA)
                </th>
              </>
            )}
            <th style={{ ...tableHeaderStyle, textAlign: "center", minWidth: 80 }}>Status</th>
          </tr>
          <tr>
            <th style={{ ...tableHeaderStyle, textAlign: "left" }}></th>
            <th style={{ ...tableHeaderStyle, textAlign: "left" }}></th>
            {(viewMode === "split" || viewMode === "accounting") && (
              <>
                <th style={{ ...tableHeaderStyle, background: THEME.blue + "05" }}>Begin Bal</th>
                <th style={{ ...tableHeaderStyle, background: THEME.blue + "05" }}>Net Activity</th>
                <th style={{ ...tableHeaderStyle, background: THEME.blue + "05" }}>End Bal</th>
              </>
            )}
            {viewMode === "split" && (
              <th style={{ ...tableHeaderStyle, background: THEME.purple + "05", textAlign: "center" }}>Variance</th>
            )}
            {(viewMode === "split" || viewMode === "mmif") && (
              <>
                <th style={{ ...tableHeaderStyle, background: THEME.gold + "05" }}>Net Sec Value</th>
                <th style={{ ...tableHeaderStyle, background: THEME.gold + "05" }}>SMA Source</th>
                <th style={{ ...tableHeaderStyle, background: THEME.gold + "05" }}>SMA Value</th>
              </>
            )}
            <th style={tableHeaderStyle}></th>
          </tr>
        </thead>
        <tbody>
          {assetLiabilityData.map((row, i) => {
            const status = getStatus(row);
            const isSelected = selectedRow === i;
            return (
              <tr key={i} onClick={() => setSelectedRow(isSelected ? null : i)}
                style={{
                  cursor: "pointer",
                  background: isSelected ? THEME.accent + "08" : i % 2 === 0 ? "transparent" : THEME.surfaceAlt + "40",
                  transition: "background 0.15s",
                }}>
                <td style={{ ...cellStyle, textAlign: "left", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: THEME.textMuted }}>
                  {row.account}
                </td>
                <td style={{ ...cellStyle, textAlign: "left", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, color: THEME.text, fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      width: 3, height: 16, borderRadius: 2,
                      background: row.category === "asset" ? THEME.blue : row.category === "liability" ? THEME.warn : THEME.gold,
                    }} />
                    {row.desc}
                  </div>
                </td>
                {(viewMode === "split" || viewMode === "accounting") && (
                  <>
                    <td style={{ ...cellStyle, background: THEME.blue + "03" }}><NumberCell val={row.beginBal} /></td>
                    <td style={{ ...cellStyle, background: THEME.blue + "03" }}><NumberCell val={row.netActivity} /></td>
                    <td style={{ ...cellStyle, background: THEME.blue + "03", fontWeight: 600 }}><NumberCell val={row.endBal} highlight={row.endBal && Math.abs(row.endBal) > 100000000} /></td>
                  </>
                )}
                {viewMode === "split" && (
                  <td style={{ ...cellStyle, textAlign: "center", background: THEME.purple + "05" }}>
                    <VarianceCell val={row.checkSecondary || row.checkPrimary} />
                  </td>
                )}
                {(viewMode === "split" || viewMode === "mmif") && (
                  <>
                    <td style={{ ...cellStyle, background: THEME.gold + "03" }}><NumberCell val={row.netSecValue} /></td>
                    <td style={{ ...cellStyle, background: THEME.gold + "03", fontFamily: "'DM Sans', sans-serif", color: THEME.textMuted, fontSize: 11 }}>{row.sma || "—"}</td>
                    <td style={{ ...cellStyle, background: THEME.gold + "03" }}><NumberCell val={row.smaValue} /></td>
                  </>
                )}
                <td style={{ ...cellStyle, textAlign: "center" }}><StatusPill status={status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderCapitalTable = () => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...tableHeaderStyle, textAlign: "left", minWidth: 90 }}>Account</th>
            <th style={{ ...tableHeaderStyle, textAlign: "left", minWidth: 200 }}>Description</th>
            <th style={tableHeaderStyle}>Beginning Balance</th>
            <th style={tableHeaderStyle}>Net Activity</th>
            <th style={tableHeaderStyle}>Ending Balance</th>
          </tr>
        </thead>
        <tbody>
          {capitalData.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : THEME.surfaceAlt + "40" }}>
              <td style={{ ...cellStyle, textAlign: "left", fontSize: 11, color: THEME.textMuted }}>{row.account}</td>
              <td style={{ ...cellStyle, textAlign: "left", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{row.desc}</td>
              <td style={cellStyle}><NumberCell val={row.beginBal} /></td>
              <td style={cellStyle}><NumberCell val={row.netActivity} /></td>
              <td style={{ ...cellStyle, fontWeight: 600 }}><NumberCell val={row.endBal} /></td>
            </tr>
          ))}
          <tr style={{ background: THEME.accent + "08" }}>
            <td colSpan={2} style={{ ...cellStyle, textAlign: "left", fontWeight: 700, color: THEME.accent }}>Capital Totals</td>
            <td style={{ ...cellStyle, fontWeight: 700, color: THEME.accent }}><NumberCell val={727458828.96} /></td>
            <td style={cellStyle}></td>
            <td style={{ ...cellStyle, fontWeight: 700, color: THEME.accent }}><NumberCell val={742046247.13} /></td>
          </tr>
          <tr style={{ background: THEME.gold + "06" }}>
            <td colSpan={2} style={{ ...cellStyle, textAlign: "left", fontWeight: 600, color: THEME.gold, fontSize: 11 }}>PnL Activity for FYE TD from TB</td>
            <td style={cellStyle}></td>
            <td style={cellStyle}></td>
            <td style={{ ...cellStyle, fontWeight: 700, color: THEME.gold }}><NumberCell val={2835346.63} /></td>
          </tr>
          <tr style={{ background: `linear-gradient(90deg, ${THEME.accent}12, ${THEME.gold}08)` }}>
            <td colSpan={2} style={{ ...cellStyle, textAlign: "left", fontWeight: 800, color: THEME.text, fontSize: 13 }}>Capital Including Period End</td>
            <td style={cellStyle}></td>
            <td style={cellStyle}></td>
            <td style={{ ...cellStyle, fontWeight: 800, color: THEME.accent, fontSize: 14 }}><NumberCell val={730294175.59} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const renderShareholderTable = () => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...tableHeaderStyle, textAlign: "left" }}>ISIN</th>
            <th style={tableHeaderStyle}>Opening Position</th>
            <th style={tableHeaderStyle}>Issued</th>
            <th style={tableHeaderStyle}>Redeemed</th>
            <th style={tableHeaderStyle}>Closing Position</th>
            <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Match</th>
          </tr>
        </thead>
        <tbody>
          {shareholderData.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : THEME.surfaceAlt + "40" }}>
              <td style={{ ...cellStyle, textAlign: "left", fontWeight: 600, color: THEME.blue }}>{row.isin}</td>
              <td style={cellStyle}><NumberCell val={row.openPos} /></td>
              <td style={cellStyle}><NumberCell val={row.issued} /></td>
              <td style={cellStyle}><NumberCell val={row.redeemed} /></td>
              <td style={{ ...cellStyle, fontWeight: 600 }}><NumberCell val={row.closePos} /></td>
              <td style={{ ...cellStyle, textAlign: "center" }}><StatusPill status="match" /></td>
            </tr>
          ))}
          <tr style={{ background: THEME.accent + "08", borderTop: `2px solid ${THEME.accent}33` }}>
            <td style={{ ...cellStyle, textAlign: "left", fontWeight: 800, color: THEME.accent }}>TOTAL (Fund 760001)</td>
            <td style={{ ...cellStyle, fontWeight: 700, color: THEME.accent }}><NumberCell val={730294175.56} /></td>
            <td style={{ ...cellStyle, fontWeight: 700, color: THEME.accent }}><NumberCell val={51671913.62} /></td>
            <td style={{ ...cellStyle, fontWeight: 700, color: THEME.accent }}><NumberCell val={36337733.18} /></td>
            <td style={{ ...cellStyle, fontWeight: 800, color: THEME.accent }}><NumberCell val={752432832.05} /></td>
            <td style={{ ...cellStyle, textAlign: "center" }}><StatusPill status="match" /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const renderCrossCheck = () => (
    <div style={{
      background: `linear-gradient(135deg, ${THEME.card}, ${THEME.surfaceAlt})`,
      borderRadius: 12, border: `1px solid ${THEME.border}`,
      padding: 20, marginTop: 16,
    }}>
      <SectionHeader icon="⚖" color={THEME.purple}>Ledger Cross Check</SectionHeader>
      <p style={{ color: THEME.textMuted, fontSize: 11, marginBottom: 16, fontStyle: "italic" }}>
        Assuming starting balance for PnL accounts was reset at the start of the period
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 2 }}>
        {[
          { label: "Assets (1x)", ...ledgerCrossCheck.assets, color: THEME.blue },
          { label: "Liabilities (2x)", ...ledgerCrossCheck.liabilities, color: THEME.warn },
          { label: "Capital (3x)", ...ledgerCrossCheck.capital, color: THEME.gold },
          { label: "BS Diff (A-L-C)", ...ledgerCrossCheck.bsDiff, color: THEME.purple, highlight: true },
          { label: "Income (4x)", ...ledgerCrossCheck.income, color: THEME.accent },
          { label: "Expense (5x)", ...ledgerCrossCheck.expense, color: THEME.warn },
          { label: "Net Income", ...ledgerCrossCheck.netIncome, color: THEME.accent, highlight: true },
          { label: "RGL (61x)", ...ledgerCrossCheck.rgl, color: THEME.textMuted },
          { label: "URGL (6x excl 61)", ...ledgerCrossCheck.urgl, color: THEME.textMuted },
          { label: "Net GL", ...ledgerCrossCheck.netGL, color: THEME.gold },
          { label: "Total PnL", ...ledgerCrossCheck.totalPnL, color: THEME.accent, highlight: true },
          { label: "TB Balanced?", ...ledgerCrossCheck.tbBalanced, color: THEME.match, highlight: true },
        ].map((item, i) => (
          <div key={i} style={{
            padding: "10px 14px", borderRadius: 8,
            background: item.highlight ? item.color + "0A" : "transparent",
            border: item.highlight ? `1px solid ${item.color}22` : "1px solid transparent",
          }}>
            <div style={{ fontSize: 10, color: item.color, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>
              {item.label}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, color: THEME.textDim, marginBottom: 2 }}>START</div>
                <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: THEME.text }}>{fmtCompact(item.start)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: THEME.textDim, marginBottom: 2 }}>END</div>
                <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: THEME.text, fontWeight: 600 }}>{fmtCompact(item.end)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderNAVTieOut = () => (
    <div style={{
      background: `linear-gradient(135deg, ${THEME.card}, ${THEME.surfaceAlt})`,
      borderRadius: 12, border: `1px solid ${THEME.accent}22`,
      padding: 20, marginTop: 16,
    }}>
      <SectionHeader icon="◎" color={THEME.accent}>NAV Tie-Out</SectionHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div style={{ padding: 16, background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}` }}>
          <div style={{ fontSize: 10, color: THEME.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>From TB (Capital + PnL)</div>
          <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: THEME.textMuted, marginBottom: 4 }}>Capital: {fmtCompact(navComparison.capitalTotals)}</div>
          <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: THEME.textMuted, marginBottom: 8 }}>+ PnL: {fmtCompact(navComparison.pnlActivityFYE)}</div>
          <div style={{ fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: THEME.text, fontWeight: 800 }}>{fmtCompact(navComparison.capitalIncPeriodEnd)}</div>
        </div>
        <div style={{ padding: 16, background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}` }}>
          <div style={{ fontSize: 10, color: THEME.gold, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>From NAV (SMA)</div>
          <div style={{ fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: THEME.gold, fontWeight: 800, marginTop: 28 }}>{fmt(navComparison.navFromSMA)}</div>
        </div>
        <div style={{ padding: 16, background: THEME.surface, borderRadius: 10, border: `1px solid ${THEME.border}` }}>
          <div style={{ fontSize: 10, color: THEME.blue, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>From Shareholder Pivot</div>
          <div style={{ fontSize: 16, fontFamily: "'JetBrains Mono', monospace", color: THEME.blue, fontWeight: 800, marginTop: 28 }}>{fmt(navComparison.navFromShareholderPivot)}</div>
        </div>
      </div>
      <div style={{
        marginTop: 16, padding: "12px 20px", borderRadius: 8,
        background: THEME.match + "0A", border: `1px solid ${THEME.match}22`,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
      }}>
        <span style={{ color: THEME.match, fontSize: 18 }}>✓</span>
        <span style={{ color: THEME.match, fontSize: 13, fontWeight: 700 }}>NAV to Shareholders — ALL SHARE CLASSES TIED</span>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: THEME.bg, color: THEME.text,
      fontFamily: "'DM Sans', sans-serif",
      opacity: animate ? 1 : 0, transition: "opacity 0.5s ease",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Sora:wght@700;800&display=swap" rel="stylesheet" />

      {/* ─── Header ─── */}
      <div style={{
        padding: "16px 28px",
        background: `linear-gradient(180deg, ${THEME.surface}, ${THEME.bg})`,
        borderBottom: `1px solid ${THEME.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.blue})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 800, color: "#fff",
              boxShadow: `0 4px 20px ${THEME.accent}33`,
            }}>R</div>
            <div>
              <h1 style={{
                margin: 0, fontSize: 20, fontWeight: 800,
                fontFamily: "'Sora', sans-serif",
                background: `linear-gradient(135deg, ${THEME.accent}, ${THEME.blue})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>ReconcilAIre</h1>
              <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>
                Guggenheim KY9 · Fund 760001 · GFI Test Pack 2
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: THEME.textDim, letterSpacing: 1, textTransform: "uppercase" }}>Quarter End</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: THEME.text }}>Q1 2026</div>
            </div>
            <div style={{
              display: "flex", gap: 4, padding: 3, borderRadius: 8,
              background: THEME.surfaceAlt, border: `1px solid ${THEME.border}`,
            }}>
              {[
                { key: "split", label: "Split" },
                { key: "accounting", label: "TB" },
                { key: "mmif", label: "MMIF" },
              ].map(m => (
                <button key={m.key} onClick={() => setViewMode(m.key)} style={{
                  padding: "6px 14px", border: "none", borderRadius: 6, cursor: "pointer",
                  background: viewMode === m.key ? THEME.accent + "20" : "transparent",
                  color: viewMode === m.key ? THEME.accent : THEME.textMuted,
                  fontSize: 11, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                }}>{m.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── KPI Strip ─── */}
        <div style={{
          display: "flex", gap: 16, marginTop: 16,
          padding: "14px 0",
        }}>
          {[
            { label: "Total Checks", value: totalChecks, color: THEME.text },
            { label: "Tied", value: matchCount, color: THEME.match },
            { label: "Breaks", value: breakCount, color: THEME.mismatch },
            { label: "TB Balanced", value: "✓ 0.00", color: THEME.match },
            { label: "NAV From SMA", value: fmtCompact(752432832.02), color: THEME.gold },
            { label: "NAV Shareholders", value: fmtCompact(752432832.05), color: THEME.blue },
          ].map((kpi, i) => (
            <div key={i} style={{
              flex: 1, padding: "10px 16px", borderRadius: 10,
              background: THEME.card, border: `1px solid ${THEME.border}`,
            }}>
              <div style={{ fontSize: 9, color: THEME.textDim, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color, fontFamily: "'JetBrains Mono', monospace" }}>{kpi.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Tab Bar ─── */}
      <div style={{
        display: "flex", padding: "0 28px",
        borderBottom: `1px solid ${THEME.border}`,
        background: THEME.surface,
      }}>
        <TabButton active={activeTab === "anl"} onClick={() => setActiveTab("anl")} count={assetLiabilityData.length}>
          Asset & Liability
        </TabButton>
        <TabButton active={activeTab === "capital"} onClick={() => setActiveTab("capital")} count={capitalData.length}>
          Capital
        </TabButton>
        <TabButton active={activeTab === "shareholder"} onClick={() => setActiveTab("shareholder")} count={shareholderData.length}>
          Shareholder Pivot
        </TabButton>
        <TabButton active={activeTab === "nav"} onClick={() => setActiveTab("nav")}>
          NAV Tie-Out
        </TabButton>
        <TabButton active={activeTab === "crosscheck"} onClick={() => setActiveTab("crosscheck")}>
          Ledger Cross Check
        </TabButton>
      </div>

      {/* ─── Content ─── */}
      <div style={{ padding: "20px 28px" }}>
        {activeTab === "anl" && (
          <div style={{
            background: THEME.surface, borderRadius: 12,
            border: `1px solid ${THEME.border}`, overflow: "hidden",
          }}>
            <div style={{
              padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: `1px solid ${THEME.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14 }}>📊</span>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>Asset, Liability & Expense Reconciliation</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 3, borderRadius: 2, background: THEME.blue }} />
                <span style={{ fontSize: 10, color: THEME.textMuted }}>Accounting</span>
                <span style={{ width: 10, height: 3, borderRadius: 2, background: THEME.gold, marginLeft: 8 }} />
                <span style={{ fontSize: 10, color: THEME.textMuted }}>MMIF</span>
                <span style={{ width: 10, height: 3, borderRadius: 2, background: THEME.purple, marginLeft: 8 }} />
                <span style={{ fontSize: 10, color: THEME.textMuted }}>Variance</span>
              </div>
            </div>
            {renderANLTable()}
          </div>
        )}

        {activeTab === "capital" && (
          <div style={{
            background: THEME.surface, borderRadius: 12,
            border: `1px solid ${THEME.border}`, overflow: "hidden",
          }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${THEME.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14 }}>💰</span>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>Capital Ledger — Standard Ledger Accounts</span>
              </div>
            </div>
            {renderCapitalTable()}
          </div>
        )}

        {activeTab === "shareholder" && (
          <div style={{
            background: THEME.surface, borderRadius: 12,
            border: `1px solid ${THEME.border}`, overflow: "hidden",
          }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${THEME.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14 }}>🏦</span>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>Shareholder Activity Pivot by ISIN</span>
              </div>
            </div>
            {renderShareholderTable()}
          </div>
        )}

        {activeTab === "nav" && renderNAVTieOut()}
        {activeTab === "crosscheck" && renderCrossCheck()}
      </div>

      {/* ─── Footer ─── */}
      <div style={{
        padding: "16px 28px", borderTop: `1px solid ${THEME.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 10, color: THEME.textDim }}>
          ReconcilAIre v2.0 · BNY Fund Services · Powered by RECON-AI
        </div>
        <div style={{ fontSize: 10, color: THEME.textDim }}>
          Source: Guggenheim_KY9_760001_GFI_Test_Pack_2.xlsx · Internal Use Only
        </div>
      </div>
    </div>
  );
}
