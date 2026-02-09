import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Stack,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Checkbox,
  FormControlLabel,
  FormGroup,
  RadioGroup,
  Radio,
  IconButton,
  Tooltip,
  LinearProgress,
  TextField,
  CircularProgress,
  Alert,
  alpha,
  useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { fetchEvent, fetchEventRuns, fetchValidationChecks, runValidation } from '../../services/api';
import { EventStatus, Fund, CheckType, ConversionEvent, ValidationRun } from '../../types';

const statusSteps = ['Draft', 'Active', 'Parallel', 'Sign-off', 'Go-Live'];
const statusToStep: Record<EventStatus, number> = {
  DRAFT: 0,
  ACTIVE: 1,
  PARALLEL: 2,
  SIGNED_OFF: 3,
  COMPLETE: 4,
};

const fundStatusIcon = (status: Fund['status']) => {
  switch (status) {
    case 'PASSED':
    case 'SIGNED_OFF':
      return <CheckCircleIcon fontSize="small" color="success" />;
    case 'FAILED':
      return <CancelIcon fontSize="small" color="error" />;
    case 'IN_PARALLEL':
      return <WarningAmberIcon fontSize="small" color="warning" />;
    default:
      return <HourglassEmptyIcon fontSize="small" color="disabled" />;
  }
};

const aiStatusChip = (fund: Fund) => {
  if (!fund.aiStatus) return <Chip label="—" size="small" variant="outlined" />;
  if (fund.aiStatus === 'ANALYZING')
    return <Chip label="Analyzing..." size="small" color="info" variant="outlined" icon={<SmartToyIcon />} sx={{ fontSize: '0.7rem' }} />;
  if (fund.aiStatus === 'COMPLETE' && fund.aiConfidence !== undefined)
    return (
      <Chip
        label={`${(fund.aiConfidence * 100).toFixed(0)}%`}
        size="small"
        color={fund.aiConfidence >= 0.85 ? 'success' : fund.aiConfidence >= 0.7 ? 'warning' : 'error'}
        sx={{ fontWeight: 600, fontSize: '0.7rem' }}
      />
    );
  return <Chip label="Needs Review" size="small" color="warning" sx={{ fontSize: '0.7rem' }} />;
};

const reviewChip = (fund: Fund) => {
  if (!fund.humanReview) return <Chip label="—" size="small" variant="outlined" />;
  const colorMap: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
    APPROVED: 'success',
    PENDING: 'warning',
    IN_PROGRESS: 'warning',
    REJECTED: 'error',
  };
  return (
    <Chip
      label={fund.humanReview.replace('_', ' ')}
      size="small"
      color={colorMap[fund.humanReview] || 'default'}
      variant="outlined"
      sx={{ textTransform: 'capitalize', fontSize: '0.7rem' }}
    />
  );
};

