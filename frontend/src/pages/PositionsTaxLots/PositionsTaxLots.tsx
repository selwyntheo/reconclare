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
  Chip,
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { fetchPositionTaxLots } from '../../services/api';
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

// ── Row Type ─────────────────────────────────────────────────

interface TaxLotRow {
  primaryAssetId: string;
  assetId: string;
  issueDescription: string;
  lotTradeDate: string;
  lotSettleDate: string;
  bnyShares: number;
  incumbentShares: number;
  bnyCostBase: number;
  incumbentCostBase: number;
  bnyMarketValue: number;
  incumbentMarketValue: number;
  gainLoss: number;
  breakCategory: ResolutionBreakCategory | '';
  breakTeam: BreakTeam | '';
  breakOwner: string;
  isTieOutRow?: boolean;
  tieOutStatus?: 'PASS' | 'FAIL';
}

// ── Component ────────────────────────────────────────────────

export default function PositionsTaxLots() {
  const { eventId, account } = useParams<{ eventId: string; account: string }>();
  const location = useLocation();
  const valuationDt = new URLSearchParams(location.search).get('valuationDt') || '';

  const [rawRows, setRawRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data Fetch ─────────────────────────────────────────────

  useEffect(() => {
    if (!eventId || !account || !valuationDt) return;
    setLoading(true);
    setError(null);
    fetchPositionTaxLots(eventId, account, valuationDt)
      .then((data: any[]) => setRawRows(data))
      .catch((err) => {
        setError(err.message || 'Failed to load tax lots');
        setRawRows([]);
      })
      .finally(() => setLoading(false));
  }, [eventId, account, valuationDt]);

  // ── Build rows with tie-out rows injected per asset group ──

  const rows: TaxLotRow[] = useMemo(() => {
    if (rawRows.length === 0) return [];

    const mapped: TaxLotRow[] = rawRows.map((d) => ({
      primaryAssetId: d.primaryAssetId ?? d.assetId ?? '',
      assetId: d.assetId ?? '',
      issueDescription: d.issueDescription ?? '',
      lotTradeDate: d.lotTradeDate ?? '',
      lotSettleDate: d.lotSettleDate ?? '',
      bnyShares: d.bnyShares ?? 0,
      incumbentShares: d.incumbentShares ?? 0,
      bnyCostBase: d.bnyCostBase ?? 0,
      incumbentCostBase: d.incumbentCostBase ?? 0,
      bnyMarketValue: d.bnyMarketValue ?? 0,
      incumbentMarketValue: d.incumbentMarketValue ?? 0,
      gainLoss: (d.bnyMarketValue ?? 0) - (d.bnyCostBase ?? 0),
      breakCategory: d.breakCategory ?? '',
      breakTeam: d.breakTeam ?? '',
      breakOwner: d.breakOwner ?? '',
    }));

    // Group by primaryAssetId and add tie-out rows
    const grouped = new Map<string, TaxLotRow[]>();
    mapped.forEach((row) => {
      const key = row.primaryAssetId;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    });

    const result: TaxLotRow[] = [];
    grouped.forEach((lots, primaryAssetId) => {
      // Add lot rows
      result.push(...lots);

      // Compute tie-out row: sum of lot values vs position-level
      const sumBnyShares = lots.reduce((s, l) => s + l.bnyShares, 0);
      const sumIncShares = lots.reduce((s, l) => s + l.incumbentShares, 0);
      const sumBnyCost = lots.reduce((s, l) => s + l.bnyCostBase, 0);
      const sumIncCost = lots.reduce((s, l) => s + l.incumbentCostBase, 0);
      const sumBnyMV = lots.reduce((s, l) => s + l.bnyMarketValue, 0);
      const sumIncMV = lots.reduce((s, l) => s + l.incumbentMarketValue, 0);

      // Position-level values are expected on the first row (or could be fetched separately)
      // For tie-out, we compare BNY lots sum to Incumbent lots sum
      const sharesDiff = Math.abs(sumBnyShares - sumIncShares);
      const costDiff = Math.abs(sumBnyCost - sumIncCost);
      const mvDiff = Math.abs(sumBnyMV - sumIncMV);
      const tieOutPass = sharesDiff < 0.0001 && costDiff < 0.01 && mvDiff < 0.01;

      result.push({
        primaryAssetId,
        assetId: `${primaryAssetId} (Tie-Out)`,
        issueDescription: tieOutPass ? 'Lot totals tie out' : 'Lot totals DO NOT tie out',
        lotTradeDate: '',
        lotSettleDate: '',
        bnyShares: sumBnyShares,
        incumbentShares: sumIncShares,
        bnyCostBase: sumBnyCost,
        incumbentCostBase: sumIncCost,
        bnyMarketValue: sumBnyMV,
        incumbentMarketValue: sumIncMV,
        gainLoss: sumBnyMV - sumBnyCost,
        breakCategory: '',
        breakTeam: '',
        breakOwner: '',
        isTieOutRow: true,
        tieOutStatus: tieOutPass ? 'PASS' : 'FAIL',
      });
    });

    return result;
  }, [rawRows]);

  // ── Inline Edit Handlers ───────────────────────────────────

  const handleCategoryChange = useCallback(
    (assetId: string, category: ResolutionBreakCategory) => {
      if (!eventId) return;
      setRawRows((prev) =>
        prev.map((r) => (r.assetId === assetId ? { ...r, breakCategory: category } : r))
      );
      updateBreakCategory(assetId, { eventId, breakCategory: category, changedBy: 'current-user' }).catch(() => {});
    },
    [eventId]
  );

  const handleTeamChange = useCallback(
    (assetId: string, team: BreakTeam) => {
      if (!eventId) return;
      setRawRows((prev) =>
        prev.map((r) => (r.assetId === assetId ? { ...r, breakTeam: team, breakOwner: '' } : r))
      );
      updateBreakTeam(assetId, { eventId, assignedTeam: team, changedBy: 'current-user' }).catch(() => {});
    },
    [eventId]
  );

  const handleOwnerChange = useCallback(
    (assetId: string, owner: string) => {
      if (!eventId) return;
      setRawRows((prev) =>
        prev.map((r) => (r.assetId === assetId ? { ...r, breakOwner: owner } : r))
      );
      const row = rawRows.find((r) => r.assetId === assetId);
      if (row && row.breakTeam) {
        updateBreakTeam(assetId, { eventId, assignedTeam: row.breakTeam, assignedOwner: owner, changedBy: 'current-user' }).catch(() => {});
      }
    },
    [eventId, rawRows]
  );

  // ── Column Definitions ─────────────────────────────────────

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  const columnDefs: ColDef<TaxLotRow>[] = useMemo(
    () => [
      {
        field: 'primaryAssetId',
        headerName: 'Asset ID',
        width: 140,
        rowGroup: true,
        hide: true,
      },
      {
        field: 'assetId',
        headerName: 'Asset ID',
        width: 160,
        cellStyle: (p) => (p.data?.isTieOutRow ? { fontWeight: 700, fontStyle: 'italic' } : null),
      },
      {
        field: 'issueDescription',
        headerName: 'Issue Description',
        flex: 1,
        minWidth: 180,
        cellRenderer: (params: any) => {
          if (params.data?.isTieOutRow) {
            const status = params.data.tieOutStatus;
            return (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={status}
                  size="small"
                  sx={{
                    bgcolor: status === 'PASS' ? '#E8F5E9' : '#FFEBEE',
                    color: status === 'PASS' ? '#2E7D32' : '#C62828',
                    fontWeight: 700,
                  }}
                />
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                  {params.value}
                </Typography>
              </Stack>
            );
          }
          return params.value;
        },
      },
      { field: 'lotTradeDate', headerName: 'Lot Trade Date', width: 130 },
      { field: 'lotSettleDate', headerName: 'Lot Settle Date', width: 130 },
      {
        field: 'bnyShares',
        headerName: 'BNY Shares',
        width: 130,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value, 4),
        cellStyle: (p) => (p.data?.isTieOutRow ? { fontWeight: 700 } : null),
      },
      {
        field: 'incumbentShares',
        headerName: 'Incumbent Shares',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value, 4),
        cellStyle: (p) => (p.data?.isTieOutRow ? { fontWeight: 700 } : null),
      },
      {
        field: 'bnyCostBase',
        headerName: 'BNY Cost Base',
        width: 140,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value),
        cellStyle: (p) => (p.data?.isTieOutRow ? { fontWeight: 700 } : null),
      },
      {
        field: 'incumbentCostBase',
        headerName: 'Incumbent Cost Base',
        width: 160,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value),
        cellStyle: (p) => (p.data?.isTieOutRow ? { fontWeight: 700 } : null),
      },
      {
        field: 'bnyMarketValue',
        headerName: 'BNY Market Value',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value),
        cellStyle: (p) => (p.data?.isTieOutRow ? { fontWeight: 700 } : null),
      },
      {
        field: 'incumbentMarketValue',
        headerName: 'Incumbent Market Value',
        width: 170,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value),
        cellStyle: (p) => (p.data?.isTieOutRow ? { fontWeight: 700 } : null),
      },
      {
        field: 'gainLoss',
        headerName: 'Gain/Loss',
        width: 130,
        type: 'numericColumn',
        valueFormatter: (p) => formatNumber(p.value),
        cellStyle: (p) => {
          const styles: Record<string, string | number> = {};
          if (p.value != null && p.value < 0) styles.color = '#d32f2f';
          if (p.data?.isTieOutRow) styles.fontWeight = 700;
          return Object.keys(styles).length > 0 ? styles : null;
        },
      },
      {
        field: 'breakCategory',
        headerName: 'Break Category',
        width: 190,
        cellRenderer: (params: any) => {
          if (params.data?.isTieOutRow) return null;
          return (
            <BreakCategorySelector
              value={params.value}
              onChange={(cat) => handleCategoryChange(params.data.assetId, cat)}
              size="small"
            />
          );
        },
        sortable: false,
        filter: false,
      },
      {
        field: 'breakTeam',
        headerName: 'Break Team',
        width: 310,
        cellRenderer: (params: any) => {
          if (params.data?.isTieOutRow) return null;
          return (
            <BreakTeamDropdown
              team={params.data.breakTeam}
              owner={params.data.breakOwner}
              onTeamChange={(team) => handleTeamChange(params.data.assetId, team)}
              onOwnerChange={(owner) => handleOwnerChange(params.data.assetId, owner)}
              size="small"
            />
          );
        },
        sortable: false,
        filter: false,
      },
      {
        field: 'breakOwner',
        headerName: 'Break Owner',
        width: 130,
      },
    ],
    [handleCategoryChange, handleTeamChange, handleOwnerChange]
  );

  // ── Summary Stats ──────────────────────────────────────────

  const stats = useMemo(() => {
    const lotRows = rows.filter((r) => !r.isTieOutRow);
    const tieOutRows = rows.filter((r) => r.isTieOutRow);
    const totalLots = lotRows.length;
    const uniqueAssets = new Set(lotRows.map((r) => r.primaryAssetId)).size;
    const passCount = tieOutRows.filter((r) => r.tieOutStatus === 'PASS').length;
    const failCount = tieOutRows.filter((r) => r.tieOutStatus === 'FAIL').length;
    return { totalLots, uniqueAssets, passCount, failCount };
  }, [rows]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }} role="main" aria-label="Positions Tax Lots">
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
            <Typography variant="caption" color="text.secondary">Unique Assets</Typography>
            <Typography variant="body1" fontWeight={600}>{stats.uniqueAssets}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Total Lots</Typography>
            <Typography variant="body1" fontWeight={600}>{stats.totalLots}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Tie-Out Results</Typography>
            <Typography variant="body1" fontWeight={600}>
              <span style={{ color: '#2E7D32' }}>{stats.passCount} PASS</span>
              {stats.failCount > 0 && (
                <>
                  {' / '}
                  <span style={{ color: '#C62828' }}>{stats.failCount} FAIL</span>
                </>
              )}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* Grid */}
      <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="Tax lots data grid">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading tax lots data" />
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
              '& .tie-out-row': {
                backgroundColor: '#f5f5f5',
                borderTop: '2px solid #bdbdbd',
              },
            }}
          >
            <AgGridReact<TaxLotRow>
              modules={[AllCommunityModule]}
              theme="legacy"
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows
              getRowId={(params) => `${params.data.primaryAssetId}-${params.data.assetId}-${params.data.lotTradeDate}`}
              getRowClass={(params) => (params.data?.isTieOutRow ? 'tie-out-row' : undefined)}
              groupDefaultExpanded={1}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
