import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Stack,
  CircularProgress,
  Divider,
  Alert,
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import ReviewStatusBadge from '../../components/shared/ReviewStatusBadge';
import { useAuth } from '../../context/AuthContext';
import { canOverrideKD } from '../../config/permissions';
import { fetchShareClasses } from '../../services/api';

// ── Types ──────────────────────────────────────────────────

interface ShareClassRow {
  shareClassId: string;
  shareClassName: string;
  currency: string;
  bnyNetAssetsBase: number | null;
  bnyNetAssetsLocal: number | null;
  incumbentNetAssetsBase: number | null;
  incumbentNetAssetsLocal: number | null;
  netAssetsDiffBase: number | null;
  netAssetsDiffLocal: number | null;
  bnyNavPerShareBase: number | null;
  bnyNavPerShareLocal: number | null;
  incumbentNavPerShareBase: number | null;
  incumbentNavPerShareLocal: number | null;
  navPerShareDiffBase: number | null;
  navPerShareDiffLocal: number | null;
  bnyUnits: number | null;
  incumbentUnits: number | null;
  unitsDiff: number | null;
  shareMovementSubscriptions: number | null;
  shareMovementRedemptions: number | null;
  shareMovementNet: number | null;
  priorDayBnyNetAssetsBase: number | null;
  priorDayIncumbentNetAssetsBase: number | null;
  priorDayNetAssetsDiffBase: number | null;
  priorDayBnyNavPerShareBase: number | null;
  priorDayIncumbentNavPerShareBase: number | null;
  priorDayNavPerShareDiffBase: number | null;
  reviewStatus?: string;
  breakCategory?: string;
}

// ── Formatters ─────────────────────────────────────────────

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return '';
  return v < 0
    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatShares = (v: number | null | undefined) => {
  if (v == null) return '';
  return v < 0
    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })})`
    : v.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
};

const formatNavPerShare = (v: number | null | undefined) => {
  if (v == null) return '';
  return v < 0
    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })})`
    : v.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 });
};

const varianceCellStyle = (params: any) =>
  params.value != null && params.value !== 0 ? { color: '#d32f2f', fontWeight: 600 } : null;

// ── Component ──────────────────────────────────────────────

