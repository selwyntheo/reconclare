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

import { fetchShareBreaks } from '../../services/api';
import BreakCategorySelector from '../../components/shared/BreakCategorySelector';
import BreakTeamDropdown from '../../components/shared/BreakTeamDropdown';
import {
  MatchStatus,
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

const computeMatchStatus = (bnyShares: number, incumbentShares: number): MatchStatus => {
  if (bnyShares === incumbentShares) return 'MATCH';
  if (incumbentShares === 0) return 'BNY_ONLY';
  if (bnyShares === 0) return 'INCUMBENT_ONLY';
  return 'MATCHED_WITH_DIFFERENCES';
};

const MATCH_STATUS_COLORS: Record<MatchStatus, string> = {
  MATCH: '#2E7D32',
  BNY_ONLY: '#1565C0',
  INCUMBENT_ONLY: '#7B1FA2',
  MATCHED_WITH_DIFFERENCES: '#E65100',
};

// ── Row Type ─────────────────────────────────────────────────

interface ShareBreakRow {
  assetId: string;
  securityType: string;
  issueDescription: string;
  cusip: string;
  bnyShares: number;
  incumbentShares: number;
  sharesDiff: number;
  bnyMarketValue: number;
  incumbentMarketValue: number;
  marketValueDiff: number;
  matchStatus: MatchStatus;
  breakCategory: ResolutionBreakCategory | '';
  breakTeam: BreakTeam | '';
  breakOwner: string;
  comment: string;
}

// ── Component ────────────────────────────────────────────────

export default function PositionsShareBreaks() {
  const { eventId, account } = useParams<{ eventId: string; account: string }>();
  const location = useLocation();
  const valuationDt = new URLSearchParams(location.search).get('valuationDt') || '';

  const [rows, setRows] = useState<ShareBreakRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data Fetch ─────────────────────────────────────────────

  useEffect(() => {
    if (!eventId || !account || !valuationDt) return;
    setLoading(true);
    setError(null);
    fetchShareBreaks(eventId, account, valuationDt)
      .then((data: any[]) => {
        const mapped: ShareBreakRow[] = data.map((d) => ({
          ...d,
          matchStatus: computeMatchStatus(d.bnyShares ?? 0, d.incumbentShares ?? 0),
          breakCategory: d.breakCategory ?? '',
          breakTeam: d.breakTeam ?? '',
          breakOwner: d.breakOwner ?? '',
          comment: d.comment ?? '',
        }));
        setRows(mapped);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load share breaks');
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

  const columnDefs: ColDef<ShareBreakRow>[] = useMemo(
    () => [
      { field: 'assetId', headerName: 'Asset ID', width: 120 },
      { field: 'securityType', headerName: 'Security Type', width: 110 },
      { field: 'issueDescription', headerName: 'Issue Description', flex: 1, minWidth: 180 },
      { field: 'cusip', headerName: 'CUSIP', width: 110 },
      {
        field: 'bnyShares',
        headerName: 'BNY Shares',
        width: 130,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value, 4),
      },
      {
        field: 'incumbentShares',
        headerName: 'Incumbent Shares',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value, 4),
      },
      {
        field: 'sharesDiff',
        headerName: 'Shares Diff',
        width: 120,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value, 4),
        cellStyle: (p) => (p.value != null && p.value !== 0 ? { color: '#d32f2f' } : null),
      },
      {
        field: 'bnyMarketValue',
        headerName: 'BNY Market Value',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value),
      },
      {
        field: 'incumbentMarketValue',
        headerName: 'Incumbent Market Value',
        width: 170,
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
        field: 'matchStatus',
        headerName: 'Match Status',
        width: 170,
        cellStyle: (p) => ({
          color: MATCH_STATUS_COLORS[p.value as MatchStatus] || '#000',
          fontWeight: 600,
        }),
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
    const matches = rows.filter((r) => r.matchStatus === 'MATCH').length;
    const breaks = total - matches;
    const totalMVDiff = rows.reduce((sum, r) => sum + (r.marketValueDiff ?? 0), 0);
    return { total, matches, breaks, totalMVDiff };
  }, [rows]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }} role="main" aria-label="Positions Share Breaks">
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
            <Typography variant="caption" color="text.secondary">Matches / Breaks</Typography>
            <Typography variant="body1" fontWeight={600}>
              <span style={{ color: '#2E7D32' }}>{stats.matches}</span>
              {' / '}
              <span style={{ color: stats.breaks > 0 ? '#d32f2f' : undefined }}>{stats.breaks}</span>
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
      <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="Share breaks data grid">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading share breaks data" />
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
            <AgGridReact<ShareBreakRow>
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
