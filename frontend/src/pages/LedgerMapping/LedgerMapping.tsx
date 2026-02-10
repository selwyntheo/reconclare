/**
 * Ledger Mapping Management Page
 * Allows users to view, create, edit, and delete GL account to category mappings
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Chip,
  Stack,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  alpha,
  useTheme,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import {
  fetchGLCategoryMappings,
  fetchLedgerCategories,
  createGLCategoryMapping,
  updateGLCategoryMapping,
  deleteGLCategoryMapping,
} from '../../services/api';
import { GLCategoryMapping, LedgerCategory } from '../../types';

// Ledger sections and BS/INCST options
const LEDGER_SECTIONS = ['ASSETS', 'LIABILITIES', 'EQUITY', 'INCOME', 'EXPENSES'];
const BS_INCST_OPTIONS = ['BS', 'INCST'];

interface MappingFormData {
  chartOfAccounts: string;
  glAccountNumber: string;
  glAccountDescription: string;
  ledgerSection: string;
  bsIncst: 'BS' | 'INCST';
  conversionCategory: string;
}

const emptyForm: MappingFormData = {
  chartOfAccounts: 'investone mufg',
  glAccountNumber: '',
  glAccountDescription: '',
  ledgerSection: 'ASSETS',
  bsIncst: 'BS',
  conversionCategory: '',
};

const LedgerMapping: React.FC = () => {
  const theme = useTheme();
  const [mappings, setMappings] = useState<GLCategoryMapping[]>([]);
  const [categories, setCategories] = useState<LedgerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<MappingFormData>(emptyForm);
  const [originalGlNumber, setOriginalGlNumber] = useState('');

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState<GLCategoryMapping | null>(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mappingsData, categoriesData] = await Promise.all([
        fetchGLCategoryMappings(),
        fetchLedgerCategories(),
      ]);
      setMappings(mappingsData);
      setCategories(categoriesData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setSnackbar({ open: true, message: 'Failed to load data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter mappings
  const filteredMappings = mappings.filter((m) => {
    const matchesSearch =
      searchTerm === '' ||
      m.glAccountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.glAccountDescription.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === '' || m.conversionCategory === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Group by category for display
  const groupedByCategory = filteredMappings.reduce((acc, mapping) => {
    const cat = mapping.conversionCategory;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(mapping);
    return acc;
  }, {} as Record<string, GLCategoryMapping[]>);

  // Handlers
  const handleOpenCreate = () => {
    setFormData(emptyForm);
    setEditMode(false);
    setDialogOpen(true);
  };

  const handleOpenEdit = (mapping: GLCategoryMapping) => {
    setFormData({
      chartOfAccounts: mapping.chartOfAccounts,
      glAccountNumber: mapping.glAccountNumber,
      glAccountDescription: mapping.glAccountDescription,
      ledgerSection: mapping.ledgerSection,
      bsIncst: mapping.bsIncst,
      conversionCategory: mapping.conversionCategory,
    });
    setOriginalGlNumber(mapping.glAccountNumber);
    setEditMode(true);
    setDialogOpen(true);
  };

  const handleOpenDelete = (mapping: GLCategoryMapping) => {
    setMappingToDelete(mapping);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editMode) {
        await updateGLCategoryMapping(originalGlNumber, formData, formData.chartOfAccounts);
        setSnackbar({ open: true, message: 'Mapping updated successfully', severity: 'success' });
      } else {
        await createGLCategoryMapping(formData);
        setSnackbar({ open: true, message: 'Mapping created successfully', severity: 'success' });
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message || 'Operation failed', severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!mappingToDelete) return;
    try {
      await deleteGLCategoryMapping(mappingToDelete.glAccountNumber, mappingToDelete.chartOfAccounts);
      setSnackbar({ open: true, message: 'Mapping deleted successfully', severity: 'success' });
      setDeleteDialogOpen(false);
      setMappingToDelete(null);
      loadData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message || 'Delete failed', severity: 'error' });
    }
  };

  const handleExport = () => {
    const csv = [
      ['Chart of Accounts', 'GL Account Number', 'Description', 'Ledger Section', 'BS/INCST', 'Category'].join(','),
      ...filteredMappings.map((m) =>
        [m.chartOfAccounts, m.glAccountNumber, `"${m.glAccountDescription}"`, m.ledgerSection, m.bsIncst, m.conversionCategory].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gl-category-mappings.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Unique categories from loaded categories or mappings
  const allCategories = Array.from(
    new Set([
      ...categories.map((c) => c.categoryName),
      ...mappings.map((m) => m.conversionCategory),
    ])
  ).sort();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <AccountBalanceWalletIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h5" fontWeight={700}>
              Ledger Mapping Configuration
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Map GL accounts to ledger conversion categories for subledger reconciliation
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData}>
            Refresh
          </Button>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExport}>
            Export CSV
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            Add Mapping
          </Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              size="small"
              placeholder="Search GL accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ minWidth: 280 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Filter by Category"
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="">All Categories</MenuItem>
                {allCategories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ flex: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {filteredMappings.length} of {mappings.length} mappings
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Mappings Table */}
      <Card>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <TableCell sx={{ fontWeight: 600 }}>GL Account</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ledger Section</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>BS/INCST</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center', width: 100 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.keys(groupedByCategory)
                .sort()
                .map((category) => (
                  <React.Fragment key={category}>
                    {/* Category header row */}
                    <TableRow sx={{ bgcolor: alpha(theme.palette.info.main, 0.06) }}>
                      <TableCell colSpan={6}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {category}
                          </Typography>
                          <Chip
                            label={`${groupedByCategory[category].length} accounts`}
                            size="small"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        </Stack>
                      </TableCell>
                    </TableRow>
                    {/* Mapping rows */}
                    {groupedByCategory[category].map((mapping) => (
                      <TableRow
                        key={`${mapping.chartOfAccounts}-${mapping.glAccountNumber}`}
                        hover
                        sx={{ '&:last-child td': { borderBottom: 0 } }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" fontWeight={500}>
                            {mapping.glAccountNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{mapping.glAccountDescription}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={mapping.ledgerSection}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 22 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={mapping.bsIncst}
                            size="small"
                            color={mapping.bsIncst === 'BS' ? 'primary' : 'secondary'}
                            sx={{ fontSize: '0.7rem', height: 22 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {mapping.conversionCategory}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleOpenEdit(mapping)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleOpenDelete(mapping)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              {filteredMappings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="text.secondary">No mappings found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editMode ? 'Edit GL Mapping' : 'Add GL Mapping'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="GL Account Number"
              value={formData.glAccountNumber}
              onChange={(e) => setFormData({ ...formData, glAccountNumber: e.target.value })}
              required
              disabled={editMode}
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.glAccountDescription}
              onChange={(e) => setFormData({ ...formData, glAccountDescription: e.target.value })}
              required
              fullWidth
            />
            <FormControl fullWidth required>
              <InputLabel>Ledger Section</InputLabel>
              <Select
                value={formData.ledgerSection}
                label="Ledger Section"
                onChange={(e) => setFormData({ ...formData, ledgerSection: e.target.value })}
              >
                {LEDGER_SECTIONS.map((section) => (
                  <MenuItem key={section} value={section}>
                    {section}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>BS/INCST</InputLabel>
              <Select
                value={formData.bsIncst}
                label="BS/INCST"
                onChange={(e) => setFormData({ ...formData, bsIncst: e.target.value as 'BS' | 'INCST' })}
              >
                {BS_INCST_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt} - {opt === 'BS' ? 'Balance Sheet' : 'Income Statement'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Conversion Category</InputLabel>
              <Select
                value={formData.conversionCategory}
                label="Conversion Category"
                onChange={(e) => setFormData({ ...formData, conversionCategory: e.target.value })}
              >
                {allCategories.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Chart of Accounts"
              value={formData.chartOfAccounts}
              onChange={(e) => setFormData({ ...formData, chartOfAccounts: e.target.value })}
              fullWidth
              helperText="Default: investone mufg"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!formData.glAccountNumber || !formData.conversionCategory}
          >
            {editMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the mapping for GL account{' '}
            <strong>{mappingToDelete?.glAccountNumber}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LedgerMapping;
