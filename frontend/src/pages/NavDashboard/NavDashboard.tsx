import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Radio,
  RadioGroup,
  LinearProgress,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  IconButton,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ScheduleIcon from '@mui/icons-material/Schedule';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ColDef, RowClickedEvent, RowDoubleClickedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { DrillDownBreadcrumb } from '../../components/shared/DrillDownBreadcrumb';
import { ValidationStatus } from '../../components/shared/ValidationStatus';
import { AICommentaryPanel } from '../../components/shared/AICommentaryPanel';
import { useDrillDownState, useDrillDownDispatch } from '../../context/DrillDownContext';
import { useSSE } from '../../hooks/useSSE';
import {
  fetchNavCompare,
  fetchNavCrossChecks,
  fetchEvent,
  fetchAvailableDates,
  fetchAIAnalysis,
  runSequentialValidation,
} from '../../services/api';
import { NavCompareRow, CrossCheckResult, AICommentaryData, CheckType, DrillDownTab } from '../../types';
import { exportToCsv } from '../../utils/exportToExcel';
import NavValidationView from '../../components/validation/NavValidationView';

const CHECK_SUITE_OPTIONS: { value: CheckType; label: string; level: string }[] = [
  { value: 'NAV_TO_LEDGER', label: 'NAV to Ledger', level: 'L0' },
  { value: 'LEDGER_BS_TO_INCST', label: 'Ledger BS to INCST', level: 'L1' },
  { value: 'LEDGER_TF_TO_CLASS', label: 'Ledger TF to Class', level: 'L1' },
  { value: 'POSITION_TO_LOT', label: 'Position to Lot', level: 'L2' },
  { value: 'LEDGER_TO_SUBLEDGER', label: 'Ledger to Subledger', level: 'L2' },
  { value: 'BASIS_LOT_CHECK', label: 'Basis Lot Check', level: 'L2' },
];

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return '';
  return v < 0 ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const NavDashboard: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const state = useDrillDownState();
  const dispatch = useDrillDownDispatch();

  const [valuationDt, setValuationDt] = useState(searchParams.get('valuationDt') || '');
  const [, setAvailableDates] = useState<string[]>([]);
  const [funds, setFunds] = useState<NavCompareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFund, setSelectedFund] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AICommentaryData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [checkSuite, setCheckSuite] = useState<CheckType[]>(CHECK_SUITE_OPTIONS.map((c) => c.value));
  const [fundFilter, setFundFilter] = useState<'all' | 'selected'>('all');
  const [validating, setValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState('');
  const [expandedFund, setExpandedFund] = useState<string | null>(null);
  const [crossChecks, setCrossChecks] = useState<CrossCheckResult | null>(null);
  const [crossChecksLoading, setCrossChecksLoading] = useState(false);

  // Set event context
  useEffect(() => {
    if (eventId && !state.context.eventId) {
      fetchEvent(eventId).then((evt: any) => {
        dispatch({ type: 'SET_EVENT', eventId: evt.eventId, eventName: evt.eventName });
      }).catch(() => {});
    }
  }, [eventId, state.context.eventId, dispatch]);

  // Load available dates
  useEffect(() => {
    if (eventId) {
      fetchAvailableDates(eventId).then((dates) => {
        setAvailableDates(dates);
        if (!valuationDt && dates.length > 0) {
          setValuationDt(dates[0]);
        }
      }).catch(() => {});
    }
  }, [eventId, valuationDt]);

  // Load NAV compare data
  useEffect(() => {
    if (eventId && valuationDt) {
      setLoading(true);
      fetchNavCompare(eventId, valuationDt)
        .then((data) => {
          // Sort: breaks first, then by |tnaDifference| descending
          const sorted = [...data].sort((a, b) => {
            const aBreak = a.validationStatus === 'break' ? 0 : a.validationStatus === 'marginal' ? 1 : 2;
            const bBreak = b.validationStatus === 'break' ? 0 : b.validationStatus === 'marginal' ? 1 : 2;
            if (aBreak !== bBreak) return aBreak - bBreak;
            return Math.abs(b.tnaDifference) - Math.abs(a.tnaDifference);
          });
          setFunds(sorted);
          dispatch({ type: 'SET_NAV_FUNDS', funds: sorted });
        })
        .catch(() => setFunds([]))
        .finally(() => setLoading(false));
    }
  }, [eventId, valuationDt, dispatch]);

  // SSE for real-time updates
  useSSE({
    eventId: eventId || '',
    enabled: !!eventId,
    onEvent: (event) => {
      if (event.type === 'validation_progress') {
        setValidationProgress(event.data.message || `Processing fund ${event.data.fundIndex} of ${event.data.totalFunds}...`);
      }
      if (event.type === 'validation_complete') {
        setValidating(false);
        setValidationProgress('');
        // Reload data
        if (eventId && valuationDt) {
          fetchNavCompare(eventId, valuationDt).then(setFunds).catch(() => {});
        }
      }
    },
  });

  // Load AI analysis for selected fund
  useEffect(() => {
    if (eventId && selectedFund) {
      setAiLoading(true);
      fetchAIAnalysis(eventId, selectedFund)
        .then(setAiAnalysis)
        .catch(() => setAiAnalysis(null))
        .finally(() => setAiLoading(false));
    }
  }, [eventId, selectedFund]);

  const handleRunValidation = async () => {
    if (!eventId || !valuationDt) return;
    setValidating(true);
    setValidationProgress('Starting validation...');
    try {
      await runSequentialValidation(eventId, valuationDt, checkSuite, fundFilter === 'all' ? undefined : 'selected');
      // Reload data after successful validation
      fetchNavCompare(eventId, valuationDt).then(setFunds).catch(() => {});
    } catch {
      // error handled silently
    } finally {
      setValidating(false);
      setValidationProgress('');
    }
  };

  const handleExportNavGrid = useCallback(() => {
    exportToCsv('nav-compare', [
      { headerName: 'Valuation Dt', field: 'valuationDt' },
      { headerName: 'Account', field: 'account' },
      { headerName: 'Account Name', field: 'accountName' },
      { headerName: 'Incumbent TNA', field: 'incumbentTNA' },
      { headerName: 'BNY TNA', field: 'bnyTNA' },
      { headerName: 'TNA Difference', field: 'tnaDifference' },
      { headerName: 'Diff (BP)', field: 'tnaDifferenceBP' },
      { headerName: 'Validation', field: 'validationStatus' },
    ], funds);
  }, [funds]);

  const handleExpandCrossChecks = useCallback((account: string) => {
    if (expandedFund === account) {
      setExpandedFund(null);
      setCrossChecks(null);
      return;
    }
    setExpandedFund(account);
    setCrossChecks(null);
    setCrossChecksLoading(true);
    fetchNavCrossChecks(eventId || '', account, valuationDt)
      .then(setCrossChecks)
      .catch(() => setCrossChecks(null))
      .finally(() => setCrossChecksLoading(false));
  }, [expandedFund, eventId, valuationDt]);

  const handleRowDoubleClick = (account: string, accountName: string) => {
    dispatch({ type: 'SET_FUND', account, accountName, valuationDt });
    navigate(`/events/${eventId}/funds/${account}/trial-balance?valuationDt=${valuationDt}`);
  };

  const columnDefs = useMemo((): ColDef<NavCompareRow>[] => [
    {
      headerName: '',
      width: 50,
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: (params: any) => {
        if (!params.data || Math.abs(params.data.tnaDifference) < 0.01) return null;
        const isExpanded = params.data.account === expandedFund;
        return (
          <IconButton
            size="small"
            sx={{ p: 0 }}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              handleExpandCrossChecks(params.data.account);
            }}
            aria-label={isExpanded ? 'Collapse cross-checks' : 'Expand cross-checks'}
          >
            {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        );
      },
    },
    { field: 'valuationDt', headerName: 'Valuation Dt', width: 120 },
    { field: 'account', headerName: 'Account', width: 110 },
    { field: 'accountName', headerName: 'Account Name', flex: 1, minWidth: 180 },
    {
      field: 'incumbentTNA',
      headerName: 'Incumbent TNA',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'bnyTNA',
      headerName: 'BNY TNA',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'tnaDifference',
      headerName: 'TNA Difference',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: (p) => p.value != null && p.value < 0 ? { color: '#d32f2f' } : null,
    },
    {
      field: 'tnaDifferenceBP',
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
  ], [expandedFund, handleExpandCrossChecks]);

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 112px)' }} role="main" aria-label="NAV Dashboard">
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <DrillDownBreadcrumb />

        {/* Validation Control Panel */}
        <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
          <Stack direction="row" spacing={3} alignItems="flex-start" flexWrap="wrap">
            <Box>
              <Typography variant="caption" fontWeight={600}>Valuation Date</Typography>
              <TextField
                type="date"
                size="small"
                value={valuationDt}
                onChange={(e) => setValuationDt(e.target.value)}
                sx={{ display: 'block', mt: 0.5, minWidth: 160 }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={600}>Check Suite</Typography>
              <FormGroup row sx={{ mt: 0.5 }}>
                {CHECK_SUITE_OPTIONS.map((opt) => (
                  <FormControlLabel
                    key={opt.value}
                    control={
                      <Checkbox
                        size="small"
                        checked={checkSuite.includes(opt.value)}
                        onChange={(e) => {
                          if (e.target.checked) setCheckSuite((prev) => [...prev, opt.value]);
                          else setCheckSuite((prev) => prev.filter((c) => c !== opt.value));
                        }}
                      />
                    }
                    label={<Typography variant="caption">{opt.label} ({opt.level})</Typography>}
                  />
                ))}
              </FormGroup>
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={600}>Fund Filter</Typography>
              <RadioGroup row value={fundFilter} onChange={(e) => setFundFilter(e.target.value as any)} sx={{ mt: 0.5 }}>
                <FormControlLabel value="all" control={<Radio size="small" />} label={<Typography variant="caption">All Funds</Typography>} />
                <FormControlLabel value="selected" control={<Radio size="small" />} label={<Typography variant="caption">Selected Only</Typography>} />
              </RadioGroup>
            </Box>
            <Stack direction="row" spacing={1} sx={{ mt: 'auto', pt: 2 }}>
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={handleRunValidation}
                disabled={validating || !valuationDt}
                size="small"
              >
                {validating ? 'Running...' : 'Run Validation'}
              </Button>
              <Button variant="outlined" startIcon={<ScheduleIcon />} size="small" disabled>
                Schedule
              </Button>
            </Stack>
          </Stack>
          {validating && (
            <Box sx={{ mt: 1 }} role="status" aria-live="polite">
              <Typography variant="caption" color="text.secondary">{validationProgress}</Typography>
              <LinearProgress sx={{ mt: 0.5 }} aria-label="Validation progress" />
            </Box>
          )}
        </Paper>

        {/* Reconciliation / Validation Tabs */}
        <Paper sx={{ mb: 1 }} elevation={0}>
          <Tabs
            value={state.tabs.navDashboard}
            onChange={(_, v: DrillDownTab) => dispatch({ type: 'SET_TAB', screen: 'navDashboard', tab: v })}
            sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, textTransform: 'none' } }}
          >
            <Tab label="Reconciliation" value="reconciliation" />
            <Tab label="Validation" value="validation" />
          </Tabs>
        </Paper>

        {state.tabs.navDashboard === 'reconciliation' ? (
          <>
            {/* NAV Compare Grid */}
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 0.5 }}>
              <Button size="small" startIcon={<FileDownloadIcon />} variant="outlined" onClick={handleExportNavGrid}>
                Export to Excel
              </Button>
            </Stack>
            <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="NAV Compare data grid">
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress aria-label="Loading NAV data" /></Box>
              ) : (
                <Box
                  className="ag-theme-alpine"
                  sx={{ height: '100%', width: '100%', '& .ag-cell:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleExportNavGrid();
                  }}
                >
                  <AgGridReact<NavCompareRow>
                    modules={[AllCommunityModule]}
                    theme="legacy"
                    rowData={funds}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowSelection="single"
                    animateRows
                    onRowClicked={(e: RowClickedEvent<NavCompareRow>) => {
                      if (e.data) {
                        setSelectedFund(e.data.account);
                        dispatch({ type: 'SET_NAV_SELECTED_FUND', account: e.data.account });
                      }
                    }}
                    onRowDoubleClicked={(e: RowDoubleClickedEvent<NavCompareRow>) => {
                      if (e.data) handleRowDoubleClick(e.data.account, e.data.accountName);
                    }}
                    getRowId={(params) => params.data.account}
                  />
                </Box>
              )}
            </Box>

            {/* Cross-Check Detail Panel */}
            <Collapse in={!!expandedFund} unmountOnExit>
              <Paper sx={{ p: 2, mt: 1 }} elevation={1}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">
                    Internal Checks — {funds.find((f) => f.account === expandedFund)?.accountName || expandedFund}
                  </Typography>
                  <IconButton size="small" onClick={() => { setExpandedFund(null); setCrossChecks(null); }}>
                    <KeyboardArrowUpIcon fontSize="small" />
                  </IconButton>
                </Stack>
                {crossChecksLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
                ) : crossChecks ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Check</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>LHS Value</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>RHS Value</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Difference</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[
                          { key: 'bsCheck', label: 'Ledger BS Compare Check', data: crossChecks.bsCheck },
                          { key: 'incstCheck', label: 'Ledger INCST Compare Check', data: crossChecks.incstCheck },
                        ].map((row) => (
                          <TableRow key={row.key} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                            <TableCell>{row.label}</TableCell>
                            <TableCell align="right">${formatCurrency(row.data.lhsValue)}</TableCell>
                            <TableCell align="right">${formatCurrency(row.data.rhsValue)}</TableCell>
                            <TableCell
                              align="right"
                              sx={{ color: row.data.difference !== 0 ? '#d32f2f' : undefined, fontWeight: row.data.difference !== 0 ? 600 : undefined }}
                            >
                              ${formatCurrency(row.data.difference)}
                            </TableCell>
                            <TableCell><ValidationStatus status={row.data.validationStatus} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">No cross-check data available.</Typography>
                )}
              </Paper>
            </Collapse>
          </>
        ) : (
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <NavValidationView eventId={eventId || ''} valuationDt={valuationDt} />
          </Box>
        )}
      </Box>

      {/* AI Commentary Panel */}
      <AICommentaryPanel
        analysis={aiAnalysis}
        loading={aiLoading}
        level="nav"
      />
    </Box>
  );
};

export default NavDashboard;
