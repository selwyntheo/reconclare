import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  CircularProgress,
  Divider,
  Button,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ColDef, RowDoubleClickedEvent } from 'ag-grid-community';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { DrillDownBreadcrumb } from '../../components/shared/DrillDownBreadcrumb';
import { ValidationStatus } from '../../components/shared/ValidationStatus';
import { AICommentaryPanel } from '../../components/shared/AICommentaryPanel';
import { useDrillDownState, useDrillDownDispatch } from '../../context/DrillDownContext';
import {
  fetchTrialBalanceCompare,
  fetchSubledgerCheck,
  fetchEvent,
  fetchAIAnalysis,
} from '../../services/api';
import { TrialBalanceCategoryRow, SubledgerCheckResult, AICommentaryData } from '../../types';
import { exportToCsv } from '../../utils/exportToExcel';

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return '';
  return v < 0
    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const TrialBalance: React.FC = () => {
  const { eventId, account } = useParams<{ eventId: string; account: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const state = useDrillDownState();
  const dispatch = useDrillDownDispatch();
  const valuationDt = searchParams.get('valuationDt') || state.context.valuationDt || '';

  const [categories, setCategories] = useState<TrialBalanceCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [subledgerChecks, setSubledgerChecks] = useState<Record<string, SubledgerCheckResult>>({});
  const [aiAnalysis, setAiAnalysis] = useState<AICommentaryData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [, setHighlightedCategory] = useState<string | null>(null);

  // Set context if not already set
  useEffect(() => {
    if (eventId && !state.context.eventId) {
      fetchEvent(eventId).then((evt: any) => {
        dispatch({ type: 'SET_EVENT', eventId: evt.eventId, eventName: evt.eventName });
      }).catch(() => {});
    }
  }, [eventId, state.context.eventId, dispatch]);

  // Load trial balance data
  useEffect(() => {
    if (account && valuationDt) {
      setLoading(true);
      fetchTrialBalanceCompare(account, valuationDt)
        .then(setCategories)
        .catch(() => setCategories([]))
        .finally(() => setLoading(false));
    }
  }, [account, valuationDt]);

  // Load AI analysis
  useEffect(() => {
    if (eventId && account) {
      setAiLoading(true);
      fetchAIAnalysis(eventId, account)
        .then(setAiAnalysis)
        .catch(() => setAiAnalysis(null))
        .finally(() => setAiLoading(false));
    }
  }, [eventId, account]);

  // Compute totals and tie-out
  const totals = useMemo(() => {
    const incumbentTotal = categories.reduce((sum, c) => sum + c.incumbentBalance, 0);
    const bnyTotal = categories.reduce((sum, c) => sum + c.bnyBalance, 0);
    const varianceTotal = categories.reduce((sum, c) => sum + c.balanceDiff, 0);
    return { incumbentTotal, bnyTotal, varianceTotal };
  }, [categories]);

  const navVariance = state.trialBalance.navVariance;
  const tieOutDiff = navVariance !== null ? totals.varianceTotal - navVariance : null;
  const tieOutPass = tieOutDiff !== null && Math.abs(tieOutDiff) < 0.01;

  // Build waterfall data
  const waterfallData = useMemo(() => {
    const data: { category: string; base: number; value: number; fill: string; originalValue: number }[] = [];
    let runningTotal = totals.incumbentTotal;

    data.push({ category: 'Incumbent NAV', base: 0, value: runningTotal, fill: '#90caf9', originalValue: runningTotal });

    categories.forEach((cat) => {
      const val = cat.balanceDiff;
      if (val >= 0) {
        data.push({ category: cat.category, base: runningTotal, value: val, fill: '#4caf50', originalValue: val });
        runningTotal += val;
      } else {
        runningTotal += val;
        data.push({ category: cat.category, base: runningTotal, value: Math.abs(val), fill: '#f44336', originalValue: val });
      }
    });

    data.push({ category: 'BNY NAV', base: 0, value: totals.bnyTotal, fill: '#90caf9', originalValue: totals.bnyTotal });
    return data;
  }, [categories, totals]);

  const handleExpandRow = useCallback((category: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
        if (!subledgerChecks[category] && account && valuationDt) {
          fetchSubledgerCheck(account, category, valuationDt)
            .then((result) => setSubledgerChecks((prev) => ({ ...prev, [category]: result })))
            .catch(() => {});
        }
      }
      return next;
    });
  }, [subledgerChecks, account, valuationDt]);

  const handleCategoryDoubleClick = (cat: TrialBalanceCategoryRow) => {
    dispatch({ type: 'SET_CATEGORY', category: cat.category, navVariance: cat.balanceDiff, navVarianceBP: cat.balanceDiffBP });
    navigate(`/events/${eventId}/funds/${account}/positions?valuationDt=${valuationDt}&category=${encodeURIComponent(cat.category)}`);
  };

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  const columnDefs: ColDef<TrialBalanceCategoryRow>[] = [
    {
      headerName: '',
      width: 50,
      cellRenderer: (params: any) => (
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleExpandRow(params.data.category); }} aria-label={expandedRows.has(params.data.category) ? `Collapse ${params.data.category}` : `Expand ${params.data.category}`}>
          {expandedRows.has(params.data.category) ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
        </IconButton>
      ),
      sortable: false,
      filter: false,
    },
    { field: 'category', headerName: 'Category', flex: 1, minWidth: 180 },
    {
      field: 'incumbentBalance',
      headerName: 'Incumbent Balance',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'bnyBalance',
      headerName: 'BNY Balance',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'balanceDiff',
      headerName: 'Balance Diff',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: (p) => p.value != null && p.value < 0 ? { color: '#d32f2f' } : null,
    },
    {
      field: 'balanceDiffBP',
      headerName: 'Diff (BP)',
      width: 100,
      type: 'numericColumn',
      valueFormatter: (p) => `${p.value?.toFixed(2)} bp`,
    },
    {
      field: 'validationStatus',
      headerName: 'Validation',
      width: 100,
      cellRenderer: (params: any) => <ValidationStatus status={params.value} />,
    },
  ];

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 112px)' }} role="main" aria-label="Trial Balance">
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <DrillDownBreadcrumb />

        {/* Context Header */}
        <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
          <Stack direction="row" spacing={3} alignItems="center">
            <Box>
              <Typography variant="caption" color="text.secondary">Fund</Typography>
              <Typography variant="body1" fontWeight={600}>{state.context.accountName || account} ({account})</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">Valuation Date</Typography>
              <Typography variant="body1" fontWeight={600}>{valuationDt}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">NAV Variance</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body1" fontWeight={600} color={navVariance && navVariance < 0 ? 'error.main' : 'text.primary'}>
                  {navVariance !== null ? `$${formatCurrency(navVariance)}` : '—'}
                </Typography>
                {navVariance !== null && <ValidationStatus status={Math.abs(navVariance) < 0.01 ? 'pass' : 'break'} />}
              </Stack>
            </Box>
          </Stack>
        </Paper>

        {/* Waterfall Chart */}
        {waterfallData.length > 2 && (
          <Paper sx={{ p: 2, mb: 2, height: 250 }} elevation={1}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>NAV Variance Decomposition</Typography>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={waterfallData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(_value: any, _name: any, props: any) => {
                    const orig = props.payload.originalValue;
                    const pct = totals.varianceTotal !== 0 ? ((orig / totals.varianceTotal) * 100).toFixed(1) : '0';
                    return [`$${formatCurrency(orig)} (${pct}% of variance)`, props.payload.category];
                  }}
                />
                <Bar dataKey="base" stackId="waterfall" fill="transparent" />
                <Bar
                  dataKey="value"
                  stackId="waterfall"
                  onClick={(data: any) => setHighlightedCategory(data.category)}
                  cursor="pointer"
                >
                  {waterfallData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        )}

        {/* Ledger BS Compare Grid */}
        <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="Trial Balance data grid">
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress aria-label="Loading trial balance data" /></Box>
          ) : (
            <Box className="ag-theme-alpine" sx={{ height: '100%', width: '100%', '& .ag-cell:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}>
              <AgGridReact<TrialBalanceCategoryRow>
                modules={[AllCommunityModule]}
                theme="legacy"
                rowData={categories}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                animateRows
                onRowDoubleClicked={(e: RowDoubleClickedEvent<TrialBalanceCategoryRow>) => {
                  if (e.data) handleCategoryDoubleClick(e.data);
                }}
                getRowId={(params) => params.data.category}
              />
            </Box>
          )}

          {/* Expanded subledger check rows */}
          {categories.filter((c) => expandedRows.has(c.category)).map((cat) => {
            const check = subledgerChecks[cat.category];
            return (
              <Collapse key={cat.category} in>
                <Paper variant="outlined" sx={{ mx: 1, mb: 1, p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Subledger Compare Check — {cat.category}</Typography>
                  {!check ? <CircularProgress size={20} /> : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Ledger (GL)</TableCell>
                          <TableCell align="right">Subledger (Derived)</TableCell>
                          <TableCell align="right">Difference</TableCell>
                          <TableCell align="center">Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>{formatCurrency(check.ledgerValue)}</TableCell>
                          <TableCell align="right">{formatCurrency(check.subledgerValue)}</TableCell>
                          <TableCell align="right" sx={{ color: check.difference !== 0 ? '#d32f2f' : undefined }}>
                            {formatCurrency(check.difference)}
                          </TableCell>
                          <TableCell align="center"><ValidationStatus status={check.validationStatus} /></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </Paper>
              </Collapse>
            );
          })}
        </Box>

        {/* Reconciliation Roll-Up Summary */}
        <Paper sx={{ p: 2, mt: 1 }} elevation={1}>
          <Stack direction="row" spacing={4} alignItems="center">
            <Box>
              <Typography variant="caption" color="text.secondary">Total Incumbent</Typography>
              <Typography variant="body2" fontWeight={600}>${formatCurrency(totals.incumbentTotal)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Total BNY</Typography>
              <Typography variant="body2" fontWeight={600}>${formatCurrency(totals.bnyTotal)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Total Variance</Typography>
              <Typography variant="body2" fontWeight={600} color={totals.varianceTotal < 0 ? 'error.main' : undefined}>
                ${formatCurrency(totals.varianceTotal)}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">Tie-Out to NAV</Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                {tieOutPass !== null && <ValidationStatus status={tieOutPass ? 'pass' : 'break'} showLabel />}
                {tieOutDiff !== null && !tieOutPass && (
                  <Typography variant="caption" color="error.main">
                    Discrepancy: ${formatCurrency(tieOutDiff)}
                  </Typography>
                )}
              </Stack>
            </Box>
            <Box sx={{ ml: 'auto' }}>
              <Button
                size="small"
                startIcon={<FileDownloadIcon />}
                variant="outlined"
                onClick={() => {
                  const exportRows = categories.flatMap((cat) => {
                    const base = [{
                      category: cat.category,
                      type: 'Ledger',
                      incumbentBalance: cat.incumbentBalance,
                      bnyBalance: cat.bnyBalance,
                      balanceDiff: cat.balanceDiff,
                      balanceDiffBP: cat.balanceDiffBP,
                      validationStatus: cat.validationStatus,
                    }];
                    const check = subledgerChecks[cat.category];
                    if (check) {
                      base.push({
                        category: cat.category,
                        type: 'Subledger Check',
                        incumbentBalance: check.ledgerValue,
                        bnyBalance: check.subledgerValue,
                        balanceDiff: check.difference,
                        balanceDiffBP: 0,
                        validationStatus: check.validationStatus,
                      });
                    }
                    return base;
                  });
                  exportToCsv(`trial-balance-${account}`, [
                    { headerName: 'Category', field: 'category' },
                    { headerName: 'Type', field: 'type' },
                    { headerName: 'Incumbent Balance', field: 'incumbentBalance' },
                    { headerName: 'BNY Balance', field: 'bnyBalance' },
                    { headerName: 'Balance Diff', field: 'balanceDiff' },
                    { headerName: 'Diff (BP)', field: 'balanceDiffBP' },
                    { headerName: 'Validation', field: 'validationStatus' },
                  ], exportRows);
                }}
              >Export to Excel</Button>
            </Box>
          </Stack>
        </Paper>
      </Box>

      {/* AI Commentary Panel */}
      <AICommentaryPanel analysis={aiAnalysis} loading={aiLoading} level="trial-balance" />
    </Box>
  );
};

export default TrialBalance;
