import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

import { useAuth } from '../../context/AuthContext';
import { canOverrideKD } from '../../config/permissions';
import { fetchRagTracker } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';

// ── Types ──────────────────────────────────────────────────

interface RagTrackerData {
  funds: RagFundRow[];
  dates: string[];
}

interface RagFundRow {
  fund: string;
  fundName: string;
  [dateKey: string]: any; // dynamic date columns holding BP values
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
  return { backgroundColor: bg, fontWeight: '600', textAlign: 'center' };
}

// ── Formatters ─────────────────────────────────────────────

const formatBP = (v: number | null | undefined) => {
  if (v == null) return '';
  return `${v.toFixed(2)}`;
};

const formatDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

// ── Component ──────────────────────────────────────────────

export default function NavRagTracker() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { role, permissions } = useAuth();

  const [data, setData] = useState<RagTrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Data Fetch ─────────────────────────────────────────

  const normalizeResult = useCallback((result: any): RagTrackerData => {
    if (Array.isArray(result)) {
      const allKeys = result.length > 0 ? Object.keys(result[0]) : [];
      const dates = allKeys.filter((k) => k !== 'fund' && k !== 'fundName');
      return { funds: result as RagFundRow[], dates };
    }
    return result as RagTrackerData;
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    fetchRagTracker(eventId)
      .then((result) => {
        setData(normalizeResult(result));
      })
      .catch((err) => {
        setError(err.message || 'Failed to load RAG tracker data');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [eventId, normalizeResult]);

  // ── WebSocket Auto-Refresh ─────────────────────────────

  useWebSocket({
    eventId: eventId || '',
    enabled: !!eventId,
    onMessage: (msg) => {
      if (msg.type === 'KD_OVERRIDE' || msg.type === 'BREAK_UPDATED') {
        // Re-fetch data
        fetchRagTracker(eventId!)
          .then((result) => {
            setData(normalizeResult(result));
          })
          .catch(() => {});
      }
    },
  });

  // ── Column Definitions (fund rows x date columns) ─────

  const defaultColDef = useMemo(() => ({ sortable: true, filter: true, resizable: true }), []);

  const columnDefs: ColDef<RagFundRow>[] = useMemo(() => {
    const dates = data?.dates || [];

    // Static fund columns
    const fundCols: ColDef<RagFundRow>[] = [
      { field: 'fund', headerName: 'Fund', width: 120, pinned: 'left' },
      { field: 'fundName', headerName: 'Fund Name', width: 200, pinned: 'left' },
    ];

    // Dynamic date columns
    const dateCols: ColDef<RagFundRow>[] = dates.map((dateStr) => ({
      headerName: formatDate(dateStr),
      field: dateStr,
      width: 100,
      type: 'numericColumn',
      valueFormatter: (p) => formatBP(p.value),
      cellStyle: ragCellStyle,
    }));

    return [...fundCols, ...dateCols];
  }, [data]);

  // ── Summary Stats ─────────────────────────────────────

  const summaryStats = useMemo(() => {
    if (!data) return { totalFunds: 0, totalDates: 0, greenPct: 0, amberPct: 0, redPct: 0 };

    const totalFunds = data.funds.length;
    const totalDates = data.dates.length;
    let greenCount = 0;
    let amberCount = 0;
    let redCount = 0;
    let totalCells = 0;

    data.funds.forEach((fund) => {
      data.dates.forEach((dateStr) => {
        const val = fund[dateStr];
        if (val != null) {
          totalCells++;
          const absBP = Math.abs(val);
          if (absBP <= 5) greenCount++;
          else if (absBP <= 50) amberCount++;
          else redCount++;
        }
      });
    });

    return {
      totalFunds,
      totalDates,
      greenPct: totalCells > 0 ? Math.round((greenCount / totalCells) * 100) : 0,
      amberPct: totalCells > 0 ? Math.round((amberCount / totalCells) * 100) : 0,
      redPct: totalCells > 0 ? Math.round((redCount / totalCells) * 100) : 0,
    };
  }, [data]);

  // ── Render ────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }} role="main" aria-label="NAV RAG Tracker">
      {/* Context Header */}
      <Paper sx={{ p: 2, mb: 2 }} elevation={1}>
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
          <Box>
            <Typography variant="caption" color="text.secondary">Event</Typography>
            <Typography variant="body1" fontWeight={600}>{eventId || '--'}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Funds</Typography>
            <Typography variant="body1" fontWeight={600}>{summaryStats.totalFunds}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Date Range</Typography>
            <Typography variant="body1" fontWeight={600}>
              {data?.dates.length
                ? `${formatDate(data.dates[0])} - ${formatDate(data.dates[data.dates.length - 1])}`
                : '--'}
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Role</Typography>
            <Typography variant="body1" fontWeight={600}>{permissions.label}</Typography>
          </Box>
        </Stack>
      </Paper>

      {/* RAG Legend */}
      <Paper sx={{ p: 1.5, mb: 2 }} elevation={0} variant="outlined">
        <Stack direction="row" spacing={3} alignItems="center">
          <Typography variant="caption" fontWeight={600}>RAG Legend (Adjusted BP):</Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 16, height: 16, bgcolor: RAG_GREEN, borderRadius: 0.5, border: '1px solid #ccc' }} />
            <Typography variant="caption">|BP| &lt;= 5 (Green)</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 16, height: 16, bgcolor: RAG_AMBER, borderRadius: 0.5, border: '1px solid #ccc' }} />
            <Typography variant="caption">|BP| &lt;= 50 (Amber)</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 16, height: 16, bgcolor: RAG_RED, borderRadius: 0.5, border: '1px solid #ccc' }} />
            <Typography variant="caption">|BP| &gt; 50 (Red)</Typography>
          </Stack>
        </Stack>
      </Paper>

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* RAG Matrix Grid */}
      <Box sx={{ flex: 1, minHeight: 300 }} role="region" aria-label="RAG tracker matrix grid">
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading RAG tracker data" />
          </Box>
        ) : data && data.funds.length > 0 ? (
          <Box
            className="ag-theme-alpine"
            sx={{
              height: '100%',
              width: '100%',
              '& .ag-cell:focus-within': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
            }}
          >
            <AgGridReact<RagFundRow>
              modules={[AllCommunityModule]}
              theme="legacy"
              rowData={data.funds}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows
              getRowId={(params) => params.data.fund}
              onCellClicked={(e) => {
                if (e.colDef.field && e.colDef.field !== 'fund' && e.colDef.field !== 'fundName') {
                  const dateStr = e.colDef.field;
                  navigate(`/events/${eventId}/nav-dashboard/scorecard?valuationDt=${dateStr}`);
                }
              }}
            />
          </Box>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.default' }} elevation={0}>
            <Typography variant="body1" color="text.secondary">
              No RAG tracker data available for this event.
            </Typography>
          </Paper>
        )}
      </Box>

      {/* Summary Footer */}
      <Paper sx={{ p: 2, mt: 1 }} elevation={1}>
        <Stack direction="row" spacing={4} alignItems="center">
          <Box>
            <Typography variant="caption" color="text.secondary">Total Funds</Typography>
            <Typography variant="body2" fontWeight={600}>{summaryStats.totalFunds}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Date Points</Typography>
            <Typography variant="body2" fontWeight={600}>{summaryStats.totalDates}</Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">Green</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: '#2E7D32' }}>
              {summaryStats.greenPct}%
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Amber</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: '#ED6C02' }}>
              {summaryStats.amberPct}%
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Red</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ color: '#d32f2f' }}>
              {summaryStats.redPct}%
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
