import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider,
  Alert,
  alpha,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, ColDef, ICellRendererParams, CellStyle } from 'ag-grid-community';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsIcon from '@mui/icons-material/Settings';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DescriptionIcon from '@mui/icons-material/Description';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import ScienceIcon from '@mui/icons-material/Science';
import HistoryIcon from '@mui/icons-material/History';
import RuleIcon from '@mui/icons-material/Rule';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  breaks,
  sideBySideData,
  candidateCauses,
  hypothesisTests,
  evidenceLog,
  lineageNodes,
} from '../../data/mockData';
import {
  validationRules,
  validationResults,
} from '../../data/validationData';
import { HypothesisTest, SideBySideRow, ValidationResult, ValidationStatus } from '../../types';

ModuleRegistry.registerModules([AllCommunityModule]);

// ── AG Grid Cell Renderers ─────────────────────────────────
const MatchCellRenderer: React.FC<ICellRendererParams<SideBySideRow>> = ({ value }) =>
  value ? (
    <CheckCircleIcon fontSize="small" color="success" />
  ) : (
    <CancelIcon fontSize="small" color="error" />
  );

const ResultCellRenderer: React.FC<ICellRendererParams<HypothesisTest>> = ({ value }) => {
  const iconMap: Record<string, React.ReactNode> = {
    pass: <CheckCircleIcon fontSize="small" color="success" />,
    fail: <CancelIcon fontSize="small" color="error" />,
    inconclusive: <HelpOutlineIcon fontSize="small" color="disabled" />,
    pending: <HourglassEmptyIcon fontSize="small" color="warning" />,
  };
  const colorMap: Record<string, 'success' | 'error' | 'default' | 'warning'> = {
    pass: 'success',
    fail: 'error',
    inconclusive: 'default',
    pending: 'warning',
  };
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {iconMap[value] || null}
      <Chip
        label={value}
        size="small"
        color={colorMap[value] || 'default'}
        sx={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.7rem' }}
      />
    </Stack>
  );
};

const CategoryCellRenderer: React.FC<ICellRendererParams<HypothesisTest>> = ({ value }) => (
  <Chip
    label={String(value).replace('_', ' ')}
    size="small"
    variant="outlined"
    sx={{ textTransform: 'capitalize', fontSize: '0.7rem' }}
  />
);

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

