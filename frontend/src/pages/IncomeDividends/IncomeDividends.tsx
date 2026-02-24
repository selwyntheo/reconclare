import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Stack,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Chip,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { DrillDownBreadcrumb } from '../../components/shared/DrillDownBreadcrumb';
import { ValidationStatus } from '../../components/shared/ValidationStatus';
import BreakCategorySelector from '../../components/shared/BreakCategorySelector';
import {
  fetchDividends,
  fetchDividendDetail,
  fetchDividendFundSummary,
  fetchIncomeTieBack,
} from '../../services/api';

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return '';
  return v < 0
    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ── Types ────────────────────────────────────────────────────

interface DividendDetailEvent {
  xdDate: string;
  payDate: string;
  bnyRate: number;
  incumbentRate: number;
  rateDiff: number;
  bnyAmount: number;
  incumbentAmount: number;
  amountDiff: number;
}

interface TieBackResult {
  totalNetIncomeDiff: number;
  tbSubClassBalance: number;
  tieBackPass: boolean;
}

type ViewLevel = 'security' | 'fund';

export default function IncomeDividends() {
  const { eventId, account } = useParams<{ eventId: string; account: string }>();
  const valuationDt = new URLSearchParams(useLocation().search).get('valuationDt') || '';

  const [rowData, setRowData] = useState<any[]>([]);
  const [fundLevelData, setFundLevelData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Task 14.3: Expandable row drilldown state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [detailData, setDetailData] = useState<Record<string, DividendDetailEvent[]>>({});

  // Task 14.4: View level toggle
  const [viewLevel, setViewLevel] = useState<ViewLevel>('security');

  // Task 14.5: Tie-back validation
  const [tieBack, setTieBack] = useState<TieBackResult | null>(null);

  // Load security-level dividend data
  useEffect(() => {
    if (eventId && account && valuationDt) {
      setLoading(true);
      setError(null);
      fetchDividends(eventId, account, valuationDt)
        .then(setRowData)
        .catch((err) => {
          setError(err.message || 'Failed to load dividend income data');
          setRowData([]);
        })
        .finally(() => setLoading(false));
    }
  }, [eventId, account, valuationDt]);

  // Load fund-level data when switching to fund view
  useEffect(() => {
    if (viewLevel === 'fund' && eventId && valuationDt) {
      setLoading(true);
      fetchDividendFundSummary(eventId, valuationDt)
        .then(setFundLevelData)
        .catch((err) => {
          setError(err.message || 'Failed to load fund-level dividend data');
          setFundLevelData([]);
        })
        .finally(() => setLoading(false));
    }
  }, [viewLevel, eventId, valuationDt]);

  // Task 14.5: Load tie-back validation
  useEffect(() => {
    if (eventId && account && valuationDt) {
      fetchIncomeTieBack(eventId, account, valuationDt)
        .then(setTieBack)
        .catch(() => setTieBack(null));
    }
  }, [eventId, account, valuationDt]);

  // Task 14.3: Handle row expand/collapse
  const handleExpandRow = useCallback(
    (assetId: string) => {
      setExpandedRows((prev) => {
        const next = new Set(prev);
        if (next.has(assetId)) {
          next.delete(assetId);
        } else {
          next.add(assetId);
          // Load detail data if not already loaded
          if (!detailData[assetId] && eventId && account && valuationDt) {
            fetchDividendDetail(eventId, account, assetId, valuationDt)
              .then((events) =>
                setDetailData((prev) => ({ ...prev, [assetId]: events }))
              )
              .catch(() =>
                setDetailData((prev) => ({ ...prev, [assetId]: [] }))
              );
          }
        }
        return next;
      });
    },
    [detailData, eventId, account, valuationDt]
  );

  // Compute totals for tie-back
  const totalNetIncomeDiff = useMemo(() => {
    return rowData.reduce((sum, row) => sum + (row.netDiff || 0), 0);
  }, [rowData]);

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  // Security-level column definitions with expand icon
  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: '',
      width: 50,
      cellRenderer: (params: any) => (
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); handleExpandRow(params.data.assetId); }}
          aria-label={expandedRows.has(params.data.assetId) ? `Collapse ${params.data.issueDescription || params.data.assetId}` : `Expand ${params.data.issueDescription || params.data.assetId}`}
        >
          {expandedRows.has(params.data.assetId) ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
        </IconButton>
      ),
      sortable: false,
      filter: false,
    },
    { field: 'assetId', headerName: 'Asset ID', width: 120 },
    { field: 'issueDescription', headerName: 'Issue Description', flex: 1, minWidth: 180 },
    { field: 'securityType', headerName: 'Security Type', width: 120 },
    {
      field: 'bnyGrossIncome',
      headerName: 'BNY Gross Income',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'incumbentGrossIncome',
      headerName: 'Incumbent Gross Income',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'grossDiff',
      headerName: 'Gross Diff',
      width: 120,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: (p) => p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null,
    },
    {
      field: 'bnyWithholding',
      headerName: 'BNY Withholding',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'incumbentWithholding',
      headerName: 'Incumbent Withholding',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'withholdingDiff',
      headerName: 'Withholding Diff',
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: (p) => p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null,
    },
    {
      field: 'bnyNetIncome',
      headerName: 'BNY Net Income',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'incumbentNetIncome',
      headerName: 'Incumbent Net Income',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'netDiff',
      headerName: 'Net Diff',
      width: 120,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: (p) => p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null,
    },
    {
      field: 'bnyReclaim',
      headerName: 'BNY Reclaim',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'incumbentReclaim',
      headerName: 'Incumbent Reclaim',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'reclaimDiff',
      headerName: 'Reclaim Diff',
      width: 120,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: (p) => p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null,
    },
    {
      field: 'breakCategory',
      headerName: 'Break Category',
      width: 180,
      cellRenderer: (params: any) => (
        <BreakCategorySelector
          value={params.value || ''}
          onChange={() => {}}
          size="small"
        />
      ),
    },
    {
      field: 'breakTeam',
      headerName: 'Break Team',
      width: 160,
    },
    {
      field: 'breakOwner',
      headerName: 'Break Owner',
      width: 140,
    },
    {
      field: 'comment',
      headerName: 'Comment',
      flex: 1,
      minWidth: 200,
      editable: true,
    },
  ], [expandedRows, handleExpandRow]);

  // Task 14.4: Fund-level column definitions
  const fundColumnDefs: ColDef[] = useMemo(() => [
    { field: 'fund', headerName: 'Fund', width: 120 },
    { field: 'fundName', headerName: 'Fund Name', flex: 1, minWidth: 200 },
    {
      field: 'totalBnyGrossIncome',
      headerName: 'BNY Gross Income',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'totalIncumbentGrossIncome',
      headerName: 'Incumbent Gross Income',
      width: 180,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'totalGrossDiff',
      headerName: 'Gross Diff',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: (p) => p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null,
    },
    {
      field: 'totalBnyNetIncome',
      headerName: 'BNY Net Income',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'totalIncumbentNetIncome',
      headerName: 'Incumbent Net Income',
      width: 180,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'totalNetDiff',
      headerName: 'Net Diff',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: (p) => p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null,
    },
    {
      field: 'securityCount',
      headerName: 'Securities',
      width: 110,
      type: 'numericColumn',
    },
    {
      field: 'breakCount',
      headerName: 'Breaks',
      width: 100,
      type: 'numericColumn',
      cellStyle: (p) => p.value != null && p.value > 0 ? { color: '#d32f2f', fontWeight: 600 } : null,
    },
  ], []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }} role="main" aria-label="Income Dividends">
      <DrillDownBreadcrumb />

      {/* Context Header */}
      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Stack direction="row" spacing={3} alignItems="center">
          <Box>
            <Typography variant="caption" color="text.secondary">Fund</Typography>
            <Typography variant="body1" fontWeight={600}>{account}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Valuation Date</Typography>
            <Typography variant="body1" fontWeight={600}>{valuationDt}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">View</Typography>
            <Typography variant="body1" fontWeight={600}>Income — Dividends</Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Task 14.4: View Level Toggle */}
      <Paper sx={{ mb: 1 }} elevation={0}>
        <Tabs
          value={viewLevel}
          onChange={(_, v: ViewLevel) => setViewLevel(v)}
          sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, textTransform: 'none' } }}
        >
          <Tab label="Security Level" value="security" />
          <Tab label="Fund Level" value="fund" />
        </Tabs>
      </Paper>

      {/* Data Grid */}
      <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="Dividend income data grid">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading dividend income data" />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        ) : viewLevel === 'security' ? (
          <>
            <Box
              className="ag-theme-alpine"
              sx={{
                height: '100%',
                width: '100%',
                '& .ag-cell:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
              }}
            >
              <AgGridReact
                modules={[AllCommunityModule]}
                theme="legacy"
                rowData={rowData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                animateRows
                getRowId={(params) => params.data.assetId}
              />
            </Box>

            {/* Task 14.3: Expanded detail rows */}
            {rowData
              .filter((row) => expandedRows.has(row.assetId))
              .map((row) => {
                const details = detailData[row.assetId];
                return (
                  <Collapse key={row.assetId} in>
                    <Paper variant="outlined" sx={{ mx: 1, mb: 1, p: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Dividend Events — {row.issueDescription} ({row.assetId})
                      </Typography>
                      {!details ? (
                        <CircularProgress size={20} />
                      ) : details.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          No dividend events found
                        </Typography>
                      ) : (
                        <Box sx={{ overflowX: 'auto' }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>XD Date</TableCell>
                                <TableCell>Pay Date</TableCell>
                                <TableCell align="right">BNY Rate</TableCell>
                                <TableCell align="right">Incumbent Rate</TableCell>
                                <TableCell align="right">Rate Diff</TableCell>
                                <TableCell align="right">BNY Amount</TableCell>
                                <TableCell align="right">Incumbent Amount</TableCell>
                                <TableCell align="right">Amount Diff</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {details.map((evt, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{evt.xdDate}</TableCell>
                                  <TableCell>{evt.payDate}</TableCell>
                                  <TableCell align="right">{evt.bnyRate?.toFixed(6)}</TableCell>
                                  <TableCell align="right">{evt.incumbentRate?.toFixed(6)}</TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{ color: evt.rateDiff !== 0 ? '#d32f2f' : undefined }}
                                  >
                                    {evt.rateDiff?.toFixed(6)}
                                  </TableCell>
                                  <TableCell align="right">{formatCurrency(evt.bnyAmount)}</TableCell>
                                  <TableCell align="right">{formatCurrency(evt.incumbentAmount)}</TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{ color: evt.amountDiff !== 0 ? '#d32f2f' : undefined }}
                                  >
                                    {formatCurrency(evt.amountDiff)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      )}
                    </Paper>
                  </Collapse>
                );
              })}
          </>
        ) : (
          /* Task 14.4: Fund Level View */
          <Box
            className="ag-theme-alpine"
            sx={{
              height: '100%',
              width: '100%',
              '& .ag-cell:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
            }}
          >
            <AgGridReact
              modules={[AllCommunityModule]}
              theme="legacy"
              rowData={fundLevelData}
              columnDefs={fundColumnDefs}
              defaultColDef={defaultColDef}
              animateRows
              getRowId={(params) => params.data.fund}
            />
          </Box>
        )}
      </Box>

      {/* Task 14.5: Ledger Tie-Back Validation Footer */}
      <Paper sx={{ p: 2, mt: 1 }} elevation={1}>
        <Stack direction="row" spacing={4} alignItems="center">
          <Box>
            <Typography variant="caption" color="text.secondary">Total Net Income Difference</Typography>
            <Typography variant="body2" fontWeight={600} color={totalNetIncomeDiff !== 0 ? 'error.main' : undefined}>
              ${formatCurrency(totalNetIncomeDiff)}
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Dividend RecPay TB Balance</Typography>
            <Typography variant="body2" fontWeight={600}>
              {tieBack ? `$${formatCurrency(tieBack.tbSubClassBalance)}` : '—'}
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Ledger Tie-Back</Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {tieBack ? (
                <>
                  <ValidationStatus status={tieBack.tieBackPass ? 'pass' : 'break'} showLabel />
                  {!tieBack.tieBackPass && (
                    <Typography variant="caption" color="error.main">
                      Discrepancy: ${formatCurrency(tieBack.totalNetIncomeDiff - tieBack.tbSubClassBalance)}
                    </Typography>
                  )}
                </>
              ) : (
                <Chip label="Pending" size="small" variant="outlined" />
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
