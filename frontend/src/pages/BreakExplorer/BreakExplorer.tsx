import React, { useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  Stack,
  Paper,
  useTheme,
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef, ICellRendererParams, RowClickedEvent, RowStyle } from 'ag-grid-community';
import { breaks } from '../../data/mockData';
import { Break, BreakSeverity, BreakStatus } from '../../types';

ModuleRegistry.registerModules([AllCommunityModule]);

const severityColorMap: Record<BreakSeverity, 'error' | 'warning' | 'info' | 'success'> = {
  critical: 'error',
  high: 'warning',
  medium: 'info',
  low: 'success',
};

const statusColorMap: Record<BreakStatus, 'error' | 'warning' | 'info' | 'success'> = {
  open: 'error',
  investigating: 'warning',
  resolved: 'success',
  closed: 'info',
};

const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);

// ── Cell Renderers ─────────────────────────────────────────
const SeverityCellRenderer: React.FC<ICellRendererParams> = ({ value }) => (
  <Chip
    label={value}
    size="small"
    color={severityColorMap[value as BreakSeverity] || 'default'}
    sx={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.7rem' }}
  />
);

const StatusCellRenderer: React.FC<ICellRendererParams> = ({ value }) => (
  <Chip
    label={value}
    size="small"
    variant="outlined"
    color={statusColorMap[value as BreakStatus] || 'default'}
    sx={{ textTransform: 'capitalize', fontSize: '0.7rem' }}
  />
);

const ConfidenceCellRenderer: React.FC<ICellRendererParams> = ({ value }) => {
  const pct = (value * 100).toFixed(0);
  return (
    <Chip
      label={`${pct}%`}
      size="small"
      color={value >= 0.85 ? 'success' : value >= 0.7 ? 'warning' : 'default'}
      sx={{ fontWeight: 600, minWidth: 48, fontSize: '0.7rem' }}
    />
  );
};

const BreakTypeCellRenderer: React.FC<ICellRendererParams> = ({ value }) => (
  <Chip
    label={String(value).replace('_', ' ')}
    size="small"
    variant="outlined"
    sx={{ textTransform: 'capitalize', fontSize: '0.7rem' }}
  />
);

const VarianceCellRenderer: React.FC<ICellRendererParams> = ({ value }) => (
  <span style={{ color: value < 0 ? '#D32F2F' : '#1A1A2E', fontWeight: 600 }}>
    {formatCurrency(value)}
  </span>
);

const VarianceLocalCellRenderer: React.FC<ICellRendererParams> = ({ value, data }) => (
  <span style={{ color: '#5A6178' }}>
    {formatCurrency(value)} {data?.currency}
  </span>
);

const IdCellRenderer: React.FC<ICellRendererParams> = ({ value }) => (
  <span style={{ color: '#1B3A5C', fontWeight: 600 }}>{value}</span>
);

// ── Main Component ─────────────────────────────────────────
const BreakExplorer: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const gridRef = useRef<AgGridReact>(null);

  const columnDefs = useMemo<ColDef<Break>[]>(
    () => [
      {
        headerName: 'ID',
        field: 'id',
        width: 110,
        pinned: 'left',
        cellRenderer: IdCellRenderer,
        filter: 'agTextColumnFilter',
      },
      {
        headerName: 'Fund',
        field: 'fund',
        minWidth: 180,
        filter: 'agTextColumnFilter',
        cellStyle: { fontWeight: 500 },
      },
      {
        headerName: 'Date',
        field: 'date',
        width: 120,
        filter: 'agDateColumnFilter',
      },
      {
        headerName: 'Component',
        field: 'component',
        minWidth: 150,
        filter: 'agTextColumnFilter',
      },
      {
        headerName: 'Account Group',
        field: 'accountGroup',
        minWidth: 180,
        filter: 'agTextColumnFilter',
      },
      {
        headerName: 'Variance (Base)',
        field: 'varianceBase',
        width: 150,
        type: 'rightAligned',
        cellRenderer: VarianceCellRenderer,
        filter: 'agNumberColumnFilter',
        sort: 'asc',
        comparator: (a: number, b: number) => Math.abs(a) - Math.abs(b),
      },
      {
        headerName: 'Variance (Local)',
        field: 'varianceLocal',
        width: 160,
        type: 'rightAligned',
        cellRenderer: VarianceLocalCellRenderer,
        filter: 'agNumberColumnFilter',
      },
      {
        headerName: 'Break Type',
        field: 'breakType',
        width: 140,
        cellRenderer: BreakTypeCellRenderer,
        filter: 'agSetColumnFilter',
      },
      {
        headerName: 'Confidence',
        field: 'confidence',
        width: 120,
        cellRenderer: ConfidenceCellRenderer,
        filter: 'agNumberColumnFilter',
      },
      {
        headerName: 'Severity',
        field: 'severity',
        width: 120,
        cellRenderer: SeverityCellRenderer,
        filter: 'agSetColumnFilter',
        comparator: (a: string, b: string) =>
          (severityOrder[a] || 0) - (severityOrder[b] || 0),
      },
      {
        headerName: 'Status',
        field: 'status',
        width: 130,
        cellRenderer: StatusCellRenderer,
        filter: 'agSetColumnFilter',
      },
      {
        headerName: 'Top Candidate Cause',
        field: 'topCandidateCause',
        minWidth: 280,
        flex: 1,
        filter: 'agTextColumnFilter',
        tooltipField: 'topCandidateCause',
      },
      {
        headerName: 'Age',
        field: 'ageDays',
        width: 80,
        filter: 'agNumberColumnFilter',
        valueFormatter: (params: any) => `${params.value}d`,
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
      floatingFilter: true,
      suppressHeaderMenuButton: false,
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.8125rem',
        fontFamily: '"Inter", "Roboto", sans-serif',
      },
    }),
    []
  );

  const onRowClicked = useCallback(
    (event: RowClickedEvent<Break>) => {
      if (event.data) {
        navigate(`/investigate?breakId=${event.data.id}`);
      }
    },
    [navigate]
  );

  return (
    <Box>
      {/* ── Header ──────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Break Explorer
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography variant="subtitle1">
            {breaks.length} breaks
          </Typography>
          <Chip
            label={`${breaks.filter((b) => b.severity === 'critical').length} critical`}
            size="small"
            color="error"
            sx={{ fontWeight: 600 }}
          />
          <Chip
            label={`${breaks.filter((b) => b.status === 'open').length} open`}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        </Stack>
      </Box>

      {/* ── AG Grid ─────────────────────────────────── */}
      <Paper
        sx={{
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
          height: 'calc(100vh - 220px)',
          minHeight: 400,
        }}
      >
        <AgGridReact<Break>
          ref={gridRef}
          rowData={breaks}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onRowClicked={onRowClicked}
          rowSelection="single"
          animateRows={true}
          pagination={true}
          paginationPageSize={20}
          paginationPageSizeSelector={[10, 20, 50, 100]}
          enableCellTextSelection={true}
          tooltipShowDelay={300}
          rowHeight={42}
          headerHeight={40}
          floatingFiltersHeight={36}
          getRowStyle={(params): RowStyle | undefined => {
            if (params.data?.severity === 'critical') {
              return { borderLeft: '3px solid #D32F2F', cursor: 'pointer' };
            }
            return { cursor: 'pointer' };
          }}
        />
      </Paper>
    </Box>
  );
};

export default BreakExplorer;