const InvestigationWorkspace: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [outcomeDialog, setOutcomeDialog] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');

  // Use first break as the investigation target
  const brk = breaks[0];

  const handleOutcome = (action: string) => {
    setOutcomeDialog(action);
  };

  const handleConfirmOutcome = () => {
    setOutcomeDialog(null);
    setRationale('');
  };

  // ── AG Grid Column Definitions ───────────────────────────
  const compactDefaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      cellStyle: {
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.8125rem',
        fontFamily: '"Inter", "Roboto", sans-serif',
      },
    }),
    []
  );

  const sideBySideColDefs = useMemo<ColDef[]>(
    () => [
      { headerName: 'Field', field: 'field', minWidth: 160, cellStyle: { fontWeight: 500 } as CellStyle },
      { headerName: 'Our Value', field: 'ourValue', minWidth: 200, cellStyle: { fontFamily: 'monospace' } as CellStyle },
      { headerName: 'Incumbent Value', field: 'incumbentValue', minWidth: 200, cellStyle: { fontFamily: 'monospace' } as CellStyle },
      {
        headerName: 'Match',
        field: 'match',
        width: 100,
        cellRenderer: MatchCellRenderer,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' } as CellStyle,
      },
    ],
    []
  );

  const hypothesisColDefs = useMemo<ColDef[]>(
    () => [
      { headerName: 'Test', field: 'name', minWidth: 200, cellStyle: { fontWeight: 600 } as CellStyle },
      { headerName: 'Category', field: 'category', width: 160, cellRenderer: CategoryCellRenderer },
      {
        headerName: 'Result',
        field: 'result',
        width: 160,
        cellRenderer: ResultCellRenderer,
        cellStyle: { display: 'flex', alignItems: 'center' } as CellStyle,
      },
      { headerName: 'Detail', field: 'detail', minWidth: 300, flex: 1, tooltipField: 'detail' },
      {
        headerName: 'Confidence',
        field: 'confidence',
        width: 120,
        valueFormatter: (params: any) =>
          params.value > 0 ? `${(params.value * 100).toFixed(0)}%` : '—',
        cellStyle: { textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' } as CellStyle,
      },
    ],
    []
  );

  return (
    <Box>
      {/* ── Break Summary Header ────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" spacing={2}>
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h5" fontWeight={700}>
                  {brk.id}
                </Typography>
                <Chip label={brk.severity} size="small" color="error" sx={{ fontWeight: 600, textTransform: 'capitalize' }} />
                <Chip label={brk.status} size="small" variant="outlined" color="warning" sx={{ textTransform: 'capitalize' }} />
                <Chip label={brk.breakType.replace('_', ' ')} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
              </Stack>
              <Typography variant="body1" color="text.secondary">
                <strong>{brk.fund}</strong> · {brk.component} · {brk.accountGroup}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Date: {brk.date} · Age: {brk.ageDays} day(s) · Currency: {brk.currency}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="overline" color="text.secondary">
                Variance (Base)
              </Typography>
              <Typography variant="h4" fontWeight={700} color="error.main">
                ${Math.abs(brk.varianceBase).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end" sx={{ mt: 0.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Confidence:
                </Typography>
                <Chip
                  label={`${(brk.confidence * 100).toFixed(0)}%`}
                  size="small"
                  color="success"
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
            </Box>
          </Stack>

          {/* ── Top Candidate Cause ─────────────────── */}
          <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Top Candidate Cause:
            </Typography>
            <Typography variant="body2">{brk.topCandidateCause}</Typography>
          </Alert>
        </CardContent>
      </Card>

      {/* ── One-Click Outcomes ───────────────────────── */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 3 }} flexWrap="wrap">
        <Button
          variant="outlined"
          color="warning"
          startIcon={<SettingsIcon />}
          onClick={() => handleOutcome('config_issue')}
          sx={{ borderRadius: 2 }}
        >
          Mark as Config Issue
        </Button>
        <Button
          variant="outlined"
          color="info"
          startIcon={<AccessTimeIcon />}
          onClick={() => handleOutcome('timing_difference')}
          sx={{ borderRadius: 2 }}
        >
          Mark as Timing Difference
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<DescriptionIcon />}
          onClick={() => handleOutcome('correction_je')}
          sx={{ borderRadius: 2 }}
        >
          Create Correction JE Proposal
        </Button>
      </Stack>

      {/* ── Tabbed Investigation ─────────────────────── */}
      <Card>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            borderBottom: `1px solid ${theme.palette.divider}`,
            px: 2,
            '& .MuiTab-root': { minHeight: 48 },
          }}
        >
          <Tab icon={<AccountTreeIcon />} iconPosition="start" label="Lineage Graph" />
          <Tab icon={<CompareArrowsIcon />} iconPosition="start" label="Side-by-Side" />
          <Tab icon={<FormatListNumberedIcon />} iconPosition="start" label="Candidate Set" />
          <Tab icon={<ScienceIcon />} iconPosition="start" label="Hypothesis Tests" />
          <Tab icon={<HistoryIcon />} iconPosition="start" label="Evidence Log" />
          <Tab icon={<RuleIcon />} iconPosition="start" label="Validation Rules" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {/* ── Tab 0: Lineage Graph ──────────────────── */}
          <TabPanel value={tabValue} index={0}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              NAV Component → Postings → JE Lines → Subledger Docs → Events
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                overflowX: 'auto',
                py: 3,
                px: 2,
                gap: 0,
              }}
            >
              {lineageNodes.map((node, idx) => {
                const typeColors: Record<string, string> = {
                  nav_component: theme.palette.primary.main,
                  posting: theme.palette.secondary.main,
                  je_line: theme.palette.warning.main,
                  subledger_doc: theme.palette.info.main,
                  event: theme.palette.success.main,
                };
                const color = typeColors[node.type] || theme.palette.grey[500];
                return (
                  <React.Fragment key={node.id}>
                    <Paper
                      elevation={2}
                      sx={{
                        p: 2,
                        minWidth: 160,
                        maxWidth: 200,
                        borderRadius: 2,
                        borderTop: `3px solid ${color}`,
                        bgcolor: alpha(color, 0.04),
                        flexShrink: 0,
                      }}
                    >
                      <Chip
                        label={node.type.replace('_', ' ')}
                        size="small"
                        sx={{
                          bgcolor: alpha(color, 0.12),
                          color: color,
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          textTransform: 'uppercase',
                          mb: 1,
                        }}
                      />
                      <Typography variant="body2" fontWeight={600}>
                        {node.label}
                      </Typography>
                      {node.value !== undefined && (
                        <Typography variant="caption" color="text.secondary">
                          ${Math.abs(node.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </Typography>
                      )}
                    </Paper>
                    {idx < lineageNodes.length - 1 && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          mx: 1,
                          flexShrink: 0,
                        }}
                      >
                        <Box
                          sx={{
                            width: 40,
                            height: 2,
                            bgcolor: theme.palette.divider,
                          }}
                        />
                        <Box
                          sx={{
                            width: 0,
                            height: 0,
                            borderTop: '5px solid transparent',
                            borderBottom: '5px solid transparent',
                            borderLeft: `8px solid ${theme.palette.divider}`,
                          }}
                        />
                      </Box>
                    )}
                  </React.Fragment>
                );
              })}
            </Box>
          </TabPanel>

          {/* ── Tab 1: Side-by-Side (AG Grid) ─────────── */}
          <TabPanel value={tabValue} index={1}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Your Chain vs Incumbent Chain — Field-by-field comparison
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderRadius: 2, overflow: 'hidden', height: 420 }}
            >
              <AgGridReact<SideBySideRow>
                rowData={sideBySideData}
                columnDefs={sideBySideColDefs}
                defaultColDef={compactDefaultColDef}
                domLayout="normal"
                rowHeight={38}
                headerHeight={38}
                getRowStyle={(params) =>
                  params.data && !params.data.match
                    ? { background: alpha(theme.palette.error.main, 0.04) }
                    : undefined
                }
              />
            </Paper>
          </TabPanel>

          {/* ── Tab 2: Candidate Set ──────────────────── */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Minimal Explaining Set — Ranked by confidence
            </Typography>
            <Stack spacing={2}>
              {candidateCauses.map((c) => (
                <Paper
                  key={c.rank}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    borderLeft: `4px solid ${
                      c.confidence >= 0.8
                        ? theme.palette.success.main
                        : c.confidence >= 0.5
                        ? theme.palette.warning.main
                        : theme.palette.grey[400]
                    }`,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Chip
                        label={`#${c.rank}`}
                        size="small"
                        color="primary"
                        sx={{ fontWeight: 700, minWidth: 36 }}
                      />
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {c.description}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                          <Chip
                            label={c.breakType.replace('_', ' ')}
                            size="small"
                            variant="outlined"
                            sx={{ textTransform: 'capitalize', fontSize: '0.7rem' }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {c.evidenceCount} evidence item(s)
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                    <Box sx={{ minWidth: 100, textAlign: 'right' }}>
                      <Typography variant="body2" fontWeight={700}>
                        {(c.confidence * 100).toFixed(0)}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={c.confidence * 100}
                        sx={{
                          mt: 0.5,
                          height: 4,
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 2,
                            bgcolor:
                              c.confidence >= 0.8
                                ? 'success.main'
                                : c.confidence >= 0.5
                                ? 'warning.main'
                                : 'grey.400',
                          },
                        }}
                      />
                    </Box>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </TabPanel>

          {/* ── Tab 3: Hypothesis Tests (AG Grid) ────── */}
          <TabPanel value={tabValue} index={3}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Automated hypothesis checks with results
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderRadius: 2, overflow: 'hidden', height: 340 }}
            >
              <AgGridReact<HypothesisTest>
                rowData={hypothesisTests}
                columnDefs={hypothesisColDefs}
                defaultColDef={compactDefaultColDef}
                domLayout="normal"
                rowHeight={42}
                headerHeight={38}
              />
            </Paper>
          </TabPanel>

          {/* ── Tab 4: Evidence Log ───────────────────── */}
          <TabPanel value={tabValue} index={4}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Every query run, outputs, and config versions
            </Typography>
            <Stack spacing={1}>
              {evidenceLog.map((ev) => (
                <Accordion
                  key={ev.id}
                  variant="outlined"
                  disableGutters
                  sx={{ borderRadius: '8px !important', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', pr: 2 }}>
                      <Chip
                        label={ev.queryType}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', fontWeight: 600 }}
                      />
                      <Typography variant="body2" fontWeight={500} sx={{ flexGrow: 1 }}>
                        {ev.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </Typography>
                      {ev.configVersion && (
                        <Chip label={ev.configVersion} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                      )}
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Paper
                      sx={{
                        p: 1.5,
                        bgcolor: alpha(theme.palette.primary.main, 0.03),
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {ev.output}
                    </Paper>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          </TabPanel>

          {/* ── Tab 5: Validation Rules ─────────────── */}
          <TabPanel value={tabValue} index={5}>
            <ValidationRulesPanel fund={brk.fund} theme={theme} />
          </TabPanel>
        </Box>
      </Card>

      {/* ── Outcome Dialogs ─────────────────────────── */}
      <Dialog
        open={outcomeDialog === 'config_issue'}
        onClose={() => setOutcomeDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Mark as Config Issue</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will open a config diff and generate a recommended patch for the pricing source mapping mismatch.
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, fontFamily: 'monospace', fontSize: '0.8rem' }}>
            <Typography variant="caption" color="error.main" display="block">
              - price_source: "Reuters EOD" # incumbent v2.3
            </Typography>
            <Typography variant="caption" color="success.main" display="block">
              + price_source: "Bloomberg EOD" # recommended v2.4
            </Typography>
            <Typography variant="caption" color="error.main" display="block">
              - price_cutoff: "16:30 GMT"
            </Typography>
            <Typography variant="caption" color="success.main" display="block">
              + price_cutoff: "16:00 EST"
            </Typography>
          </Paper>
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Additional notes (optional)"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOutcomeDialog(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleConfirmOutcome}>
            Apply Config Patch
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={outcomeDialog === 'timing_difference'}
        onClose={() => setOutcomeDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Mark as Incumbent Timing Difference</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Record the rationale and close this break as an expected timing difference.
          </Typography>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            Incumbent uses T-1 pricing while our system uses T pricing. This is a known operational difference.
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            size="small"
            placeholder="e.g., Confirmed with operations team that incumbent runs EOD pricing at T-1..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOutcomeDialog(null)}>Cancel</Button>
          <Button variant="contained" color="info" onClick={handleConfirmOutcome}>
            Record & Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={outcomeDialog === 'correction_je'}
        onClose={() => setOutcomeDialog(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Create Correction JE Proposal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Generate a journal entry template with supporting evidence pack.
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>GL 4010 — Unrealized P&L</TableCell>
                  <TableCell>Price correction AAPL (T-1 → T)</TableCell>
                  <TableCell align="right">$45,230.12</TableCell>
                  <TableCell align="right">—</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>GL 1010 — Investment at MV</TableCell>
                  <TableCell>Market value adjustment AAPL</TableCell>
                  <TableCell align="right">—</TableCell>
                  <TableCell align="right">$45,230.12</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Evidence Pack
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="caption">• Price comparison: Bloomberg $242.15 vs Reuters $239.13</Typography>
            <Typography variant="caption">• Position: 15,000 shares AAPL</Typography>
            <Typography variant="caption">• Variance: ($242.15 - $239.13) × 15,000 = $45,300 (rounded to $45,230.12 after fees)</Typography>
            <Typography variant="caption">• Similar resolved breaks: BRK-045, BRK-067, BRK-089</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOutcomeDialog(null)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleConfirmOutcome}>
            Generate JE & Evidence Pack
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ── Validation Rules Panel (Tab 5) ───────────────────────────

const valStatusConfig: Record<ValidationStatus, { color: 'success' | 'error' | 'warning' | 'info' | 'default'; icon: React.ReactNode; label: string }> = {
  passed: { color: 'success', icon: <CheckCircleIcon fontSize="small" />, label: 'Passed' },
  failed: { color: 'error', icon: <CancelIcon fontSize="small" />, label: 'Failed' },
  warning: { color: 'warning', icon: <WarningAmberIcon fontSize="small" />, label: 'Warning' },
  running: { color: 'info', icon: <HourglassEmptyIcon fontSize="small" />, label: 'Running' },
  pending: { color: 'default', icon: <HourglassEmptyIcon fontSize="small" />, label: 'Pending' },
  skipped: { color: 'default', icon: <HourglassEmptyIcon fontSize="small" />, label: 'Skipped' },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);

const ValidationRulesPanel: React.FC<{ fund: string; theme: any }> = ({ fund, theme }) => {
  const fundResults = validationResults.filter((r) => r.account === fund);
  const passCount = fundResults.filter((r) => r.status === 'passed').length;
  const failCount = fundResults.filter((r) => r.status === 'failed').length;
  const warnCount = fundResults.filter((r) => r.status === 'warning').length;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        InvestOne → Eagle validation checks for <strong>{fund}</strong> — showing which rules triggered breaks relevant to this investigation
      </Typography>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2.5 }}>
        <Chip icon={<CheckCircleIcon />} label={`${passCount} passed`} size="small" color="success" variant="outlined" />
        {failCount > 0 && <Chip icon={<CancelIcon />} label={`${failCount} failed`} size="small" color="error" />}
        {warnCount > 0 && <Chip icon={<WarningAmberIcon />} label={`${warnCount} warnings`} size="small" color="warning" variant="outlined" />}
      </Stack>

      <Stack spacing={1.5}>
        {validationRules.map((rule) => {
          const result = fundResults.find((r) => r.ruleId === rule.id);
          const status = result?.status || 'pending';
          const cfg = valStatusConfig[status];
          const matchRate = result && result.lhsRowCount > 0
            ? (result.matchedCount / result.lhsRowCount) * 100
            : 100;

          return (
            <Paper
              key={rule.id}
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                borderLeft: `4px solid ${
                  status === 'failed'
                    ? theme.palette.error.main
                    : status === 'warning'
                    ? theme.palette.warning.main
                    : theme.palette.success.main
                }`,
                bgcolor: status === 'failed' ? alpha(theme.palette.error.main, 0.02) : 'transparent',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Chip label={rule.id} size="small" color="primary" sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{rule.name}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {rule.lhs.source} vs {rule.rhs.source}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Keys: {rule.lhs.keys.join(', ')}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  {result && (
                    <>
                      <Chip
                        label={`${matchRate.toFixed(1)}%`}
                        size="small"
                        color={matchRate >= 99 ? 'success' : matchRate >= 95 ? 'warning' : 'error'}
                        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                      />
                      {result.breakCount > 0 && (
                        <Chip
                          label={`${result.breakCount} break(s) · ${formatCurrency(result.totalVariance)}`}
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      )}
                    </>
                  )}
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {cfg.icon}
                    <Chip label={cfg.label} size="small" color={cfg.color} sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                  </Stack>
                </Stack>
              </Stack>

              {rule.lhs.filter && (
                <Stack direction="row" spacing={2} sx={{ mt: 1.5, pl: 1 }}>
                  <Box>
                    <Typography variant="caption" color="primary.main" fontWeight={600}>LHS Filter:</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', ml: 0.5 }}>
                      {rule.lhs.filter}
                    </Typography>
                  </Box>
                  {rule.rhs.filter && (
                    <Box>
                      <Typography variant="caption" color="secondary.main" fontWeight={600}>RHS Filter:</Typography>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', ml: 0.5 }}>
                        {rule.rhs.filter}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              )}
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};

export default InvestigationWorkspace;
