/**
 * Data Mapping Designer Page
 * Full mapping editor with source/target schema, CEL field mappings,
 * preview, validation, AI suggestions, and execution.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
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
  Tab,
  Tabs,
  Grid,
  Divider,
  Autocomplete,
  LinearProgress,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  alpha,
  useTheme,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PreviewIcon from '@mui/icons-material/Preview';
import VerifiedIcon from '@mui/icons-material/Verified';
import FunctionsIcon from '@mui/icons-material/Functions';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule } from 'ag-grid-community';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import {
  fetchMapping,
  createMapping,
  updateMapping,
  validateMapping,
  previewMapping,
  inferSchema,
  executeMapping,
  executeMappingAsync,
  fetchCelFunctions,
  suggestCel,
  validateCel,
  fetchLookupTables,
  fetchMappingJob,
  downloadJobOutput,
  aiGenerateMapping,
  readSampleRows,
} from '../../services/api';
import type { AiGenerateResult } from '../../services/api';
import type {
  MappingDefinition,
  FieldMapping,
  FilterExpression,
  SourceConfig,
  TargetConfig,
  FieldSchema,
  ErrorHandling,
  FileFormat,
  FieldType,
  ErrorStrategy,
  MappingValidateResponse,
  PreviewResponse,
  PreviewRow,
  CelFunctionDoc,
  AiFieldMapping,
  LookupTableMeta,
  MappingJob,
  FieldValidationResult,
} from '../../types/mapping';

const FILE_FORMATS: FileFormat[] = ['CSV', 'TSV', 'JSON', 'EXCEL'];
const FIELD_TYPES: FieldType[] = ['STRING', 'INT', 'DOUBLE', 'DECIMAL', 'BOOL', 'DATE', 'DATETIME', 'TIMESTAMP'];
const ERROR_STRATEGIES: ErrorStrategy[] = ['FAIL_FAST', 'SKIP_AND_LOG', 'USE_DEFAULT', 'COLLECT_ERRORS'];

const emptySource: SourceConfig = { format: 'CSV', options: {}, schema: [] };
const emptyTarget: TargetConfig = { format: 'JSON', options: {}, schema: [] };
const emptyErrorHandling: ErrorHandling = {
  onFieldError: 'SKIP_AND_LOG',
  onRowError: 'SKIP_AND_LOG',
  maxErrorCount: 1000,
  defaults: {},
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}
const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ py: 2 }}>
    {value === index && children}
  </Box>
);

const DataMappingDesigner: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { mappingId } = useParams<{ mappingId: string }>();
  const [searchParams] = useSearchParams();
  const isNew = mappingId === 'new';

  // Core state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [source, setSource] = useState<SourceConfig>(emptySource);
  const [target, setTarget] = useState<TargetConfig>(emptyTarget);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [filters, setFilters] = useState<FilterExpression[]>([]);
  const [errorHandling, setErrorHandling] = useState<ErrorHandling>(emptyErrorHandling);
  const [status, setStatus] = useState<string>('DRAFT');
  const [version, setVersion] = useState('1.0');

  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<MappingValidateResponse | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [celFunctions, setCelFunctions] = useState<CelFunctionDoc[]>([]);
  const [lookupTables, setLookupTables] = useState<LookupTableMeta[]>([]);
  const [aiGenerating, setAiGenerating] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });

  // Execution state
  const [executing, setExecuting] = useState(false);
  const [executeFile, setExecuteFile] = useState<File | null>(null);
  const [currentJob, setCurrentJob] = useState<MappingJob | null>(null);

  // Real sample data from source file (for preview)
  const [sourceSampleRows, setSourceSampleRows] = useState<Record<string, unknown>[]>([]);

  // AI Auto-Map dialog state
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiSourceFile, setAiSourceFile] = useState<File | null>(null);
  const [aiTargetFile, setAiTargetFile] = useState<File | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiMappingResult, setAiMappingResult] = useState<AiGenerateResult | null>(null);

  // Source file for schema inference
  const fileInputRef = useRef<HTMLInputElement>(null);
  const executeFileRef = useRef<HTMLInputElement>(null);
  const aiSourceRef = useRef<HTMLInputElement>(null);
  const aiTargetRef = useRef<HTMLInputElement>(null);

  // Load existing mapping
  useEffect(() => {
    if (!isNew && mappingId) {
      setLoading(true);
      fetchMapping(mappingId)
        .then((m) => {
          setName(m.name);
          setDescription(m.description || '');
          setTags(m.tags || []);
          setSource(m.source);
          setTarget(m.target);
          setFieldMappings(m.fieldMappings);
          setFilters(m.filters || []);
          setErrorHandling(m.errorHandling || emptyErrorHandling);
          setStatus(m.status);
          setVersion(m.version);
        })
        .catch((err) => setSnackbar({ open: true, message: err.message, severity: 'error' }))
        .finally(() => setLoading(false));
    }
  }, [mappingId, isNew]);

  // Load CEL functions and lookup tables
  useEffect(() => {
    fetchCelFunctions().then(setCelFunctions).catch(() => {});
    fetchLookupTables().then(setLookupTables).catch(() => {});
  }, []);

  // Set initial tab from query param
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'execute') setActiveTab(3);
  }, [searchParams]);

  const getMappingPayload = () => ({
    name,
    description: description || undefined,
    tags,
    source,
    target,
    fieldMappings,
    filters: filters.length > 0 ? filters : undefined,
    errorHandling,
  });

  // Open AI dialog automatically for new mappings
  useEffect(() => {
    if (isNew && fieldMappings.length === 0 && !loading) {
      setAiDialogOpen(true);
    }
  }, [isNew, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // AI Auto-Map: upload source + target files, LLM generates everything
  const handleAiAutoMap = async () => {
    if (!aiSourceFile) {
      setSnackbar({ open: true, message: 'Source file is required', severity: 'error' });
      return;
    }
    if (!aiTargetFile) {
      setSnackbar({ open: true, message: 'Target file is required', severity: 'error' });
      return;
    }
    setAiRunning(true);
    try {
      const result = await aiGenerateMapping(aiSourceFile, aiTargetFile);
      setAiMappingResult(result);

      // Populate the mapping form with AI results
      setName(result.name);
      setDescription(result.description);
      setSource(result.source as SourceConfig);
      setTarget(result.target as TargetConfig);
      setFieldMappings(result.fieldMappings);
      // Capture real sample rows for preview
      if (result.sourceStats.sampleRows?.length > 0) {
        setSourceSampleRows(result.sourceStats.sampleRows);
      }

      // Close dialog and switch to field mappings tab
      setAiDialogOpen(false);
      setActiveTab(1);
      setSnackbar({
        open: true,
        message: `AI generated ${result.fieldMappings.length} field mappings from ${result.sourceStats.fieldsInferred} source → ${result.targetStats.fieldsInferred} target fields`,
        severity: 'success',
      });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setAiRunning(false);
    }
  };

  // Save
  const handleSave = async () => {
    if (!name.trim()) {
      setSnackbar({ open: true, message: 'Name is required', severity: 'error' });
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const created = await createMapping(getMappingPayload());
        setSnackbar({ open: true, message: 'Mapping created', severity: 'success' });
        navigate(`/data-mapping/${created.mappingId}`, { replace: true });
      } else {
        await updateMapping(mappingId!, getMappingPayload());
        setSnackbar({ open: true, message: 'Mapping saved', severity: 'success' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Validate
  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const result = await validateMapping(getMappingPayload());
      setValidationResult(result);
      setSnackbar({
        open: true,
        message: result.valid ? 'All expressions valid' : 'Some expressions have errors',
        severity: result.valid ? 'success' : 'error',
      });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setValidating(false);
    }
  };

  // Schema inference from file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'source' | 'target') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await inferSchema(file);
      const schema: FieldSchema[] = result.fields.map((f) => ({
        name: f.name,
        type: f.inferredType,
      }));
      if (side === 'source') {
        setSource((prev) => ({
          ...prev,
          format: result.format,
          schema,
          options: { ...prev.options, ...result.options },
        }));
        // Build sample rows from per-field sampleValues for preview
        const maxSamples = Math.max(...result.fields.map((f) => f.sampleValues?.length || 0), 0);
        const rows: Record<string, unknown>[] = [];
        for (let i = 0; i < Math.min(maxSamples, 5); i++) {
          const row: Record<string, unknown> = {};
          result.fields.forEach((f) => {
            row[f.name] = f.sampleValues?.[i] ?? null;
          });
          rows.push(row);
        }
        if (rows.length > 0) setSourceSampleRows(rows);
      } else {
        setTarget((prev) => ({ ...prev, format: result.format, schema }));
      }
      setSnackbar({ open: true, message: `Inferred ${result.fields.length} fields from ${file.name}`, severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
    e.target.value = '';
  };

  // Preview — load sample data from file upload
  const previewFileRef = useRef<HTMLInputElement>(null);

  const handlePreviewWithFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const result = await readSampleRows(file, 10);
      if (result.rows.length > 0) {
        setSourceSampleRows(result.rows);
        setSnackbar({ open: true, message: `Loaded ${result.rows.length} of ${result.totalRows} rows from ${file.name}`, severity: 'success' });
        // Auto-run preview with the new data
        runPreview(result.rows);
      } else {
        setSnackbar({ open: true, message: 'File contains no data rows', severity: 'error' });
      }
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const runPreview = async (sampleData: Record<string, unknown>[]) => {
    if (fieldMappings.length === 0) {
      setSnackbar({ open: true, message: 'Add field mappings before previewing', severity: 'error' });
      return;
    }
    setPreviewing(true);
    try {
      const result = await previewMapping({
        mapping: getMappingPayload(),
        sampleData,
      });
      setPreviewResult(result);
      setActiveTab(2);
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setPreviewing(false);
    }
  };

  const handlePreview = async () => {
    if (sourceSampleRows.length > 0) {
      return runPreview(sourceSampleRows);
    }
    // No sample data available — prompt user to upload a file
    setSnackbar({ open: true, message: 'Upload a source file first (use the upload button on the Preview tab or the Schema tab)', severity: 'info' });
    setActiveTab(2);
  };

  // AI Suggest for a single field
  const handleAiSuggest = async (targetField: string, targetType: string, index: number) => {
    setAiGenerating(targetField);
    try {
      const suggestion = await suggestCel({
        targetField,
        targetType,
        sourceSchema: source.schema,
        existingMappings: fieldMappings,
        lookupTables: lookupTables.map((lt) => lt.name),
      });
      setFieldMappings((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          cel: suggestion.cel,
          description: suggestion.explanation,
        };
        return updated;
      });
      setSnackbar({
        open: true,
        message: `AI suggestion (${suggestion.confidence}): ${suggestion.explanation}`,
        severity: 'info',
      });
    } catch (err: any) {
      setSnackbar({ open: true, message: `AI suggestion failed: ${err.message}`, severity: 'error' });
    } finally {
      setAiGenerating(null);
    }
  };

  // Execute
  const handleExecute = async () => {
    if (!executeFile) {
      setSnackbar({ open: true, message: 'Select a file to execute', severity: 'error' });
      return;
    }
    setExecuting(true);
    try {
      const result = await executeMappingAsync(mappingId!, executeFile);
      setCurrentJob(result);
      setSnackbar({ open: true, message: `Job started: ${result.jobId}`, severity: 'success' });
      // Poll job status
      pollJob(result.jobId);
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
      setExecuting(false);
    }
  };

  const pollJob = async (jobId: string) => {
    const poll = async () => {
      try {
        const job = await fetchMappingJob(jobId);
        setCurrentJob(job);
        if (job.status === 'RUNNING' || job.status === 'PENDING') {
          setTimeout(poll, 2000);
        } else {
          setExecuting(false);
        }
      } catch {
        setExecuting(false);
      }
    };
    poll();
  };

  const handleDownloadOutput = async () => {
    if (!currentJob?.jobId) return;
    try {
      const blob = await downloadJobOutput(currentJob.jobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mapping-output-${currentJob.jobId}.${target.format.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  // Field mapping helpers
  const addFieldMapping = () => {
    setFieldMappings((prev) => [...prev, { targetField: '', cel: '' }]);
  };

  const updateFieldMapping = (index: number, field: Partial<FieldMapping>) => {
    setFieldMappings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...field };
      return updated;
    });
  };

  const removeFieldMapping = (index: number) => {
    setFieldMappings((prev) => prev.filter((_, i) => i !== index));
  };

  // Schema field helpers
  const addSchemaField = (side: 'source' | 'target') => {
    const newField: FieldSchema = { name: '', type: 'STRING' };
    if (side === 'source') {
      setSource((prev) => ({ ...prev, schema: [...prev.schema, newField] }));
    } else {
      setTarget((prev) => ({ ...prev, schema: [...prev.schema, newField] }));
    }
  };

  const updateSchemaField = (side: 'source' | 'target', index: number, field: Partial<FieldSchema>) => {
    if (side === 'source') {
      setSource((prev) => {
        const schema = [...prev.schema];
        schema[index] = { ...schema[index], ...field };
        return { ...prev, schema };
      });
    } else {
      setTarget((prev) => {
        const schema = [...prev.schema];
        schema[index] = { ...schema[index], ...field };
        return { ...prev, schema };
      });
    }
  };

  const removeSchemaField = (side: 'source' | 'target', index: number) => {
    if (side === 'source') {
      setSource((prev) => ({ ...prev, schema: prev.schema.filter((_, i) => i !== index) }));
    } else {
      setTarget((prev) => ({ ...prev, schema: prev.schema.filter((_, i) => i !== index) }));
    }
  };

  // Filter helpers
  const addFilter = () => setFilters((prev) => [...prev, { cel: '' }]);
  const updateFilter = (index: number, field: Partial<FilterExpression>) => {
    setFilters((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...field };
      return updated;
    });
  };
  const removeFilter = (index: number) => setFilters((prev) => prev.filter((_, i) => i !== index));

  // Get validation status for a field
  const getFieldValidation = (targetField: string): FieldValidationResult | undefined => {
    return validationResult?.fieldResults?.find((r) => r.targetField === targetField);
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={() => navigate('/data-mapping')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" fontWeight={600}>
            {isNew ? 'New Mapping' : name}
          </Typography>
          {!isNew && (
            <Chip label={status} size="small" variant="outlined" sx={{ ml: 1 }} />
          )}
          {!isNew && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>v{version}</Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<AutoFixHighIcon />}
            onClick={() => setAiDialogOpen(true)}
          >
            AI Auto-Map
          </Button>
          <Button
            variant="outlined"
            startIcon={<VerifiedIcon />}
            onClick={handleValidate}
            disabled={validating || fieldMappings.length === 0}
          >
            {validating ? 'Validating...' : 'Validate'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<PreviewIcon />}
            onClick={handlePreview}
            disabled={previewing || fieldMappings.length === 0}
          >
            Preview
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Stack>
      </Stack>

      {/* Validation summary */}
      {validationResult && (
        <Alert
          severity={validationResult.valid ? 'success' : 'error'}
          sx={{ mb: 2 }}
          onClose={() => setValidationResult(null)}
        >
          {validationResult.valid
            ? 'All CEL expressions are valid'
            : `${validationResult.fieldResults.filter((r) => !r.valid).length} field(s) and ${validationResult.filterResults.filter((r) => !r.valid).length} filter(s) have errors`}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
        <Tab label="Schema & Config" />
        <Tab label="Field Mappings" />
        <Tab label="Preview" />
        {!isNew && <Tab label="Execute" />}
        <Tab label="CEL Reference" />
      </Tabs>

      {/* Tab 0: Schema & Config */}
      <TabPanel value={activeTab} index={0}>
        {/* Basic info */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Mapping Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete
                  multiple
                  freeSolo
                  value={tags}
                  onChange={(_, v) => setTags(v)}
                  options={['nav', 'positions', 'income', 'state-street', 'northern-trust', 'bny']}
                  renderInput={(params) => <TextField {...params} label="Tags" />}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Source & Target side-by-side */}
        <Grid container spacing={2}>
          {/* Source Schema */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader
                title="Source Schema"
                titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
                action={
                  <Stack direction="row" spacing={0.5}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      hidden
                      accept=".csv,.tsv,.json,.xlsx,.xls"
                      onChange={(e) => handleFileUpload(e, 'source')}
                    />
                    <Tooltip title="Infer schema from file">
                      <IconButton size="small" onClick={() => fileInputRef.current?.click()}>
                        <UploadFileIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Add field">
                      <IconButton size="small" onClick={() => addSchemaField('source')}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                }
              />
              <CardContent sx={{ pt: 0 }}>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Format</InputLabel>
                  <Select
                    value={source.format}
                    label="Format"
                    onChange={(e) => setSource((prev) => ({ ...prev, format: e.target.value as FileFormat }))}
                  >
                    {FILE_FORMATS.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                  </Select>
                </FormControl>
                {source.schema.map((field, i) => (
                  <Stack key={i} direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                    <TextField
                      size="small"
                      label="Name"
                      value={field.name}
                      onChange={(e) => updateSchemaField('source', i, { name: e.target.value })}
                      sx={{ flex: 2 }}
                    />
                    <FormControl size="small" sx={{ flex: 1, minWidth: 100 }}>
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={field.type}
                        label="Type"
                        onChange={(e) => updateSchemaField('source', i, { type: e.target.value as FieldType })}
                      >
                        {FIELD_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <IconButton size="small" onClick={() => removeSchemaField('source', i)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                {source.schema.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No source fields. Upload a file or add fields manually.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Target Schema */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader
                title="Target Schema"
                titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
                action={
                  <Tooltip title="Add field">
                    <IconButton size="small" onClick={() => addSchemaField('target')}>
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                }
              />
              <CardContent sx={{ pt: 0 }}>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Format</InputLabel>
                  <Select
                    value={target.format}
                    label="Format"
                    onChange={(e) => setTarget((prev) => ({ ...prev, format: e.target.value as FileFormat }))}
                  >
                    {FILE_FORMATS.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                  </Select>
                </FormControl>
                {target.schema.map((field, i) => (
                  <Stack key={i} direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                    <TextField
                      size="small"
                      label="Name"
                      value={field.name}
                      onChange={(e) => updateSchemaField('target', i, { name: e.target.value })}
                      sx={{ flex: 2 }}
                    />
                    <FormControl size="small" sx={{ flex: 1, minWidth: 100 }}>
                      <InputLabel>Type</InputLabel>
                      <Select
                        value={field.type}
                        label="Type"
                        onChange={(e) => updateSchemaField('target', i, { type: e.target.value as FieldType })}
                      >
                        {FIELD_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <IconButton size="small" onClick={() => removeSchemaField('target', i)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                {target.schema.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    No target fields. Add fields to define the target schema.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Error Handling Config */}
        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight={600}>Error Handling</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>On Field Error</InputLabel>
                  <Select
                    value={errorHandling.onFieldError}
                    label="On Field Error"
                    onChange={(e) => setErrorHandling((prev) => ({ ...prev, onFieldError: e.target.value as ErrorStrategy }))}
                  >
                    {ERROR_STRATEGIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>On Row Error</InputLabel>
                  <Select
                    value={errorHandling.onRowError}
                    label="On Row Error"
                    onChange={(e) => setErrorHandling((prev) => ({ ...prev, onRowError: e.target.value as ErrorStrategy }))}
                  >
                    {ERROR_STRATEGIES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Max Error Count"
                  type="number"
                  value={errorHandling.maxErrorCount}
                  onChange={(e) => setErrorHandling((prev) => ({ ...prev, maxErrorCount: parseInt(e.target.value) || 0 }))}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </TabPanel>

      {/* Tab 1: Field Mappings */}
      <TabPanel value={activeTab} index={1}>
        <Card>
          <CardHeader
            title="Field Mappings"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
            subheader={`${fieldMappings.length} mapping(s) defined`}
            action={
              <Button size="small" startIcon={<AddIcon />} onClick={addFieldMapping}>
                Add Mapping
              </Button>
            }
          />
          <CardContent sx={{ pt: 0 }}>
            {fieldMappings.map((fm, i) => {
              const validation = getFieldValidation(fm.targetField);
              return (
                <Paper
                  key={i}
                  variant="outlined"
                  sx={{
                    p: 2,
                    mb: 1.5,
                    borderColor: validation?.valid === false ? theme.palette.error.main : undefined,
                    backgroundColor: validation?.valid === false ? alpha(theme.palette.error.main, 0.04) : undefined,
                  }}
                >
                  <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Autocomplete
                        freeSolo
                        value={fm.targetField}
                        onChange={(_, v) => updateFieldMapping(i, { targetField: v || '' })}
                        onInputChange={(_, v) => updateFieldMapping(i, { targetField: v })}
                        options={target.schema.map((f) => f.name)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size="small"
                            label="Target Field"
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: validation ? (
                                <>
                                  {validation.valid
                                    ? <CheckCircleIcon fontSize="small" color="success" sx={{ mr: 0.5 }} />
                                    : <ErrorOutlineIcon fontSize="small" color="error" sx={{ mr: 0.5 }} />}
                                  {params.InputProps.startAdornment}
                                </>
                              ) : params.InputProps.startAdornment,
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="CEL Expression"
                        value={fm.cel}
                        onChange={(e) => updateFieldMapping(i, { cel: e.target.value })}
                        placeholder='e.g. src.Fund_ID, parseDecimal(src.amount), formatDate(parseDate(src.date, "MM/dd/yyyy"), "yyyy-MM-dd")'
                        error={validation?.valid === false}
                        helperText={validation?.valid === false ? validation.error : undefined}
                        sx={{
                          '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.85rem' },
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Tooltip title="AI Suggest CEL expression">
                          <span>
                            <IconButton
                              size="small"
                              color="secondary"
                              onClick={() => {
                                const targetType = target.schema.find((f) => f.name === fm.targetField)?.type || 'STRING';
                                handleAiSuggest(fm.targetField, targetType, i);
                              }}
                              disabled={!fm.targetField || aiGenerating === fm.targetField || source.schema.length === 0}
                            >
                              {aiGenerating === fm.targetField ? <CircularProgress size={18} /> : <AutoFixHighIcon fontSize="small" />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <IconButton size="small" color="error" onClick={() => removeFieldMapping(i)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Grid>
                  </Grid>
                  {fm.description && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {fm.description}
                    </Typography>
                  )}
                </Paper>
              );
            })}
            {fieldMappings.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No field mappings defined. Click "Add Mapping" to start mapping source fields to target fields.
              </Typography>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <Card sx={{ mt: 2 }}>
          <CardHeader
            title="Row Filters"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
            subheader="CEL expressions that must evaluate to true for a row to be included"
            action={
              <Button size="small" startIcon={<AddIcon />} onClick={addFilter}>
                Add Filter
              </Button>
            }
          />
          <CardContent sx={{ pt: 0 }}>
            {filters.map((f, i) => (
              <Stack key={i} direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                <TextField
                  fullWidth
                  size="small"
                  label={`Filter ${i + 1}`}
                  value={f.cel}
                  onChange={(e) => updateFilter(i, { cel: e.target.value })}
                  placeholder="e.g. src.status != 'CANCELLED'"
                  sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                />
                <IconButton size="small" color="error" onClick={() => removeFilter(i)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            {filters.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No filters. All rows will be processed.
              </Typography>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Tab 2: Preview */}
      <TabPanel value={activeTab} index={2}>
        <Card>
          <CardHeader
            title="Mapping Preview"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
            subheader={previewResult
              ? `${previewResult.mappedRows} mapped, ${previewResult.filteredRows} filtered, ${previewResult.errorRows} errors`
              : 'Run preview to see transformation results'}
            action={
              <Stack direction="row" spacing={1}>
                <input
                  type="file"
                  ref={previewFileRef}
                  hidden
                  accept=".csv,.tsv,.json,.xlsx,.xls"
                  onChange={handlePreviewWithFile}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<UploadFileIcon />}
                  onClick={() => previewFileRef.current?.click()}
                  disabled={previewing}
                >
                  Upload Source File
                </Button>
                <Button
                  size="small"
                  startIcon={<PreviewIcon />}
                  onClick={handlePreview}
                  disabled={previewing || (sourceSampleRows.length === 0 && fieldMappings.length === 0)}
                >
                  {previewing ? 'Running...' : `Run Preview${sourceSampleRows.length > 0 ? ` (${sourceSampleRows.length} rows)` : ''}`}
                </Button>
              </Stack>
            }
          />
          <CardContent>
            {previewing && <LinearProgress sx={{ mb: 2 }} />}
            {previewResult && previewResult.rows.length > 0 ? (
              <Box className="ag-theme-alpine" sx={{ height: 400 }}>
                <AgGridReact<any>
                  modules={[AllCommunityModule]}
                  rowData={previewResult.rows.map((r, i) => ({
                    _rowIndex: i,
                    _filtered: r.filtered,
                    _errors: r.errors.join('; '),
                    ...r.sourceRow,
                    ...Object.fromEntries(
                      Object.entries(r.targetRow || {}).map(([k, v]) => [`_target_${k}`, v])
                    ),
                  }))}
                  columnDefs={[
                    { headerName: '#', field: '_rowIndex', width: 60, pinned: 'left' as const },
                    { headerName: 'Filtered', field: '_filtered', width: 90 },
                    ...source.schema.map((f) => ({
                      headerName: `src.${f.name}`,
                      field: f.name,
                      flex: 1,
                    })),
                    ...target.schema.map((f) => ({
                      headerName: `target.${f.name}`,
                      field: `_target_${f.name}`,
                      flex: 1,
                      cellStyle: { backgroundColor: alpha(theme.palette.success.main, 0.06) },
                    })),
                    { headerName: 'Errors', field: '_errors', flex: 1 },
                  ]}
                  defaultColDef={{ sortable: true, resizable: true }}
                  rowHeight={36}
                  headerHeight={40}
                  suppressCellFocus
                />
              </Box>
            ) : !previewing ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                {sourceSampleRows.length === 0
                  ? 'Upload a source file to preview how your mappings transform real data.'
                  : 'Click "Run Preview" to see how your mappings transform the uploaded data.'}
              </Typography>
            ) : null}
          </CardContent>
        </Card>
      </TabPanel>

      {/* Tab 3: Execute (only for existing mappings) */}
      {!isNew && (
        <TabPanel value={activeTab} index={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardHeader
                  title="Execute Mapping"
                  titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
                />
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <input
                        type="file"
                        ref={executeFileRef}
                        hidden
                        accept=".csv,.tsv,.json,.xlsx,.xls"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setExecuteFile(file);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        variant="outlined"
                        startIcon={<UploadFileIcon />}
                        onClick={() => executeFileRef.current?.click()}
                      >
                        Select Source File
                      </Button>
                      {executeFile && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Selected: {executeFile.name} ({(executeFile.size / 1024).toFixed(1)} KB)
                        </Typography>
                      )}
                    </Box>
                    <Button
                      variant="contained"
                      startIcon={executing ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
                      onClick={handleExecute}
                      disabled={executing || !executeFile || (status !== 'APPROVED' && status !== 'ACTIVE' && status !== 'VALIDATED')}
                      fullWidth
                    >
                      {executing ? 'Executing...' : 'Run Mapping'}
                    </Button>
                    {status === 'DRAFT' && (
                      <Alert severity="warning">Mapping must be validated before execution.</Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Job Status */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardHeader
                  title="Job Status"
                  titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
                />
                <CardContent>
                  {currentJob ? (
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Job ID</Typography>
                        <Typography variant="body2" fontFamily="monospace">{currentJob.jobId}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Status</Typography>
                        <Chip
                          label={currentJob.status}
                          size="small"
                          color={
                            currentJob.status === 'COMPLETED' ? 'success'
                            : currentJob.status === 'FAILED' ? 'error'
                            : currentJob.status === 'RUNNING' ? 'info'
                            : 'default'
                          }
                        />
                      </Stack>
                      {currentJob.progress && (
                        <>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">Rows Processed</Typography>
                            <Typography variant="body2">{currentJob.progress.rowsProcessed}</Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">Rows Skipped</Typography>
                            <Typography variant="body2">{currentJob.progress.rowsSkipped}</Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">Errors</Typography>
                            <Typography variant="body2" color={currentJob.progress.errorCount > 0 ? 'error' : undefined}>
                              {currentJob.progress.errorCount}
                            </Typography>
                          </Stack>
                        </>
                      )}
                      {currentJob.durationMs && (
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">Duration</Typography>
                          <Typography variant="body2">{(currentJob.durationMs / 1000).toFixed(2)}s</Typography>
                        </Stack>
                      )}
                      {currentJob.status === 'RUNNING' && <LinearProgress />}
                      {currentJob.status === 'COMPLETED' && (
                        <Button
                          variant="outlined"
                          startIcon={<DownloadIcon />}
                          onClick={handleDownloadOutput}
                        >
                          Download Output
                        </Button>
                      )}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No job running. Execute a mapping to see status here.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      )}

      {/* Tab 4 (or 3 for new): CEL Reference */}
      <TabPanel value={activeTab} index={isNew ? 3 : 4}>
        <Card>
          <CardHeader
            title="CEL Function Reference"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
            subheader={`${celFunctions.length} functions available`}
          />
          <CardContent>
            {celFunctions.length > 0 ? (
              <>
                {['date', 'numeric', 'string', 'lookup', 'coercion'].map((category) => {
                  const fns = celFunctions.filter((f) => f.category === category);
                  if (fns.length === 0) return null;
                  return (
                    <Accordion key={category} defaultExpanded={category === 'string'}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <FunctionsIcon fontSize="small" />
                          <Typography fontWeight={600} sx={{ textTransform: 'capitalize' }}>{category}</Typography>
                          <Chip label={fns.length} size="small" />
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        {fns.map((fn) => (
                          <Paper key={fn.name} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                            <Typography variant="body2" fontWeight={600} fontFamily="monospace">
                              {fn.signature}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {fn.description}
                            </Typography>
                            {fn.example && (
                              <Typography variant="caption" fontFamily="monospace" sx={{ mt: 0.5, display: 'block', color: theme.palette.info.main }}>
                                Example: {fn.example}
                              </Typography>
                            )}
                          </Paper>
                        ))}
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      {/* AI Auto-Map Dialog */}
      <Dialog
        open={aiDialogOpen}
        onClose={() => !aiRunning && setAiDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AutoFixHighIcon color="secondary" />
            <Typography variant="h6">AI Auto-Map</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Upload a source file and a target file. The AI will infer both schemas,
            analyze sample data, and generate CEL field mappings automatically.
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Source file */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Source File</Typography>
              <input
                type="file"
                ref={aiSourceRef}
                hidden
                accept=".csv,.tsv,.json,.xlsx,.xls"
                onChange={(e) => {
                  setAiSourceFile(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => aiSourceRef.current?.click()}
                fullWidth
                disabled={aiRunning}
              >
                {aiSourceFile ? aiSourceFile.name : 'Choose source file...'}
              </Button>
              {aiSourceFile && (
                <Typography variant="caption" color="text.secondary">
                  {(aiSourceFile.size / 1024).toFixed(1)} KB
                </Typography>
              )}
            </Box>

            {/* Target file */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Target File (example of desired output)</Typography>
              <input
                type="file"
                ref={aiTargetRef}
                hidden
                accept=".csv,.tsv,.json,.xlsx,.xls"
                onChange={(e) => {
                  setAiTargetFile(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => aiTargetRef.current?.click()}
                fullWidth
                disabled={aiRunning}
              >
                {aiTargetFile ? aiTargetFile.name : 'Choose target file...'}
              </Button>
              {aiTargetFile && (
                <Typography variant="caption" color="text.secondary">
                  {(aiTargetFile.size / 1024).toFixed(1)} KB
                </Typography>
              )}
            </Box>

            {aiRunning && (
              <Box>
                <LinearProgress color="secondary" />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                  AI is analyzing schemas and generating field mappings...
                </Typography>
              </Box>
            )}

            {aiMappingResult && !aiRunning && (
              <Alert severity="success">
                Generated {aiMappingResult.fieldMappings.length} mappings
                ({aiMappingResult.sourceStats.fieldsInferred} source fields
                {' → '}{aiMappingResult.targetStats.fieldsInferred} target fields)
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiDialogOpen(false)} disabled={aiRunning}>
            {fieldMappings.length > 0 ? 'Close' : 'Skip — map manually'}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={aiRunning ? <CircularProgress size={18} color="inherit" /> : <AutoFixHighIcon />}
            onClick={handleAiAutoMap}
            disabled={aiRunning || !aiSourceFile || !aiTargetFile}
          >
            {aiRunning ? 'Generating...' : 'Generate Mappings'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DataMappingDesigner;
