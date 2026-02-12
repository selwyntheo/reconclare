import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Grid,
  Typography,
  Chip,
  Button,
  Stack,
  Paper,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
  AvatarGroup,
  Tooltip,
  Divider,
  FormControlLabel,
  Switch,
  alpha,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SettingsIcon from '@mui/icons-material/Settings';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormGroup,
  Radio,
  RadioGroup,
  LinearProgress,
} from '@mui/material';
import { fetchEvents, fetchActivity, runValidation } from '../../services/api';
import { ConversionEvent, EventStatus, ActivityFeedItem, CheckType } from '../../types';
import { useDrillDownDispatch } from '../../context/DrillDownContext';

const CHECK_SUITE_OPTIONS: { value: CheckType; label: string }[] = [
  { value: 'NAV_TO_LEDGER', label: 'NAV to Ledger' },
  { value: 'LEDGER_BS_TO_INCST', label: 'Ledger BS to INCST' },
  { value: 'LEDGER_TF_TO_CLASS', label: 'Ledger TF to Class' },
  { value: 'POSITION_TO_LOT', label: 'Position to Lot' },
  { value: 'LEDGER_TO_SUBLEDGER', label: 'Ledger to Subledger' },
  { value: 'BASIS_LOT_CHECK', label: 'Basis Lot Check' },
];

// TODO: Replace with real auth context when available
const CURRENT_USER_ID = 'current-user';

const statusColors: Record<EventStatus, 'default' | 'primary' | 'info' | 'success' | 'warning'> = {
  DRAFT: 'default',
  ACTIVE: 'primary',
  PARALLEL: 'info',
  SIGNED_OFF: 'success',
  COMPLETE: 'success',
};

const statusLabels: Record<EventStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  PARALLEL: 'Parallel',
  SIGNED_OFF: 'Signed Off',
  COMPLETE: 'Complete',
};

const activityIcons: Record<ActivityFeedItem['type'], React.ReactNode> = {
  VALIDATION_RUN: <CheckCircleIcon fontSize="small" color="primary" />,
  AI_ANALYSIS: <SmartToyIcon fontSize="small" color="secondary" />,
  HUMAN_ANNOTATION: <PersonIcon fontSize="small" color="warning" />,
  STATUS_CHANGE: <SwapHorizIcon fontSize="small" color="success" />,
};

