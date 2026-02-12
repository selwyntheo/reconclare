import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Stack,
  Paper,
  IconButton,
  Drawer,
  Divider,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import { fetchEvent, fetchRun, fetchRunResults, fetchBreaks, fetchValidationChecks } from '../../services/api';
import { ValidationResult, BreakRecord, ConversionEvent, ValidationRun } from '../../types';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const statusIcon = (status: ValidationResult['status']) => {
  switch (status) {
    case 'PASSED': return <CheckCircleIcon fontSize="small" color="success" />;
    case 'FAILED': return <CancelIcon fontSize="small" color="error" />;
    case 'WARNING': return <WarningAmberIcon fontSize="small" color="warning" />;
  }
};

const statusColor = (status: ValidationResult['status']): 'success' | 'error' | 'warning' => {
  switch (status) {
    case 'PASSED': return 'success';
    case 'FAILED': return 'error';
    case 'WARNING': return 'warning';
  }
};

const ValidationRunView: React.FC = () => {
  const { eventId, runId } = useParams<{ eventId: string; runId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const [selectedBreak, setSelectedBreak] = useState<BreakRecord | null>(null);
  const [event, setEvent] = useState<ConversionEvent | null>(null);
  const [run, setRun] = useState<ValidationRun | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [validationChecks, setValidationChecks] = useState<any[]>([]);
  const [breakRecords, setBreakRecords] = useState<BreakRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!eventId || !runId) return;
      try {
        setLoading(true);
        const [evt, runDoc, results, checks, breaks] = await Promise.all([
          fetchEvent(eventId),
          fetchRun(runId),
          fetchRunResults(runId),
          fetchValidationChecks(),
          fetchBreaks({ runId }),
        ]);
        setEvent(evt as ConversionEvent);
        setRun(runDoc as ValidationRun);
        setValidationResults(results as ValidationResult[]);
        setValidationChecks(checks);
        setBreakRecords(breaks as BreakRecord[]);
      } catch (err) {
        console.error('Failed to load run:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId, runId]);

  const resultsByCheck = useMemo(() => {
    const grouped: Record<string, ValidationResult[]> = {};
    validationChecks.forEach((vc: any) => {
      grouped[vc.checkType] = validationResults.filter((r) => r.checkType === vc.checkType);
    });
    return grouped;
  }, [validationChecks, validationResults]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><Typography>Loading...</Typography></Box>;
  }

  if (!event || !run) {
    return (
      <Box>
        <Typography variant="h5">Run not found</Typography>
        <Button onClick={() => navigate('/')}>Back</Button>
      </Box>
    );
  }

  const totalResults = validationResults.length;
  const passedCount = validationResults.filter((r) => r.status === 'PASSED').length;
  const failedCount = validationResults.filter((r) => r.status === 'FAILED').length;
  const warningCount = validationResults.filter((r) => r.status === 'WARNING').length;

  const overallStatus = failedCount > 0 ? 'Failed' : warningCount > 0 ? 'Attention' : 'Passed';
  const overallColor = failedCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'success';

  return (
    <Box>
      {/* ── Header ──────────────────────────────────── */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate(`/events/${eventId}`)}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h5" fontWeight={700}>
              Validation Run
            </Typography>
            <Chip label={run.runId} size="small" color="primary" sx={{ fontWeight: 600 }} />
            <Chip label={overallStatus} size="small" color={overallColor} sx={{ fontWeight: 600 }} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {event.eventName} · Valuation: {run.valuationDt} · Executed: {new Date(run.executionTime).toLocaleString()} · Duration: {run.durationMs ? `${(run.durationMs / 1000).toFixed(0)}s` : '—'}
          </Typography>
        </Box>
      </Stack>

      {/* ── Summary KPIs ─────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Total Checks</Typography>
              <Typography variant="h4" fontWeight={700} color="primary.main">{totalResults}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Passed</Typography>
              <Typography variant="h4" fontWeight={700} color="success.main">{passedCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Failed</Typography>
              <Typography variant="h4" fontWeight={700} color="error.main">{failedCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Warnings</Typography>
              <Typography variant="h4" fontWeight={700} color="warning.main">{warningCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Results grouped by check ─────────────────── */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Validation Results by Check
          </Typography>
          <Stack spacing={1.5}>
            {validationChecks.map((vc) => {
              const results = resultsByCheck[vc.checkType] || [];
              if (results.length === 0) return null;
              const failed = results.filter((r) => r.status === 'FAILED').length;
              const warned = results.filter((r) => r.status === 'WARNING').length;
              const passed = results.filter((r) => r.status === 'PASSED').length;

              return (
                <Accordion
                  key={vc.checkType}
                  defaultExpanded={failed > 0}
                  variant="outlined"
                  disableGutters
                  sx={{ borderRadius: '8px !important', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', pr: 2 }}>
                      <Chip
                        label={vc.level}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: theme.palette.primary.main,
                        }}
                      />
                      <Typography variant="body1" fontWeight={600} sx={{ flex: 1 }}>
                        {vc.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                        {vc.description}
                      </Typography>
                      {passed > 0 && <Chip icon={<CheckCircleIcon />} label={passed} size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
                      {failed > 0 && <Chip icon={<CancelIcon />} label={failed} size="small" color="error" sx={{ fontSize: '0.7rem' }} />}
                      {warned > 0 && <Chip icon={<WarningAmberIcon />} label={warned} size="small" color="warning" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <Box
                      component="table"
                      sx={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        '& th': { textAlign: 'left', p: 1.5, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary', bgcolor: 'background.default' },
                        '& td': { p: 1.5, fontSize: '0.8125rem', borderTop: `1px solid ${theme.palette.divider}` },
                        '& tr:hover td': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                      }}
                    >
                      <thead>
                        <tr>
                          <th>Fund</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>LHS Rows</th>
                          <th style={{ textAlign: 'right' }}>RHS Rows</th>
                          <th style={{ textAlign: 'right' }}>Matched</th>
                          <th style={{ textAlign: 'right' }}>Breaks</th>
                          <th style={{ textAlign: 'right' }}>Total Variance</th>
                          <th style={{ textAlign: 'right' }}>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, idx) => {
                          const matchRate = r.lhsRowCount > 0 ? (r.matchedCount / r.lhsRowCount) * 100 : 100;
                          const fundBreaks = breakRecords.filter(
                            (b) => b.fundAccount === r.fundAccount && b.checkType === r.checkType
                          );
                          return (
                            <React.Fragment key={idx}>
                              <tr style={{ cursor: r.breakCount > 0 ? 'pointer' : 'default' }}>
                                <td>
                                  <Typography variant="body2" fontWeight={500}>{r.fundName}</Typography>
                                  <Typography variant="caption" color="text.secondary">{r.fundAccount}</Typography>
                                </td>
                                <td>
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    {statusIcon(r.status)}
                                    <Chip label={r.status} size="small" color={statusColor(r.status)} sx={{ fontSize: '0.7rem', fontWeight: 600 }} />
                                  </Stack>
                                </td>
                                <td style={{ textAlign: 'right' }}>{r.lhsRowCount}</td>
                                <td style={{ textAlign: 'right' }}>{r.rhsRowCount}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <Chip label={`${matchRate.toFixed(1)}%`} size="small" color={matchRate >= 99 ? 'success' : matchRate >= 95 ? 'warning' : 'error'} sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: r.breakCount > 0 ? 700 : 400, color: r.breakCount > 0 ? theme.palette.error.main : 'inherit' }}>
                                  {r.breakCount}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: r.totalVariance > 0 ? theme.palette.error.main : 'inherit' }}>
                                  {r.totalVariance > 0 ? formatCurrency(r.totalVariance) : '—'}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <Typography variant="caption" color="text.secondary">{r.durationMs}ms</Typography>
                                </td>
                              </tr>
                              {/* Inline break rows */}
                              {fundBreaks.map((brk) => (
                                <tr
                                  key={brk.breakId}
                                  style={{
                                    cursor: 'pointer',
                                    background: alpha(theme.palette.error.main, 0.02),
                                  }}
                                  onClick={() => setSelectedBreak(brk)}
                                >
                                  <td style={{ paddingLeft: 40 }}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Chip label={brk.breakId} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                                      <Typography variant="caption">{brk.glCategory || brk.securityId}</Typography>
                                    </Stack>
                                  </td>
                                  <td>
                                    <Chip label={brk.state.replace(/_/g, ' ')} size="small" variant="outlined" sx={{ fontSize: '0.65rem', textTransform: 'capitalize' }} />
                                  </td>
                                  <td colSpan={3}></td>
                                  <td style={{ textAlign: 'right' }}>1</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600, color: theme.palette.error.main }}>
                                    {formatCurrency(Math.abs(brk.variance))}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    {brk.aiAnalysis && (
                                      <Chip
                                        icon={<SmartToyIcon />}
                                        label={`${(brk.aiAnalysis.confidenceScore * 100).toFixed(0)}%`}
                                        size="small"
                                        color={brk.aiAnalysis.confidenceScore >= 0.85 ? 'success' : 'warning'}
                                        sx={{ fontSize: '0.65rem' }}
                                      />
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Stack>
        </CardContent>
      </Card>

      {/* ── AI Analysis Slide-out Panel ───────────────── */}
      <Drawer
        anchor="right"
        open={!!selectedBreak}
        onClose={() => setSelectedBreak(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, p: 3 } }}
      >
        {selectedBreak && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>
                AI Analysis
              </Typography>
              <IconButton onClick={() => setSelectedBreak(null)}>
                <CloseIcon />
              </IconButton>
            </Stack>

            <Chip label={selectedBreak.breakId} size="small" color="primary" sx={{ mb: 2, fontWeight: 600 }} />

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
              <Typography variant="overline" color="text.secondary">Break Details</Typography>
              <Typography variant="body2"><strong>Fund:</strong> {selectedBreak.fundName}</Typography>
              <Typography variant="body2"><strong>Check:</strong> {selectedBreak.checkType.replace(/_/g, ' ')}</Typography>
              <Typography variant="body2"><strong>Level:</strong> {selectedBreak.level}</Typography>
              <Typography variant="body2"><strong>Variance:</strong> {formatCurrency(Math.abs(selectedBreak.variance))}</Typography>
              <Typography variant="body2"><strong>State:</strong> {selectedBreak.state.replace(/_/g, ' ')}</Typography>
            </Paper>

            {selectedBreak.aiAnalysis ? (
              <>
                {/* Root Cause */}
                <Paper sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: alpha(theme.palette.info.main, 0.04), border: `1px solid ${alpha(theme.palette.info.main, 0.2)}` }}>
                  <Typography variant="subtitle2" color="info.main" sx={{ mb: 1 }}>Root Cause Summary</Typography>
                  <Typography variant="body2">{selectedBreak.aiAnalysis.rootCauseSummary}</Typography>
                </Paper>

                {/* Confidence */}
                <Box sx={{ mb: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="subtitle2">Confidence Score</Typography>
                    <Typography variant="h6" fontWeight={700} color={selectedBreak.aiAnalysis.confidenceScore >= 0.85 ? 'success.main' : selectedBreak.aiAnalysis.confidenceScore >= 0.7 ? 'warning.main' : 'error.main'}>
                      {(selectedBreak.aiAnalysis.confidenceScore * 100).toFixed(0)}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={selectedBreak.aiAnalysis.confidenceScore * 100}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        bgcolor: selectedBreak.aiAnalysis.confidenceScore >= 0.85 ? 'success.main' : selectedBreak.aiAnalysis.confidenceScore >= 0.7 ? 'warning.main' : 'error.main',
                      },
                    }}
                  />
                </Box>

                {/* Evidence Chain */}
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Evidence Chain</Typography>
                <Stack spacing={1} sx={{ mb: 2 }}>
                  {selectedBreak.aiAnalysis.evidenceChain.map((step) => (
                    <Paper key={step.stepNumber} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Chip label={step.stepNumber} size="small" color="primary" sx={{ fontWeight: 700, minWidth: 28 }} />
                        <Typography variant="body2">{step.description}</Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>

                {/* Classification */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Break Classification</Typography>
                  <Chip label={selectedBreak.aiAnalysis.breakCategory} size="small" color="secondary" sx={{ fontWeight: 600 }} />
                </Box>

                {/* Similar Breaks */}
                {selectedBreak.aiAnalysis.similarBreaks.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Similar Historical Breaks</Typography>
                    {selectedBreak.aiAnalysis.similarBreaks.map((sb) => (
                      <Paper key={sb.breakId} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, mb: 1 }}>
                        <Typography variant="body2" fontWeight={500}>{sb.fundName} — {sb.date}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Variance: {formatCurrency(sb.variance)} · Resolution: {sb.resolution}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                )}

                {/* Recommended Actions */}
                {selectedBreak.aiAnalysis.recommendedActions.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Recommended Actions</Typography>
                    {selectedBreak.aiAnalysis.recommendedActions.map((act) => (
                      <Paper key={act.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, mb: 1, borderLeft: `3px solid ${theme.palette.primary.main}` }}>
                        <Typography variant="body2">{act.description}</Typography>
                      </Paper>
                    ))}
                  </Box>
                )}

                {/* Feedback */}
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" spacing={1} justifyContent="center">
                  <Button variant="outlined" startIcon={<ThumbUpIcon />} color="success" size="small">
                    Good Analysis
                  </Button>
                  <Button variant="outlined" startIcon={<ThumbDownIcon />} color="error" size="small">
                    Needs Improvement
                  </Button>
                </Stack>
              </>
            ) : (
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: alpha(theme.palette.warning.main, 0.04), borderRadius: 2 }}>
                <SmartToyIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="body1" fontWeight={600}>AI Analysis Pending</Typography>
                <Typography variant="body2" color="text.secondary">Analysis has not yet been completed for this break.</Typography>
              </Paper>
            )}
          </Box>
        )}
      </Drawer>
    </Box>
  );
};

export default ValidationRunView;
