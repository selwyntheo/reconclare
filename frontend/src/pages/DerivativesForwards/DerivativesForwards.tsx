import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Stack,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { DrillDownBreadcrumb } from '../../components/shared/DrillDownBreadcrumb';
import BreakCategorySelector from '../../components/shared/BreakCategorySelector';
import { fetchForwards } from '../../services/api';

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return '';
  return v < 0
    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function DerivativesForwards() {
  const { eventId, account } = useParams<{ eventId: string; account: string }>();
  const valuationDt = new URLSearchParams(useLocation().search).get('valuationDt') || '';

  const [rowData, setRowData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventId && account && valuationDt) {
      setLoading(true);
      setError(null);
      fetchForwards(eventId, account, valuationDt)
        .then(setRowData)
        .catch((err) => {
          setError(err.message || 'Failed to load forwards data');
          setRowData([]);
        })
        .finally(() => setLoading(false));
    }
  }, [eventId, account, valuationDt]);

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  const columnDefs: ColDef[] = useMemo(() => [
    { field: 'assetId', headerName: 'Asset ID', width: 120 },
    { field: 'issueDescription', headerName: 'Issue Description', flex: 1, minWidth: 180 },
    { field: 'buyCurrency', headerName: 'Buy Currency', width: 120 },
    { field: 'sellCurrency', headerName: 'Sell Currency', width: 120 },
    { field: 'tradeDate', headerName: 'Trade Date', width: 120 },
    { field: 'settlementDate', headerName: 'Settlement Date', width: 130 },
    {
      field: 'bnyNotional',
      headerName: 'BNY Notional',
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'incumbentNotional',
      headerName: 'Incumbent Notional',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'notionalDiff',
      headerName: 'Notional Diff',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: (p) => p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null,
    },
    {
      field: 'bnyUnrealisedGL',
      headerName: 'BNY Unrealised G/L',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'incumbentUnrealisedGL',
      headerName: 'Incumbent Unrealised G/L',
      width: 180,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'unrealisedGLDiff',
      headerName: 'Unrealised G/L Diff',
      width: 160,
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
  ], []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }} role="main" aria-label="Derivatives Forwards">
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
            <Typography variant="body1" fontWeight={600}>Derivatives — Forwards</Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Data Grid */}
      <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="Forwards data grid">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading forwards data" />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        ) : (
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
        )}
      </Box>
    </Box>
  );
}
