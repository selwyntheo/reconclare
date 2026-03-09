import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Stack,
  CircularProgress,
  Divider,
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import ReviewStatusBadge from '../../components/shared/ReviewStatusBadge';
import { useAuth } from '../../context/AuthContext';
import { canOverrideKD } from '../../config/permissions';
import {
  fetchScorecard,
  fetchKnownDifferences,
  updateScorecardOverrides,
  fetchCommentaryRollup,
} from '../../services/api';
import NavSubViewNav from '../../components/shared/NavSubViewNav';
import NavKpiCards, { NavKpiData } from '../../components/shared/NavKpiCards';
import ExportButton from '../../components/shared/ExportButton';

// ── Types ──────────────────────────────────────────────────

interface KnownDifference {
  reference: string;
  description: string;
  amount: number;
  active: boolean;
  fund?: string;
}

interface ScorecardRow {
  fund: string;
  fundName: string;
  bnyNetAssets: number;
  incumbentNetAssets: number;
  difference: number;
  differenceBP: number;
  incumbentToResolve: number;
  adjustedDifference: number;
  adjustedDifferenceBP: number;
  signedOff: boolean;
  signedOffBy?: string;
  signedOffAt?: string;
  reviewStatus?: string;
  [key: string]: any; // dynamic KD columns
}

// ── RAG Helpers ────────────────────────────────────────────

const RAG_GREEN = '#E2F0D9';
const RAG_AMBER = '#FFF2CC';
const RAG_RED = '#FCE4EC';

function getRagColor(bpValue: number | null | undefined): string | undefined {
  if (bpValue == null) return undefined;
  const absBP = Math.abs(bpValue);
  if (absBP <= 5) return RAG_GREEN;
  if (absBP <= 50) return RAG_AMBER;
  return RAG_RED;
}

