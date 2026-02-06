import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Stack,
  Paper,
  Tabs,
  Tab,
  Tooltip,
  alpha,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  ColDef,
  ICellRendererParams,
  CellStyle,
  RowStyle,
} from 'ag-grid-community';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RuleIcon from '@mui/icons-material/Rule';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import {
  validationRules,
  validationResults,
  derivedRollupRules,
  validationSummary,
} from '../../data/validationData';
import {
  ValidationResult,
  ValidationStatus,
  ValidationRule,
  DerivedRollupRule,
} from '../../types';

ModuleRegistry.registerModules([AllCommunityModule]);

// ── Helpers ──────────────────────────────────────────────────

const statusConfig: Record<ValidationStatus, { color: 'success' | 'error' | 'warning' | 'info' | 'default'; icon: React.ReactNode; label: string }> = {
  passed: { color: 'success', icon: <CheckCircleIcon fontSize="small" />, label: 'Passed' },
  failed: { color: 'error', icon: <CancelIcon fontSize="small" />, label: 'Failed' },
  warning: { color: 'warning', icon: <WarningAmberIcon fontSize="small" />, label: 'Warning' },
  running: { color: 'info', icon: <HourglassEmptyIcon fontSize="small" />, label: 'Running' },
  pending: { color: 'default', icon: <HourglassEmptyIcon fontSize="small" />, label: 'Pending' },
  skipped: { color: 'default', icon: <HourglassEmptyIcon fontSize="small" />, label: 'Skipped' },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);

const ruleTypeLabels: Record<string, string> = {
  NAV_TO_LEDGER: 'NAV to Ledger',
  LEDGER_BS_TO_INCST: 'Ledger BS to INCST',
  LEDGER_TF_TO_CLASS: 'Ledger TF to Class',
  POSITION_TO_LOT: 'Position to Lot',
  LEDGER_TO_SUBLEDGER: 'Ledger to Subledger',
  BASIS_LOT_CHECK: 'Basis Lot Check',
};

const rollupCategoryLabels: Record<string, string> = {
  CAPITAL_SUBSCRIPTIONS: 'Capital & Subscriptions',
  DISTRIBUTION: 'Distribution',
  FORWARDS: 'Forwards',
  REPO: 'Repo (RPR)',
  SECURITIES: 'Securities',
  LEDGER_LOAD: 'Ledger Load',
  FUTURES_INCOME_UNREALIZED: 'Futures & Income Unrealized',
};

// ── Cell Renderers ───────────────────────────────────────────

const StatusCellRenderer: React.FC<ICellRendererParams<ValidationResult>> = ({ value }) => {
  const cfg = statusConfig[value as ValidationStatus];
  if (!cfg) return null;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {cfg.icon}
      <Chip label={cfg.label} size="small" color={cfg.color} sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
    </Stack>
  );
};

const VarianceCellRenderer: React.FC<ICellRendererParams<ValidationResult>> = ({ value }) => (
  <span style={{ color: value > 0 ? '#D32F2F' : '#2E7D32', fontWeight: 600 }}>
    {formatCurrency(value)}
  </span>
);

const MatchRateCellRenderer: React.FC<ICellRendererParams<ValidationResult>> = ({ data }) => {
  if (!data) return null;
  const rate = data.lhsRowCount > 0 ? (data.matchedCount / data.lhsRowCount) * 100 : 100;
  return (
    <Chip
      label={`${rate.toFixed(1)}%`}
      size="small"
      color={rate >= 99 ? 'success' : rate >= 95 ? 'warning' : 'error'}
      sx={{ fontWeight: 600, fontSize: '0.7rem', minWidth: 52 }}
    />
  );
};

const RuleTypeCellRenderer: React.FC<ICellRendererParams<ValidationResult>> = ({ value }) => (
  <Chip
    label={ruleTypeLabels[value] || value}
    size="small"
    variant="outlined"
    sx={{ fontSize: '0.7rem' }}
  />
);

