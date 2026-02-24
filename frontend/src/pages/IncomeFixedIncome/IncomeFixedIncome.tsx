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
import { fetchFixedIncomeIncome } from '../../services/api';

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return '';
  return v < 0
    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatRate = (v: number | null | undefined) => {
  if (v == null) return '';
  return `${v.toFixed(4)}%`;
};

export default function IncomeFixedIncome() {
  const { eventId, account } = useParams<{ eventId: string; account: string }>();
  const valuationDt = new URLSearchParams(useLocation().search).get('valuationDt') || '';

  const [rowData, setRowData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventId && account && valuationDt) {
      setLoading(true);
      setError(null);
      fetchFixedIncomeIncome(eventId, account, valuationDt)
        .then(setRowData)
        .catch((err) => {
          setError(err.message || 'Failed to load fixed income data');
          setRowData([]);
        })
        .finally(() => setLoading(false));
    }
  }, [eventId, account, valuationDt]);

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  const columnDefs: ColDef[] = useMemo(() => [
    { field: 'assetId', headerName: 'Asset ID', width: 120 },
    { field: 'issueDescription', headerName: 'Issue Description', flex: 1, minWidth: 180 },
    { field: 'priorCouponDate', headerName: 'Prior Coupon Date', width: 140 },
    { field: 'nextCouponDate', headerName: 'Next Coupon Date', width: 140 },
    { field: 'paymentFrequency', headerName: 'Payment Frequency', width: 140 },
    {
      field: 'bnyCouponRate',
      headerName: 'BNY Coupon Rate',
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => formatRate(p.value),
    },
    {
      field: 'incumbentCouponRate',
      headerName: 'Incumbent Coupon Rate',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatRate(p.value),
    },
    {
      field: 'couponRateDiff',
      headerName: 'Coupon Rate Diff',
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => formatRate(p.value),
      cellStyle: (p) => p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null,
    },
    {
      field: 'bnyAccruedIncome',
      headerName: 'BNY Accrued Income',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'incumbentAccruedIncome',
      headerName: 'Incumbent Accrued Income',
      width: 180,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      field: 'accruedDiff',
      headerName: 'Accrued Diff',
      width: 130,
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }} role="main" aria-label="Income Fixed Income">
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
            <Typography variant="body1" fontWeight={600}>Income — Fixed Income</Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Data Grid */}
      <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="Fixed income data grid">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading fixed income data" />
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
