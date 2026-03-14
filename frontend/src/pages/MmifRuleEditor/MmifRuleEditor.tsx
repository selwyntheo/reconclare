import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Snackbar,
  IconButton,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CelExpressionEditor from '../../components/shared/CelExpressionEditor';
import AiRuleSuggestDialog from './AiRuleSuggestDialog';
import type { AiRuleSuggestResponse } from '../../services/api';
import type { CelFunctionDoc } from '../../components/shared/CelExpressionEditor';
import type { MmifValidationRule, DslRuleTestResult } from '../../types';
import {
  fetchMmifValidationRule,
  createMmifValidationRule,
  updateMmifValidationRule,
  validateMmifExpression,
  testMmifDslRule,
  fetchMmifDslFunctions,
} from '../../services/api';

const SEVERITY_OPTIONS = ['HARD', 'SOFT', 'DERIVED', 'ADVISORY'];
const CATEGORY_OPTIONS = ['', 'LEDGER_CROSS_CHECK', 'MMIF_RETURN', 'CUSTOM'];
const DATA_SOURCE_OPTIONS = ['mmifLedgerData', 'mmifSampleData'];

export default function MmifRuleEditor() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const navigate = useNavigate();
  const isNew = !ruleId || ruleId === 'new';

  // Form state
  const [rule, setRule] = useState<Partial<MmifValidationRule>>({
    ruleId: '',
    ruleName: '',
    description: '',
    severity: 'HARD',
    tolerance: 0,
    mmifSection: '',
    category: '',
    isDsl: true,
    dataSource: 'mmifLedgerData',
    isActive: true,
    lhs: { label: '', expr: '' },
    rhs: { label: '', expr: '' },
  });

  const [functions, setFunctions] = useState<CelFunctionDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<DslRuleTestResult | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [isLegacy, setIsLegacy] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // Test parameters
  const [testFundAccount, setTestFundAccount] = useState('IE-UCITS-EQ-001');
  const [testFilingPeriod, setTestFilingPeriod] = useState('2026Q1');

  // Load functions on mount
  useEffect(() => {
    fetchMmifDslFunctions()
      .then(setFunctions)
      .catch(() => {});
  }, []);

  // Load existing rule
  useEffect(() => {
    if (!isNew && ruleId) {
      setLoading(true);
      fetchMmifValidationRule(ruleId)
        .then((r) => {
          setRule(r);
          setIsLegacy(!r.isDsl);
        })
        .catch(() => {
          setSnackbar({ open: true, message: `Rule ${ruleId} not found`, severity: 'error' });
        })
        .finally(() => setLoading(false));
    }
  }, [ruleId, isNew]);

  const updateField = useCallback(
    (field: string, value: any) => {
      setRule((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const updateLhs = useCallback((field: string, value: string) => {
    setRule((prev) => ({
      ...prev,
      lhs: { ...prev.lhs!, [field]: value },
    }));
  }, []);

  const updateRhs = useCallback((field: string, value: string) => {
    setRule((prev) => ({
      ...prev,
      rhs: { ...prev.rhs!, [field]: value },
    }));
  }, []);

  const handleSave = async () => {
    if (!rule.ruleId || !rule.ruleName) {
      setSnackbar({ open: true, message: 'Rule ID and Name are required', severity: 'error' });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await createMmifValidationRule(rule);
        setSnackbar({ open: true, message: `Rule ${rule.ruleId} created`, severity: 'success' });
        navigate(`/mmif/rules/${rule.ruleId}`, { replace: true });
      } else {
        await updateMmifValidationRule(rule.ruleId!, rule);
        setSnackbar({ open: true, message: `Rule ${rule.ruleId} updated`, severity: 'success' });
      }
    } catch (e: any) {
      setSnackbar({ open: true, message: e.message || 'Save failed', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!rule.lhs?.expr || !rule.rhs?.expr) {
      setSnackbar({ open: true, message: 'Both LHS and RHS expressions are required', severity: 'error' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testMmifDslRule({
        lhsExpr: rule.lhs.expr,
        rhsExpr: rule.rhs.expr,
        dataSource: rule.dataSource || 'mmifLedgerData',
        fundAccount: testFundAccount,
        filingPeriod: testFilingPeriod,
        tolerance: rule.tolerance || 0,
        severity: rule.severity || 'HARD',
        lhsLabel: rule.lhs.label,
        rhsLabel: rule.rhs.label,
      });
      setTestResult(result);
    } catch (e: any) {
      setTestResult({
        lhsValue: 0,
        rhsValue: 0,
        variance: 0,
        status: 'FAILED',
        lhsLabel: '',
        rhsLabel: '',
        error: e.message || 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleConvertToDsl = () => {
    setRule((prev) => ({
      ...prev,
      isDsl: true,
      lhs: prev.lhs || { label: '', expr: '' },
      rhs: prev.rhs || { label: '', expr: '' },
      dataSource: prev.dataSource || 'mmifLedgerData',
    }));
    setIsLegacy(false);
  };

  const handleApplyAiSuggestion = (result: AiRuleSuggestResponse) => {
    setRule((prev) => ({
      ...prev,
      ruleId: isNew ? result.ruleId : prev.ruleId,
      ruleName: result.ruleName,
      description: result.description,
      severity: result.severity as MmifValidationRule['severity'],
      tolerance: result.tolerance,
      mmifSection: result.mmifSection || undefined,
      category: result.category,
      dataSource: result.dataSource,
      lhs: result.lhs,
      rhs: result.rhs,
    }));
  };

  // Group functions by category
  const functionsByCategory = functions.reduce<Record<string, CelFunctionDoc[]>>((acc, fn) => {
    const cat = fn.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(fn);
    return acc;
  }, {});

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <IconButton onClick={() => navigate('/mmif')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {isNew ? 'Create Validation Rule' : `Edit Rule: ${rule.ruleId}`}
        </Typography>
        {rule.isDsl && <Chip label="DSL" color="primary" size="small" />}
        {isLegacy && <Chip label="Legacy (Read-Only)" color="default" size="small" />}
        {rule.version && <Chip label={`v${rule.version}`} variant="outlined" size="small" />}
        {!isLegacy && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<SmartToyIcon />}
            onClick={() => setAiDialogOpen(true)}
            sx={{ ml: 'auto' }}
          >
            AI Assist
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Left Panel: Metadata + Function Reference */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Rule Metadata
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Rule ID"
                  value={rule.ruleId || ''}
                  onChange={(e) => updateField('ruleId', e.target.value)}
                  placeholder="VR_021"
                  disabled={!isNew}
                  size="small"
                  helperText="Format: VR_XXX"
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={rule.severity || 'HARD'}
                    label="Severity"
                    onChange={(e) => updateField('severity', e.target.value)}
                    disabled={isLegacy}
                  >
                    {SEVERITY_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Rule Name"
                  value={rule.ruleName || ''}
                  onChange={(e) => updateField('ruleName', e.target.value)}
                  disabled={isLegacy}
                  size="small"
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={rule.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  disabled={isLegacy}
                  size="small"
                />
              </Grid>

              <Grid size={{ xs: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Tolerance"
                  value={rule.tolerance ?? 0}
                  onChange={(e) => updateField('tolerance', parseFloat(e.target.value) || 0)}
                  disabled={isLegacy}
                  size="small"
                  inputProps={{ step: 0.01, min: 0 }}
                />
              </Grid>

              <Grid size={{ xs: 4 }}>
                <TextField
                  fullWidth
                  label="MMIF Section"
                  value={rule.mmifSection || ''}
                  onChange={(e) => updateField('mmifSection', e.target.value || null)}
                  disabled={isLegacy}
                  size="small"
                  placeholder="e.g. 4.3"
                />
              </Grid>

              <Grid size={{ xs: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={rule.category || ''}
                    label="Category"
                    onChange={(e) => updateField('category', e.target.value || null)}
                    disabled={isLegacy}
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <MenuItem key={c} value={c}>{c || '(none)'}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Data Source</InputLabel>
                  <Select
                    value={rule.dataSource || 'mmifLedgerData'}
                    label="Data Source"
                    onChange={(e) => updateField('dataSource', e.target.value)}
                    disabled={isLegacy}
                  >
                    {DATA_SOURCE_OPTIONS.map((ds) => (
                      <MenuItem key={ds} value={ds}>{ds}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 6 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={rule.isActive !== false}
                      onChange={(e) => updateField('isActive', e.target.checked)}
                      disabled={isLegacy}
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Function Reference */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
              Function Reference
            </Typography>
            {Object.entries(functionsByCategory).map(([cat, fns]) => (
              <Accordion key={cat} disableGutters defaultExpanded={cat === 'accounting'}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
                    {cat} ({fns.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 1, pt: 0 }}>
                  {fns.map((fn) => (
                    <Box
                      key={fn.name}
                      sx={{
                        p: 1,
                        mb: 0.5,
                        borderRadius: 1,
                        bgcolor: 'action.hover',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.selected' },
                      }}
                      onClick={() => {
                        navigator.clipboard.writeText(fn.example);
                        setSnackbar({ open: true, message: `Copied: ${fn.name}`, severity: 'success' });
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {fn.name}
                        </Typography>
                        <Tooltip title="Copy example">
                          <ContentCopyIcon sx={{ fontSize: 14, opacity: 0.5 }} />
                        </Tooltip>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {fn.signature}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary">
                        {fn.description}
                      </Typography>
                    </Box>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
          </Paper>
        </Grid>

        {/* Right Panel: Expression Editors + Test */}
        <Grid size={{ xs: 12, md: 7 }}>
          {isLegacy && !rule.isDsl ? (
            <Paper sx={{ p: 3 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                This is a legacy (hardcoded) rule. Convert to DSL to edit expressions.
              </Alert>
              <Button variant="contained" onClick={handleConvertToDsl}>
                Convert to DSL
              </Button>
            </Paper>
          ) : (
            <>
              {/* LHS Expression */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  LHS Expression (Left-Hand Side)
                </Typography>
                <TextField
                  fullWidth
                  label="LHS Label"
                  value={rule.lhs?.label || ''}
                  onChange={(e) => updateLhs('label', e.target.value)}
                  size="small"
                  sx={{ mb: 2 }}
                  placeholder="e.g. BS Diff (A-L-C)"
                />
                <CelExpressionEditor
                  value={rule.lhs?.expr || ''}
                  onChange={(v) => updateLhs('expr', v)}
                  label="Expression"
                  functions={functions}
                  height={100}
                  validateExpression={validateMmifExpression}
                />
              </Paper>

              {/* RHS Expression */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  RHS Expression (Right-Hand Side)
                </Typography>
                <TextField
                  fullWidth
                  label="RHS Label"
                  value={rule.rhs?.label || ''}
                  onChange={(e) => updateRhs('label', e.target.value)}
                  size="small"
                  sx={{ mb: 2 }}
                  placeholder="e.g. Total PnL"
                />
                <CelExpressionEditor
                  value={rule.rhs?.expr || ''}
                  onChange={(v) => updateRhs('expr', v)}
                  label="Expression"
                  functions={functions}
                  height={100}
                  validateExpression={validateMmifExpression}
                />
              </Paper>

              {/* Test Panel */}
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Test Rule
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: 4 }}>
                    <TextField
                      fullWidth
                      label="Fund Account"
                      value={testFundAccount}
                      onChange={(e) => setTestFundAccount(e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <TextField
                      fullWidth
                      label="Filing Period"
                      value={testFilingPeriod}
                      onChange={(e) => setTestFilingPeriod(e.target.value)}
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={testing ? <CircularProgress size={18} /> : <PlayArrowIcon />}
                      onClick={handleTest}
                      disabled={testing}
                    >
                      Run Test
                    </Button>
                  </Grid>
                </Grid>

                {testResult && (
                  <Box sx={{ mt: 2 }}>
                    {testResult.error ? (
                      <Alert severity="error">{testResult.error}</Alert>
                    ) : (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr 1fr',
                          gap: 2,
                          p: 2,
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                        }}
                      >
                        <Box>
                          <Typography variant="caption" color="text.secondary">LHS Value</Typography>
                          <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
                            {testResult.lhsValue?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">RHS Value</Typography>
                          <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
                            {testResult.rhsValue?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Variance</Typography>
                          <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
                            {testResult.variance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Status</Typography>
                          <Chip
                            label={testResult.status}
                            color={
                              testResult.status === 'PASSED'
                                ? 'success'
                                : testResult.status === 'WARNING'
                                ? 'warning'
                                : 'error'
                            }
                            size="small"
                            sx={{ mt: 0.5 }}
                          />
                        </Box>
                        {testResult.rowCount !== undefined && (
                          <Box sx={{ gridColumn: '1 / -1' }}>
                            <Typography variant="caption" color="text.secondary">
                              Data rows: {testResult.rowCount}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                )}
              </Paper>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button variant="outlined" onClick={() => navigate('/mmif')}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {isNew ? 'Create Rule' : 'Save Changes'}
                </Button>
              </Box>
            </>
          )}
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        message={snackbar.message}
      />

      <AiRuleSuggestDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        onApply={handleApplyAiSuggestion}
        currentDataSource={rule.dataSource}
        currentLhsExpr={rule.lhs?.expr}
        currentRhsExpr={rule.rhs?.expr}
      />
    </Box>
  );
}