const formatGoLiveCountdown = (targetGoLiveDate: string): string => {
  const target = new Date(targetGoLiveDate);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const formatted = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (diffDays < 0) return `${formatted} — ${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return `${formatted} — today`;
  return `${formatted} — ${diffDays} day${diffDays === 1 ? '' : 's'}`;
};

const getLastValidationTimestamp = (event: ConversionEvent): string | null => {
  const timestamps = event.funds
    .map((f) => f.lastRunTimestamp)
    .filter((ts): ts is string => !!ts);
  if (timestamps.length === 0) return null;
  timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return timestamps[0];
};

const EventDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDrillDownDispatch();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [events, setEvents] = useState<ConversionEvent[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [, setLoading] = useState(true);
  // Run Validation modal state
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runModalEvent, setRunModalEvent] = useState<ConversionEvent | null>(null);
  const [runValDate, setRunValDate] = useState('');
  const [runCheckSuite, setRunCheckSuite] = useState<CheckType[]>(CHECK_SUITE_OPTIONS.map((c) => c.value));
  const [runFundFilter, setRunFundFilter] = useState<'all' | 'selected'>('all');
  const [runValidating, setRunValidating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [evts, acts] = await Promise.all([
          fetchEvents(),
          fetchActivity(10),
        ]);
        setEvents(evts as ConversionEvent[]);
        setActivityFeed(acts as ActivityFeedItem[]);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const navigateToEvent = useCallback(
    (event: ConversionEvent) => {
      dispatch({ type: 'SET_EVENT', eventId: event.eventId, eventName: event.eventName });
      navigate(`/events/${event.eventId}/nav-dashboard`);
    },
    [dispatch, navigate],
  );

  const navigateToActivityEvent = useCallback(
    (item: ActivityFeedItem) => {
      const event = events.find((e) => e.eventId === item.eventId);
      if (event) {
        dispatch({ type: 'SET_EVENT', eventId: event.eventId, eventName: event.eventName });
      }
      navigate(`/events/${item.eventId}/nav-dashboard`);
    },
    [dispatch, navigate, events],
  );

  const openRunModal = useCallback((event: ConversionEvent) => {
    setRunModalEvent(event);
    setRunValDate('');
    setRunCheckSuite(CHECK_SUITE_OPTIONS.map((c) => c.value));
    setRunFundFilter('all');
    setRunModalOpen(true);
  }, []);

  const handleRunValidation = async () => {
    if (!runModalEvent || !runValDate) return;
    setRunValidating(true);
    try {
      await runValidation({ eventId: runModalEvent.eventId, valuationDt: runValDate, checkSuite: runCheckSuite, fundSelection: runFundFilter === 'all' ? undefined : 'selected' });
      setRunModalOpen(false);
      navigateToEvent(runModalEvent);
    } catch {
      // stay on modal
    } finally {
      setRunValidating(false);
    }
  };

  const filteredEvents = useMemo(() => events.filter((e) => {
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    if (assignedToMe && !e.assignedTeam.some((m) => m.userId === CURRENT_USER_ID)) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchesEventName = e.eventName.toLowerCase().includes(q);
      const matchesEventId = e.eventId.toLowerCase().includes(q);
      const matchesFundName = e.funds.some((f) => f.fundName.toLowerCase().includes(q));
      const matchesIncumbent = e.incumbentProvider.toLowerCase().includes(q);
      if (!matchesEventName && !matchesEventId && !matchesFundName && !matchesIncumbent) return false;
    }
    return true;
  }), [events, statusFilter, assignedToMe, search]);

  const getEventProgress = (event: ConversionEvent) => {
    const passed = event.funds.filter((f) => f.status === 'PASSED' || f.status === 'SIGNED_OFF').length;
    return event.funds.length > 0 ? (passed / event.funds.length) * 100 : 0;
  };

  const getAttentionCount = (event: ConversionEvent) =>
    event.funds.filter((f) => f.status === 'FAILED' || (f.breakCount && f.breakCount > 0)).length;

  const getFundSegments = (event: ConversionEvent) => {
    const total = event.funds.length;
    if (total === 0) return { passedPct: 0, attentionPct: 0, failedPct: 0 };
    const passed = event.funds.filter((f) => f.status === 'PASSED' || f.status === 'SIGNED_OFF').length;
    const failed = event.funds.filter((f) => f.status === 'FAILED').length;
    const attention = total - passed - failed;
    return {
      passedPct: (passed / total) * 100,
      attentionPct: (attention / total) * 100,
      failedPct: (failed / total) * 100,
    };
  };

  const formatTimeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  };

  return (
    <Box role="main" aria-label="Event Dashboard">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Event Dashboard
        </Typography>
        <Typography variant="subtitle1">
          Portfolio view of all conversion events — <strong>February 12, 2026</strong>
        </Typography>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search events, funds, providers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 280 }}
        />
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, v) => v && setStatusFilter(v)}
          size="small"
        >
          <ToggleButton value="ALL">All Events</ToggleButton>
          <ToggleButton value="ACTIVE">Active</ToggleButton>
          <ToggleButton value="PARALLEL">Parallel</ToggleButton>
          <ToggleButton value="SIGNED_OFF">Signed Off</ToggleButton>
          <ToggleButton value="DRAFT">Draft</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={assignedToMe}
              onChange={(e) => setAssignedToMe(e.target.checked)}
            />
          }
          label={<Typography variant="body2">Assigned To Me</Typography>}
          sx={{ ml: 1 }}
        />
      </Stack>

      {/* Main Content: Cards + Activity Feed */}
      <Grid container spacing={3}>
        {/* Event Cards */}
        <Grid size={{ xs: 12, lg: 9 }}>
          <Grid container spacing={2}>
            {filteredEvents.map((event) => {
              const progress = getEventProgress(event);
              const attention = getAttentionCount(event);
              const passed = event.funds.filter((f) => f.status === 'PASSED' || f.status === 'SIGNED_OFF').length;
              const { passedPct, attentionPct, failedPct } = getFundSegments(event);
              const sparkData = (event.breakTrend7d || []).map((v, i) => ({ d: i, v }));
              const lastValidation = getLastValidationTimestamp(event);

              return (
                <Grid size={{ xs: 12, sm: 6, md: 6 }} key={event.eventId}>
                  <Card
                    sx={{
                      height: '100%',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                        transform: 'translateY(-2px)',
                      },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: 2,
                      },
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${event.eventName} — ${statusLabels[event.status]}`}
                    onClick={() => navigateToEvent(event)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToEvent(event); } }}
                  >
                    <CardContent sx={{ pb: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="overline" color="text.secondary">
                            {event.eventId}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                            {event.eventName}
                          </Typography>
                        </Box>
                        <Chip
                          label={statusLabels[event.status]}
                          size="small"
                          color={statusColors[event.status]}
                          sx={{ fontWeight: 600 }}
                        />
                      </Stack>

                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        From: {event.incumbentProvider}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Go-live: {formatGoLiveCountdown(event.targetGoLiveDate)}
                      </Typography>

                      {lastValidation && (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                          <ScheduleIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            Last validation: {formatTimeAgo(lastValidation)}
                          </Typography>
                        </Stack>
                      )}

                      {/* 3-Segment Fund Progress Bar */}
                      <Box sx={{ mt: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="caption" fontWeight={600}>
                            {passed} of {event.funds.length} funds passed
                          </Typography>
                          <Typography variant="caption" fontWeight={600}>
                            {progress.toFixed(0)}%
                          </Typography>
                        </Stack>
                        <Box
                          sx={{
                            display: 'flex',
                            height: 8,
                            borderRadius: 4,
                            overflow: 'hidden',
                            bgcolor: alpha(theme.palette.grey[300], 0.3),
                          }}
                        >
                          {passedPct > 0 && (
                            <Box sx={{ width: `${passedPct}%`, bgcolor: theme.palette.success.main, transition: 'width 0.3s ease' }} />
                          )}
                          {attentionPct > 0 && (
                            <Box sx={{ width: `${attentionPct}%`, bgcolor: theme.palette.warning.main, transition: 'width 0.3s ease' }} />
                          )}
                          {failedPct > 0 && (
                            <Box sx={{ width: `${failedPct}%`, bgcolor: theme.palette.error.main, transition: 'width 0.3s ease' }} />
                          )}
                        </Box>
                        <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                            <Typography variant="caption" color="text.secondary">Passed</Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                            <Typography variant="caption" color="text.secondary">Attention</Typography>
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main' }} />
                            <Typography variant="caption" color="text.secondary">Failed</Typography>
                          </Stack>
                        </Stack>
                      </Box>

                      {/* Attention + Sparkline */}
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
                        <Stack direction="row" spacing={1}>
                          {attention > 0 && (
                            <Chip
                              icon={<ErrorIcon />}
                              label={`${attention} attention`}
                              size="small"
                              color="error"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          )}
                        </Stack>
                        {sparkData.length > 0 && (
                          <Box sx={{ width: 80, height: 30 }}>
                            <ResponsiveContainer>
                              <LineChart data={sparkData}>
                                <Line
                                  type="monotone"
                                  dataKey="v"
                                  stroke={theme.palette.error.main}
                                  strokeWidth={1.5}
                                  dot={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </Box>
                        )}
                      </Stack>

                      {/* Team */}
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
                        <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.65rem' } }}>
                          {event.assignedTeam.map((m) => (
                            <Tooltip key={m.userId} title={`${m.name} (${m.role.replace('_', ' ')})`}>
                              <Avatar sx={{ bgcolor: 'secondary.main' }}>
                                {m.name.split(' ').map((n) => n[0]).join('')}
                              </Avatar>
                            </Tooltip>
                          ))}
                        </AvatarGroup>
                      </Stack>
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 1.5, pt: 0 }}>
                      {(['ACTIVE', 'PARALLEL'] as const).includes(event.status as any) ? (
                        <>
                          <Button
                            size="small"
                            startIcon={<PlayArrowIcon />}
                            onClick={(e) => { e.stopPropagation(); openRunModal(event); }}
                          >
                            Run Validation
                          </Button>
                          <Button
                            size="small"
                            startIcon={<VisibilityIcon />}
                            onClick={(e) => { e.stopPropagation(); navigateToEvent(event); }}
                          >
                            Details
                          </Button>
                        </>
                      ) : (['SIGNED_OFF', 'COMPLETE'] as const).includes(event.status as any) ? (
                        <Button
                          size="small"
                          startIcon={<AssessmentIcon />}
                          onClick={(e) => { e.stopPropagation(); navigateToEvent(event); }}
                        >
                          View Report
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          startIcon={<SettingsIcon />}
                          onClick={(e) => { e.stopPropagation(); navigateToEvent(event); }}
                        >
                          Configure
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Grid>

        {/* Activity Feed */}
        <Grid size={{ xs: 12, lg: 3 }}>
          <Paper sx={{ p: 2, borderRadius: 2, position: 'sticky', top: 80 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Activity Feed
            </Typography>
            <Stack spacing={1.5} divider={<Divider />}>
              {activityFeed.slice(0, 8).map((item) => (
                <Stack
                  key={item.id}
                  direction="row"
                  spacing={1.5}
                  alignItems="flex-start"
                  onClick={() => navigateToActivityEvent(item)}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 1,
                    p: 0.5,
                    mx: -0.5,
                    transition: 'background-color 0.15s',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                    },
                  }}
                >
                  <Box sx={{ mt: 0.3 }}>{activityIcons[item.type]}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                      {item.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatTimeAgo(item.timestamp)}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Run Validation Modal */}
      <Dialog open={runModalOpen} onClose={() => setRunModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Run Validation — {runModalEvent?.eventName}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" fontWeight={600}>Valuation Date</Typography>
              <TextField
                type="date"
                size="small"
                fullWidth
                value={runValDate}
                onChange={(e) => setRunValDate(e.target.value)}
                sx={{ mt: 0.5 }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={600}>Check Suite</Typography>
              <FormGroup sx={{ mt: 0.5 }}>
                {CHECK_SUITE_OPTIONS.map((opt) => (
                  <FormControlLabel
                    key={opt.value}
                    control={
                      <Checkbox
                        size="small"
                        checked={runCheckSuite.includes(opt.value)}
                        onChange={(e) => {
                          if (e.target.checked) setRunCheckSuite((prev) => [...prev, opt.value]);
                          else setRunCheckSuite((prev) => prev.filter((c) => c !== opt.value));
                        }}
                      />
                    }
                    label={<Typography variant="body2">{opt.label}</Typography>}
                  />
                ))}
              </FormGroup>
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={600}>Fund Filter</Typography>
              <RadioGroup row value={runFundFilter} onChange={(e) => setRunFundFilter(e.target.value as any)} sx={{ mt: 0.5 }}>
                <FormControlLabel value="all" control={<Radio size="small" />} label={<Typography variant="body2">All Funds</Typography>} />
                <FormControlLabel value="selected" control={<Radio size="small" />} label={<Typography variant="body2">Selected Only</Typography>} />
              </RadioGroup>
            </Box>
            {runValidating && <LinearProgress role="status" aria-live="polite" aria-label="Validation in progress" />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRunModalOpen(false)} disabled={runValidating}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={handleRunValidation}
            disabled={runValidating || !runValDate || runCheckSuite.length === 0}
          >
            {runValidating ? 'Running...' : 'Run Validation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EventDashboard;
