import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  Paper,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  ToggleButtonGroup,
  ToggleButton,
  Card,
  CardContent,
  Grid,
  Autocomplete,
  TextField,
  IconButton,
  alpha,
  useTheme,
  CircularProgress,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';
import { fetchMmifReconciliationDetail } from '../../services/api';
import {
  MmifReconciliationDetail,
  MmifReconAccountRow,
  MmifReconLedgerItem,
  ReconRowStatus,
  MmifFund,
  MmifDrillDownContext,
  MMIF_SECTIONS,
} from '../../types';

// ── Formatters ──────────────────────────────────────────────

const fmt = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  const isNeg = n < 0;
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return isNeg ? `(${formatted})` : formatted;
};

const fmtCompact = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '—';
  const abs = Math.abs(n);
  const isNeg = n < 0;
  let result: string;
  if (abs >= 1e9) result = (abs / 1e9).toFixed(2) + 'B';
  else if (abs >= 1e6) result = (abs / 1e6).toFixed(2) + 'M';
  else if (abs >= 1e3) result = (abs / 1e3).toFixed(1) + 'K';
  else result = abs.toFixed(2);
  return isNeg ? `(${result})` : result;
};

// ── Sub-components ──────────────────────────────────────────

const StatusChip: React.FC<{ status: ReconRowStatus }> = ({ status }) => {
  const map: Record<ReconRowStatus, { label: string; color: 'success' | 'error' | 'warning' | 'default' }> = {
    match: { label: 'Tied', color: 'success' },
    break: { label: 'Break', color: 'error' },
    review: { label: 'Review', color: 'warning' },
    na: { label: 'N/A', color: 'default' },
  };
  const { label, color } = map[status] || map.na;
  return (
    <Chip
      label={label}
      size="small"
      color={color}
      variant="outlined"
      sx={{ fontWeight: 600, fontSize: '0.65rem', height: 22 }}
    />
  );
};

const NumberCellContent: React.FC<{
  val: number | null | undefined;
  highlight?: boolean;
  color?: string;
}> = ({ val, highlight, color }) => {
  const theme = useTheme();
  if (val === null || val === undefined) {
    return <Typography variant="body2" color="text.disabled" fontFamily="monospace" fontSize="0.75rem">—</Typography>;
  }
  return (
    <Typography
      variant="body2"
      fontFamily="monospace"
      fontSize="0.75rem"
      fontWeight={highlight ? 700 : 400}
      color={color || (val < 0 ? 'error.main' : 'text.primary')}
      sx={highlight ? { bgcolor: alpha(theme.palette.warning.main, 0.06), px: 0.5, borderRadius: 0.5 } : undefined}
    >
      {fmt(val)}
    </Typography>
  );
};

const VarianceCellContent: React.FC<{ val: number | null | undefined }> = ({ val }) => {
  const theme = useTheme();
  if (val === null || val === undefined) {
    return <Typography variant="body2" color="text.disabled" fontFamily="monospace" fontSize="0.75rem">—</Typography>;
  }
  const isZero = Math.abs(val) < 0.01;
  return (
    <Typography
      variant="body2"
      fontFamily="monospace"
      fontSize="0.75rem"
      fontWeight={700}
      color={isZero ? 'success.main' : 'error.main'}
      sx={{ textShadow: isZero ? undefined : `0 0 4px ${alpha(theme.palette.error.main, 0.2)}` }}
    >
      {fmt(val)}
    </Typography>
  );
};

// ── Main Component ──────────────────────────────────────────

interface MmifBreakDetailViewProps {
  eventId: string;
  funds: MmifFund[];
  drillDownContext?: MmifDrillDownContext | null;
  onClearDrillDown?: () => void;
}

const mapSectionToSubTab = (mmifSection?: string): number => {
  if (!mmifSection) return 0;
  if (mmifSection === '5.1') return 2; // Shareholder
  return 0; // A&L for sections 2, 3.x, 4.x and default
};

