/**
 * Data Mapping List Page
 * Lists all mapping definitions with status, tags, and CRUD actions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Stack,
  TextField,
  IconButton,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  alpha,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TransformIcon from '@mui/icons-material/Transform';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule } from 'ag-grid-community';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
  fetchMappings,
  deleteMapping,
  cloneMapping,
  approveMapping,
} from '../../services/api';
import type { MappingDefinition, MappingStatus } from '../../types/mapping';

const STATUS_COLORS: Record<MappingStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DRAFT: 'default',
  VALIDATED: 'info',
  APPROVED: 'warning',
  ACTIVE: 'success',
  ARCHIVED: 'error',
};

const DataMappingList: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [mappings, setMappings] = useState<MappingDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; mapping: MappingDefinition | null }>({
    open: false, mapping: null,
  });

  const loadMappings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMappings({
        status: statusFilter || undefined,
        search: searchText || undefined,
        limit: 200,
      });
      setMappings(result.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load mappings');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchText]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const handleDelete = async () => {
    if (!deleteDialog.mapping) return;
    try {
      await deleteMapping(deleteDialog.mapping.mappingId);
      setSnackbar({ open: true, message: 'Mapping deleted', severity: 'success' });
      setDeleteDialog({ open: false, mapping: null });
      loadMappings();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleClone = async (mappingId: string) => {
    try {
      const cloned = await cloneMapping(mappingId);
      setSnackbar({ open: true, message: `Cloned as "${cloned.name}"`, severity: 'success' });
      loadMappings();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleApprove = async (mappingId: string) => {
    try {
      await approveMapping(mappingId, 'current-user');
      setSnackbar({ open: true, message: 'Mapping approved', severity: 'success' });
      loadMappings();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const columnDefs: ColDef[] = [
    {
      headerName: 'Name',
      field: 'name',
      flex: 2,
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams) => (
        <Box
          sx={{ cursor: 'pointer', color: theme.palette.primary.main, fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}
          onClick={() => navigate(`/data-mapping/${params.data.mappingId}`)}
        >
          {params.value}
        </Box>
      ),
    },
    {
      headerName: 'Status',
      field: 'status',
      width: 130,
      cellRenderer: (params: ICellRendererParams) => (
        <Chip
          label={params.value}
          color={STATUS_COLORS[params.value as MappingStatus] || 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      headerName: 'Source',
      field: 'source.format',
      width: 100,
      valueGetter: (params: any) => params.data?.source?.format || '',
    },
    {
      headerName: 'Target',
      field: 'target.format',
      width: 100,
      valueGetter: (params: any) => params.data?.target?.format || '',
    },
    {
      headerName: 'Fields',
      width: 80,
      valueGetter: (params: any) => params.data?.fieldMappings?.length || 0,
    },
    {
      headerName: 'Version',
      field: 'version',
      width: 90,
    },
    {
      headerName: 'Tags',
      field: 'tags',
      flex: 1,
      minWidth: 150,
      cellRenderer: (params: ICellRendererParams) => (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', py: 0.5 }}>
          {(params.value || []).map((tag: string) => (
            <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
          ))}
        </Stack>
      ),
    },
    {
      headerName: 'Updated',
      field: 'updatedAt',
      width: 160,
      valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleString() : '',
    },
    {
      headerName: 'Actions',
      width: 180,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams) => {
        const m = params.data as MappingDefinition;
        return (
          <Stack direction="row" spacing={0}>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => navigate(`/data-mapping/${m.mappingId}`)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clone">
              <IconButton size="small" onClick={() => handleClone(m.mappingId)}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {m.status === 'VALIDATED' && (
              <Tooltip title="Approve">
                <IconButton size="small" color="success" onClick={() => handleApprove(m.mappingId)}>
                  <CheckCircleIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {(m.status === 'APPROVED' || m.status === 'ACTIVE') && (
              <Tooltip title="Execute">
                <IconButton size="small" color="primary" onClick={() => navigate(`/data-mapping/${m.mappingId}?tab=execute`)}>
                  <PlayArrowIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, mapping: m })}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <TransformIcon sx={{ fontSize: 28, color: theme.palette.primary.main }} />
          <Typography variant="h5" fontWeight={600}>Data Mapping Utility</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/data-mapping/new')}>
          New Mapping
        </Button>
      </Stack>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              size="small"
              placeholder="Search mappings..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadMappings()}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              }}
              sx={{ width: 300 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="VALIDATED">Validated</MenuItem>
                <MenuItem value="APPROVED">Approved</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="ARCHIVED">Archived</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Refresh">
              <IconButton onClick={loadMappings}><RefreshIcon /></IconButton>
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>

      {/* Error */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Grid */}
      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box className="ag-theme-alpine" sx={{ height: 'calc(100vh - 280px)', width: '100%' }}>
              <AgGridReact
                modules={[AllCommunityModule]}
                rowData={mappings}
                columnDefs={columnDefs}
                defaultColDef={{ sortable: true, filter: true, resizable: true }}
                animateRows
                rowHeight={48}
                headerHeight={44}
                suppressCellFocus
                getRowId={(params) => params.data.mappingId}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, mapping: null })}>
        <DialogTitle>Delete Mapping</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteDialog.mapping?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, mapping: null })}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DataMappingList;
