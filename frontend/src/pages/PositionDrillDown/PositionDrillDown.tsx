import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { DrillDownBreadcrumb } from '../../components/shared/DrillDownBreadcrumb';
import { ValidationStatus } from '../../components/shared/ValidationStatus';
import { AICommentaryPanel } from '../../components/shared/AICommentaryPanel';
import { useDrillDownState, useDrillDownDispatch } from '../../context/DrillDownContext';
import {
  fetchPositionCompare,
  fetchTaxLots,
  fetchBasisLotCheck,
  fetchEvent,
  fetchAIAnalysis,
} from '../../services/api';
import {
  PositionCompareRow,
  TaxLotRow,
  BasisLotRow,
  ComparisonField,
  AICommentaryData,
} from '../../types';
import { exportToCsv } from '../../utils/exportToExcel';

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return '';
  return v < 0
    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type ViewMode = 'positions' | 'basis-lot';

const PositionDrillDown: React.FC = () => {
  const { eventId, account } = useParams<{ eventId: string; account: string }>();
  const [searchParams] = useSearchParams();
  const state = useDrillDownState();
  const dispatch = useDrillDownDispatch();
  const valuationDt = searchParams.get('valuationDt') || state.context.valuationDt || '';
  const category = searchParams.get('category') || state.context.category || '';

  const [positions, setPositions] = useState<PositionCompareRow[]>([]);
  const [basisLots, setBasisLots] = useState<BasisLotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [taxLots, setTaxLots] = useState<Record<string, TaxLotRow[]>>({});
  const [aiAnalysis, setAiAnalysis] = useState<AICommentaryData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('positions');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [securityDetailOpen, setSecurityDetailOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PositionCompareRow | null>(null);

  // Set context if not already set
  useEffect(() => {
    if (eventId && !state.context.eventId) {
      fetchEvent(eventId).then((evt: any) => {
        dispatch({ type: 'SET_EVENT', eventId: evt.eventId, eventName: evt.eventName });
      }).catch(() => {});
    }
  }, [eventId, state.context.eventId, dispatch]);

  // Load position compare data
  useEffect(() => {
    if (account && valuationDt && category) {
      setLoading(true);
      fetchPositionCompare(account, valuationDt, category)
        .then(setPositions)
        .catch(() => setPositions([]))
        .finally(() => setLoading(false));
    }
  }, [account, valuationDt, category]);

  // Load basis lot data when in basis-lot view
  useEffect(() => {
    if (viewMode === 'basis-lot' && account && valuationDt) {
      setLoading(true);
      fetchBasisLotCheck(account, valuationDt)
        .then(setBasisLots)
        .catch(() => setBasisLots([]))
        .finally(() => setLoading(false));
    }
  }, [viewMode, account, valuationDt]);

  // Load AI analysis
  useEffect(() => {
    if (eventId && account) {
      setAiLoading(true);
      fetchAIAnalysis(eventId, account, category)
        .then(setAiAnalysis)
        .catch(() => setAiAnalysis(null))
        .finally(() => setAiLoading(false));
    }
  }, [eventId, account, category]);

  // Compute position roll-up
  const positionRollUp = useMemo(() => {
    if (positions.length === 0) return null;
    const totalVariance = positions.reduce((sum, p) => {
      const primaryField = p.comparisonFields[0];
      return sum + (primaryField ? primaryField.variance : 0);
    }, 0);
    return { totalVariance };
  }, [positions]);

  const categoryVariance = state.trialBalance.navVariance;
  const rollUpTieOut = positionRollUp && categoryVariance !== null
    ? Math.abs(positionRollUp.totalVariance - categoryVariance) < 0.01
    : null;

  const handleExpandRow = useCallback((assetId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
        if (!taxLots[assetId] && account && valuationDt) {
          fetchTaxLots(account, assetId, valuationDt)
            .then((lots) => setTaxLots((prev) => ({ ...prev, [assetId]: lots })))
            .catch(() => {});
        }
      }
      return next;
    });
  }, [taxLots, account, valuationDt]);

  const handleSecurityClick = (pos: PositionCompareRow) => {
    setSelectedPosition(pos);
    setSecurityDetailOpen(true);
  };

  const handleRequestAnalysis = () => {
    if (eventId && account && selectedAssetId) {
      setAiLoading(true);
      fetchAIAnalysis(eventId, account, category)
        .then(setAiAnalysis)
        .catch(() => {})
        .finally(() => setAiLoading(false));
    }
  };

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  // Build dynamic comparison columns from the first row's comparisonFields
  const comparisonColumnDefs = useMemo((): ColDef<PositionCompareRow>[] => {
    if (positions.length === 0) return [];
    const fields = positions[0].comparisonFields;
    const cols: ColDef<PositionCompareRow>[] = [];

    fields.forEach((field, idx) => {
      cols.push(
        {
          headerName: `${field.fieldName} (Inc)`,
          width: 140,
          type: 'numericColumn',
          valueGetter: (p) => p.data?.comparisonFields[idx]?.incumbent,
          valueFormatter: (p) => formatCurrency(p.value ?? 0),
        },
        {
          headerName: `${field.fieldName} (BNY)`,
          width: 140,
          type: 'numericColumn',
          valueGetter: (p) => p.data?.comparisonFields[idx]?.bny,
          valueFormatter: (p) => formatCurrency(p.value ?? 0),
        },
        {
          headerName: `${field.fieldName} (Var)`,
          width: 140,
          type: 'numericColumn',
          valueGetter: (p) => p.data?.comparisonFields[idx]?.variance,
          valueFormatter: (p) => formatCurrency(p.value ?? 0),
          cellStyle: (p) => p.value != null && p.value < 0 ? { color: '#d32f2f' } : null,
        },
      );
    });

    return cols;
  }, [positions]);

  const columnDefs: ColDef<PositionCompareRow>[] = useMemo(() => [
    {
      headerName: '',
      width: 50,
      cellRenderer: (params: any) => (
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleExpandRow(params.data.assetId); }} aria-label={expandedRows.has(params.data.assetId) ? `Collapse ${params.data.issueDescription || params.data.assetId}` : `Expand ${params.data.issueDescription || params.data.assetId}`}>
          {expandedRows.has(params.data.assetId) ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
        </IconButton>
      ),
      sortable: false,
      filter: false,
    },
    {
      field: 'assetId',
      headerName: 'Asset ID',
      width: 120,
      cellRenderer: (params: any) => (
        <Typography
          variant="body2"
          sx={{ color: 'primary.main', cursor: 'pointer', textDecoration: 'underline', lineHeight: '42px' }}
          onClick={(e) => { e.stopPropagation(); handleSecurityClick(params.data); }}
        >
          {params.value}
        </Typography>
      ),
    },
    { field: 'securityType', headerName: 'Sec Type', width: 90 },
    { field: 'issueDescription', headerName: 'Issue Description', flex: 1, minWidth: 180 },
    { field: 'cusip', headerName: 'CUSIP', width: 110 },
    { field: 'longShortInd', headerName: 'L/S', width: 60 },
    { field: 'shareClass', headerName: 'Share Class', width: 100 },
    ...comparisonColumnDefs,
    {
      field: 'validationStatus',
      headerName: 'Validation',
      width: 100,
      cellRenderer: (params: any) => <ValidationStatus status={params.value} />,
    },
  ], [comparisonColumnDefs, expandedRows, handleExpandRow]);

  const basisLotColumnDefs: ColDef<BasisLotRow>[] = useMemo(() => [
    { field: 'assetId', headerName: 'Asset ID', width: 120 },
    { field: 'issueDescription', headerName: 'Issue Description', flex: 1, minWidth: 200 },
    {
      field: 'primaryShares',
      headerName: 'Primary Shares',
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'nonPrimaryShares',
      headerName: 'Non-Primary Shares',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'shareVariance',
      headerName: 'Variance',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: (p) => p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null,
    },
    {
      field: 'validationStatus',
      headerName: 'Validation',
      width: 100,
      cellRenderer: (params: any) => <ValidationStatus status={params.value} />,
    },
  ], []);

  const renderTaxLotField = (field: ComparisonField) => (
    <React.Fragment key={field.fieldName}>
      <TableCell align="right">{formatCurrency(field.incumbent)}</TableCell>
      <TableCell align="right">{formatCurrency(field.bny)}</TableCell>
      <TableCell align="right" sx={{ color: field.variance !== 0 ? '#d32f2f' : undefined }}>
        {formatCurrency(field.variance)}
      </TableCell>
    </React.Fragment>
  );

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 112px)' }} role="main" aria-label="Position Drill-Down">
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <DrillDownBreadcrumb />

        {/* Context Header */}
        <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
          <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
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
              <Typography variant="caption" color="text.secondary">Category</Typography>
              <Typography variant="body1" fontWeight={600}>{category}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">Category Variance</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body1" fontWeight={600} color={categoryVariance && categoryVariance < 0 ? 'error.main' : 'text.primary'}>
                  {categoryVariance !== null ? `$${formatCurrency(categoryVariance)}` : '—'}
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </Paper>

        {/* View Toggle */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
          >
            <ToggleButton value="positions">Position Compare</ToggleButton>
            <ToggleButton value="basis-lot">Basis Lot Check</ToggleButton>
          </ToggleButtonGroup>
          <Button
            size="small"
            startIcon={<AutoFixHighIcon />}
            variant="outlined"
            onClick={handleRequestAnalysis}
            disabled={aiLoading || !selectedAssetId}
          >
            Request Analysis
          </Button>
        </Stack>

        {/* Position Compare Grid or Basis Lot Grid */}
        <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="Position data grid">
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress aria-label="Loading position data" /></Box>
          ) : viewMode === 'positions' ? (
            <Box className="ag-theme-alpine" sx={{ height: '100%', width: '100%', '& .ag-cell:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}>
              <AgGridReact<PositionCompareRow>
                modules={[AllCommunityModule]}
                theme="legacy"
                rowData={positions}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                animateRows
                onRowClicked={(e) => {
                  if (e.data) {
                    setSelectedAssetId(e.data.assetId);
                    dispatch({ type: 'SET_POS_SELECTED', assetId: e.data.assetId });
                  }
                }}
                getRowId={(params) => params.data.assetId}
              />
            </Box>
          ) : (
            <Box className="ag-theme-alpine" sx={{ height: '100%', width: '100%', '& .ag-cell:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}>
              <AgGridReact<BasisLotRow>
                modules={[AllCommunityModule]}
                theme="legacy"
                rowData={basisLots}
                columnDefs={basisLotColumnDefs}
                defaultColDef={defaultColDef}
                animateRows
                getRowId={(params) => params.data.assetId}
              />
            </Box>
          )}

          {/* Expanded tax lot detail rows */}
          {viewMode === 'positions' && positions.filter((p) => expandedRows.has(p.assetId)).map((pos) => {
            const lots = taxLots[pos.assetId];
            return (
              <Collapse key={pos.assetId} in>
                <Paper variant="outlined" sx={{ mx: 1, mb: 1, p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Tax Lot Detail — {pos.issueDescription} ({pos.assetId})
                  </Typography>
                  {!lots ? <CircularProgress size={20} /> : lots.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No tax lots found</Typography>
                  ) : (
                    <Box sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Transaction ID</TableCell>
                            <TableCell>Trade Date</TableCell>
                            <TableCell>Settle Date</TableCell>
                            <TableCell align="right" colSpan={3}>Shares (Inc / BNY / Var)</TableCell>
                            <TableCell align="right" colSpan={3}>Orig Cost (Inc / BNY / Var)</TableCell>
                            <TableCell align="right" colSpan={3}>Book Value (Inc / BNY / Var)</TableCell>
                            <TableCell align="right" colSpan={3}>Market Value (Inc / BNY / Var)</TableCell>
                            <TableCell>Broker</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {lots.map((lot) => (
                            <TableRow key={lot.transactionId}>
                              <TableCell>{lot.transactionId}</TableCell>
                              <TableCell>{lot.lotTradeDate}</TableCell>
                              <TableCell>{lot.lotSettleDate}</TableCell>
                              {renderTaxLotField(lot.shares)}
                              {renderTaxLotField(lot.origCostBase)}
                              {renderTaxLotField(lot.bookValueBase)}
                              {renderTaxLotField(lot.marketValueBase)}
                              <TableCell>{lot.brokerCode}</TableCell>
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
        </Box>

        {/* Position Roll-Up Validation Footer */}
        <Paper sx={{ p: 2, mt: 1 }} elevation={1}>
          <Stack direction="row" spacing={4} alignItems="center">
            <Box>
              <Typography variant="caption" color="text.secondary">Sum of Position Variances</Typography>
              <Typography variant="body2" fontWeight={600}>
                ${positionRollUp ? formatCurrency(positionRollUp.totalVariance) : '—'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">GL Category Variance</Typography>
              <Typography variant="body2" fontWeight={600}>
                ${categoryVariance !== null ? formatCurrency(categoryVariance) : '—'}
              </Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="caption" color="text.secondary">Roll-Up Tie-Out</Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                {rollUpTieOut !== null && <ValidationStatus status={rollUpTieOut ? 'pass' : 'break'} showLabel />}
                {rollUpTieOut !== null && !rollUpTieOut && positionRollUp && categoryVariance !== null && (
                  <Typography variant="caption" color="error.main">
                    Discrepancy: ${formatCurrency(positionRollUp.totalVariance - categoryVariance)}
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
                  const exportRows = positions.flatMap((pos) => {
                    const baseRow: Record<string, any> = {
                      type: 'Position',
                      assetId: pos.assetId,
                      securityType: pos.securityType,
                      issueDescription: pos.issueDescription,
                      cusip: pos.cusip,
                      longShortInd: pos.longShortInd,
                      shareClass: pos.shareClass,
                      validationStatus: pos.validationStatus,
                    };
                    pos.comparisonFields.forEach((f) => {
                      baseRow[`${f.fieldName} (Inc)`] = f.incumbent;
                      baseRow[`${f.fieldName} (BNY)`] = f.bny;
                      baseRow[`${f.fieldName} (Var)`] = f.variance;
                    });
                    const rows = [baseRow];
                    const lots = taxLots[pos.assetId];
                    if (lots) {
                      lots.forEach((lot) => {
                        rows.push({
                          type: 'Tax Lot',
                          assetId: pos.assetId,
                          securityType: lot.transactionId,
                          issueDescription: `Trade: ${lot.lotTradeDate}`,
                          cusip: `Settle: ${lot.lotSettleDate}`,
                          longShortInd: '',
                          shareClass: lot.brokerCode,
                          validationStatus: '',
                          'Shares (Inc)': lot.shares.incumbent,
                          'Shares (BNY)': lot.shares.bny,
                          'Shares (Var)': lot.shares.variance,
                        });
                      });
                    }
                    return rows;
                  });
                  const fields = positions[0]?.comparisonFields || [];
                  const dynamicCols = fields.flatMap((f) => [
                    { headerName: `${f.fieldName} (Inc)`, field: `${f.fieldName} (Inc)` },
                    { headerName: `${f.fieldName} (BNY)`, field: `${f.fieldName} (BNY)` },
                    { headerName: `${f.fieldName} (Var)`, field: `${f.fieldName} (Var)` },
                  ]);
                  exportToCsv(`positions-${account}-${category}`, [
                    { headerName: 'Type', field: 'type' },
                    { headerName: 'Asset ID', field: 'assetId' },
                    { headerName: 'Security Type', field: 'securityType' },
                    { headerName: 'Issue Description', field: 'issueDescription' },
                    { headerName: 'CUSIP', field: 'cusip' },
                    { headerName: 'L/S', field: 'longShortInd' },
                    { headerName: 'Share Class', field: 'shareClass' },
                    ...dynamicCols,
                    { headerName: 'Validation', field: 'validationStatus' },
                  ], exportRows);
                }}
              >Export to Excel</Button>
            </Box>
          </Stack>
        </Paper>
      </Box>

      {/* AI Commentary Panel */}
      <AICommentaryPanel
        analysis={aiAnalysis}
        loading={aiLoading}
        level="position"
        onRequestAnalysis={handleRequestAnalysis}
      />

      {/* Security Reference Detail Modal */}
      <Dialog open={securityDetailOpen} onClose={() => setSecurityDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Security Reference Detail</DialogTitle>
        <DialogContent dividers>
          {selectedPosition && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Asset ID</Typography>
                  <Typography variant="body2" fontWeight={600}>{selectedPosition.assetId}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">CUSIP</Typography>
                  <Typography variant="body2" fontWeight={600}>{selectedPosition.cusip}</Typography>
                </Box>
              </Stack>
              <Box>
                <Typography variant="caption" color="text.secondary">Issue Description</Typography>
                <Typography variant="body2" fontWeight={600}>{selectedPosition.issueDescription}</Typography>
              </Box>
              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Security Type</Typography>
                  <Typography variant="body2" fontWeight={600}>{selectedPosition.securityType}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Long/Short</Typography>
                  <Typography variant="body2" fontWeight={600}>{selectedPosition.longShortInd}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Share Class</Typography>
                  <Typography variant="body2" fontWeight={600}>{selectedPosition.shareClass}</Typography>
                </Box>
              </Stack>
              <Divider />
              <Typography variant="subtitle2">Comparison Fields</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell align="right">Incumbent</TableCell>
                    <TableCell align="right">BNY</TableCell>
                    <TableCell align="right">Variance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedPosition.comparisonFields.map((f) => (
                    <TableRow key={f.fieldName}>
                      <TableCell>{f.fieldName}</TableCell>
                      <TableCell align="right">{formatCurrency(f.incumbent)}</TableCell>
                      <TableCell align="right">{formatCurrency(f.bny)}</TableCell>
                      <TableCell align="right" sx={{ color: f.variance !== 0 ? '#d32f2f' : undefined }}>
                        {formatCurrency(f.variance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSecurityDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PositionDrillDown;
