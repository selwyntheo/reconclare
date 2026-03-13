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
import CategoryIcon from '@mui/icons-material/Category';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import DescriptionIcon from '@mui/icons-material/Description';
import GavelIcon from '@mui/icons-material/Gavel';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
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
import {
  fetchEvents,
  fetchMmifEvents,
  fetchActivity,
  runValidation,
  runMmifValidation,
  fetchAllocations,
  fetchBreakSummary,
  fetchMmifCheckSuiteOptions,
} from '../../services/api';
import {
  ConversionEvent,
  MmifEvent,
  EventType,
  EventStatus,
  MmifEventStatus,
  ActivityFeedItem,
  CheckType,
} from '../../types';
import { useDrillDownDispatch } from '../../context/DrillDownContext';
import { useAuth } from '../../context/AuthContext';

// ── Constants ─────────────────────────────────────────────────

const CHECK_SUITE_OPTIONS: { value: CheckType; label: string }[] = [
  { value: 'NAV_TO_LEDGER', label: 'NAV to Ledger' },
  { value: 'LEDGER_BS_TO_INCST', label: 'Ledger BS to INCST' },
  { value: 'LEDGER_TF_TO_CLASS', label: 'Ledger TF to Class' },
  { value: 'POSITION_TO_LOT', label: 'Position to Lot' },
  { value: 'LEDGER_TO_SUBLEDGER', label: 'Ledger to Subledger' },
  { value: 'BASIS_LOT_CHECK', label: 'Basis Lot Check' },
];

const CURRENT_USER_ID = 'current-user';

const conversionStatusColors: Record<EventStatus, 'default' | 'primary' | 'info' | 'success' | 'warning'> = {
  DRAFT: 'default', ACTIVE: 'primary', PARALLEL: 'info', SIGNED_OFF: 'success', COMPLETE: 'success',
};
const conversionStatusLabels: Record<EventStatus, string> = {
  DRAFT: 'Draft', ACTIVE: 'Active', PARALLEL: 'Parallel', SIGNED_OFF: 'Signed Off', COMPLETE: 'Complete',
};

const mmifStatusColors: Record<MmifEventStatus, 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'> = {
  DRAFT: 'default', MAPPING: 'primary', EXTRACTION: 'info', RECONCILIATION: 'warning', REVIEW: 'info', FILED: 'success',
};
const mmifStatusLabels: Record<MmifEventStatus, string> = {
  DRAFT: 'Draft', MAPPING: 'Mapping', EXTRACTION: 'Extraction', RECONCILIATION: 'Reconciliation', REVIEW: 'Review', FILED: 'Filed',
};

const activityIcons: Record<ActivityFeedItem['type'], React.ReactNode> = {
  VALIDATION_RUN: <CheckCircleIcon fontSize="small" color="primary" />,
  AI_ANALYSIS: <SmartToyIcon fontSize="small" color="secondary" />,
  HUMAN_ANNOTATION: <PersonIcon fontSize="small" color="warning" />,
  STATUS_CHANGE: <SwapHorizIcon fontSize="small" color="success" />,
  BREAK_CATEGORIZED: <CategoryIcon fontSize="small" color="info" />,
  SIGN_OFF: <VerifiedUserIcon fontSize="small" color="success" />,
  AUTO_ASSIGNMENT: <AssignmentIndIcon fontSize="small" color="primary" />,
};

// ── Helpers ───────────────────────────────────────────────────

