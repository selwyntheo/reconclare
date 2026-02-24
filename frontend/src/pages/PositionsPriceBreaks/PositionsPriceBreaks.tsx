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
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { fetchPriceBreaks } from '../../services/api';
import BreakCategorySelector from '../../components/shared/BreakCategorySelector';
import BreakTeamDropdown from '../../components/shared/BreakTeamDropdown';
import {
  ResolutionBreakCategory,
  BreakTeam,
} from '../../types/breakResolution';
import { updateBreakCategory, updateBreakTeam } from '../../services/api';

// ── Helpers ──────────────────────────────────────────────────

const formatNumber = (v: number | null | undefined, decimals = 2) => {
  if (v == null) return '';
  return v < 0
    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })})`
    : v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const computePriceDiffPct = (bnyPrice: number, incumbentPrice: number): number => {
  if (incumbentPrice === 0) return 0;
  return ((bnyPrice - incumbentPrice) / incumbentPrice) * 100;
};

// ── Row Type ─────────────────────────────────────────────────

interface PriceBreakRow {
  assetId: string;
  securityType: string;
  issueDescription: string;
  bnyPrice: number;
  incumbentPrice: number;
  priceDiff: number;
  priceDiffPct: number;
  bnyMarketValue: number;
  incumbentMarketValue: number;
  marketValueDiff: number;
  breakCategory: ResolutionBreakCategory | '';
  breakTeam: BreakTeam | '';
  breakOwner: string;
  comment: string;
}

// ── Component ────────────────────────────────────────────────

export default function PositionsPriceBreaks() {
  const { eventId, account } = useParams<{ eventId: string; account: string }>();
  const location = useLocation();
  const valuationDt = new URLSearchParams(location.search).get('valuationDt') || '';

  const [rows, setRows] = useState<PriceBreakRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data Fetch ─────────────────────────────────────────────

  useEffect(() => {
    if (!eventId || !account || !valuationDt) return;
    setLoading(true);
    setError(null);
    fetchPriceBreaks(eventId, account, valuationDt)
      .then((data: any[]) => {
        const mapped: PriceBreakRow[] = data.map((d) => ({
          ...d,
          priceDiffPct: computePriceDiffPct(d.bnyPrice ?? 0, d.incumbentPrice ?? 0),
          breakCategory: d.breakCategory ?? '',
          breakTeam: d.breakTeam ?? '',
          breakOwner: d.breakOwner ?? '',
          comment: d.comment ?? '',
        }));
        setRows(mapped);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load price breaks');
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [eventId, account, valuationDt]);

  // ── Inline Edit Handlers ───────────────────────────────────

  const handleCategoryChange = useCallback(
    (assetId: string, category: ResolutionBreakCategory) => {
      if (!eventId) return;
      setRows((prev) =>
        prev.map((r) => (r.assetId === assetId ? { ...r, breakCategory: category } : r))
      );
      updateBreakCategory(assetId, { eventId, breakCategory: category, changedBy: 'current-user' }).catch(() => {});
    },
    [eventId]
  );

  const handleTeamChange = useCallback(
    (assetId: string, team: BreakTeam) => {
      if (!eventId) return;
      setRows((prev) =>
        prev.map((r) => (r.assetId === assetId ? { ...r, breakTeam: team, breakOwner: '' } : r))
      );
      updateBreakTeam(assetId, { eventId, assignedTeam: team, changedBy: 'current-user' }).catch(() => {});
    },
    [eventId]
  );

  const handleOwnerChange = useCallback(
    (assetId: string, owner: string) => {
      if (!eventId) return;
      setRows((prev) =>
        prev.map((r) => (r.assetId === assetId ? { ...r, breakOwner: owner } : r))
      );
      const row = rows.find((r) => r.assetId === assetId);
      if (row && row.breakTeam) {
        updateBreakTeam(assetId, { eventId, assignedTeam: row.breakTeam, assignedOwner: owner, changedBy: 'current-user' }).catch(() => {});
      }
    },
    [eventId, rows]
  );

  // ── Column Definitions ─────────────────────────────────────

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  const columnDefs: ColDef<PriceBreakRow>[] = useMemo(
    () => [
      { field: 'assetId', headerName: 'Asset ID', width: 120 },
      { field: 'securityType', headerName: 'Security Type', width: 110 },
      { field: 'issueDescription', headerName: 'Issue Description', flex: 1, minWidth: 180 },
      {
        field: 'bnyPrice',
        headerName: 'BNY Price',
        width: 120,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value, 6),
      },
      {
        field: 'incumbentPrice',
        headerName: 'Incumbent Price',
        width: 140,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value, 6),
      },
      {
        field: 'priceDiff',
        headerName: 'Price Diff',
        width: 120,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value, 6),
        cellStyle: (p) => (p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null),
      },
      {
        field: 'priceDiffPct',
        headerName: '% Price Diff',
        width: 120,
        type: 'numericColumn',
        valueFormatter: (p) => (p.value != null ? `${p.value.toFixed(4)}%` : ''),
        cellStyle: (p) => (p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null),
      },
      {
        field: 'bnyMarketValue',
        headerName: 'BNY MV',
        width: 140,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value),
      },
      {
        field: 'incumbentMarketValue',
        headerName: 'Incumbent MV',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value),
      },
      {
        field: 'marketValueDiff',
        headerName: 'MV Diff',
        width: 120,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value),
        cellStyle: (p) => (p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null),
      },
      {
        field: 'breakCategory',
        headerName: 'Break Category',
        width: 190,
        cellRenderer: (params: any) => (
          <BreakCategorySelector
            value={params.value}
            onChange={(cat) => handleCategoryChange(params.data.assetId, cat)}
            size="small"
          />
        ),
        sortable: false,
        filter: false,
      },
      {
        field: 'breakTeam',
        headerName: 'Break Team',
        width: 310,
        cellRenderer: (params: any) => (
          <BreakTeamDropdown
            team={params.data.breakTeam}
            owner={params.data.breakOwner}
            onTeamChange={(team) => handleTeamChange(params.data.assetId, team)}
            onOwnerChange={(owner) => handleOwnerChange(params.data.assetId, owner)}
            size="small"
          />
        ),
        sortable: false,
        filter: false,
      },
      {
        field: 'breakOwner',
        headerName: 'Break Owner',
        width: 130,
      },
      {
        field: 'comment',
        headerName: 'Comment',
        flex: 1,
        minWidth: 150,
        editable: true,
      },
    ],
    [handleCategoryChange, handleTeamChange, handleOwnerChange]
  );

  // ── Summary Stats ──────────────────────────────────────────

  const stats = useMemo(() => {
    const total = rows.length;
    const withDiff = rows.filter((r) => r.priceDiff !== 0).length;
    const maxPctDiff = rows.reduce((max, r) => Math.max(max, Math.abs(r.priceDiffPct ?? 0)), 0);
    const totalMVDiff = rows.reduce((sum, r) => sum + (r.marketValueDiff ?? 0), 0);
    return { total, withDiff, maxPctDiff, totalMVDiff };
  }, [rows]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }} role="main" aria-label="Positions Price Breaks">
      {/* Context Header */}
      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
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
            <Typography variant="caption" color="text.secondary">Total Positions</Typography>
            <Typography variant="body1" fontWeight={600}>{stats.total}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">With Price Diff</Typography>
            <Typography variant="body1" fontWeight={600} color={stats.withDiff > 0 ? 'error.main' : 'text.primary'}>
              {stats.withDiff}
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Max % Diff</Typography>
            <Typography variant="body1" fontWeight={600} color={stats.maxPctDiff > 0 ? 'error.main' : 'text.primary'}>
              {stats.maxPctDiff.toFixed(4)}%
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Total MV Diff</Typography>
            <Typography variant="body1" fontWeight={600} color={stats.totalMVDiff !== 0 ? 'error.main' : 'text.primary'}>
              ${formatNumber(stats.totalMVDiff)}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* Grid */}
      <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="Price breaks data grid">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading price breaks data" />
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
            <AgGridReact<PriceBreakRow>
              modules={[AllCommunityModule]}
              theme="legacy"
              rowData={rows}
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
