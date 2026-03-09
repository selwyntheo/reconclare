import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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

import { DrillDownBreadcrumb } from '../../components/shared/DrillDownBreadcrumb';
import NavSubViewNav from '../../components/shared/NavSubViewNav';
import NavKpiCards, { NavKpiData } from '../../components/shared/NavKpiCards';
import { useDrillDownState, useDrillDownDispatch } from '../../context/DrillDownContext';
import { fetchShareClassDashboard, fetchEvent } from '../../services/api';
import { ShareClassDashboardRow } from '../../types';

// ── RAG Helpers ────────────────────────────────────────────

const RAG_GREEN = '#E2F0D9';
const RAG_AMBER = '#FFF2CC';
const RAG_RED = '#FCE4EC';

function ragCellStyle(params: any): Record<string, string> | null {
  const val = params.data?.basisPointsDifference;
  if (val == null) return null;
  const absBP = Math.abs(val);
  if (absBP <= 5) return { backgroundColor: RAG_GREEN };
  if (absBP <= 50) return { backgroundColor: RAG_AMBER };
  return { backgroundColor: RAG_RED };
}

// ── Formatters ─────────────────────────────────────────────

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return '';
  return v < 0
    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatBP = (v: number | null | undefined) => {
  if (v == null) return '';
  return `${v.toFixed(2)} bp`;
};

const formatNav = (v: number | null | undefined) => {
  if (v == null) return '';
  return v.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 });
};

// ── Component ──────────────────────────────────────────────

