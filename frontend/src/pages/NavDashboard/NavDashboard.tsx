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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  CircularProgress,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ScheduleIcon from '@mui/icons-material/Schedule';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
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
import { NavCompareRow, CrossCheckResult, AICommentaryData, CheckType, ValidationStatusType } from '../../types';
import { exportToCsv } from '../../utils/exportToExcel';

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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [crossChecks, setCrossChecks] = useState<Record<string, CrossCheckResult>>({});
  const [aiAnalysis, setAiAnalysis] = useState<AICommentaryData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [checkSuite, setCheckSuite] = useState<CheckType[]>(CHECK_SUITE_OPTIONS.map((c) => c.value));
  const [fundFilter, setFundFilter] = useState<'all' | 'selected'>('all');
  const [validating, setValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState('');

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

  const handleExpandRow = useCallback((account: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(account)) {
        next.delete(account);
      } else {
        next.add(account);
        // Fetch cross-checks if not cached
        if (!crossChecks[account] && eventId && valuationDt) {
          fetchNavCrossChecks(eventId, account, valuationDt)
            .then((result) => setCrossChecks((prev) => ({ ...prev, [account]: result })))
            .catch(() => {});
        }
      }
      return next;
    });
  }, [crossChecks, eventId, valuationDt]);

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

  const handleRowDoubleClick = (account: string, accountName: string) => {
    dispatch({ type: 'SET_FUND', account, accountName, valuationDt });
    navigate(`/events/${eventId}/funds/${account}/trial-balance?valuationDt=${valuationDt}`);
  };

  const columnDefs = useMemo((): ColDef<NavCompareRow>[] => [
    {
      headerName: '',
      width: 50,
      cellRenderer: (params: any) => (
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); handleExpandRow(params.data.account); }}
          aria-label={expandedRows.has(params.data.account) ? 'Collapse row' : 'Expand row'}
        >
          {expandedRows.has(params.data.account) ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
        </IconButton>
      ),
      sortable: false,
      filter: false,
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
  ], [expandedRows, handleExpandRow]);

  const CrossCheckDetail: React.FC<{ account: string }> = React.memo(({ account }) => {
    const data = crossChecks[account];
    if (!data) return <Box sx={{ p: 2 }}><CircularProgress size={20} /></Box>;

    const renderCheckRow = (label: string, row: { lhsValue: number; rhsValue: number; difference: number; validationStatus: ValidationStatusType }) => (
      <TableRow>
        <TableCell>{label}</TableCell>
        <TableCell align="right">{formatCurrency(row.lhsValue)}</TableCell>
        <TableCell align="right">{formatCurrency(row.rhsValue)}</TableCell>
        <TableCell align="right" sx={{ color: row.difference < 0 ? '#d32f2f' : undefined }}>{formatCurrency(row.difference)}</TableCell>
        <TableCell align="center"><ValidationStatus status={row.validationStatus} /></TableCell>
      </TableRow>
    );

    return (
      <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Cross-Check Validations</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Check</TableCell>
              <TableCell align="right">LHS</TableCell>
              <TableCell align="right">RHS</TableCell>
              <TableCell align="right">Difference</TableCell>
              <TableCell align="center">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {renderCheckRow('Ledger BS Compare Check', data.bsCheck)}
            {renderCheckRow('Ledger INCST Compare Check', data.incstCheck)}
          </TableBody>
        </Table>
      </Box>
    );
  });

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

        {/* NAV Compare Grid */}
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 0.5 }}>
          <Button size="small" startIcon={<FileDownloadIcon />} variant="outlined" onClick={handleExportNavGrid}>
            Export to Excel
          </Button>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 400 }} role="region" aria-label="NAV Compare data grid">
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

          {/* Expanded cross-check rows rendered below grid */}
          {funds.filter((f) => expandedRows.has(f.account)).map((f) => (
            <Collapse key={f.account} in={expandedRows.has(f.account)}>
              <Paper variant="outlined" sx={{ mx: 1, mb: 1 }}>
                <Typography variant="caption" fontWeight={600} sx={{ px: 2, pt: 1, display: 'block' }}>
                  {f.accountName} ({f.account})
                </Typography>
                <CrossCheckDetail account={f.account} />
              </Paper>
            </Collapse>
          ))}
        </Box>
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