const EventDetail: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  const [event, setEvent] = useState<ConversionEvent | null>(null);
  const [eventRuns, setEventRuns] = useState<ValidationRun[]>([]);
  const [validationChecks, setValidationChecks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runSuccess, setRunSuccess] = useState<string | null>(null);
  const [valuationDate, setValuationDate] = useState('2026-02-07');
  const [selectedChecks, setSelectedChecks] = useState<CheckType[]>([]);
  const [fundSelection, setFundSelection] = useState<'all' | 'selected'>('all');

  const loadData = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const [evt, runs, checks] = await Promise.all([
        fetchEvent(eventId),
        fetchEventRuns(eventId),
        fetchValidationChecks(),
      ]);
      setEvent(evt as ConversionEvent);
      setEventRuns(runs as ValidationRun[]);
      setValidationChecks(checks);
      if (selectedChecks.length === 0 && checks.length > 0) {
        setSelectedChecks(checks.map((c: any) => c.checkType));
      }
    } catch (err) {
      console.error('Failed to load event:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleCheck = (ct: CheckType) => {
    setSelectedChecks((prev) =>
      prev.includes(ct) ? prev.filter((c) => c !== ct) : [...prev, ct]
    );
  };

  const handleRunValidation = async () => {
    if (!eventId || selectedChecks.length === 0) return;
    try {
      setRunning(true);
      setRunError(null);
      setRunSuccess(null);
      const result = await runValidation({
        eventId,
        valuationDt: valuationDate,
        checkSuite: selectedChecks,
        fundSelection: fundSelection === 'all' ? 'all' : undefined,
      });
      setRunSuccess(`Validation run ${result.runId} complete: ${result.fundsPassed ?? 0} passed, ${result.fundsFailed ?? 0} failed`);
      // Reload data to reflect new results
      await loadData();
      // Navigate to the run view
      if (result.runId) {
        navigate(`/events/${eventId}/runs/${result.runId}`);
      }
    } catch (err: any) {
      setRunError(err.message || 'Validation run failed');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!event) {
    return (
      <Box>
        <Typography variant="h5">Event not found</Typography>
        <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
      </Box>
    );
  }

  const activeStep = statusToStep[event.status];

  return (
    <Box>
      {/* ── Header ──────────────────────────────────── */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate('/')}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h5" fontWeight={700}>
              {event.eventId}: {event.eventName}
            </Typography>
            <Chip
              label={event.status.replace('_', ' ')}
              size="small"
              color={event.status === 'PARALLEL' ? 'info' : event.status === 'ACTIVE' ? 'primary' : 'success'}
              sx={{ fontWeight: 600 }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            From: {event.incumbentProvider} · Go-live: {event.targetGoLiveDate} · {event.funds.length} funds
          </Typography>
        </Box>
      </Stack>

      {/* ── Timeline Stepper ─────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep} alternativeLabel>
            {statusSteps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* ── Validation Controls ──────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Validation Controls
          </Typography>
          {runError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRunError(null)}>{runError}</Alert>}
          {runSuccess && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRunSuccess(null)}>{runSuccess}</Alert>}
          <Grid container spacing={3}>
            {/* Date Picker */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="overline" color="text.secondary">
                  Valuation Date
                </Typography>
                <TextField
                  type="date"
                  value={valuationDate}
                  onChange={(e) => setValuationDate(e.target.value)}
                  size="small"
                  fullWidth
                  sx={{ mt: 0.5 }}
                />
              </Paper>
            </Grid>

            {/* Check Suite */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="overline" color="text.secondary">
                  Check Suite
                </Typography>
                <FormGroup>
                  {validationChecks.map((vc) => (
                    <FormControlLabel
                      key={vc.checkType}
                      control={
                        <Checkbox
                          size="small"
                          checked={selectedChecks.includes(vc.checkType)}
                          onChange={() => toggleCheck(vc.checkType)}
                        />
                      }
                      label={<Typography variant="body2">{vc.name}</Typography>}
                    />
                  ))}
                </FormGroup>
              </Paper>
            </Grid>

            {/* Fund Selection */}
            <Grid size={{ xs: 12, sm: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="overline" color="text.secondary">
                  Fund Selection
                </Typography>
                <RadioGroup
                  value={fundSelection}
                  onChange={(e) => setFundSelection(e.target.value as 'all' | 'selected')}
                >
                  <FormControlLabel
                    value="all"
                    control={<Radio size="small" />}
                    label={<Typography variant="body2">All Funds ({event.funds.length})</Typography>}
                  />
                  <FormControlLabel
                    value="selected"
                    control={<Radio size="small" />}
                    label={<Typography variant="body2">Selected Only</Typography>}
                  />
                </RadioGroup>
              </Paper>
            </Grid>
          </Grid>

          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={running ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
              sx={{ fontWeight: 700 }}
              onClick={handleRunValidation}
              disabled={running || selectedChecks.length === 0}
            >
              {running ? 'Running Validation...' : 'Run Validation'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<ScheduleIcon />}
              disabled={running}
            >
              Schedule
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Recent Runs ──────────────────────────────── */}
      {eventRuns.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Recent Validation Runs
            </Typography>
            <Stack spacing={1}>
              {eventRuns.map((run) => (
                <Paper
                  key={run.runId}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) },
                  }}
                  onClick={() => navigate(`/events/${eventId}/runs/${run.runId}`)}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Chip label={run.runId} size="small" color="primary" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                      <Typography variant="body2" fontWeight={500}>
                        {run.valuationDt}
                      </Typography>
                      <Chip
                        label={run.status}
                        size="small"
                        color={run.status === 'COMPLETE' ? 'success' : run.status === 'RUNNING' ? 'info' : 'default'}
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {run.fundsPassed !== undefined && (
                        <Chip icon={<CheckCircleIcon />} label={`${run.fundsPassed} passed`} size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      )}
                      {(run.fundsFailed ?? 0) > 0 && (
                        <Chip icon={<CancelIcon />} label={`${run.fundsFailed} failed`} size="small" color="error" sx={{ fontSize: '0.7rem' }} />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {run.durationMs ? `${(run.durationMs / 1000).toFixed(0)}s` : ''}
                      </Typography>
                      <OpenInNewIcon fontSize="small" color="action" />
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* ── Fund Status Grid ─────────────────────────── */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Fund Status
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                '& th': {
                  textAlign: 'left',
                  p: 1.5,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'text.secondary',
                  bgcolor: 'background.default',
                  borderBottom: `2px solid ${theme.palette.divider}`,
                },
                '& td': {
                  p: 1.5,
                  fontSize: '0.8125rem',
                  borderBottom: `1px solid ${theme.palette.divider}`,
                },
                '& tr:hover td': {
                  bgcolor: alpha(theme.palette.primary.main, 0.02),
                },
              }}
            >
              <thead>
                <tr>
                  <th>Fund Name</th>
                  <th>Status</th>
                  <th>Last Run</th>
                  <th>Breaks</th>
                  <th>AI Status</th>
                  <th>Review</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {event.funds.map((fund) => (
                  <tr
                    key={fund.account}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/events/${eventId}/funds/${fund.account}`)}
                  >
                    <td>
                      <Typography variant="body2" fontWeight={600}>
                        {fund.fundName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {fund.account} · {fund.fundType.replace('_', ' ')}
                      </Typography>
                    </td>
                    <td>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {fundStatusIcon(fund.status)}
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {fund.status.replace('_', ' ').toLowerCase()}
                        </Typography>
                      </Stack>
                    </td>
                    <td>
                      <Typography variant="body2">
                        {fund.lastRunTimestamp
                          ? new Date(fund.lastRunTimestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </Typography>
                    </td>
                    <td>
                      {(fund.breakCount ?? 0) > 0 ? (
                        <Chip
                          label={fund.breakCount}
                          size="small"
                          color="error"
                          sx={{ fontWeight: 700, minWidth: 32 }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">0</Typography>
                      )}
                    </td>
                    <td>{aiStatusChip(fund)}</td>
                    <td>{reviewChip(fund)}</td>
                    <td>
                      <Tooltip title="View fund details">
                        <IconButton size="small">
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default EventDetail;