function ragCellStyle(params: any): Record<string, string> | null {
  const bg = getRagColor(params.value);
  if (!bg) return null;
  return { backgroundColor: bg };
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

// ── Component ──────────────────────────────────────────────

export default function NavClientScorecard() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const valuationDt = searchParams.get('valuationDt') || '';
  const { role, permissions } = useAuth();

  const [rows, setRows] = useState<ScorecardRow[]>([]);
  const [knownDifferences, setKnownDifferences] = useState<KnownDifference[]>([]);
  const [commentaryRollup, setCommentaryRollup] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data Fetch ─────────────────────────────────────────

  useEffect(() => {
    if (!eventId || !valuationDt) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchScorecard(eventId, valuationDt),
      fetchKnownDifferences(eventId, true),
    ])
      .then(([scorecardData, kdData]) => {
        // Backend returns { knownDifferences, rows } or a plain array
        const result = scorecardData as any;
        setRows(Array.isArray(result) ? result : (result.rows || []));
        setKnownDifferences(kdData as KnownDifference[]);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load scorecard data');
        setRows([]);
        setKnownDifferences([]);
      })
      .finally(() => setLoading(false));
  }, [eventId, valuationDt]);

  // ── Commentary Rollup ─────────────────────────────────

  useEffect(() => {
    if (!eventId || rows.length === 0) return;
    const rollupMap: Record<string, string> = {};
    const promises = rows.map((row) =>
      fetchCommentaryRollup(eventId!, row.fund, 'L1_GL')
        .then((result) => {
          const summaryText = Array.isArray(result)
            ? result.map((r: any) => r.summary || r.text || '').filter(Boolean).join('; ')
            : '';
          rollupMap[row.fund] = summaryText;
        })
        .catch(() => {
          rollupMap[row.fund] = '';
        })
    );
    Promise.all(promises).then(() => setCommentaryRollup({ ...rollupMap }));
  }, [eventId, rows]);

  // ── Sign-Off Handler ──────────────────────────────────

  const handleSignOff = useCallback(
    async (fund: string, checked: boolean) => {
      if (!eventId) return;
      try {
        await updateScorecardOverrides(eventId, {
          fund,
          signedOff: checked,
          valuationDt,
        });
        setRows((prev) =>
          prev.map((r) =>
            r.fund === fund ? { ...r, signedOff: checked } : r
          )
        );
      } catch {
        // Revert on failure - re-fetch
        if (eventId && valuationDt) {
          fetchScorecard(eventId, valuationDt)
            .then((data) => setRows(data as ScorecardRow[]))
            .catch(() => {});
        }
      }
    },
    [eventId, valuationDt]
  );

  // ── Active KD references for dynamic columns ──────────

  const activeKDs = useMemo(
    () => knownDifferences.filter((kd) => kd.active),
    [knownDifferences]
  );

  // ── Compute adjusted values per row ───────────────────

  const enrichedRows = useMemo(() => {
    return rows.map((row) => {
      // Sum KD amounts applicable to this fund
      const kdTotal = activeKDs.reduce((sum, kd) => {
        const kdAmount = row[`kd_${kd.reference}`] ?? kd.amount ?? 0;
        return sum + kdAmount;
      }, 0);

      const incumbentToResolve = row.incumbentToResolve ?? 0;
      const adjustedDiff = row.difference - kdTotal - incumbentToResolve;
      const adjustedBP =
        row.incumbentNetAssets !== 0
          ? (adjustedDiff / Math.abs(row.incumbentNetAssets)) * 10000
          : 0;

      return {
        ...row,
        _kdTotal: kdTotal,
        adjustedDifference: adjustedDiff,
        adjustedDifferenceBP: adjustedBP,
      };
    });
  }, [rows, activeKDs]);

  // ── Column Definitions ────────────────────────────────

  const columnDefs: ColDef<ScorecardRow>[] = useMemo(() => {
    // Static columns
    const staticCols: ColDef<ScorecardRow>[] = [
      { field: 'fund', headerName: 'Fund', width: 120, pinned: 'left' },
      { field: 'fundName', headerName: 'Fund Name', width: 200, pinned: 'left' },
      {
        field: 'bnyNetAssets',
        headerName: 'BNY Net Assets',
        width: 160,
        type: 'numericColumn',
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        field: 'incumbentNetAssets',
        headerName: 'Incumbent Net Assets',
        width: 170,
        type: 'numericColumn',
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        field: 'difference',
        headerName: 'Difference',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (p) => formatCurrency(p.value),
        cellStyle: (p) => (p.value != null && p.value !== 0 ? { color: '#d32f2f', fontWeight: 600 } : null),
      },
      {
        field: 'differenceBP',
        headerName: 'Diff (BP)',
        width: 110,
        type: 'numericColumn',
        valueFormatter: (p) => formatBP(p.value),
        cellStyle: ragCellStyle,
      },
    ];

    // Dynamic KD columns
    const kdCols: ColDef<ScorecardRow>[] = activeKDs.map((kd) => ({
      headerName: `KD: ${kd.description || kd.reference}`,
      field: `kd_${kd.reference}`,
      width: 150,
      type: 'numericColumn',
      valueGetter: (params) => params.data?.[`kd_${kd.reference}`] ?? kd.amount ?? 0,
      valueFormatter: (p) => formatCurrency(p.value),
      editable: canOverrideKD(role),
    }));

    // Incumbent to resolve column
    const incumbentCol: ColDef<ScorecardRow> = {
      field: 'incumbentToResolve',
      headerName: 'Inc. to Resolve',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (p) => formatCurrency(p.value),
    };

    // Adjusted columns with RAG
    const adjustedCols: ColDef<ScorecardRow>[] = [
      {
        headerName: 'Adjusted Diff',
        field: 'adjustedDifference',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (p) => formatCurrency(p.value),
        cellStyle: (p) => (p.value != null && p.value !== 0 ? { color: '#d32f2f', fontWeight: 600 } : null),
      },
      {
        headerName: 'Adjusted RAG (BP)',
        field: 'adjustedDifferenceBP',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (p) => formatBP(p.value),
        cellStyle: ragCellStyle,
      },
    ];

    // Review status column
    const reviewCol: ColDef<ScorecardRow> = {
      field: 'reviewStatus',
      headerName: 'Review',
      width: 120,
      cellRenderer: (params: any) =>
        params.value ? <ReviewStatusBadge status={params.value} /> : null,
    };

    // Sign-off column
    const signOffCol: ColDef<ScorecardRow> = {
      field: 'signedOff',
      headerName: 'Sign-Off',
      width: 110,
      cellRenderer: (params: any) => {
        if (!params.data) return null;
        return (
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={params.data.signedOff || false}
                disabled={!permissions.canApproveSignOff}
                onChange={(e) => handleSignOff(params.data.fund, e.target.checked)}
              />
            }
            label=""
            sx={{ m: 0, justifyContent: 'center' }}
          />
        );
      },
      sortable: false,
      filter: false,
    };

    // Comment column (rolled-up commentary)
    const commentCol: ColDef<ScorecardRow> = {
      headerName: 'Comment',
      field: 'fund',
      colId: 'comment',
      width: 250,
      valueGetter: (params) => params.data ? commentaryRollup[params.data.fund] || '' : '',
      sortable: false,
      filter: false,
    };

    return [...staticCols, ...kdCols, incumbentCol, ...adjustedCols, reviewCol, signOffCol, commentCol];
  }, [activeKDs, role, permissions.canApproveSignOff, handleSignOff, commentaryRollup]);

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  // ── Summary Stats ─────────────────────────────────────

  const summaryStats = useMemo(() => {
    const total = enrichedRows.length;
    const greenCount = enrichedRows.filter((r) => Math.abs(r.adjustedDifferenceBP) <= 5).length;
    const amberCount = enrichedRows.filter(
      (r) => Math.abs(r.adjustedDifferenceBP) > 5 && Math.abs(r.adjustedDifferenceBP) <= 50
    ).length;
    const redCount = enrichedRows.filter((r) => Math.abs(r.adjustedDifferenceBP) > 50).length;
    const signedOff = enrichedRows.filter((r) => r.signedOff).length;
    return { total, greenCount, amberCount, redCount, signedOff };
  }, [enrichedRows]);

  const kpiData: NavKpiData = useMemo(() => {
    const totalVariance = enrichedRows.reduce((s, r) => s + (r.adjustedDifference || 0), 0);
    const totalInc = enrichedRows.reduce((s, r) => s + (r.incumbentNetAssets || 0), 0);
    const totalVarianceBP = totalInc !== 0 ? (totalVariance / totalInc) * 10000 : 0;
    const sorted = [...enrichedRows].sort((a, b) => Math.abs(b.adjustedDifferenceBP) - Math.abs(a.adjustedDifferenceBP));
    const largest = sorted[0];
    return {
      totalVariance,
      totalVarianceBP,
      greenCount: summaryStats.greenCount,
      amberCount: summaryStats.amberCount,
      redCount: summaryStats.redCount,
      totalItems: summaryStats.total,
      itemLabel: 'Funds',
      largestBreak: largest ? { name: largest.fundName || largest.fund, bpValue: largest.adjustedDifferenceBP } : undefined,
      reviewProgress: { completed: summaryStats.signedOff, total: summaryStats.total },
    };
  }, [enrichedRows, summaryStats]);

  // ── Render ────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }} role="main" aria-label="NAV Client Scorecard">
      {/* Context Header */}
      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
          <Box>
            <Typography variant="caption" color="text.secondary">Event</Typography>
            <Typography variant="body1" fontWeight={600}>{eventId || '--'}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Valuation Date</Typography>
            <Typography variant="body1" fontWeight={600}>{valuationDt || '--'}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Active Known Differences</Typography>
            <Typography variant="body1" fontWeight={600}>{activeKDs.length}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Role</Typography>
            <Typography variant="body1" fontWeight={600}>{permissions.label}</Typography>
          </Box>
          <Box sx={{ ml: 'auto' }}>
            <ExportButton viewType="client-scorecard" eventId={eventId!} />
          </Box>
        </Stack>
      </Paper>

      {/* NAV Sub-View Navigation */}
      <NavSubViewNav currentView="scorecard" />

      {/* KPI Summary Cards */}
      {!loading && enrichedRows.length > 0 && <NavKpiCards data={kpiData} />}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Scorecard Grid */}
      <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="Scorecard data grid">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading scorecard data" />
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
            <AgGridReact<ScorecardRow>
              modules={[AllCommunityModule]}
              theme="legacy"
              rowData={enrichedRows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows
              getRowId={(params) => params.data.fund}
            />
          </Box>
        )}
      </Box>

      {/* Summary Footer */}
      <Paper sx={{ p: 2, mt: 1 }} elevation={1}>
        <Stack direction="row" spacing={4} alignItems="center">
          <Box>
            <Typography variant="caption" color="text.secondary">Total Funds</Typography>
            <Typography variant="body2" fontWeight={600}>{summaryStats.total}</Typography>
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
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Signed Off</Typography>
            <Typography variant="body2" fontWeight={600}>
              {summaryStats.signedOff} / {summaryStats.total}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