const MmifBreakDetailView: React.FC<MmifBreakDetailViewProps> = ({
  eventId, funds, drillDownContext, onClearDrillDown,
}) => {
  const theme = useTheme();
  const initialAccount = drillDownContext?.fundAccount || funds[0]?.account || '';
  const [selectedAccount, setSelectedAccount] = useState<string>(initialAccount);
  const [detail, setDetail] = useState<MmifReconciliationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState(0);
  const [viewMode, setViewMode] = useState<'split' | 'accounting' | 'mmif'>('split');

  // React to drill-down context changes
  useEffect(() => {
    if (drillDownContext?.fundAccount) {
      setSelectedAccount(drillDownContext.fundAccount);
      setSubTab(mapSectionToSubTab(drillDownContext.mmifSection));
    }
  }, [drillDownContext]);

  useEffect(() => {
    if (!eventId || !selectedAccount) return;
    setLoading(true);
    fetchMmifReconciliationDetail(eventId, selectedAccount)
      .then((data) => setDetail(data as MmifReconciliationDetail))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [eventId, selectedAccount]);

  // Derived KPIs
  const rows = detail?.assetLiabilityRows || [];
  const matchCount = rows.filter((r) => r.status === 'match').length;
  const breakCount = rows.filter((r) => r.status === 'break').length;
  const totalChecks = rows.filter((r) => r.status !== 'na').length;

  // ── Drill-Down Traceability Banner ──
  const renderDrillDownBanner = () => {
    if (!drillDownContext) return null;
    const sectionLabel = drillDownContext.mmifSection
      ? MMIF_SECTIONS[drillDownContext.mmifSection] || drillDownContext.mmifSection
      : null;
    return (
      <Paper
        variant="outlined"
        sx={{ mb: 2, p: 1.5, borderColor: 'info.main', bgcolor: alpha(theme.palette.info.main, 0.04), borderRadius: 2 }}
      >
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary">Drilled from</Typography>
            <Chip label={drillDownContext.ruleId.replace('_', '-')} size="small" color="info" sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
            <Typography variant="caption" fontWeight={600}>{drillDownContext.ruleName}</Typography>
            {sectionLabel && (
              <>
                <Typography variant="caption" color="text.secondary">{'\u2192'}</Typography>
                <Chip label={`Section ${drillDownContext.mmifSection}: ${sectionLabel}`} size="small" variant="outlined" color="info" sx={{ fontSize: '0.65rem', height: 22 }} />
              </>
            )}
            {drillDownContext.fundName && (
              <>
                <Typography variant="caption" color="text.secondary">{'\u2192'}</Typography>
                <Chip label={drillDownContext.fundName} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 22 }} />
              </>
            )}
          </Stack>
          <IconButton size="small" onClick={onClearDrillDown} aria-label="close drill-down">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>
    );
  };

  // ── Fund Selector (Autocomplete) ──
  const renderFundSelector = () => {
    const selectedFund = funds.find((f) => f.account === selectedAccount) || funds[0];
    if (!selectedFund) return null;
    return (
      <Autocomplete<MmifFund, false, true>
        value={selectedFund}
        onChange={(_, newValue) => {
          if (newValue) { setSelectedAccount(newValue.account); setSubTab(0); }
        }}
        options={funds}
        getOptionLabel={(option) => `${option.fundName} (${option.account})`}
        isOptionEqualToValue={(option, value) => option.account === value.account}
        renderOption={(props, option) => (
          <li {...props} key={option.account}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{option.fundName}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {option.account} — {option.fundType} — {option.fundDomicile}
                </Typography>
              </Box>
              {(option.breakCount ?? 0) > 0 && (
                <Chip label={`${option.breakCount} breaks`} size="small" color="error" sx={{ fontSize: '0.65rem', height: 20 }} />
              )}
              <Chip
                label={option.status.replace('_', ' ')}
                size="small"
                color={option.status === 'PASSED' ? 'success' : option.status === 'FAILED' ? 'error' : 'default'}
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 20 }}
              />
            </Stack>
          </li>
        )}
        renderInput={(params) => (
          <TextField {...params} label="Select Fund" size="small" placeholder="Search by fund name, account, or type..." />
        )}
        sx={{ mb: 2, maxWidth: 600 }}
        disableClearable
        autoHighlight
        ListboxProps={{ style: { maxHeight: 400 } }}
      />
    );
  };

  // ── KPI Strip ──
  const renderKpiStrip = () => {
    if (!detail) return null;
    const navSma = detail.navComparison?.navFromSMA;
    const navSh = detail.navComparison?.navFromShareholderPivot;
    const tbBal = detail.ledgerCrossCheck?.tbBalanced;

    const kpis = [
      { label: 'Total Checks', value: String(totalChecks), color: 'text.primary' },
      { label: 'Tied', value: String(matchCount), color: 'success.main' },
      { label: 'Breaks', value: String(breakCount), color: 'error.main' },
      { label: 'TB Balanced', value: tbBal && Math.abs(tbBal.end) < 0.01 ? '0.00' : fmtCompact(tbBal?.end), color: tbBal && Math.abs(tbBal.end) < 0.01 ? 'success.main' : 'error.main' },
      { label: 'NAV From SMA', value: fmtCompact(navSma), color: 'warning.main' },
      { label: 'NAV Shareholders', value: fmtCompact(navSh), color: 'info.main' },
    ];

    return (
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {kpis.map((kpi) => (
          <Grid size={{ xs: 6, sm: 4, md: 2 }} key={kpi.label}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                  {kpi.label}
                </Typography>
                <Typography variant="h6" fontWeight={800} fontFamily="monospace" color={kpi.color}>
                  {kpi.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  // ── Asset & Liability Table ──
  const renderANLTable = () => {
    if (!detail) return null;
    const showAccounting = viewMode === 'split' || viewMode === 'accounting';
    const showMmif = viewMode === 'split' || viewMode === 'mmif';
    const showVariance = viewMode === 'split';

    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, minWidth: 100 }}>Account</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 180 }}>Description</TableCell>
              {showAccounting && (
                <TableCell
                  colSpan={3}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    color: theme.palette.info.main,
                    bgcolor: alpha(theme.palette.info.main, 0.04),
                    borderBottom: `2px solid ${alpha(theme.palette.info.main, 0.3)}`,
                    fontSize: '0.7rem',
                    letterSpacing: 1,
                  }}
                >
                  ACCOUNTING (Trial Balance)
                </TableCell>
              )}
              {showVariance && (
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 700,
                    color: theme.palette.secondary.main,
                    bgcolor: alpha(theme.palette.secondary.main, 0.04),
                    fontSize: '0.7rem',
                    minWidth: 90,
                  }}
                >
                  VARIANCE
                </TableCell>
              )}
              {showMmif && (
                <TableCell
                  colSpan={3}
                  align="center"
                  sx={{
                    fontWeight: 700,
                    color: theme.palette.warning.dark,
                    bgcolor: alpha(theme.palette.warning.main, 0.04),
                    borderBottom: `2px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                    fontSize: '0.7rem',
                    letterSpacing: 1,
                  }}
                >
                  MMIF (Positions / SMA)
                </TableCell>
              )}
              <TableCell align="center" sx={{ fontWeight: 600, width: 80 }}>Status</TableCell>
            </TableRow>
            <TableRow>
              <TableCell />
              <TableCell />
              {showAccounting && (
                <>
                  <TableCell align="right" sx={{ bgcolor: alpha(theme.palette.info.main, 0.02) }}>Begin Bal</TableCell>
                  <TableCell align="right" sx={{ bgcolor: alpha(theme.palette.info.main, 0.02) }}>Net Activity</TableCell>
                  <TableCell align="right" sx={{ bgcolor: alpha(theme.palette.info.main, 0.02) }}>End Bal</TableCell>
                </>
              )}
              {showVariance && (
                <TableCell align="center" sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.02) }}>Diff</TableCell>
              )}
              {showMmif && (
                <>
                  <TableCell align="right" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.02) }}>Net Sec Value</TableCell>
                  <TableCell sx={{ bgcolor: alpha(theme.palette.warning.main, 0.02) }}>SMA Source</TableCell>
                  <TableCell align="right" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.02) }}>SMA Value</TableCell>
                </>
              )}
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {detail.assetLiabilityRows.map((row, i) => (
              <TableRow
                key={i}
                sx={{
                  bgcolor: row.status === 'break'
                    ? alpha(theme.palette.error.main, 0.04)
                    : i % 2 === 1
                    ? alpha(theme.palette.action.hover, 0.3)
                    : 'transparent',
                }}
              >
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.7rem" color="text.secondary">
                    {row.account}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Box
                      sx={{
                        width: 3,
                        height: 16,
                        borderRadius: 1,
                        bgcolor: row.category === 'asset' ? 'info.main' : 'error.main',
                      }}
                    />
                    <Typography variant="body2" fontWeight={500} fontSize="0.8rem">
                      {row.description}
                    </Typography>
                  </Stack>
                </TableCell>
                {showAccounting && (
                  <>
                    <TableCell align="right" sx={{ bgcolor: alpha(theme.palette.info.main, 0.01) }}>
                      <NumberCellContent val={row.beginBal} />
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: alpha(theme.palette.info.main, 0.01) }}>
                      <NumberCellContent val={row.netActivity} />
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: alpha(theme.palette.info.main, 0.01) }}>
                      <NumberCellContent
                        val={row.endBal}
                        highlight={row.endBal != null && Math.abs(row.endBal) > 100000000}
                      />
                    </TableCell>
                  </>
                )}
                {showVariance && (
                  <TableCell align="center" sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.02) }}>
                    <VarianceCellContent val={row.variance} />
                  </TableCell>
                )}
                {showMmif && (
                  <>
                    <TableCell align="right" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.01) }}>
                      <NumberCellContent val={row.netSecValue} />
                    </TableCell>
                    <TableCell sx={{ bgcolor: alpha(theme.palette.warning.main, 0.01) }}>
                      <Typography variant="caption" color="text.secondary">
                        {row.smaSource || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.01) }}>
                      <NumberCellContent val={row.smaValue} />
                    </TableCell>
                  </>
                )}
                <TableCell align="center">
                  <StatusChip status={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // ── Capital Table ──
  const renderCapitalTable = () => {
    if (!detail) return null;
    const capitalTotal = detail.capitalRows.reduce((sum, r) => sum + (r.endBal || 0), 0);
    const pnl = detail.navComparison?.pnlActivityFYE ?? 0;

    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, minWidth: 100 }}>Account</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 200 }}>Description</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Beginning Balance</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Net Activity</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Ending Balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detail.capitalRows.map((row, i) => (
              <TableRow key={i} sx={{ bgcolor: i % 2 === 1 ? alpha(theme.palette.action.hover, 0.3) : 'transparent' }}>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontSize="0.7rem" color="text.secondary">
                    {row.account}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>{row.description}</Typography>
                </TableCell>
                <TableCell align="right"><NumberCellContent val={row.beginBal} /></TableCell>
                <TableCell align="right"><NumberCellContent val={row.netActivity} /></TableCell>
                <TableCell align="right"><NumberCellContent val={row.endBal} highlight /></TableCell>
              </TableRow>
            ))}

            {/* Capital Totals */}
            <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.06) }}>
              <TableCell colSpan={2}>
                <Typography variant="body2" fontWeight={700} color="success.main">Capital Totals</Typography>
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell align="right">
                <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="success.main" fontSize="0.8rem">
                  {fmt(capitalTotal)}
                </Typography>
              </TableCell>
            </TableRow>

            {/* PnL Activity */}
            <TableRow sx={{ bgcolor: alpha(theme.palette.warning.main, 0.04) }}>
              <TableCell colSpan={2}>
                <Typography variant="body2" fontWeight={600} color="warning.dark" fontSize="0.8rem">
                  PnL Activity for FYE TD from TB
                </Typography>
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell align="right">
                <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="warning.dark" fontSize="0.8rem">
                  {fmt(pnl)}
                </Typography>
              </TableCell>
            </TableRow>

            {/* Capital Including Period End */}
            <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.04), borderTop: `2px solid ${theme.palette.divider}` }}>
              <TableCell colSpan={2}>
                <Typography variant="body2" fontWeight={800} fontSize="0.85rem">
                  Capital Including Period End
                </Typography>
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell align="right">
                <Typography variant="body2" fontFamily="monospace" fontWeight={800} color="success.main" fontSize="0.9rem">
                  {fmt(capitalTotal + pnl)}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // ── Shareholder Pivot Table ──
  const renderShareholderTable = () => {
    if (!detail) return null;
    const total = {
      open: detail.shareholderRows.reduce((s, r) => s + (r.openPosition || 0), 0),
      issued: detail.shareholderRows.reduce((s, r) => s + (r.issued || 0), 0),
      redeemed: detail.shareholderRows.reduce((s, r) => s + (r.redeemed || 0), 0),
      close: detail.shareholderRows.reduce((s, r) => s + (r.closePosition || 0), 0),
    };

    return (
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>ISIN</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Opening Position</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Issued</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Redeemed</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Closing Position</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600, width: 80 }}>Match</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detail.shareholderRows.map((row, i) => (
              <TableRow key={i} sx={{ bgcolor: i % 2 === 1 ? alpha(theme.palette.action.hover, 0.3) : 'transparent' }}>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600} color="info.main" fontSize="0.75rem">
                    {row.isin}
                  </Typography>
                </TableCell>
                <TableCell align="right"><NumberCellContent val={row.openPosition} /></TableCell>
                <TableCell align="right"><NumberCellContent val={row.issued} /></TableCell>
                <TableCell align="right"><NumberCellContent val={row.redeemed} /></TableCell>
                <TableCell align="right"><NumberCellContent val={row.closePosition} highlight /></TableCell>
                <TableCell align="center">
                  <StatusChip status={row.matched ? 'match' : 'break'} />
                </TableCell>
              </TableRow>
            ))}

            {/* Totals */}
            <TableRow sx={{ bgcolor: alpha(theme.palette.success.main, 0.06), borderTop: `2px solid ${alpha(theme.palette.success.main, 0.2)}` }}>
              <TableCell>
                <Typography variant="body2" fontWeight={800} color="success.main">TOTAL</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="success.main" fontSize="0.75rem">{fmt(total.open)}</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="success.main" fontSize="0.75rem">{fmt(total.issued)}</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontFamily="monospace" fontWeight={700} color="success.main" fontSize="0.75rem">{fmt(total.redeemed)}</Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontFamily="monospace" fontWeight={800} color="success.main" fontSize="0.8rem">{fmt(total.close)}</Typography>
              </TableCell>
              <TableCell align="center">
                <StatusChip status="match" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // ── NAV Tie-Out ──
  const renderNavTieOut = () => {
    if (!detail?.navComparison) return null;
    const nav = detail.navComparison;
    const navMatched =
      Math.abs(nav.capitalIncPeriodEnd - nav.navFromSMA) < 0.01 ||
      Math.abs(nav.capitalIncPeriodEnd - nav.navFromShareholderPivot) < 0.01;

    return (
      <Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">From TB (Capital + PnL)</Typography>
                <Typography variant="body2" fontFamily="monospace" color="text.secondary" sx={{ mt: 1 }}>
                  Capital: {fmtCompact(nav.capitalTotals)}
                </Typography>
                <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                  + PnL: {fmtCompact(nav.pnlActivityFYE)}
                </Typography>
                <Typography variant="h5" fontFamily="monospace" fontWeight={800} sx={{ mt: 1.5 }}>
                  {fmtCompact(nav.capitalIncPeriodEnd)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="overline" color="warning.main">From NAV (SMA)</Typography>
                <Typography variant="h5" fontFamily="monospace" fontWeight={800} color="warning.main" sx={{ mt: 3.5 }}>
                  {fmt(nav.navFromSMA)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="overline" color="info.main">From Shareholder Pivot</Typography>
                <Typography variant="h5" fontFamily="monospace" fontWeight={800} color="info.main" sx={{ mt: 3.5 }}>
                  {fmt(nav.navFromShareholderPivot)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tie-Out Result Banner */}
        <Paper
          variant="outlined"
          sx={{
            mt: 2,
            p: 2,
            textAlign: 'center',
            borderColor: navMatched ? 'success.main' : 'error.main',
            bgcolor: alpha(navMatched ? theme.palette.success.main : theme.palette.error.main, 0.04),
          }}
        >
          <Stack direction="row" justifyContent="center" alignItems="center" spacing={1}>
            {navMatched ? (
              <CheckCircleOutlineIcon color="success" />
            ) : (
              <ErrorOutlineIcon color="error" />
            )}
            <Typography variant="subtitle2" fontWeight={700} color={navMatched ? 'success.main' : 'error.main'}>
              {navMatched ? 'NAV to Shareholders — ALL SHARE CLASSES TIED' : 'NAV Tie-Out — Variance Detected'}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    );
  };

  // ── Ledger Cross Check ──
  const renderCrossCheck = () => {
    if (!detail?.ledgerCrossCheck) return null;
    const lcc = detail.ledgerCrossCheck;

    const items: { label: string; data: MmifReconLedgerItem; color: string; highlight?: boolean }[] = [
      { label: 'Assets (1x)', data: lcc.assets, color: theme.palette.info.main },
      { label: 'Liabilities (2x)', data: lcc.liabilities, color: theme.palette.error.main },
      { label: 'Capital (3x)', data: lcc.capital, color: theme.palette.warning.main },
      { label: 'BS Diff (A-L-C)', data: lcc.bsDiff, color: theme.palette.secondary.main, highlight: true },
      { label: 'Income (4x)', data: lcc.income, color: theme.palette.success.main },
      { label: 'Expense (5x)', data: lcc.expense, color: theme.palette.error.main },
      { label: 'Net Income', data: lcc.netIncome, color: theme.palette.success.main, highlight: true },
      { label: 'RGL (61x)', data: lcc.rgl, color: theme.palette.text.secondary },
      { label: 'URGL (6x excl 61)', data: lcc.urgl, color: theme.palette.text.secondary },
      { label: 'Net GL', data: lcc.netGL, color: theme.palette.warning.main },
      { label: 'Total PnL', data: lcc.totalPnL, color: theme.palette.success.main, highlight: true },
      { label: 'TB Balanced?', data: lcc.tbBalanced, color: Math.abs(lcc.tbBalanced.end) < 0.01 ? theme.palette.success.main : theme.palette.error.main, highlight: true },
    ];

    return (
      <Box>
        <Typography variant="body2" color="text.secondary" fontStyle="italic" sx={{ mb: 2 }}>
          Assuming starting balance for PnL accounts was reset at the start of the period
        </Typography>
        <Grid container spacing={1}>
          {items.map((item, i) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={i}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  height: '100%',
                  borderColor: item.highlight ? alpha(item.color, 0.3) : 'divider',
                  bgcolor: item.highlight ? alpha(item.color, 0.04) : 'transparent',
                }}
              >
                <Typography
                  variant="overline"
                  sx={{ color: item.color, fontSize: '0.6rem', fontWeight: 700 }}
                >
                  {item.label}
                </Typography>
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                  <Box>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>START</Typography>
                    <Typography variant="body2" fontFamily="monospace" fontSize="0.7rem">
                      {fmtCompact(item.data.start)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6rem' }}>END</Typography>
                    <Typography variant="body2" fontFamily="monospace" fontSize="0.7rem" fontWeight={600}>
                      {fmtCompact(item.data.end)}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  // ── Main Render ──
  if (funds.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
        No funds available
      </Typography>
    );
  }

  return (
    <Box>
      {/* Drill-Down Traceability Banner */}
      {renderDrillDownBanner()}

      {/* Fund Selector */}
      {renderFundSelector()}

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      )}

      {/* No data available */}
      {!loading && !detail && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No reconciliation detail available for this fund. Run validation to generate reconciliation data.
        </Typography>
      )}

      {/* Detail View */}
      {!loading && detail && (
        <>
          {/* KPI Strip */}
          {renderKpiStrip()}

          {/* View Mode + Sub-Tabs */}
          <Paper variant="outlined" sx={{ borderRadius: 2 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}
            >
              {/* Sub-Tabs */}
              <Tabs
                value={subTab}
                onChange={(_, v) => setSubTab(v)}
                sx={{ minHeight: 36 }}
              >
                <Tab
                  label={`Asset & Liability (${rows.length})`}
                  sx={{ minHeight: 36, py: 0 }}
                />
                <Tab
                  label={`Capital (${detail.capitalRows.length})`}
                  sx={{ minHeight: 36, py: 0 }}
                />
                <Tab
                  label={`Shareholder (${detail.shareholderRows.length})`}
                  sx={{ minHeight: 36, py: 0 }}
                />
                <Tab label="NAV Tie-Out" sx={{ minHeight: 36, py: 0 }} />
                <Tab label="Ledger Cross Check" sx={{ minHeight: 36, py: 0 }} />
              </Tabs>

              {/* View Mode Toggle (only for A&L tab) */}
              {subTab === 0 && (
                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, v) => v && setViewMode(v)}
                  size="small"
                  sx={{ ml: 2 }}
                >
                  <ToggleButton value="split" sx={{ px: 1.5, py: 0.5, fontSize: '0.7rem' }}>
                    Split
                  </ToggleButton>
                  <ToggleButton value="accounting" sx={{ px: 1.5, py: 0.5, fontSize: '0.7rem' }}>
                    TB
                  </ToggleButton>
                  <ToggleButton value="mmif" sx={{ px: 1.5, py: 0.5, fontSize: '0.7rem' }}>
                    MMIF
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
            </Stack>

            {/* Legend (A&L tab only) */}
            {subTab === 0 && (
              <Stack direction="row" spacing={2} sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 10, height: 3, borderRadius: 1, bgcolor: 'info.main' }} />
                  <Typography variant="caption" color="text.secondary">Accounting</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 10, height: 3, borderRadius: 1, bgcolor: 'warning.main' }} />
                  <Typography variant="caption" color="text.secondary">MMIF</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 10, height: 3, borderRadius: 1, bgcolor: 'secondary.main' }} />
                  <Typography variant="caption" color="text.secondary">Variance</Typography>
                </Stack>
              </Stack>
            )}

            {/* Tab Content */}
            <Box sx={{ p: 2 }}>
              {subTab === 0 && renderANLTable()}
              {subTab === 1 && renderCapitalTable()}
              {subTab === 2 && renderShareholderTable()}
              {subTab === 3 && renderNavTieOut()}
              {subTab === 4 && renderCrossCheck()}
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default MmifBreakDetailView;
