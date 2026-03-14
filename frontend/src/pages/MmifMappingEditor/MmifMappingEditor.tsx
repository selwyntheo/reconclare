import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  IconButton,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Switch,
  Alert,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SaveIcon from '@mui/icons-material/Save';
import {
  fetchMmifEvent,
  fetchMmifMapping,
  saveMmifMapping,
  fetchMmifMappingTemplate,
} from '../../services/api';
import {
  MmifFieldMapping,
  MmifFund,
  MmifEvent,
  MMIF_SECTIONS,
  INSTRUMENT_TYPES,
  CODE_TYPES,
  SOURCE_TABLES,
} from '../../types';

const EMPTY_ROW: MmifFieldMapping = {
  eagleGlPattern: '',
  eagleSourceTable: 'dataLedger',
  eagleSourceField: 'endingBalance',
  mmifSection: '3.1',
  mmifField: '',
  instrumentType: null,
  codeType: 4,
  transformation: null,
  signConvention: 1,
  isReported: true,
  notes: '',
};

export default function MmifMappingEditor() {
  const { eventId, fundType } = useParams<{ eventId: string; fundType: string }>();
  const navigate = useNavigate();

  // Data
  const [, setEvent] = useState<MmifEvent | null>(null);
  const [fundCount, setFundCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Form state
  const [configId, setConfigId] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [mappings, setMappings] = useState<MmifFieldMapping[]>([]);
  const [counterpartyEnrichment, setCounterpartyEnrichment] = useState<Record<string, { sector: string; country: string }>>({});
  const [investorClassification, setInvestorClassification] = useState<Record<string, string>>({});
  const [unmappedAccounts, setUnmappedAccounts] = useState<string[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [newCpKey, setNewCpKey] = useState('');
  const [newIcCode, setNewIcCode] = useState('');
  const [newUnmapped, setNewUnmapped] = useState('');

  useEffect(() => {
    loadData();
  }, [eventId, fundType]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    if (!eventId || !fundType) return;
    setLoading(true);
    try {
      const ev = await fetchMmifEvent(eventId);
      setEvent(ev);
      const matchingFunds = ev.funds?.filter((f: MmifFund) => f.fundType === fundType) || [];
      setFundCount(matchingFunds.length);

      // Try event-specific template override first, then fall back to global template
      const configs = await fetchMmifMapping(eventId, fundType);
      if (configs.length > 0) {
        const cfg = configs[0];
        setConfigId(cfg.configId || '');
        setBaseCurrency(cfg.baseCurrency || 'EUR');
        setMappings(cfg.mappings || []);
        setCounterpartyEnrichment(cfg.counterpartyEnrichment || {});
        setInvestorClassification(cfg.investorClassification || {});
        setUnmappedAccounts(cfg.unmappedAccounts || []);
      } else {
        // Fall back to global template defaults
        try {
          const template = await fetchMmifMappingTemplate(fundType);
          setConfigId(`MMIF-TPL-${fundType}`);
          setMappings(template.mappings || []);
          setCounterpartyEnrichment(template.counterpartyEnrichment || {});
          setInvestorClassification(template.investorClassification || {});
        } catch {
          setConfigId(`MMIF-TPL-${Date.now().toString(36)}`);
        }
      }
    } catch (e: any) {
      setSnackbar({ open: true, message: e.message || 'Failed to load data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!fundType) return;
    try {
      const template = await fetchMmifMappingTemplate(fundType);
      setMappings(template.mappings || []);
      setCounterpartyEnrichment(template.counterpartyEnrichment || {});
      setInvestorClassification(template.investorClassification || {});
      setUnmappedAccounts([]);
      setTemplateDialogOpen(false);
      setSnackbar({ open: true, message: `Reset to ${fundType} defaults (${template.mappings.length} mappings)`, severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: e.message || 'Failed to load template', severity: 'error' });
    }
  };

  const handleSave = async () => {
    if (!eventId || !fundType) return;
    setSaving(true);
    try {
      const config = {
        configId,
        eventId,
        account: fundType,
        fundType,
        baseCurrency,
        mappings,
        counterpartyEnrichment,
        investorClassification,
        unmappedAccounts,
      };
      await saveMmifMapping(eventId, config);
      setSnackbar({ open: true, message: `${fundType} mapping template saved`, severity: 'success' });
    } catch (e: any) {
      setSnackbar({ open: true, message: e.message || 'Failed to save', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Mapping row helpers ───────────────────────────────────

  const updateMapping = (index: number, field: keyof MmifFieldMapping, value: any) => {
    setMappings(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const addMappingRow = () => {
    setMappings(prev => [...prev, { ...EMPTY_ROW }]);
  };

  const removeMappingRow = (index: number) => {
    setMappings(prev => prev.filter((_, i) => i !== index));
  };

  // ── Counterparty helpers ──────────────────────────────────

  const addCounterparty = () => {
    if (!newCpKey.trim()) return;
    setCounterpartyEnrichment(prev => ({ ...prev, [newCpKey.trim()]: { sector: '', country: '' } }));
    setNewCpKey('');
  };

  const updateCounterparty = (key: string, field: 'sector' | 'country', value: string) => {
    setCounterpartyEnrichment(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const removeCounterparty = (key: string) => {
    setCounterpartyEnrichment(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  // ── Investor classification helpers ───────────────────────

  const addClassification = () => {
    if (!newIcCode.trim()) return;
    setInvestorClassification(prev => ({ ...prev, [newIcCode.trim()]: '' }));
    setNewIcCode('');
  };

  const removeClassification = (code: string) => {
    setInvestorClassification(prev => { const n = { ...prev }; delete n[code]; return n; });
  };

  // ── Unmapped accounts helpers ─────────────────────────────

  const addUnmapped = () => {
    if (!newUnmapped.trim()) return;
    setUnmappedAccounts(prev => [...prev, newUnmapped.trim()]);
    setNewUnmapped('');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate(`/mmif/${eventId}`)}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {fundType} Mapping Template
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <Chip label={fundType} size="small" color="primary" variant="outlined" />
            <Chip label={baseCurrency} size="small" variant="outlined" />
            {fundCount > 0 && (
              <Chip label={`Applies to ${fundCount} fund${fundCount > 1 ? 's' : ''}`} size="small" color="info" variant="outlined" />
            )}
          </Stack>
        </Box>
        <Button
          variant="outlined"
          startIcon={<AutoFixHighIcon />}
          onClick={() => setTemplateDialogOpen(true)}
        >
          Reset to Defaults
        </Button>
      </Stack>

      {/* Mapping Table */}
      <Paper variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            GL to MMIF Section Mappings ({mappings.length})
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addMappingRow}>
            Add Row
          </Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 100 }}>Eagle GL</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 150 }}>Source Table</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 120 }}>Source Field</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 160 }}>MMIF Section</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 120 }}>MMIF Field</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 100 }}>Inst. Type</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 90 }}>Code Type</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', width: 60 }}>Sign</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', width: 60 }}>Report</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 140 }}>Notes</TableCell>
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {mappings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11}>
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                      No mappings configured. Click "Add Row" or "Reset to Defaults" to get started.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {mappings.map((m, i) => (
                <TableRow key={i} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell>
                    <TextField
                      size="small"
                      value={m.eagleGlPattern}
                      onChange={e => updateMapping(i, 'eagleGlPattern', e.target.value)}
                      placeholder="1000*"
                      sx={{ '& input': { fontSize: '0.8rem', fontFamily: 'monospace' } }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={m.eagleSourceTable}
                      onChange={e => updateMapping(i, 'eagleSourceTable', e.target.value)}
                      sx={{ fontSize: '0.8rem' }}
                      fullWidth
                    >
                      {SOURCE_TABLES.map(t => (
                        <MenuItem key={t} value={t} sx={{ fontSize: '0.8rem' }}>{t}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={m.eagleSourceField}
                      onChange={e => updateMapping(i, 'eagleSourceField', e.target.value)}
                      sx={{ '& input': { fontSize: '0.8rem' } }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={m.mmifSection}
                      onChange={e => updateMapping(i, 'mmifSection', e.target.value)}
                      sx={{ fontSize: '0.8rem' }}
                      fullWidth
                    >
                      {Object.entries(MMIF_SECTIONS).map(([k, v]) => (
                        <MenuItem key={k} value={k} sx={{ fontSize: '0.8rem' }}>{k} — {v}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={m.mmifField}
                      onChange={e => updateMapping(i, 'mmifField', e.target.value)}
                      sx={{ '& input': { fontSize: '0.8rem' } }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <Select<string>
                      size="small"
                      value={m.instrumentType != null ? String(m.instrumentType) : ''}
                      onChange={e => updateMapping(i, 'instrumentType', e.target.value === '' ? null : Number(e.target.value))}
                      sx={{ fontSize: '0.8rem' }}
                      fullWidth
                      displayEmpty
                    >
                      <MenuItem value="" sx={{ fontSize: '0.8rem' }}><em>None</em></MenuItem>
                      {Object.entries(INSTRUMENT_TYPES).map(([k, v]) => (
                        <MenuItem key={k} value={k} sx={{ fontSize: '0.8rem' }}>{v}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={m.codeType}
                      onChange={e => updateMapping(i, 'codeType', Number(e.target.value))}
                      sx={{ fontSize: '0.8rem' }}
                      fullWidth
                    >
                      {Object.entries(CODE_TYPES).map(([k, v]) => (
                        <MenuItem key={k} value={Number(k)} sx={{ fontSize: '0.8rem' }}>{v}</MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Chip
                      label={m.signConvention === 1 ? '+1' : '-1'}
                      size="small"
                      color={m.signConvention === 1 ? 'success' : 'error'}
                      variant="outlined"
                      onClick={() => updateMapping(i, 'signConvention', m.signConvention === 1 ? -1 : 1)}
                      sx={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: '0.75rem' }}
                    />
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <Switch
                      size="small"
                      checked={m.isReported}
                      onChange={e => updateMapping(i, 'isReported', e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={m.notes}
                      onChange={e => updateMapping(i, 'notes', e.target.value)}
                      sx={{ '& input': { fontSize: '0.8rem' } }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => removeMappingRow(i)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Counterparty Enrichment */}
      <Accordion variant="outlined" sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Counterparty Enrichment ({Object.keys(counterpartyEnrichment).length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Counterparty</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Sector</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Country</TableCell>
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(counterpartyEnrichment).map(([key, val]) => (
                <TableRow key={key}>
                  <TableCell><Typography variant="body2" fontFamily="monospace">{key}</Typography></TableCell>
                  <TableCell>
                    <TextField size="small" value={val.sector} onChange={e => updateCounterparty(key, 'sector', e.target.value)} sx={{ '& input': { fontSize: '0.8rem' } }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={val.country} onChange={e => updateCounterparty(key, 'country', e.target.value)} sx={{ '& input': { fontSize: '0.8rem' } }} />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => removeCounterparty(key)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <TextField size="small" value={newCpKey} onChange={e => setNewCpKey(e.target.value)} placeholder="Counterparty name" sx={{ flex: 1 }} />
            <Button size="small" startIcon={<AddIcon />} onClick={addCounterparty} disabled={!newCpKey.trim()}>Add</Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Investor Classification */}
      <Accordion variant="outlined" sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Investor Classification ({Object.keys(investorClassification).length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Sector Code</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Label</TableCell>
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(investorClassification).map(([code, label]) => (
                <TableRow key={code}>
                  <TableCell><Typography variant="body2" fontFamily="monospace">{code}</Typography></TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={label}
                      onChange={e => setInvestorClassification(prev => ({ ...prev, [code]: e.target.value }))}
                      sx={{ '& input': { fontSize: '0.8rem' } }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => removeClassification(code)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <TextField size="small" value={newIcCode} onChange={e => setNewIcCode(e.target.value)} placeholder="Sector code (e.g. S122)" sx={{ flex: 1 }} />
            <Button size="small" startIcon={<AddIcon />} onClick={addClassification} disabled={!newIcCode.trim()}>Add</Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Unmapped Accounts */}
      <Accordion variant="outlined" sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Unmapped Accounts ({unmappedAccounts.length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            {unmappedAccounts.map((a, i) => (
              <Chip
                key={i}
                label={a}
                size="small"
                variant="outlined"
                color="warning"
                onDelete={() => setUnmappedAccounts(prev => prev.filter((_, j) => j !== i))}
                sx={{ fontFamily: 'monospace' }}
              />
            ))}
            {unmappedAccounts.length === 0 && (
              <Typography variant="body2" color="text.secondary">No unmapped accounts</Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField size="small" value={newUnmapped} onChange={e => setNewUnmapped(e.target.value)} placeholder="GL pattern (e.g. 1800*)" sx={{ flex: 1 }} />
            <Button size="small" startIcon={<AddIcon />} onClick={addUnmapped} disabled={!newUnmapped.trim()}>Add</Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Action Bar */}
      <Stack direction="row" justifyContent="flex-end" spacing={2}>
        <Button variant="outlined" onClick={() => navigate(`/mmif/${eventId}`)}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || mappings.length === 0}
        >
          Save Configuration
        </Button>
      </Stack>

      {/* Reset to Defaults Confirmation Dialog */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)}>
        <DialogTitle>Reset to Defaults</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Reset the <strong>{fundType}</strong> mapping template to defaults? This will replace all current mappings with the default template.
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            The {fundType} default template includes pre-configured GL patterns, MMIF section mappings, counterparty enrichment, and investor classification data.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleResetToDefaults}>Reset to Defaults</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
