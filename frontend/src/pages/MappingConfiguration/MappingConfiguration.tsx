/**
 * Classification Mapping Configuration Page
 * Manages three classification mapping tables (Section 10):
 * - Asset Classification
 * - Transaction Classification
 * - Ledger Category Derivation
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
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
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
import CategoryIcon from '@mui/icons-material/Category';
import {
  fetchAssetClassifications,
  createAssetClassification,
  updateAssetClassification,
  deleteAssetClassification,
  fetchTransClassifications,
  createTransClassification,
  updateTransClassification,
  deleteTransClassification,
  fetchLedgerCategoryDerivations,
  createLedgerCategoryDerivation,
  updateLedgerCategoryDerivation,
  deleteLedgerCategoryDerivation,
} from '../../services/api';
import {
  AssetClassification,
  TransClassification,
  LedgerCategoryDerivation,
} from '../../types';

// ── Constrained dropdown values (Section 10.6) ──────────────
const CONV_ASSET_CLASSES = ['equity', 'fixedIncome', 'cash', 'future', 'mf', 'swapTrs', 'invalid'];
const CONV_TRANS_CLASSES = [
  'longBuy', 'longSell', 'shortSell', 'buyCover',
  'dividend', 'dividendNeg', 'dividendPosAdj', 'divWHT',
  'coupon', 'shortCoupon', 'reclaim', 'reclaimNeg',
  'securityLending', 'securityLendingNeg',
  'paydown', 'payup', 'futurePay', 'futureRec', 'ignore',
];
const SOURCE_SYSTEMS = ['investone', 'eagle'];

const MappingConfiguration: React.FC = () => {
  const theme = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [sourceFilter, setSourceFilter] = useState('investone');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Data state
  const [assetData, setAssetData] = useState<AssetClassification[]>([]);
  const [transData, setTransData] = useState<TransClassification[]>([]);
  const [derivationData, setDerivationData] = useState<LedgerCategoryDerivation[]>([]);
  const [derivationSubView, setDerivationSubView] = useState<'transaction' | 'asset'>('transaction');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Asset form
  const [assetForm, setAssetForm] = useState<AssetClassification>({
    keySource: 'investone', keySecType: '', convAssetClass: '', glCategoryImpact: '',
  });
  const [origAssetKey, setOrigAssetKey] = useState('');

  // Trans form
  const [transForm, setTransForm] = useState<TransClassification>({
    keySource: 'investone', keyTransCode: '', convTransClass: '', recPayCategory: '',
  });
  const [origTransKey, setOrigTransKey] = useState('');

  // Derivation form
  const [derivationForm, setDerivationForm] = useState<LedgerCategoryDerivation>({
    derivationType: 'transaction',
  });
  const [origDerivationKey, setOrigDerivationKey] = useState('');

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; key: string; source?: string; derivationType?: string } | null>(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [assets, trans, derivations] = await Promise.all([
        fetchAssetClassifications(sourceFilter),
        fetchTransClassifications(sourceFilter),
        fetchLedgerCategoryDerivations(),
      ]);
      setAssetData(assets);
      setTransData(trans);
      setDerivationData(derivations);
    } catch (err) {
      console.error('Failed to load classification data:', err);
      setSnackbar({ open: true, message: 'Failed to load data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [sourceFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Filter helpers ──────────────────────────────────────────
  const filteredAssets = assetData.filter((m) =>
    searchTerm === '' ||
    m.keySecType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.convAssetClass.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.glCategoryImpact.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTrans = transData.filter((m) =>
    searchTerm === '' ||
    m.keyTransCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.convTransClass.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.recPayCategory.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDerivations = derivationData.filter((m) =>
    m.derivationType === derivationSubView
  );

  // ── Dialog handlers ─────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditMode(false);
    if (tabIndex === 0) {
      setAssetForm({ keySource: sourceFilter, keySecType: '', convAssetClass: '', glCategoryImpact: '' });
    } else if (tabIndex === 1) {
      setTransForm({ keySource: sourceFilter, keyTransCode: '', convTransClass: '', recPayCategory: '' });
    } else {
      setDerivationForm({ derivationType: derivationSubView });
    }
    setDialogOpen(true);
  };

  const handleOpenEditAsset = (row: AssetClassification) => {
    setEditMode(true);
    setAssetForm({ ...row });
    setOrigAssetKey(row.keySecType);
    setTabIndex(0);
    setDialogOpen(true);
  };

  const handleOpenEditTrans = (row: TransClassification) => {
    setEditMode(true);
    setTransForm({ ...row });
    setOrigTransKey(row.keyTransCode);
    setTabIndex(1);
    setDialogOpen(true);
  };

  const handleOpenEditDerivation = (row: LedgerCategoryDerivation) => {
    setEditMode(true);
    setDerivationForm({ ...row });
    setOrigDerivationKey(row.derivationType === 'transaction' ? row.convTransClass || '' : row.convAssetClass || '');
    setTabIndex(2);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (tabIndex === 0) {
        if (editMode) {
          await updateAssetClassification(origAssetKey, assetForm, assetForm.keySource);
          setSnackbar({ open: true, message: 'Asset classification updated', severity: 'success' });
        } else {
          await createAssetClassification(assetForm);
          setSnackbar({ open: true, message: 'Asset classification created', severity: 'success' });
        }
      } else if (tabIndex === 1) {
        if (editMode) {
          await updateTransClassification(origTransKey, transForm, transForm.keySource);
          setSnackbar({ open: true, message: 'Transaction classification updated', severity: 'success' });
        } else {
          await createTransClassification(transForm);
          setSnackbar({ open: true, message: 'Transaction classification created', severity: 'success' });
        }
      } else {
        if (editMode) {
          await updateLedgerCategoryDerivation(origDerivationKey, derivationForm, derivationForm.derivationType);
          setSnackbar({ open: true, message: 'Ledger category derivation updated', severity: 'success' });
        } else {
          await createLedgerCategoryDerivation(derivationForm);
          setSnackbar({ open: true, message: 'Ledger category derivation created', severity: 'success' });
        }
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message || 'Operation failed', severity: 'error' });
    }
  };

  const handleOpenDelete = (type: string, key: string, source?: string, derivationType?: string) => {
    setDeleteTarget({ type, key, source, derivationType });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'asset') {
        await deleteAssetClassification(deleteTarget.key, deleteTarget.source || sourceFilter);
      } else if (deleteTarget.type === 'trans') {
        await deleteTransClassification(deleteTarget.key, deleteTarget.source || sourceFilter);
      } else {
        await deleteLedgerCategoryDerivation(deleteTarget.key, deleteTarget.derivationType || 'transaction');
      }
      setSnackbar({ open: true, message: 'Deleted successfully', severity: 'success' });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message || 'Delete failed', severity: 'error' });
    }
  };

  const handleExport = () => {
    let csv = '';
    if (tabIndex === 0) {
      csv = [
        ['Source', 'Sec Type', 'Asset Class', 'GL Category Impact'].join(','),
        ...filteredAssets.map((m) => [m.keySource, m.keySecType, m.convAssetClass, `"${m.glCategoryImpact}"`].join(',')),
      ].join('\n');
    } else if (tabIndex === 1) {
      csv = [
        ['Source', 'Trans Code', 'Trans Class', 'RecPay Category'].join(','),
        ...filteredTrans.map((m) => [m.keySource, m.keyTransCode, m.convTransClass, m.recPayCategory].join(',')),
      ].join('\n');
    } else {
      if (derivationSubView === 'transaction') {
        csv = [
          ['Derivation Type', 'Trans Class', 'Amount Category', 'URGL BS Category', 'Int RecPay Cat', 'Int URGL INCST Cat'].join(','),
          ...filteredDerivations.map((m) => [
            m.derivationType, m.convTransClass || '', m.amntConvCategory || '', m.urglBsConvCategory || '',
            m.intRecPayConvCat || '', m.intUrglIncstConvCat || '',
          ].join(',')),
        ].join('\n');
      } else {
        csv = [
          ['Derivation Type', 'Asset Class', 'Cost Cat', 'URGL BS Cat', 'Daily Margin Cat', 'Int RecPay Cat', 'Int URGL INCST Cat'].join(','),
          ...filteredDerivations.map((m) => [
            m.derivationType, m.convAssetClass || '', m.costConvCat || '', m.urglBsConvCat || '',
            m.dailyMarginCat || '', m.intRecPayCat || '', m.intUrglIncstCat || '',
          ].join(',')),
        ].join('\n');
      }
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classification-mapping-${['asset', 'trans', 'derivation'][tabIndex]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            <CategoryIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h5" fontWeight={700}>
              Classification Mapping Configuration
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Configure asset, transaction, and ledger category derivation mappings per source system
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

      {/* Source System Selector + Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ py: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Source System</InputLabel>
              <Select
                value={sourceFilter}
                label="Source System"
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                {SOURCE_SYSTEMS.map((src) => (
                  <MenuItem key={src} value={src}>{src}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              placeholder="Search mappings..."
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
            <Box sx={{ flex: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {tabIndex === 0 && `${filteredAssets.length} asset mappings`}
              {tabIndex === 1 && `${filteredTrans.length} transaction mappings`}
              {tabIndex === 2 && `${filteredDerivations.length} derivation mappings`}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label="Asset Classification" />
          <Tab label="Transaction Classification" />
          <Tab label="Ledger Category Derivation" />
        </Tabs>

        {/* Tab 0: Asset Classification */}
        {tabIndex === 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Security Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Asset Class</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>GL Category Impact</TableCell>
                  <TableCell sx={{ fontWeight: 600, textAlign: 'center', width: 100 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAssets.map((row) => (
                  <TableRow key={`${row.keySource}-${row.keySecType}`} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">{row.keySource}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{row.keySecType}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.convAssetClass}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{row.glCategoryImpact}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenEditAsset(row)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleOpenDelete('asset', row.keySecType, row.keySource)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAssets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">No asset classification mappings found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Tab 1: Transaction Classification */}
        {tabIndex === 1 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                  <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Trans Code</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Trans Class</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>RecPay Category</TableCell>
                  <TableCell sx={{ fontWeight: 600, textAlign: 'center', width: 100 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTrans.map((row) => (
                  <TableRow key={`${row.keySource}-${row.keyTransCode}`} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">{row.keySource}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{row.keyTransCode}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.convTransClass}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{row.recPayCategory}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenEditTrans(row)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleOpenDelete('trans', row.keyTransCode, row.keySource)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTrans.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography color="text.secondary">No transaction classification mappings found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Tab 2: Ledger Category Derivation */}
        {tabIndex === 2 && (
          <Box>
            <Box sx={{ px: 2, py: 1.5 }}>
              <ToggleButtonGroup
                size="small"
                value={derivationSubView}
                exclusive
                onChange={(_, v) => { if (v) setDerivationSubView(v); }}
              >
                <ToggleButton value="transaction">Transaction-based</ToggleButton>
                <ToggleButton value="asset">Asset-based</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {derivationSubView === 'transaction' ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                      <TableCell sx={{ fontWeight: 600 }}>Trans Class</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Amount Category</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>URGL BS Category</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Int RecPay Cat</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Int URGL INCST Cat</TableCell>
                      <TableCell sx={{ fontWeight: 600, textAlign: 'center', width: 100 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDerivations.map((row) => (
                      <TableRow key={row.convTransClass} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{row.convTransClass}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.amntConvCategory || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.urglBsConvCategory || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.intRecPayConvCat || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.intUrglIncstConvCat || '-'}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleOpenEditDerivation(row)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleOpenDelete('derivation', row.convTransClass || '', undefined, 'transaction')}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredDerivations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4 }}>
                          <Typography color="text.secondary">No transaction-based derivation mappings found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                      <TableCell sx={{ fontWeight: 600 }}>Asset Class</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Cost Cat</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>URGL BS Cat</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Daily Margin Cat</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Int RecPay Cat</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Int URGL INCST Cat</TableCell>
                      <TableCell sx={{ fontWeight: 600, textAlign: 'center', width: 100 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDerivations.map((row) => (
                      <TableRow key={row.convAssetClass} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{row.convAssetClass}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.costConvCat || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.urglBsConvCat || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.dailyMarginCat || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.intRecPayCat || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.intUrglIncstCat || '-'}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleOpenEditDerivation(row)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleOpenDelete('derivation', row.convAssetClass || '', undefined, 'asset')}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredDerivations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                          <Typography color="text.secondary">No asset-based derivation mappings found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Card>

      {/* ── Create/Edit Dialog ─────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editMode ? 'Edit' : 'Add'}{' '}
          {tabIndex === 0 ? 'Asset Classification' : tabIndex === 1 ? 'Transaction Classification' : 'Ledger Category Derivation'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {/* Asset Classification Form */}
            {tabIndex === 0 && (
              <>
                <FormControl fullWidth required>
                  <InputLabel>Source System</InputLabel>
                  <Select
                    value={assetForm.keySource}
                    label="Source System"
                    onChange={(e) => setAssetForm({ ...assetForm, keySource: e.target.value })}
                  >
                    {SOURCE_SYSTEMS.map((src) => (
                      <MenuItem key={src} value={src}>{src}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Security Type Code"
                  value={assetForm.keySecType}
                  onChange={(e) => setAssetForm({ ...assetForm, keySecType: e.target.value })}
                  required
                  disabled={editMode}
                  fullWidth
                />
                <FormControl fullWidth required>
                  <InputLabel>Asset Class</InputLabel>
                  <Select
                    value={assetForm.convAssetClass}
                    label="Asset Class"
                    onChange={(e) => setAssetForm({ ...assetForm, convAssetClass: e.target.value })}
                  >
                    {CONV_ASSET_CLASSES.map((cls) => (
                      <MenuItem key={cls} value={cls}>{cls}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="GL Category Impact"
                  value={assetForm.glCategoryImpact}
                  onChange={(e) => setAssetForm({ ...assetForm, glCategoryImpact: e.target.value })}
                  required
                  fullWidth
                  helperText="Comma-separated category names, e.g. 'Investment Cost, Holdings Unrealized'"
                />
              </>
            )}

            {/* Transaction Classification Form */}
            {tabIndex === 1 && (
              <>
                <FormControl fullWidth required>
                  <InputLabel>Source System</InputLabel>
                  <Select
                    value={transForm.keySource}
                    label="Source System"
                    onChange={(e) => setTransForm({ ...transForm, keySource: e.target.value })}
                  >
                    {SOURCE_SYSTEMS.map((src) => (
                      <MenuItem key={src} value={src}>{src}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Transaction Code"
                  value={transForm.keyTransCode}
                  onChange={(e) => setTransForm({ ...transForm, keyTransCode: e.target.value })}
                  required
                  disabled={editMode}
                  fullWidth
                />
                <FormControl fullWidth required>
                  <InputLabel>Transaction Class</InputLabel>
                  <Select
                    value={transForm.convTransClass}
                    label="Transaction Class"
                    onChange={(e) => setTransForm({ ...transForm, convTransClass: e.target.value })}
                  >
                    {CONV_TRANS_CLASSES.map((cls) => (
                      <MenuItem key={cls} value={cls}>{cls}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="RecPay Category"
                  value={transForm.recPayCategory}
                  onChange={(e) => setTransForm({ ...transForm, recPayCategory: e.target.value })}
                  required
                  fullWidth
                />
              </>
            )}

            {/* Ledger Category Derivation Form */}
            {tabIndex === 2 && (
              <>
                <FormControl fullWidth required>
                  <InputLabel>Derivation Type</InputLabel>
                  <Select
                    value={derivationForm.derivationType}
                    label="Derivation Type"
                    onChange={(e) => setDerivationForm({ ...derivationForm, derivationType: e.target.value as 'transaction' | 'asset' })}
                    disabled={editMode}
                  >
                    <MenuItem value="transaction">Transaction</MenuItem>
                    <MenuItem value="asset">Asset</MenuItem>
                  </Select>
                </FormControl>
                {derivationForm.derivationType === 'transaction' ? (
                  <>
                    <FormControl fullWidth required>
                      <InputLabel>Transaction Class</InputLabel>
                      <Select
                        value={derivationForm.convTransClass || ''}
                        label="Transaction Class"
                        onChange={(e) => setDerivationForm({ ...derivationForm, convTransClass: e.target.value })}
                        disabled={editMode}
                      >
                        {CONV_TRANS_CLASSES.map((cls) => (
                          <MenuItem key={cls} value={cls}>{cls}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Amount Category"
                      value={derivationForm.amntConvCategory || ''}
                      onChange={(e) => setDerivationForm({ ...derivationForm, amntConvCategory: e.target.value || undefined })}
                      fullWidth
                    />
                    <TextField
                      label="URGL BS Category"
                      value={derivationForm.urglBsConvCategory || ''}
                      onChange={(e) => setDerivationForm({ ...derivationForm, urglBsConvCategory: e.target.value || undefined })}
                      fullWidth
                    />
                    <TextField
                      label="Interest RecPay Category"
                      value={derivationForm.intRecPayConvCat || ''}
                      onChange={(e) => setDerivationForm({ ...derivationForm, intRecPayConvCat: e.target.value || undefined })}
                      fullWidth
                    />
                    <TextField
                      label="Interest URGL INCST Category"
                      value={derivationForm.intUrglIncstConvCat || ''}
                      onChange={(e) => setDerivationForm({ ...derivationForm, intUrglIncstConvCat: e.target.value || undefined })}
                      fullWidth
                    />
                  </>
                ) : (
                  <>
                    <FormControl fullWidth required>
                      <InputLabel>Asset Class</InputLabel>
                      <Select
                        value={derivationForm.convAssetClass || ''}
                        label="Asset Class"
                        onChange={(e) => setDerivationForm({ ...derivationForm, convAssetClass: e.target.value })}
                        disabled={editMode}
                      >
                        {CONV_ASSET_CLASSES.map((cls) => (
                          <MenuItem key={cls} value={cls}>{cls}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Cost Category"
                      value={derivationForm.costConvCat || ''}
                      onChange={(e) => setDerivationForm({ ...derivationForm, costConvCat: e.target.value || undefined })}
                      fullWidth
                    />
                    <TextField
                      label="URGL BS Category"
                      value={derivationForm.urglBsConvCat || ''}
                      onChange={(e) => setDerivationForm({ ...derivationForm, urglBsConvCat: e.target.value || undefined })}
                      fullWidth
                    />
                    <TextField
                      label="Daily Margin Category"
                      value={derivationForm.dailyMarginCat || ''}
                      onChange={(e) => setDerivationForm({ ...derivationForm, dailyMarginCat: e.target.value || undefined })}
                      fullWidth
                    />
                    <TextField
                      label="Interest RecPay Category"
                      value={derivationForm.intRecPayCat || ''}
                      onChange={(e) => setDerivationForm({ ...derivationForm, intRecPayCat: e.target.value || undefined })}
                      fullWidth
                    />
                    <TextField
                      label="Interest URGL INCST Category"
                      value={derivationForm.intUrglIncstCat || ''}
                      onChange={(e) => setDerivationForm({ ...derivationForm, intUrglIncstCat: e.target.value || undefined })}
                      fullWidth
                    />
                  </>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {editMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the mapping for <strong>{deleteTarget?.key}</strong>?
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

export default MappingConfiguration;