export default function NavShareClass() {
  const { eventId, account } = useParams<{ eventId: string; account: string }>();
  const [searchParams] = useSearchParams();
  const valuationDt = searchParams.get('valuationDt') || '';
  const { role, permissions } = useAuth();

  const [rows, setRows] = useState<ShareClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data Fetch ─────────────────────────────────────────

  useEffect(() => {
    if (!eventId || !account || !valuationDt) return;
    setLoading(true);
    setError(null);
    fetchShareClasses(eventId, account, valuationDt)
      .then((data) => setRows(data as ShareClassRow[]))
      .catch((err) => {
        setError(err.message || 'Failed to load share class data');
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [eventId, account, valuationDt]);

  // ── Column Definitions (27 columns) ───────────────────

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  const columnDefs: ColDef<ShareClassRow>[] = useMemo(() => [
    // Identity
    { field: 'shareClassId', headerName: 'Share Class ID', width: 130, pinned: 'left' },
    { field: 'shareClassName', headerName: 'Share Class Name', width: 180, pinned: 'left' },
    { field: 'currency', headerName: 'Currency', width: 90 },

    // Net Assets (Base)
    {
      headerName: 'BNY Net Assets (Base)',
      field: 'bnyNetAssetsBase',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      headerName: 'Inc Net Assets (Base)',
      field: 'incumbentNetAssetsBase',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      headerName: 'Net Assets Diff (Base)',
      field: 'netAssetsDiffBase',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: varianceCellStyle,
    },

    // Net Assets (Local)
    {
      headerName: 'BNY Net Assets (Local)',
      field: 'bnyNetAssetsLocal',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      headerName: 'Inc Net Assets (Local)',
      field: 'incumbentNetAssetsLocal',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      headerName: 'Net Assets Diff (Local)',
      field: 'netAssetsDiffLocal',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: varianceCellStyle,
    },

    // NAV Per Share (Base)
    {
      headerName: 'BNY NAV/Share (Base)',
      field: 'bnyNavPerShareBase',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatNavPerShare(p.value),
    },
    {
      headerName: 'Inc NAV/Share (Base)',
      field: 'incumbentNavPerShareBase',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatNavPerShare(p.value),
    },
    {
      headerName: 'NAV/Share Diff (Base)',
      field: 'navPerShareDiffBase',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatNavPerShare(p.value),
      cellStyle: varianceCellStyle,
    },

    // NAV Per Share (Local)
    {
      headerName: 'BNY NAV/Share (Local)',
      field: 'bnyNavPerShareLocal',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatNavPerShare(p.value),
    },
    {
      headerName: 'Inc NAV/Share (Local)',
      field: 'incumbentNavPerShareLocal',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatNavPerShare(p.value),
    },
    {
      headerName: 'NAV/Share Diff (Local)',
      field: 'navPerShareDiffLocal',
      width: 170,
      type: 'numericColumn',
      valueFormatter: (p) => formatNavPerShare(p.value),
      cellStyle: varianceCellStyle,
    },

    // Units
    {
      headerName: 'BNY Units',
      field: 'bnyUnits',
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => formatShares(p.value),
    },
    {
      headerName: 'Inc Units',
      field: 'incumbentUnits',
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => formatShares(p.value),
    },
    {
      headerName: 'Units Diff',
      field: 'unitsDiff',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (p) => formatShares(p.value),
      cellStyle: varianceCellStyle,
    },

    // Share Movement
    {
      headerName: 'Subscriptions',
      field: 'shareMovementSubscriptions',
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => formatShares(p.value),
    },
    {
      headerName: 'Redemptions',
      field: 'shareMovementRedemptions',
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => formatShares(p.value),
    },
    {
      headerName: 'Net Movement',
      field: 'shareMovementNet',
      width: 140,
      type: 'numericColumn',
      valueFormatter: (p) => formatShares(p.value),
      cellStyle: varianceCellStyle,
    },

    // Prior Day Section
    {
      headerName: 'PD BNY Net Assets',
      field: 'priorDayBnyNetAssetsBase',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      headerName: 'PD Inc Net Assets',
      field: 'priorDayIncumbentNetAssetsBase',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    },
    {
      headerName: 'PD Net Assets Diff',
      field: 'priorDayNetAssetsDiffBase',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
      cellStyle: varianceCellStyle,
    },
    {
      headerName: 'PD BNY NAV/Share',
      field: 'priorDayBnyNavPerShareBase',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatNavPerShare(p.value),
    },
    {
      headerName: 'PD Inc NAV/Share',
      field: 'priorDayIncumbentNavPerShareBase',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatNavPerShare(p.value),
    },
    {
      headerName: 'PD NAV/Share Diff',
      field: 'priorDayNavPerShareDiffBase',
      width: 160,
      type: 'numericColumn',
      valueFormatter: (p) => formatNavPerShare(p.value),
      cellStyle: varianceCellStyle,
    },

    // Review status
    {
      headerName: 'Review Status',
      field: 'reviewStatus',
      width: 130,
      cellRenderer: (params: any) =>
        params.value ? <ReviewStatusBadge status={params.value} /> : null,
    },
  ], []);

  // ── Render ────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }} role="main" aria-label="NAV Share Class Comparison">
      {/* Context Header */}
      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
          <Box>
            <Typography variant="caption" color="text.secondary">Fund Account</Typography>
            <Typography variant="body1" fontWeight={600}>{account || '--'}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Valuation Date</Typography>
            <Typography variant="body1" fontWeight={600}>{valuationDt || '--'}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Event</Typography>
            <Typography variant="body1" fontWeight={600}>{eventId || '--'}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Role</Typography>
            <Typography variant="body1" fontWeight={600}>{permissions.label}</Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Share Class Grid */}
      <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="Share class data grid">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading share class data" />
          </Box>
        ) : (
          <Box
            className="ag-theme-alpine"
            sx={{
              height: '100%',
              width: '100%',
              '& .ag-cell:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
            }}
          >
            <AgGridReact<ShareClassRow>
              modules={[AllCommunityModule]}
              theme="legacy"
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows
              getRowId={(params) => params.data.shareClassId}
            />
          </Box>
        )}
      </Box>

      {/* Summary Footer */}
      <Paper sx={{ p: 2, mt: 1 }} elevation={1}>
        <Stack direction="row" spacing={4} alignItems="center">
          <Box>
            <Typography variant="caption" color="text.secondary">Share Classes</Typography>
            <Typography variant="body2" fontWeight={600}>{rows.length}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Classes with Variance</Typography>
            <Typography variant="body2" fontWeight={600} color="error.main">
              {rows.filter((r) => r.netAssetsDiffBase != null && r.netAssetsDiffBase !== 0).length}
            </Typography>
          </Box>
          {canOverrideKD(role) && (
            <>
              <Divider orientation="vertical" flexItem />
              <Box>
                <Typography variant="caption" color="text.secondary">KD Override</Typography>
                <Typography variant="body2" fontWeight={600}>Enabled</Typography>
              </Box>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