const DurationCellRenderer: React.FC<ICellRendererParams<ValidationResult>> = ({ value }) => (
  <Typography variant="caption" color="text.secondary">{value}ms</Typography>
);

// ── Tab Panel ────────────────────────────────────────────────

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

// ── Main Component ───────────────────────────────────────────

const ValidationMatrix: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);

  // ── AG Grid: Validation Results ────────────────────────────
  const resultColDefs = useMemo<ColDef<ValidationResult>[]>(
    () => [
      { headerName: 'Rule', field: 'ruleId', width: 100, pinned: 'left', cellStyle: { fontWeight: 600, color: '#1B3A5C' } as CellStyle },
      { headerName: 'Validation', field: 'ruleName', minWidth: 180, filter: 'agTextColumnFilter' },
      { headerName: 'Type', field: 'ruleType', width: 170, cellRenderer: RuleTypeCellRenderer, filter: 'agSetColumnFilter' },
      { headerName: 'Fund / Account', field: 'account', minWidth: 180, filter: 'agTextColumnFilter', cellStyle: { fontWeight: 500 } as CellStyle },
      { headerName: 'Date', field: 'valuationDate', width: 120, filter: 'agDateColumnFilter' },
      {
        headerName: 'Status',
        field: 'status',
        width: 140,
        cellRenderer: StatusCellRenderer,
        cellStyle: { display: 'flex', alignItems: 'center' } as CellStyle,
        filter: 'agSetColumnFilter',
      },
      {
        headerName: 'Match Rate',
        colId: 'matchRate',
        width: 120,
        cellRenderer: MatchRateCellRenderer,
        cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' } as CellStyle,
        valueGetter: (params: any) => params.data ? (params.data.matchedCount / Math.max(params.data.lhsRowCount, 1)) * 100 : 0,
        filter: 'agNumberColumnFilter',
      },
      { headerName: 'LHS Rows', field: 'lhsRowCount', width: 100, type: 'rightAligned', filter: 'agNumberColumnFilter' },
      { headerName: 'RHS Rows', field: 'rhsRowCount', width: 100, type: 'rightAligned', filter: 'agNumberColumnFilter' },
      { headerName: 'Matched', field: 'matchedCount', width: 100, type: 'rightAligned', filter: 'agNumberColumnFilter' },
      { headerName: 'Breaks', field: 'breakCount', width: 90, type: 'rightAligned', filter: 'agNumberColumnFilter', cellStyle: (params: any) => ({ fontWeight: params.value > 0 ? 700 : 400, color: params.value > 0 ? '#D32F2F' : 'inherit' }) },
      { headerName: 'Total Variance', field: 'totalVariance', width: 150, type: 'rightAligned', cellRenderer: VarianceCellRenderer, filter: 'agNumberColumnFilter' },
      { headerName: 'Max Variance', field: 'maxVariance', width: 140, type: 'rightAligned', cellRenderer: VarianceCellRenderer, filter: 'agNumberColumnFilter' },
      { headerName: 'Duration', field: 'durationMs', width: 100, cellRenderer: DurationCellRenderer },
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

  const getRowStyle = useCallback((params: any): RowStyle | undefined => {
    if (params.data?.status === 'failed') {
      return { borderLeft: '3px solid #D32F2F', background: alpha('#D32F2F', 0.02) };
    }
    if (params.data?.status === 'warning') {
      return { borderLeft: '3px solid #ED6C02', background: alpha('#ED6C02', 0.02) };
    }
    return undefined;
  }, []);

  // ── Group rules by category for the Rule Definitions tab ───
  const groupedRollupRules = useMemo(() => {
    const groups: Record<string, DerivedRollupRule[]> = {};
    derivedRollupRules.forEach((r) => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    return groups;
  }, []);

  return (
    <Box>
      {/* ── Header ──────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Validation Matrix
        </Typography>
        <Typography variant="subtitle1">
          InvestOne → Eagle conversion validation — <strong>February 5, 2026</strong>
        </Typography>
      </Box>

      {/* ── Summary KPI Cards ─────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Total Checks</Typography>
              <Typography variant="h4" fontWeight={700} color="primary.main">
                {validationSummary.totalRules}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3, md: 2 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Passed</Typography>
              <Typography variant="h4" fontWeight={700} color="success.main">
                {validationSummary.passed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3, md: 2 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Failed</Typography>
              <Typography variant="h4" fontWeight={700} color="error.main">
                {validationSummary.failed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3, md: 2 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Warnings</Typography>
              <Typography variant="h4" fontWeight={700} color="warning.main">
                {validationSummary.warnings}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3, md: 2 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Match Rate</Typography>
              <Typography variant="h4" fontWeight={700} color="primary.main">
                {validationSummary.overallMatchRate}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Total Variance</Typography>
              <Typography variant="h5" fontWeight={700} color="error.main">
                {formatCurrency(validationSummary.totalVariance)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Tabbed Content ─────────────────────────────── */}
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
          <Tab icon={<RuleIcon />} iconPosition="start" label="Validation Results" />
          <Tab icon={<CompareArrowsIcon />} iconPosition="start" label="Rule Definitions (LHS vs RHS)" />
          <Tab icon={<AccountTreeIcon />} iconPosition="start" label="Derived Rollup Rules" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {/* ── Tab 0: Validation Results AG Grid ──────── */}
          <TabPanel value={tabValue} index={0}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              All validation checks for the current NAV cycle — click any row to drill into break details
            </Typography>
            <Paper
              sx={{
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                overflow: 'hidden',
                height: 'calc(100vh - 380px)',
                minHeight: 400,
              }}
            >
              <AgGridReact<ValidationResult>
                rowData={validationResults}
                columnDefs={resultColDefs}
                defaultColDef={defaultColDef}
                rowHeight={42}
                headerHeight={40}
                floatingFiltersHeight={36}
                pagination={true}
                paginationPageSize={20}
                paginationPageSizeSelector={[10, 20, 50]}
                enableCellTextSelection={true}
                tooltipShowDelay={300}
                animateRows={true}
                getRowStyle={getRowStyle}
              />
            </Paper>
          </TabPanel>

          {/* ── Tab 1: Rule Definitions ────────────────── */}
          <TabPanel value={tabValue} index={1}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              §1 Validation Matrix — Each rule compares LHS to RHS using defined keys, comparison fields, and filters
            </Typography>
            <Stack spacing={2}>
              {validationRules.map((rule) => (
                <RuleDefinitionCard key={rule.id} rule={rule} theme={theme} />
              ))}
            </Stack>
          </TabPanel>

          {/* ── Tab 2: Derived Rollup Rules ────────────── */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              §2 Derived SubLedger Rollup Rules — Generate the derivedSubLedgerRollup dataset used in Ledger-to-Subledger validation
            </Typography>
            <Stack spacing={2}>
              {Object.entries(groupedRollupRules).map(([category, rules]) => (
                <Accordion
                  key={category}
                  defaultExpanded
                  variant="outlined"
                  disableGutters
                  sx={{ borderRadius: '8px !important', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Chip
                        label={rollupCategoryLabels[category] || category}
                        size="small"
                        color="primary"
                        sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {rules.length} rule(s)
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Rule ID</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Source</TableCell>
                            <TableCell>Ledger Account</TableCell>
                            <TableCell>Data Expression</TableCell>
                            <TableCell>Filter</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rules.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell sx={{ fontWeight: 600, color: '#1B3A5C' }}>{r.id}</TableCell>
                              <TableCell>{r.name}</TableCell>
                              <TableCell>
                                <Chip label={r.sourceTable} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                              </TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.ledgerAccount}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.dataExpression}</TableCell>
                              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#5A6178' }}>{r.filter || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          </TabPanel>
        </Box>
      </Card>
    </Box>
  );
};

// ── Rule Definition Card ─────────────────────────────────────

const RuleDefinitionCard: React.FC<{ rule: ValidationRule; theme: any }> = ({ rule, theme }) => {
  const ruleResults = validationResults.filter((r) => r.ruleId === rule.id);
  const passCount = ruleResults.filter((r) => r.status === 'passed').length;
  const failCount = ruleResults.filter((r) => r.status === 'failed').length;
  const warnCount = ruleResults.filter((r) => r.status === 'warning').length;
  const matchRate = ruleResults.length > 0
    ? ruleResults.reduce((s, r) => s + r.matchedCount, 0) / Math.max(ruleResults.reduce((s, r) => s + r.lhsRowCount, 0), 1) * 100
    : 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 2,
        borderLeft: `4px solid ${
          failCount > 0 ? theme.palette.error.main : warnCount > 0 ? theme.palette.warning.main : theme.palette.success.main
        }`,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={rule.id} size="small" color="primary" sx={{ fontWeight: 700 }} />
            <Typography variant="body1" fontWeight={700}>{rule.name}</Typography>
            <Chip label={`§${rule.section}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {passCount > 0 && <Chip icon={<CheckCircleIcon />} label={`${passCount} passed`} size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
          {failCount > 0 && <Chip icon={<CancelIcon />} label={`${failCount} failed`} size="small" color="error" sx={{ fontSize: '0.7rem' }} />}
          {warnCount > 0 && <Chip icon={<WarningAmberIcon />} label={`${warnCount} warn`} size="small" color="warning" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
          <Tooltip title="Overall match rate for this rule">
            <Chip label={`${matchRate.toFixed(1)}%`} size="small" color={matchRate >= 99 ? 'success' : matchRate >= 95 ? 'warning' : 'error'} sx={{ fontWeight: 700 }} />
          </Tooltip>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {/* LHS */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.03),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
            }}
          >
            <Typography variant="overline" color="primary.main" sx={{ mb: 1, display: 'block' }}>
              LHS (Left-Hand Side)
            </Typography>
            <Stack spacing={0.75}>
              <LabelValue label="Source" value={rule.lhs.source} mono />
              <LabelValue label="Keys" value={rule.lhs.keys.join(' | ')} mono />
              <LabelValue label="Display" value={rule.lhs.displayFields.join(' | ')} />
              <LabelValue label="Compare" value={rule.lhs.compareFields.join(' | ')} mono />
              {rule.lhs.filter && <LabelValue label="Filter" value={rule.lhs.filter} mono />}
            </Stack>
          </Paper>
        </Grid>

        {/* RHS */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.secondary.main, 0.03),
              border: `1px solid ${alpha(theme.palette.secondary.main, 0.12)}`,
            }}
          >
            <Typography variant="overline" color="secondary.main" sx={{ mb: 1, display: 'block' }}>
              RHS (Right-Hand Side)
            </Typography>
            <Stack spacing={0.75}>
              <LabelValue label="Source" value={rule.rhs.source} mono />
              <LabelValue label="Keys" value={rule.rhs.keys.join(' | ')} mono />
              <LabelValue label="Display" value={rule.rhs.displayFields.join(' | ')} />
              <LabelValue label="Compare" value={rule.rhs.compareFields.join(' | ')} mono />
              {rule.rhs.filter && <LabelValue label="Filter" value={rule.rhs.filter} mono />}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );
};

const LabelValue: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <Stack direction="row" spacing={1} alignItems="baseline">
    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60, fontWeight: 600 }}>
      {label}:
    </Typography>
    <Typography
      variant="body2"
      sx={{
        fontFamily: mono ? 'monospace' : 'inherit',
        fontSize: mono ? '0.75rem' : '0.8125rem',
        wordBreak: 'break-word',
      }}
    >
      {value}
    </Typography>
  </Stack>
);

export default ValidationMatrix;
