import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Chip,
  Stack,
  Paper,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Button,
  IconButton,
  Tooltip,
  Divider,
  alpha,
  useTheme,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Fab,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DescriptionIcon from '@mui/icons-material/Description';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import GppGoodIcon from '@mui/icons-material/GppGood';
import BlockIcon from '@mui/icons-material/Block';
import {
  fetchMmifEvent,
  fetchMmifSummary,
  fetchMmifEventBreaks,
  fetchMmifEventRuns,
  fetchMmifValidationRules,
  fetchMmifMapping,
  runMmifAgentAnalysis,
  fetchMmifAgentAnalysis,
} from '../../services/api';
import {
  MmifEvent,
  MmifEventStatus,
  MmifSummary,
  MmifBreakRecord,
  MmifValidationRule,
  MmifAgentAnalysis,
  MmifAttestationReport,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import MmifAgentPipeline from '../../components/shared/MmifAgentPipeline';
import MmifLevelDrillDown from '../../components/shared/MmifLevelDrillDown';
import MmifChatPanel from '../../components/shared/MmifChatPanel';

const mmifStatusLabels: Record<MmifEventStatus, string> = {
  DRAFT: 'Draft',
  MAPPING: 'Mapping',
  EXTRACTION: 'Extraction',
  RECONCILIATION: 'Reconciliation',
  REVIEW: 'Review',
  FILED: 'Filed',
};

const severityIcon = (severity: string) => {
  switch (severity) {
    case 'HARD': return <ErrorIcon fontSize="small" color="error" />;
    case 'SOFT': return <WarningAmberIcon fontSize="small" color="warning" />;
    case 'DERIVED': return <InfoOutlinedIcon fontSize="small" color="info" />;
    case 'ADVISORY': return <InfoOutlinedIcon fontSize="small" color="action" />;
    default: return null;
  }
};

const statusChip = (status: string) => {
  switch (status) {
    case 'PASSED': return <Chip label="Pass" size="small" color="success" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />;
    case 'FAILED': return <Chip label="Fail" size="small" color="error" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />;
    case 'WARNING': return <Chip label="Warning" size="small" color="warning" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />;
    default: return <Chip label={status} size="small" />;
  }
};

const formatCurrency = (val: number): string => {
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(2);
};

// ── Attestation Tab ──────────────────────────────────────────

const AttestationTab: React.FC<{ report: MmifAttestationReport | null | undefined }> = ({ report }) => {
  const theme = useTheme();

  if (!report) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <GppGoodIcon sx={{ fontSize: 48, opacity: 0.25, mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          No attestation report available. Run the agent analysis to generate one.
        </Typography>
      </Box>
    );
  }

  const clearanceColor = report.submissionClearance ? 'success' : 'error';
  const readinessColor =
    report.readinessScore >= 90 ? 'success' : report.readinessScore >= 70 ? 'warning' : 'error';

  return (
    <Stack spacing={3}>
      {/* Clearance Banner */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2,
          borderColor: report.submissionClearance
            ? theme.palette.success.main
            : theme.palette.error.main,
          bgcolor: alpha(
            report.submissionClearance ? theme.palette.success.main : theme.palette.error.main,
            0.04
          ),
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          {report.submissionClearance ? (
            <GppGoodIcon sx={{ fontSize: 40, color: 'success.main' }} />
          ) : (
            <BlockIcon sx={{ fontSize: 40, color: 'error.main' }} />
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={700} color={report.submissionClearance ? 'success.main' : 'error.main'}>
              {report.submissionClearance ? 'Cleared for Submission' : 'Submission Blocked'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {report.fundAccount} · {report.filingPeriod} · ID: {report.attestationId}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Readiness Score
            </Typography>
            <Typography variant="h4" fontWeight={700} color={`${readinessColor}.main`}>
              {report.readinessScore}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={report.readinessScore}
              color={readinessColor}
              sx={{ width: 100, height: 6, borderRadius: 3, mt: 0.5 }}
            />
          </Box>
        </Stack>
      </Paper>

      {/* Summary Stats */}
      <Grid container spacing={2}>
        {[
          { label: 'Total Rules', value: report.totalRules, color: 'text.primary' },
          { label: 'Passed', value: report.passed, color: 'success.main' },
          { label: 'Warnings', value: report.warnings, color: 'warning.main' },
          { label: 'Failed', value: report.failed, color: 'error.main' },
          { label: 'Hard Failures', value: report.hardFailures, color: 'error.dark' },
        ].map(({ label, value, color }) => (
          <Grid size={{ xs: 6, sm: 'auto' }} key={label} sx={{ flex: 1 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="h4" fontWeight={700} color={color}>
                  {value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Rule-by-rule checklist */}
      {report.ruleResults?.length > 0 && (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
            Rule Results
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 100 }}>Rule</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 80 }}>Severity</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 80 }} align="center">Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 100 }} align="right">Variance</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 80 }} align="center">Confidence</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Root Cause</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.ruleResults.map((r) => {
                  const rowBg =
                    r.status === 'FAILED'
                      ? alpha(theme.palette.error.main, 0.04)
                      : r.status === 'WARNING'
                      ? alpha(theme.palette.warning.main, 0.04)
                      : 'transparent';
                  return (
                    <TableRow key={r.ruleId} sx={{ bgcolor: rowBg }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} fontFamily="monospace" fontSize="0.75rem">
                          {r.ruleId.replace('_', '-')}
                        </Typography>
                      </TableCell>
                      <TableCell>{r.ruleName}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {severityIcon(r.severity)}
                          <Typography variant="caption">{r.severity}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="center">{statusChip(r.status)}</TableCell>
                      <TableCell align="right">
                        {r.variance !== undefined ? (
                          <Typography variant="body2" fontFamily="monospace" color="error" fontWeight={600}>
                            {formatCurrency(r.variance)}
                          </Typography>
                        ) : (
                          <CheckCircleIcon fontSize="small" color="success" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {r.confidence !== undefined ? (
                          <Chip
                            label={`${Math.round(r.confidence * 100)}%`}
                            size="small"
                            color={r.confidence >= 0.8 ? 'success' : r.confidence >= 0.5 ? 'warning' : 'error'}
                            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {r.rootCause ?? '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Stack>
  );
};

// ── Main Page ────────────────────────────────────────────────

const MmifReconciliation: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const { permissions } = useAuth();
  const isReadOnly = permissions.screens.mmifReconciliation.readOnly;

  const [event, setEvent] = useState<MmifEvent | null>(null);
  const [summary, setSummary] = useState<MmifSummary | null>(null);
  const [breaks, setBreaks] = useState<MmifBreakRecord[]>([]);
  const [rules, setRules] = useState<MmifValidationRule[]>([]);
  const [latestRun, setLatestRun] = useState<any>(null);
  const [mappingConfigs, setMappingConfigs] = useState<any[]>([]);
  const [expandedMapping, setExpandedMapping] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);

  // Agent analysis state
  const [agentAnalysis, setAgentAnalysis] = useState<MmifAgentAnalysis | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);

  // Chat panel state
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [evt, sum, brks, rls, runs, maps] = await Promise.all([
          fetchMmifEvent(eventId),
          fetchMmifSummary(eventId),
          fetchMmifEventBreaks(eventId),
          fetchMmifValidationRules(),
          fetchMmifEventRuns(eventId),
          fetchMmifMapping(eventId).catch(() => []),
        ]);
        setEvent(evt as MmifEvent);
        setSummary(sum as MmifSummary);
        setBreaks(brks as MmifBreakRecord[]);
        setRules(rls as MmifValidationRule[]);
        setLatestRun(runs.length > 0 ? runs[0] : null);
        setMappingConfigs(maps as any[]);
      } catch (err) {
        console.error('Failed to load MMIF event:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  // Fetch existing agent analysis on mount
  useEffect(() => {
    if (!eventId) return;
    fetchMmifAgentAnalysis(eventId)
      .then((data) => {
        if (data) setAgentAnalysis(data as MmifAgentAnalysis);
      })
      .catch(() => {
        // No existing analysis — that's fine
      });
  }, [eventId]);

  const handleRunAnalysis = async () => {
    if (!eventId || agentLoading) return;
    setAgentLoading(true);
    try {
      const result = await runMmifAgentAnalysis(eventId);
      setAgentAnalysis(result as MmifAgentAnalysis);
    } catch (err) {
      console.error('Agent analysis failed:', err);
    } finally {
      setAgentLoading(false);
    }
  };

  if (loading) return <LinearProgress />;
  if (!event || !summary) return <Typography>Event not found</Typography>;

  // Group breaks by fund
  const breaksByFund: Record<string, MmifBreakRecord[]> = {};
  breaks.forEach((b) => {
    if (!breaksByFund[b.fundAccount]) breaksByFund[b.fundAccount] = [];
    breaksByFund[b.fundAccount].push(b);
  });

  // Build rule results from latest run
  const ruleResults = latestRun?.results || [];

  // Attestation report (from agent analysis or null)
  const attestationReport: MmifAttestationReport | null | undefined = agentAnalysis?.attestationReport;

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/mmif')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <DescriptionIcon color="primary" sx={{ fontSize: 28 }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {event.eventName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {event.eventId} — {event.regulatoryBody} — {event.filingPeriod}
          </Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Chip label={mmifStatusLabels[event.status]} color="warning" sx={{ fontWeight: 600 }} />
      </Stack>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="primary" fontWeight={700}>{summary.totalFunds}</Typography>
              <Typography variant="caption" color="text.secondary">Total Funds</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="error" fontWeight={700}>{summary.totalBreaks}</Typography>
              <Typography variant="caption" color="text.secondary">Total Breaks</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="warning.main" fontWeight={700}>{summary.fundsWithBreaks}</Typography>
              <Typography variant="caption" color="text.secondary">Funds with Breaks</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h4" color="text.secondary" fontWeight={700}>
                {new Date(event.filingDeadline).toLocaleDateString('en-IE', { month: 'short', day: 'numeric' })}
              </Typography>
              <Typography variant="caption" color="text.secondary">Filing Deadline</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Severity Breakdown */}
      {Object.keys(summary.breaksBySeverity).length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          {Object.entries(summary.breaksBySeverity).map(([sev, count]) => (
            <Chip
              key={sev}
              icon={severityIcon(sev) || undefined}
              label={`${sev}: ${count}`}
              size="small"
              variant="outlined"
              color={sev === 'HARD' ? 'error' : sev === 'SOFT' ? 'warning' : 'default'}
            />
          ))}
        </Stack>
      )}

      {/* Tabs */}
      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label="Validation Rules" />
          <Tab label="Breaks by Fund" />
          <Tab label="Fund Details" />
          <Tab label="Mapping Config" />
          <Tab
            label={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <SmartToyIcon sx={{ fontSize: 16 }} />
                <span>Agent Analysis</span>
              </Stack>
            }
          />
          <Tab
            label={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <GppGoodIcon sx={{ fontSize: 16 }} />
                <span>Attestation</span>
              </Stack>
            }
          />
        </Tabs>

        {/* Tab 0: Validation Rules Matrix */}
        {activeTab === 0 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              MMIF Validation Rules (VR-001 through VR-015)
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: 100 }}>Rule</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 80 }}>Severity</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 80 }}>Section</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 80 }}>Tolerance</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 80 }}>Breaks</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rules.map((rule) => {
                    const breakCount = summary.breaksByRule[rule.ruleId] || 0;
                    return (
                      <TableRow
                        key={rule.ruleId}
                        sx={{
                          bgcolor: breakCount > 0 ? alpha(theme.palette.error.main, 0.04) : 'transparent',
                        }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {rule.ruleId.replace('_', '-')}
                          </Typography>
                        </TableCell>
                        <TableCell>{rule.ruleName}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {severityIcon(rule.severity)}
                            <Typography variant="caption">{rule.severity}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>{rule.mmifSection || '—'}</TableCell>
                        <TableCell>{rule.tolerance}</TableCell>
                        <TableCell>
                          {breakCount > 0 ? (
                            <Chip label={breakCount} size="small" color="error" sx={{ fontWeight: 600 }} />
                          ) : (
                            <CheckCircleIcon fontSize="small" color="success" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">{rule.description}</Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Tab 1: Breaks by Fund */}
        {activeTab === 1 && (
          <Box sx={{ p: 2 }}>
            {breaks.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No breaks detected
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Break ID</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Fund</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Rule</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Section</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Eagle (LHS)</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">MMIF (RHS)</TableCell>
                      <TableCell sx={{ fontWeight: 600 }} align="right">Variance</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>State</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {breaks.map((b) => (
                      <TableRow key={b.breakId}>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                            {b.breakId}
                          </Typography>
                        </TableCell>
                        <TableCell>{b.fundName}</TableCell>
                        <TableCell>
                          <Chip label={b.ruleId.replace('_', '-')} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            {severityIcon(b.severity)}
                            <Typography variant="caption">{b.severity}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>{b.mmifSection || '—'}</TableCell>
                        <TableCell align="right">{formatCurrency(b.lhsValue)}</TableCell>
                        <TableCell align="right">{formatCurrency(b.rhsValue)}</TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color="error"
                            fontWeight={600}
                          >
                            {formatCurrency(b.variance)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={b.state} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Tab 2: Fund Details */}
        {activeTab === 2 && (
          <Box sx={{ p: 2 }}>
            <Grid container spacing={2}>
              {event.funds.map((fund) => {
                const fundBreaks = breaksByFund[fund.account] || [];
                return (
                  <Grid size={{ xs: 12, sm: 6 }} key={fund.account}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box>
                            <Typography variant="subtitle2" fontWeight={600}>{fund.fundName}</Typography>
                            <Typography variant="caption" color="text.secondary">{fund.account}</Typography>
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            <Chip label={fund.fundType} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                            <Chip label={fund.fundDomicile} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                          </Stack>
                        </Stack>
                        {fund.cbiCode && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            CBI Code: {fund.cbiCode}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          Share Classes: {fund.shareClasses.join(', ')}
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Stack direction="row" spacing={1} alignItems="center">
                          {fundBreaks.length > 0 ? (
                            <Chip
                              icon={<ErrorIcon />}
                              label={`${fundBreaks.length} break${fundBreaks.length > 1 ? 's' : ''}`}
                              size="small"
                              color="error"
                              variant="outlined"
                            />
                          ) : (
                            <Chip
                              icon={<CheckCircleIcon />}
                              label="All passed"
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          )}
                          <Chip
                            label={fund.status.replace('_', ' ')}
                            size="small"
                            color={fund.status === 'PASSED' ? 'success' : fund.status === 'IN_PARALLEL' ? 'warning' : 'default'}
                          />
                        </Stack>
                        {fundBreaks.length > 0 && (
                          <Stack spacing={0.5} sx={{ mt: 1 }}>
                            {fundBreaks.map((b) => (
                              <Typography key={b.breakId} variant="caption" color="error">
                                {b.ruleId.replace('_', '-')}: {b.ruleName} — variance {formatCurrency(b.variance)}
                              </Typography>
                            ))}
                          </Stack>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}

        {/* Tab 3: Mapping Config */}
        {activeTab === 3 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Eagle GL to MMIF Section Mapping
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Mapping configurations define how Eagle trial balance accounts map to MMIF taxonomy sections.
              Each fund requires a mapping configuration before reconciliation can proceed.
            </Typography>
            <Stack spacing={2}>
              {event.funds.map((fund) => {
                const config = mappingConfigs.find((c: any) => c.account === fund.account);
                const isExpanded = expandedMapping === fund.account;
                return (
                  <Paper key={fund.account} variant="outlined" sx={{ overflow: 'hidden' }}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ p: 2, cursor: config ? 'pointer' : 'default' }}
                      onClick={() => config && setExpandedMapping(isExpanded ? null : fund.account)}
                    >
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2">{fund.fundName}</Typography>
                          {config ? (
                            <Chip label={`${config.mappings.length} rules`} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                          ) : (
                            <Chip label="Not configured" size="small" color="default" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                          )}
                          {config?.unmappedAccounts?.length > 0 && (
                            <Chip label={`${config.unmappedAccounts.length} unmapped`} size="small" color="warning" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {fund.account} — {fund.fundType} — {fund.fundDomicile}
                          {config && ` — ${config.baseCurrency}`}
                        </Typography>
                      </Box>
                      {config && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          {isExpanded ? 'Click to collapse' : 'Click to expand'}
                        </Typography>
                      )}
                    </Stack>

                    {isExpanded && config && (
                      <Box>
                        <Divider />
                        {/* GL → MMIF Mapping Table */}
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Eagle GL</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Source Table</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Source Field</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>MMIF Section</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>MMIF Field</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Inst. Type</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Code Type</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Sign</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Notes</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {config.mappings.map((m: any, i: number) => (
                                <TableRow key={i} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                                  <TableCell>
                                    <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem" fontWeight={600}>
                                      {m.eagleGlPattern}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption">{m.eagleSourceTable}</Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption">{m.eagleSourceField}</Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Chip label={m.mmifSection} size="small" color="info" variant="outlined" sx={{ fontSize: '0.7rem', fontWeight: 600, height: 22 }} />
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption">{m.mmifField}</Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption">{m.instrumentType ?? '—'}</Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption">{m.codeType ?? '—'}</Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" fontFamily="monospace">
                                      {m.signConvention === -1 ? '-1' : '+1'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="caption" color="text.secondary">{m.notes}</Typography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>

                        {/* Counterparty Enrichment */}
                        {config.counterpartyEnrichment && Object.keys(config.counterpartyEnrichment).length > 0 && (
                          <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(theme.palette.grey[500], 0.04) }}>
                            <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                              Counterparty Enrichment
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              {Object.entries(config.counterpartyEnrichment).map(([name, info]: [string, any]) => (
                                <Chip
                                  key={name}
                                  label={`${name}: ${info.sector} (${info.country})`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem', height: 22 }}
                                />
                              ))}
                            </Stack>
                          </Box>
                        )}

                        {/* Investor Classification */}
                        {config.investorClassification && Object.keys(config.investorClassification).length > 0 && (
                          <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>
                              Investor Classification
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              {Object.entries(config.investorClassification).map(([code, label]: [string, any]) => (
                                <Chip
                                  key={code}
                                  label={`${code}: ${label}`}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  sx={{ fontSize: '0.7rem', height: 22 }}
                                />
                              ))}
                            </Stack>
                          </Box>
                        )}

                        {/* Unmapped Accounts Warning */}
                        {config.unmappedAccounts?.length > 0 && (
                          <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.06) }}>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <WarningAmberIcon fontSize="small" color="warning" />
                              <Typography variant="caption" fontWeight={600} color="warning.dark">
                                Unmapped GL Accounts: {config.unmappedAccounts.join(', ')}
                              </Typography>
                            </Stack>
                          </Box>
                        )}

                        {/* Timestamps */}
                        <Box sx={{ px: 2, py: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
                          <Typography variant="caption" color="text.secondary">
                            Created: {new Date(config.createdAt).toLocaleDateString()} — Updated: {new Date(config.updatedAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Tab 4: Agent Analysis */}
        {activeTab === 4 && (
          <Box sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Multi-agent pipeline analyses breaks across all 4 reconciliation levels (L0–L3) and generates an attestation report.
              </Typography>
              <Tooltip title={isReadOnly ? 'Read-only mode' : 'Trigger the 6-agent analysis pipeline'}>
                <span>
                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={agentLoading ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                    onClick={handleRunAnalysis}
                    disabled={agentLoading || isReadOnly}
                    sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    {agentLoading ? 'Running...' : 'Run Analysis'}
                  </Button>
                </span>
              </Tooltip>
            </Stack>

            {/* Pipeline visualisation */}
            <MmifAgentPipeline analysis={agentAnalysis} loading={agentLoading} />

            {/* Level drill-down (only when analysis available) */}
            {agentAnalysis && (
              <Box sx={{ mt: 3 }}>
                <MmifLevelDrillDown analysis={agentAnalysis} />
              </Box>
            )}
          </Box>
        )}

        {/* Tab 5: Attestation */}
        {activeTab === 5 && (
          <Box sx={{ p: 2 }}>
            <AttestationTab report={attestationReport} />
          </Box>
        )}
      </Paper>

      {/* Chat FAB */}
      <Tooltip title="Open MMIF Agent Chat" placement="left">
        <Fab
          color="secondary"
          aria-label="Open MMIF Agent Chat"
          onClick={() => setChatOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 32,
            right: chatOpen ? PANEL_WIDTH + 16 : 24,
            transition: 'right 0.25s ease',
            zIndex: (t) => t.zIndex.drawer + 2,
          }}
        >
          <SmartToyIcon />
        </Fab>
      </Tooltip>

      {/* Chat Panel */}
      {eventId && (
        <MmifChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          eventId={eventId}
        />
      )}
    </Box>
  );
};

// Panel width constant (must match MmifChatPanel)
const PANEL_WIDTH = 420;

export default MmifReconciliation;