const formatCountdown = (dateStr: string): string => {
  const target = new Date(dateStr);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const formatted = target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (diffDays < 0) return `${formatted} — ${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return `${formatted} — today`;
  return `${formatted} — ${diffDays} day${diffDays === 1 ? '' : 's'}`;
};

const formatFilingPeriod = (period: string): string => {
  if (period.includes('Q')) {
    const [year, quarter] = [period.slice(0, 4), period.slice(4)];
    return `${quarter} ${year}`;
  }
  if (period.includes('M')) {
    const [year, month] = [period.slice(0, 4), period.slice(5)];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
  }
  return period;
};

const formatTimeAgo = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
};

const isConversion = (e: any): e is ConversionEvent =>
  !e.eventType || e.eventType === 'CONVERSION';

const isMmif = (e: any): e is MmifEvent =>
  e.eventType === 'REGULATORY_FILING';

// ── Component ─────────────────────────────────────────────────

const EventDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDrillDownDispatch();
  const { permissions } = useAuth();
  const isReadOnly = permissions.screens.eventDashboard.readOnly;

  // ── State ──────────────────────────────────────
  const [eventTypeFilter, setEventTypeFilter] = useState<'ALL' | EventType>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [assignedToMe, setAssignedToMe] = useState(false);

  const [conversionEvents, setConversionEvents] = useState<ConversionEvent[]>([]);
  const [mmifEvents, setMmifEvents] = useState<MmifEvent[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [, setLoading] = useState(true);

  const [allocSummary, setAllocSummary] = useState<Record<string, { assigned: number; total: number }>>({});
  const [breakSummaries, setBreakSummaries] = useState<Record<string, Record<string, { count: number; totalAmount: number }>>>({});
  const [reviewCompletion, setReviewCompletion] = useState<Record<string, { completed: number; total: number }>>({});

  // Run Validation modal
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runModalEvent, setRunModalEvent] = useState<any | null>(null);
  const [runValDate, setRunValDate] = useState('');
  const [runCheckSuite, setRunCheckSuite] = useState<string[]>(CHECK_SUITE_OPTIONS.map((c) => c.value));
  const [runFundFilter, setRunFundFilter] = useState<'all' | 'selected'>('all');
  const [runValidating, setRunValidating] = useState(false);
  // MMIF check suite options (loaded lazily)
  const [mmifCheckOptions, setMmifCheckOptions] = useState<{ value: string; label: string }[]>([]);

  // ── Load data ──────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [convEvts, mmifEvts, acts] = await Promise.all([
          fetchEvents(),
          fetchMmifEvents().catch(() => []),
          fetchActivity(10),
        ]);
        setConversionEvents(convEvts as ConversionEvent[]);
        setMmifEvents(mmifEvts as MmifEvent[]);
        setActivityFeed(acts as ActivityFeedItem[]);

        // Load MMIF check suite options
        fetchMmifCheckSuiteOptions().then(setMmifCheckOptions).catch(() => {});

        // Allocation + review summaries for conversion events
        const allocMap: Record<string, { assigned: number; total: number }> = {};
        const completionMap: Record<string, { completed: number; total: number }> = {};
        await Promise.all(
          (convEvts as ConversionEvent[]).map(async (evt) => {
            try {
              const allocs = await fetchAllocations(evt.eventId);
              allocMap[evt.eventId] = { assigned: allocs.filter((a: any) => a.reviewer).length, total: allocs.length };
              completionMap[evt.eventId] = { completed: allocs.filter((a: any) => a.reviewStatus === 'COMPLETE').length, total: allocs.length };
            } catch {
              allocMap[evt.eventId] = { assigned: 0, total: 0 };
              completionMap[evt.eventId] = { completed: 0, total: 0 };
            }
          })
        );
        setAllocSummary(allocMap);
        setReviewCompletion(completionMap);

        // Break summaries for conversion events
        const breakMap: Record<string, Record<string, { count: number; totalAmount: number }>> = {};
        await Promise.all(
          (convEvts as ConversionEvent[]).map(async (evt) => {
            try { breakMap[evt.eventId] = await fetchBreakSummary(evt.eventId); }
            catch { breakMap[evt.eventId] = {}; }
          })
        );
        setBreakSummaries(breakMap);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Navigation ─────────────────────────────────
  const navigateToConversionEvent = useCallback(
    (event: ConversionEvent) => {
      dispatch({ type: 'SET_EVENT', eventId: event.eventId, eventName: event.eventName });
      navigate(`/events/${event.eventId}/nav-dashboard`);
    },
    [dispatch, navigate],
  );

  const navigateToMmifEvent = useCallback(
    (event: MmifEvent) => {
      navigate(`/mmif/${event.eventId}`);
    },
    [navigate],
  );

  const navigateToActivityEvent = useCallback(
    (item: ActivityFeedItem) => {
      const event = conversionEvents.find((e) => e.eventId === item.eventId);
      if (event) {
        dispatch({ type: 'SET_EVENT', eventId: event.eventId, eventName: event.eventName });
      }
      navigate(`/events/${item.eventId}/nav-dashboard`);
    },
    [dispatch, navigate, conversionEvents],
  );

  // ── Modal ──────────────────────────────────────
  const openRunModal = useCallback((event: any) => {
    setRunModalEvent(event);
    setRunValDate('');
    if (isMmif(event)) {
      setRunCheckSuite(mmifCheckOptions.map((o) => o.value));
    } else {
      setRunCheckSuite(CHECK_SUITE_OPTIONS.map((c) => c.value));
    }
    setRunFundFilter('all');
    setRunModalOpen(true);
  }, [mmifCheckOptions]);

  const handleRunValidation = async () => {
    if (!runModalEvent) return;
    setRunValidating(true);
    try {
      if (isMmif(runModalEvent)) {
        await runMmifValidation({
          eventId: runModalEvent.eventId,
          filingPeriod: runModalEvent.filingPeriod,
          checkSuite: runCheckSuite,
          fundSelection: runFundFilter === 'all' ? 'all' : 'selected',
        });
        setRunModalOpen(false);
        navigateToMmifEvent(runModalEvent);
      } else {
        if (!runValDate) return;
        await runValidation({ eventId: runModalEvent.eventId, valuationDt: runValDate, checkSuite: runCheckSuite as CheckType[], fundSelection: runFundFilter === 'all' ? undefined : 'selected' });
        setRunModalOpen(false);
        navigateToConversionEvent(runModalEvent);
      }
    } catch {
      // stay on modal
    } finally {
      setRunValidating(false);
    }
  };

  // ── Build unified event list ───────────────────
  const allEvents = useMemo(() => {
    const conv = conversionEvents.map((e) => ({ ...e, eventType: (e.eventType || 'CONVERSION') as EventType }));
    const mmif = mmifEvents.map((e) => ({ ...e, eventType: 'REGULATORY_FILING' as EventType }));
    return [...conv, ...mmif];
  }, [conversionEvents, mmifEvents]);

  // ── Filter ─────────────────────────────────────
  const filteredEvents = useMemo(() => allEvents.filter((e) => {
    // Event type filter
    if (eventTypeFilter !== 'ALL' && e.eventType !== eventTypeFilter) return false;
    // Status filter
    if (statusFilter !== 'ALL' && (e as any).status !== statusFilter) return false;
    // Assigned to me
    if (assignedToMe && !(e as any).assignedTeam?.some((m: any) => m.userId === CURRENT_USER_ID)) return false;
    // Search
    if (search) {
      const q = search.toLowerCase();
      const name = (e as any).eventName?.toLowerCase() || '';
      const id = e.eventId.toLowerCase();
      const funds = ((e as any).funds || []).some((f: any) => f.fundName?.toLowerCase().includes(q));
      const provider = isConversion(e) ? (e as ConversionEvent).incumbentProvider?.toLowerCase() || '' : '';
      const period = isMmif(e) ? (e as MmifEvent).filingPeriod?.toLowerCase() || '' : '';
      if (!name.includes(q) && !id.includes(q) && !funds && !provider.includes(q) && !period.includes(q)) return false;
    }
    return true;
  }), [allEvents, eventTypeFilter, statusFilter, assignedToMe, search]);

  // ── Conversion helpers ─────────────────────────
  const getConvProgress = (event: ConversionEvent) => {
    const passed = event.funds.filter((f) => f.status === 'PASSED' || f.status === 'SIGNED_OFF').length;
    return event.funds.length > 0 ? (passed / event.funds.length) * 100 : 0;
  };
  const getAttentionCount = (event: ConversionEvent) =>
    event.funds.filter((f) => f.status === 'FAILED' || (f.breakCount && f.breakCount > 0)).length;
  const getBreakTooltipText = (eventId: string): string => {
    const summary = breakSummaries[eventId];
    if (!summary || Object.keys(summary).length === 0) return 'No break data available';
    return Object.entries(summary)
      .map(([category, data]) => `${category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}: ${data.count}`)
      .join(', ');
  };
  const getReviewPct = (eventId: string): number => {
    const comp = reviewCompletion[eventId];
    if (!comp || comp.total === 0) return 0;
    return Math.round((comp.completed / comp.total) * 100);
  };
  const getConvFundSegments = (event: ConversionEvent) => {
    const total = event.funds.length;
    if (total === 0) return { passedPct: 0, attentionPct: 0, failedPct: 0 };
    const passed = event.funds.filter((f) => f.status === 'PASSED' || f.status === 'SIGNED_OFF').length;
    const failed = event.funds.filter((f) => f.status === 'FAILED').length;
    return { passedPct: (passed / total) * 100, attentionPct: ((total - passed - failed) / total) * 100, failedPct: (failed / total) * 100 };
  };
  const getLastValidationTimestamp = (event: ConversionEvent): string | null => {
    const ts = event.funds.map((f) => f.lastRunTimestamp).filter((t): t is string => !!t);
    if (ts.length === 0) return null;
    ts.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return ts[0];
  };

  // ── MMIF helpers ───────────────────────────────
  const getMmifTotalBreaks = (event: MmifEvent): number =>
    event.funds.reduce((s, f) => s + (f.breakCount || 0), 0);
  const getMmifFundSegments = (event: MmifEvent) => {
    const total = event.funds.length;
    if (total === 0) return { passedPct: 0, inProgressPct: 0, pendingPct: 0 };
    const passed = event.funds.filter((f) => f.status === 'PASSED' || f.status === 'SIGNED_OFF').length;
    const inProg = event.funds.filter((f) => f.status === 'IN_PARALLEL').length;
    return { passedPct: (passed / total) * 100, inProgressPct: (inProg / total) * 100, pendingPct: ((total - passed - inProg) / total) * 100 };
  };

  // ── Dynamic status filter options ──────────────
  const statusOptions = useMemo(() => {
    if (eventTypeFilter === 'REGULATORY_FILING') {
      return ['ALL', 'DRAFT', 'MAPPING', 'EXTRACTION', 'RECONCILIATION', 'REVIEW', 'FILED'];
    }
    if (eventTypeFilter === 'CONVERSION') {
      return ['ALL', 'ACTIVE', 'PARALLEL', 'SIGNED_OFF', 'DRAFT'];
    }
    return ['ALL']; // When showing both types, only offer ALL
  }, [eventTypeFilter]);

  // Reset status filter when event type changes if current selection is invalid
  useEffect(() => {
    if (!statusOptions.includes(statusFilter)) setStatusFilter('ALL');
  }, [statusOptions, statusFilter]);

  // ── Render ─────────────────────────────────────
  return (
    <Box role="main" aria-label="Event Dashboard">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Event Dashboard
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Unified view of Conversion and MMIF Regulatory Filing events
        </Typography>
      </Box>

      {/* Event Type Toggle */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={eventTypeFilter}
          exclusive
          onChange={(_, v) => v && setEventTypeFilter(v)}
          size="small"
        >
          <ToggleButton value="ALL">All Events</ToggleButton>
          <ToggleButton value="CONVERSION">
            <SwapHorizIcon sx={{ fontSize: 16, mr: 0.5 }} />
            Conversion
          </ToggleButton>
          <ToggleButton value="REGULATORY_FILING">
            <DescriptionIcon sx={{ fontSize: 16, mr: 0.5 }} />
            Regulatory Filing
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Filters */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search events, funds, providers, periods..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300 }}
        />
        {statusOptions.length > 1 && (
          <ToggleButtonGroup
            value={statusFilter}
            exclusive
            onChange={(_, v) => v && setStatusFilter(v)}
            size="small"
          >
            {statusOptions.map((opt) => (
              <ToggleButton key={opt} value={opt}>
                {opt === 'ALL' ? 'All Statuses' : opt.charAt(0) + opt.slice(1).toLowerCase().replace('_', ' ')}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
        <FormControlLabel
          control={<Switch size="small" checked={assignedToMe} onChange={(e) => setAssignedToMe(e.target.checked)} />}
          label={<Typography variant="body2">Assigned To Me</Typography>}
          sx={{ ml: 1 }}
        />
      </Stack>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Event Cards */}
        <Grid size={{ xs: 12, lg: 9 }}>
          <Grid container spacing={2}>
            {filteredEvents.map((event) => {
              if (isMmif(event)) {
                return <MmifCard key={event.eventId} event={event as MmifEvent} theme={theme} isReadOnly={isReadOnly} onNavigate={navigateToMmifEvent} onRunValidation={openRunModal} getMmifTotalBreaks={getMmifTotalBreaks} getMmifFundSegments={getMmifFundSegments} />;
              }
              return <ConversionCard key={event.eventId} event={event as ConversionEvent} theme={theme} isReadOnly={isReadOnly} onNavigate={navigateToConversionEvent} onRunValidation={openRunModal} onRoster={(eid) => navigate(`/events/${eid}/allocations`)} getConvProgress={getConvProgress} getAttentionCount={getAttentionCount} getConvFundSegments={getConvFundSegments} getLastValidationTimestamp={getLastValidationTimestamp} getBreakTooltipText={getBreakTooltipText} getReviewPct={getReviewPct} allocSummary={allocSummary} reviewCompletion={reviewCompletion} />;
            })}
            {filteredEvents.length === 0 && (
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">No events match your filters</Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </Grid>

        {/* Activity Feed */}
        <Grid size={{ xs: 12, lg: 3 }}>
          <Paper sx={{ p: 2, borderRadius: 2, position: 'sticky', top: 80 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Activity Feed</Typography>
            <Stack spacing={1.5} divider={<Divider />}>
              {activityFeed.slice(0, 8).map((item) => (
                <Stack key={item.id} direction="row" spacing={1.5} alignItems="flex-start" onClick={() => navigateToActivityEvent(item)}
                  sx={{ cursor: 'pointer', borderRadius: 1, p: 0.5, mx: -0.5, transition: 'background-color 0.15s', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) } }}>
                  <Box sx={{ mt: 0.3 }}>{activityIcons[item.type]}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.4 }}>{item.message}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatTimeAgo(item.timestamp)}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Run Validation Modal */}
      <Dialog open={runModalOpen} onClose={() => setRunModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Run Validation — {runModalEvent?.eventName}
          {runModalEvent && isMmif(runModalEvent) && (
            <Chip label="MMIF" size="small" color="info" sx={{ ml: 1, fontSize: '0.7rem' }} />
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Valuation Date — only for Conversion */}
            {runModalEvent && isConversion(runModalEvent) && (
              <Box>
                <Typography variant="caption" fontWeight={600}>Valuation Date</Typography>
                <TextField type="date" size="small" fullWidth value={runValDate} onChange={(e) => setRunValDate(e.target.value)} sx={{ mt: 0.5 }} InputLabelProps={{ shrink: true }} />
              </Box>
            )}
            {/* Filing Period — only for MMIF */}
            {runModalEvent && isMmif(runModalEvent) && (
              <Box>
                <Typography variant="caption" fontWeight={600}>Filing Period</Typography>
                <Typography variant="body2">{formatFilingPeriod((runModalEvent as MmifEvent).filingPeriod)}</Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" fontWeight={600}>
                {runModalEvent && isMmif(runModalEvent) ? 'Validation Rules (VR-001 to VR-015)' : 'Check Suite'}
              </Typography>
              <FormGroup sx={{ mt: 0.5, maxHeight: 300, overflow: 'auto' }}>
                {(runModalEvent && isMmif(runModalEvent) ? mmifCheckOptions : CHECK_SUITE_OPTIONS).map((opt) => (
                  <FormControlLabel key={opt.value} control={
                    <Checkbox size="small" checked={runCheckSuite.includes(opt.value)} onChange={(e) => {
                      if (e.target.checked) setRunCheckSuite((prev) => [...prev, opt.value]);
                      else setRunCheckSuite((prev) => prev.filter((c) => c !== opt.value));
                    }} />
                  } label={<Typography variant="body2">{opt.label}</Typography>} />
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
            {runValidating && <LinearProgress />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRunModalOpen(false)} disabled={runValidating}>Cancel</Button>
          <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={handleRunValidation}
            disabled={runValidating || runCheckSuite.length === 0 || (runModalEvent && isConversion(runModalEvent) && !runValDate)}>
            {runValidating ? 'Running...' : 'Run Validation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ══════════════════════════════════════════════════════════════
// Conversion Event Card
// ══════════════════════════════════════════════════════════════

interface ConversionCardProps {
  event: ConversionEvent;
  theme: any;
  isReadOnly: boolean;
  onNavigate: (e: ConversionEvent) => void;
  onRunValidation: (e: ConversionEvent) => void;
  onRoster: (eventId: string) => void;
  getConvProgress: (e: ConversionEvent) => number;
  getAttentionCount: (e: ConversionEvent) => number;
  getConvFundSegments: (e: ConversionEvent) => { passedPct: number; attentionPct: number; failedPct: number };
  getLastValidationTimestamp: (e: ConversionEvent) => string | null;
  getBreakTooltipText: (eventId: string) => string;
  getReviewPct: (eventId: string) => number;
  allocSummary: Record<string, { assigned: number; total: number }>;
  reviewCompletion: Record<string, { completed: number; total: number }>;
}

const ConversionCard: React.FC<ConversionCardProps> = ({ event, theme, isReadOnly, onNavigate, onRunValidation, onRoster, getConvProgress, getAttentionCount, getConvFundSegments, getLastValidationTimestamp, getBreakTooltipText, getReviewPct, allocSummary, reviewCompletion }) => {
  const progress = getConvProgress(event);
  const attention = getAttentionCount(event);
  const passed = event.funds.filter((f) => f.status === 'PASSED' || f.status === 'SIGNED_OFF').length;
  const { passedPct, attentionPct, failedPct } = getConvFundSegments(event);
  const sparkData = (event.breakTrend7d || []).map((v, i) => ({ d: i, v }));
  const lastValidation = getLastValidationTimestamp(event);

  return (
    <Grid size={{ xs: 12, sm: 6, md: 6 }} key={event.eventId}>
      <Card sx={{ height: '100%', cursor: 'pointer', transition: 'all 0.2s',
        '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.12)', transform: 'translateY(-2px)' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }} tabIndex={0} role="button" aria-label={`${event.eventName} — ${conversionStatusLabels[event.status]}`}
        onClick={() => onNavigate(event)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(event); } }}>
        <CardContent sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="overline" color="text.secondary">{event.eventId}</Typography>
                <Chip label="Conversion" size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 16, '& .MuiChip-label': { px: 0.5 } }} />
              </Stack>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>{event.eventName}</Typography>
            </Box>
            <Chip label={conversionStatusLabels[event.status]} size="small" color={conversionStatusColors[event.status]} sx={{ fontWeight: 600 }} />
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>From: {event.incumbentProvider}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Go-live: {formatCountdown(event.targetGoLiveDate)}</Typography>

          {lastValidation && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
              <ScheduleIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">Last validation: {formatTimeAgo(lastValidation)}</Typography>
            </Stack>
          )}

          {/* Progress Bar */}
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="caption" fontWeight={600}>{passed} of {event.funds.length} funds passed</Typography>
              <Typography variant="caption" fontWeight={600}>{progress.toFixed(0)}%</Typography>
            </Stack>
            <Tooltip title={getBreakTooltipText(event.eventId)} placement="top" arrow>
              <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', bgcolor: alpha(theme.palette.grey[300], 0.3) }}>
                {passedPct > 0 && <Box sx={{ width: `${passedPct}%`, bgcolor: theme.palette.success.main, transition: 'width 0.3s ease' }} />}
                {attentionPct > 0 && <Box sx={{ width: `${attentionPct}%`, bgcolor: theme.palette.warning.main, transition: 'width 0.3s ease' }} />}
                {failedPct > 0 && <Box sx={{ width: `${failedPct}%`, bgcolor: theme.palette.error.main, transition: 'width 0.3s ease' }} />}
              </Box>
            </Tooltip>
            <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
              <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} /><Typography variant="caption" color="text.secondary">Passed</Typography></Stack>
              <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} /><Typography variant="caption" color="text.secondary">Attention</Typography></Stack>
              <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main' }} /><Typography variant="caption" color="text.secondary">Failed</Typography></Stack>
            </Stack>
          </Box>

          {reviewCompletion[event.eventId] && reviewCompletion[event.eventId].total > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{getReviewPct(event.eventId)}% reviewed</Typography>
          )}

          {/* Attention + Sparkline */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
            <Stack direction="row" spacing={1}>
              {attention > 0 && <Chip icon={<ErrorIcon />} label={`${attention} attention`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.7rem' }} />}
            </Stack>
            {sparkData.length > 0 && (
              <Box sx={{ width: 80, height: 30 }}>
                <ResponsiveContainer><LineChart data={sparkData}><Line type="monotone" dataKey="v" stroke={theme.palette.error.main} strokeWidth={1.5} dot={false} /></LineChart></ResponsiveContainer>
              </Box>
            )}
          </Stack>

          {/* Team */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
            <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.65rem' } }}>
              {event.assignedTeam.map((m) => (
                <Tooltip key={m.userId} title={`${m.name} (${m.role.replace('_', ' ')})`}><Avatar sx={{ bgcolor: 'secondary.main' }}>{m.name.split(' ').map((n) => n[0]).join('')}</Avatar></Tooltip>
              ))}
            </AvatarGroup>
          </Stack>
          {allocSummary[event.eventId] && allocSummary[event.eventId].total > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{allocSummary[event.eventId].assigned} of {allocSummary[event.eventId].total} reviewers assigned</Typography>
          )}
        </CardContent>
        <CardActions sx={{ px: 2, pb: 1.5, pt: 0 }}>
          {(['ACTIVE', 'PARALLEL'] as const).includes(event.status as any) ? (
            <>
              {!isReadOnly && <Button size="small" startIcon={<PlayArrowIcon />} onClick={(e) => { e.stopPropagation(); onRunValidation(event); }}>Run Validation</Button>}
              <Button size="small" startIcon={<VisibilityIcon />} onClick={(e) => { e.stopPropagation(); onNavigate(event); }}>Details</Button>
            </>
          ) : (['SIGNED_OFF', 'COMPLETE'] as const).includes(event.status as any) ? (
            <Button size="small" startIcon={<AssessmentIcon />} onClick={(e) => { e.stopPropagation(); onNavigate(event); }}>View Report</Button>
          ) : (
            <Button size="small" startIcon={<SettingsIcon />} onClick={(e) => { e.stopPropagation(); onNavigate(event); }}>Configure</Button>
          )}
          <Button size="small" variant="text" sx={{ textTransform: 'none', fontSize: '0.75rem' }} onClick={(e: React.MouseEvent) => { e.stopPropagation(); onRoster(event.eventId); }}>Roster</Button>
        </CardActions>
      </Card>
    </Grid>
  );
};

// ══════════════════════════════════════════════════════════════
// MMIF Regulatory Filing Event Card
// ══════════════════════════════════════════════════════════════

interface MmifCardProps {
  event: MmifEvent;
  theme: any;
  isReadOnly: boolean;
  onNavigate: (e: MmifEvent) => void;
  onRunValidation: (e: MmifEvent) => void;
  getMmifTotalBreaks: (e: MmifEvent) => number;
  getMmifFundSegments: (e: MmifEvent) => { passedPct: number; inProgressPct: number; pendingPct: number };
}

const MmifCard: React.FC<MmifCardProps> = ({ event, theme, isReadOnly, onNavigate, onRunValidation, getMmifTotalBreaks, getMmifFundSegments }) => {
  const totalBreaks = getMmifTotalBreaks(event);
  const { passedPct, inProgressPct, pendingPct } = getMmifFundSegments(event);
  const sparkData = (event.breakTrend7d || []).map((v, i) => ({ d: i, v }));
  const passedFunds = event.funds.filter((f) => f.status === 'PASSED' || f.status === 'SIGNED_OFF').length;

  return (
    <Grid size={{ xs: 12, sm: 6, md: 6 }} key={event.eventId}>
      <Card sx={{ height: '100%', cursor: 'pointer', transition: 'all 0.2s',
        '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.12)', transform: 'translateY(-2px)' },
        borderLeft: event.status === 'RECONCILIATION' ? `4px solid ${theme.palette.warning.main}` : event.status === 'FILED' ? `4px solid ${theme.palette.success.main}` : undefined,
      }} tabIndex={0} role="button" aria-label={`${event.eventName} — ${mmifStatusLabels[event.status]}`}
        onClick={() => onNavigate(event)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(event); } }}>
        <CardContent sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="overline" color="text.secondary">{event.eventId}</Typography>
                <Chip label="Reg Filing" size="small" color="info" variant="outlined" sx={{ fontSize: '0.6rem', height: 16, '& .MuiChip-label': { px: 0.5 } }} />
              </Stack>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>{event.eventName}</Typography>
            </Box>
            <Chip label={mmifStatusLabels[event.status]} size="small" color={mmifStatusColors[event.status]} sx={{ fontWeight: 600 }} />
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <GavelIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">{event.regulatoryBody}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">{formatFilingPeriod(event.filingPeriod)}</Typography>
            </Stack>
            <Chip label={event.filingFrequency} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Deadline: {formatCountdown(event.filingDeadline)}
          </Typography>

          {/* Progress Bar */}
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="caption" fontWeight={600}>{passedFunds} of {event.funds.length} funds reconciled</Typography>
            </Stack>
            <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', bgcolor: alpha(theme.palette.grey[300], 0.3) }}>
              {passedPct > 0 && <Box sx={{ width: `${passedPct}%`, bgcolor: theme.palette.success.main }} />}
              {inProgressPct > 0 && <Box sx={{ width: `${inProgressPct}%`, bgcolor: theme.palette.warning.main }} />}
              {pendingPct > 0 && <Box sx={{ width: `${pendingPct}%`, bgcolor: theme.palette.grey[300] }} />}
            </Box>
            <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
              <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} /><Typography variant="caption" color="text.secondary">Passed</Typography></Stack>
              <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} /><Typography variant="caption" color="text.secondary">In Progress</Typography></Stack>
              <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'grey.300' }} /><Typography variant="caption" color="text.secondary">Pending</Typography></Stack>
            </Stack>
          </Box>

          {/* Breaks + Sparkline */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
            <Stack direction="row" spacing={1}>
              {totalBreaks > 0 ? (
                <Chip icon={<ErrorOutlineIcon />} label={`${totalBreaks} break${totalBreaks > 1 ? 's' : ''}`} size="small" color="error" variant="outlined" sx={{ fontSize: '0.7rem' }} />
              ) : (
                <Chip icon={<CheckCircleOutlineIcon />} label="No breaks" size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem' }} />
              )}
            </Stack>
            {sparkData.length > 0 && (
              <Box sx={{ width: 80, height: 30 }}>
                <ResponsiveContainer><LineChart data={sparkData}><Line type="monotone" dataKey="v" stroke={totalBreaks > 0 ? theme.palette.error.main : theme.palette.success.main} strokeWidth={1.5} dot={false} /></LineChart></ResponsiveContainer>
              </Box>
            )}
          </Stack>

          {/* Fund Type Chips */}
          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap">
            {Array.from(new Set(event.funds.map((f) => f.fundType))).map((ft) => (
              <Chip key={ft} label={ft} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20 }} />
            ))}
          </Stack>

          {/* Team */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
            <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.65rem' } }}>
              {event.assignedTeam.map((m) => (
                <Tooltip key={m.userId} title={`${m.name} (${m.role.replace('_', ' ')})`}>
                  <Avatar sx={{ bgcolor: m.role === 'FUND_ADMIN' ? 'secondary.main' : 'primary.main' }}>{m.name.split(' ').map((n) => n[0]).join('')}</Avatar>
                </Tooltip>
              ))}
            </AvatarGroup>
          </Stack>
        </CardContent>
        <CardActions sx={{ px: 2, pb: 1.5, pt: 0 }}>
          {(['RECONCILIATION', 'EXTRACTION', 'MAPPING'] as const).includes(event.status as any) ? (
            <>
              {!isReadOnly && <Button size="small" startIcon={<PlayArrowIcon />} onClick={(e) => { e.stopPropagation(); onRunValidation(event); }}>Run Validation</Button>}
              <Button size="small" startIcon={<VisibilityIcon />} onClick={(e) => { e.stopPropagation(); onNavigate(event); }}>Details</Button>
            </>
          ) : event.status === 'FILED' ? (
            <Button size="small" startIcon={<DescriptionIcon />} onClick={(e) => { e.stopPropagation(); onNavigate(event); }}>View Filing</Button>
          ) : (
            <Button size="small" startIcon={<SettingsIcon />} onClick={(e) => { e.stopPropagation(); onNavigate(event); }}>Configure</Button>
          )}
        </CardActions>
      </Card>
    </Grid>
  );
};

export default EventDashboard;