export default function NavShareClassDashboard() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const state = useDrillDownState();
  const dispatch = useDrillDownDispatch();
  const valuationDt = searchParams.get('valuationDt') || '';

  const [rows, setRows] = useState<ShareClassDashboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set event context
  useEffect(() => {
    if (eventId && !state.context.eventId) {
      fetchEvent(eventId)
        .then((evt: any) => {
          dispatch({ type: 'SET_EVENT', eventId: evt.eventId, eventName: evt.eventName });
        })
        .catch(() => {});
    }
  }, [eventId, state.context.eventId, dispatch]);

  // Load data
  useEffect(() => {
    if (!eventId || !valuationDt) return;
    setLoading(true);
    setError(null);
    fetchShareClassDashboard(eventId, valuationDt)
      .then((data) => setRows(data as ShareClassDashboardRow[]))
      .catch((err) => {
        setError(err.message || 'Failed to load share class dashboard data');
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [eventId, valuationDt]);

  // ── Column Definitions ────────────────────────────────────

  const columnDefs: ColDef<ShareClassDashboardRow>[] = useMemo(
    () => [
      { field: 'account', headerName: 'Account', width: 110 },
      { field: 'accountName', headerName: 'Fund Name', width: 180 },
      { field: 'shareClass', headerName: 'Share Class', width: 120 },
      {
        field: 'bnyUnits',
        headerName: 'Units (BNY)',
        width: 130,
        type: 'numericColumn',
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        field: 'incumbentUnits',
        headerName: 'Units (Inc)',
        width: 130,
        type: 'numericColumn',
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        field: 'unitsDifference',
        headerName: 'Units (Diff)',
        width: 120,
        type: 'numericColumn',
        valueFormatter: (p) => formatCurrency(p.value),
        cellStyle: (p) => (p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null),
      },
      {
        field: 'bnyNetAssets',
        headerName: 'Net Assets (BNY)',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        field: 'incumbentNetAssets',
        headerName: 'Net Assets (Inc)',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        field: 'netAssetsDifference',
        headerName: 'Net Assets (Diff)',
        width: 140,
        type: 'numericColumn',
        valueFormatter: (p) => formatCurrency(p.value),
        cellStyle: (p) => (p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null),
      },
      {
        field: 'bnyNavPerShare',
        headerName: 'NAV/Share (BNY)',
        width: 140,
        type: 'numericColumn',
        valueFormatter: (p) => formatNav(p.value),
      },
      {
        field: 'incumbentNavPerShare',
        headerName: 'NAV/Share (Inc)',
        width: 140,
        type: 'numericColumn',
        valueFormatter: (p) => formatNav(p.value),
      },
      {
        field: 'navPerShareDifference',
        headerName: 'NAV/Share (Diff)',
        width: 140,
        type: 'numericColumn',
        valueFormatter: (p) => formatNav(p.value),
        cellStyle: (p) => (p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null),
      },
      {
        field: 'ragStatus',
        headerName: 'RAG',
        width: 80,
        cellStyle: ragCellStyle,
      },
      {
        field: 'basisPointsDifference',
        headerName: 'BP',
        width: 100,
        type: 'numericColumn',
        valueFormatter: (p) => formatBP(p.value),
        cellStyle: ragCellStyle,
      },
    ],
    [],
  );

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  // ── Summary Stats ─────────────────────────────────────────

  const summaryStats = useMemo(() => {
    const totalClasses = rows.length;
    const fundSet = new Set(rows.map((r) => r.account));
    const fundsCount = fundSet.size;
    const greenCount = rows.filter((r) => Math.abs(r.basisPointsDifference) <= 5).length;
    const amberCount = rows.filter(
      (r) => Math.abs(r.basisPointsDifference) > 5 && Math.abs(r.basisPointsDifference) <= 50,
    ).length;
    const redCount = rows.filter((r) => Math.abs(r.basisPointsDifference) > 50).length;
    return { totalClasses, fundsCount, greenCount, amberCount, redCount };
  }, [rows]);

  const kpiData: NavKpiData = useMemo(() => {
    const totalVariance = rows.reduce((s, r) => s + (r.netAssetsDifference || 0), 0);
    const totalInc = rows.reduce((s, r) => s + (r.incumbentNetAssets || 0), 0);
    const totalVarianceBP = totalInc !== 0 ? (totalVariance / totalInc) * 10000 : 0;
    const sorted = [...rows].sort((a, b) => Math.abs(b.basisPointsDifference) - Math.abs(a.basisPointsDifference));
    const largest = sorted[0];
    return {
      totalVariance,
      totalVarianceBP,
      greenCount: summaryStats.greenCount,
      amberCount: summaryStats.amberCount,
      redCount: summaryStats.redCount,
      totalItems: summaryStats.totalClasses,
      itemLabel: 'Share Classes',
      largestBreak: largest ? { name: `${largest.accountName} (${largest.shareClass})`, bpValue: largest.basisPointsDifference } : undefined,
    };
  }, [rows, summaryStats]);

  // ── Render ────────────────────────────────────────────────

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }}
      role="main"
      aria-label="NAV Share Class Dashboard"
    >
      <DrillDownBreadcrumb />

      {/* Context Header */}
      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
          <Box>
            <Typography variant="caption" color="text.secondary">Event</Typography>
            <Typography variant="body1" fontWeight={600}>
              {state.context.eventName || eventId || '--'}
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Valuation Date</Typography>
            <Typography variant="body1" fontWeight={600}>{valuationDt || '--'}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Share Classes</Typography>
            <Typography variant="body1" fontWeight={600}>{summaryStats.totalClasses}</Typography>
          </Box>
        </Stack>
      </Paper>

      {/* NAV Sub-View Navigation */}
      <NavSubViewNav currentView="share-class-dashboard" />

      {/* KPI Summary Cards */}
      {!loading && rows.length > 0 && <NavKpiCards data={kpiData} />}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Share Class Grid */}
      <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="Share class dashboard grid">
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
              '& .ag-cell:focus-within': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: -2,
              },
            }}
          >
            <AgGridReact<ShareClassDashboardRow>
              modules={[AllCommunityModule]}
              theme="legacy"
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows
              getRowId={(params) => `${params.data.account}-${params.data.shareClass}`}
              onRowDoubleClicked={(e) => {
                if (e.data) {
                  navigate(
                    `/events/${eventId}/nav-dashboard/share-class/${e.data.account}?valuationDt=${valuationDt}`,
                  );
                }
              }}
            />
          </Box>
        )}
      </Box>

      {/* Summary Footer */}
      <Paper sx={{ p: 2, mt: 1 }} elevation={1}>
        <Stack direction="row" spacing={4} alignItems="center">
          <Box>
            <Typography variant="caption" color="text.secondary">Total Share Classes</Typography>
            <Typography variant="body2" fontWeight={600}>{summaryStats.totalClasses}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Funds</Typography>
            <Typography variant="body2" fontWeight={600}>{summaryStats.fundsCount}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Green (|BP| &lt;= 5)</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: '#2E7D32' }}>
              {summaryStats.greenCount}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Amber (|BP| &lt;= 50)</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: '#ED6C02' }}>
              {summaryStats.amberCount}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Red (|BP| &gt; 50)</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: '#d32f2f' }}>
              {summaryStats.redCount}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
