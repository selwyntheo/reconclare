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
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Radio,
  RadioGroup,
  LinearProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SettingsIcon from '@mui/icons-material/Settings';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import GavelIcon from '@mui/icons-material/Gavel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { fetchMmifEvents, runMmifValidation, fetchMmifCheckSuiteOptions } from '../../services/api';
import { MmifEvent, MmifEventStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';

const mmifStatusColors: Record<MmifEventStatus, 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'> = {
  DRAFT: 'default',
  MAPPING: 'primary',
  EXTRACTION: 'info',
  RECONCILIATION: 'warning',
  REVIEW: 'info',
  FILED: 'success',
};

const mmifStatusLabels: Record<MmifEventStatus, string> = {
  DRAFT: 'Draft',
  MAPPING: 'Mapping',
  EXTRACTION: 'Extraction',
  RECONCILIATION: 'Reconciliation',
  REVIEW: 'Review',
  FILED: 'Filed',
};

const formatDeadlineCountdown = (deadline: string): string => {
  const target = new Date(deadline);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const formatted = target.toLocaleDateString('en-IE', { month: 'short', day: 'numeric', year: 'numeric' });
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

const MmifDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const isReadOnly = permissions.screens.mmifDashboard.readOnly;
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<MmifEvent[]>([]);
  const [, setLoading] = useState(true);
  const [checkSuiteOptions, setCheckSuiteOptions] = useState<{ value: string; label: string }[]>([]);

  // Run Validation modal state
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runModalEvent, setRunModalEvent] = useState<MmifEvent | null>(null);
  const [runCheckSuite, setRunCheckSuite] = useState<string[]>([]);
  const [runFundFilter, setRunFundFilter] = useState<'all' | 'selected'>('all');
  const [runValidating, setRunValidating] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [evts, options] = await Promise.all([
          fetchMmifEvents(),
          fetchMmifCheckSuiteOptions().catch(() => []),
        ]);
        setEvents(evts as MmifEvent[]);
        setCheckSuiteOptions(options);
        setRunCheckSuite(options.map((o: any) => o.value));
      } catch (err) {
        console.error('Failed to load MMIF dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const navigateToEvent = useCallback(
    (event: MmifEvent) => {
      navigate(`/mmif/${event.eventId}`);
    },
    [navigate],
  );

  const openRunModal = useCallback((event: MmifEvent) => {
    setRunModalEvent(event);
    setRunCheckSuite(checkSuiteOptions.map((o) => o.value));
    setRunFundFilter('all');
    setRunModalOpen(true);
  }, [checkSuiteOptions]);

  const handleRunValidation = async () => {
    if (!runModalEvent) return;
    setRunValidating(true);
    try {
      await runMmifValidation({
        eventId: runModalEvent.eventId,
        filingPeriod: runModalEvent.filingPeriod,
        checkSuite: runCheckSuite,
        fundSelection: runFundFilter === 'all' ? 'all' : 'selected',
      });
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
    if (search) {
      const q = search.toLowerCase();
      const matchesName = e.eventName.toLowerCase().includes(q);
      const matchesId = e.eventId.toLowerCase().includes(q);
      const matchesFund = e.funds.some((f) => f.fundName.toLowerCase().includes(q));
      const matchesPeriod = e.filingPeriod.toLowerCase().includes(q);
      if (!matchesName && !matchesId && !matchesFund && !matchesPeriod) return false;
    }
    return true;
  }), [events, statusFilter, search]);

  const getTotalBreaks = (event: MmifEvent): number =>
    event.funds.reduce((sum, f) => sum + (f.breakCount || 0), 0);

  const getFundSegments = (event: MmifEvent) => {
    const total = event.funds.length;
    if (total === 0) return { passedPct: 0, inProgressPct: 0, pendingPct: 0 };
    const passed = event.funds.filter((f) => f.status === 'PASSED' || f.status === 'SIGNED_OFF').length;
    const inProgress = event.funds.filter((f) => f.status === 'IN_PARALLEL').length;
    const pending = total - passed - inProgress;
    return {
      passedPct: (passed / total) * 100,
      inProgressPct: (inProgress / total) * 100,
      pendingPct: (pending / total) * 100,
    };
  };

  return (
    <Box role="main" aria-label="MMIF Filing Dashboard">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
          <DescriptionIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            MMIF Regulatory Filing
          </Typography>
        </Stack>
        <Typography variant="subtitle1" color="text.secondary">
          CBI Money Market & Investment Fund reporting — reconciliation dashboard
        </Typography>
      </Box>

      {/* Filters */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search filings, funds, periods..."
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
          <ToggleButton value="ALL">All</ToggleButton>
          <ToggleButton value="DRAFT">Draft</ToggleButton>
          <ToggleButton value="MAPPING">Mapping</ToggleButton>
          <ToggleButton value="EXTRACTION">Extraction</ToggleButton>
          <ToggleButton value="RECONCILIATION">Reconciliation</ToggleButton>
          <ToggleButton value="REVIEW">Review</ToggleButton>
          <ToggleButton value="FILED">Filed</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Event Cards */}
      <Grid container spacing={2}>
        {filteredEvents.map((event) => {
          const totalBreaks = getTotalBreaks(event);
          const { passedPct, inProgressPct, pendingPct } = getFundSegments(event);
          const sparkData = (event.breakTrend7d || []).map((v, i) => ({ d: i, v }));
          const passedFunds = event.funds.filter((f) => f.status === 'PASSED' || f.status === 'SIGNED_OFF').length;

          return (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={event.eventId}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                    transform: 'translateY(-2px)',
                  },
                  borderLeft: event.status === 'RECONCILIATION'
                    ? `4px solid ${theme.palette.warning.main}`
                    : event.status === 'FILED'
                    ? `4px solid ${theme.palette.success.main}`
                    : undefined,
                }}
                tabIndex={0}
                role="button"
                aria-label={`${event.eventName} — ${mmifStatusLabels[event.status]}`}
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
                      label={mmifStatusLabels[event.status]}
                      size="small"
                      color={mmifStatusColors[event.status]}
                      sx={{ fontWeight: 600 }}
                    />
                  </Stack>

                  <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <GavelIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {event.regulatoryBody}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {formatFilingPeriod(event.filingPeriod)}
                      </Typography>
                    </Stack>
                    <Chip
                      label={event.filingFrequency}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Deadline: {formatDeadlineCountdown(event.filingDeadline)}
                  </Typography>

                  {/* Fund Progress Bar */}
                  <Box sx={{ mt: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" fontWeight={600}>
                        {passedFunds} of {event.funds.length} funds reconciled
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
                        <Box sx={{ width: `${passedPct}%`, bgcolor: theme.palette.success.main }} />
                      )}
                      {inProgressPct > 0 && (
                        <Box sx={{ width: `${inProgressPct}%`, bgcolor: theme.palette.warning.main }} />
                      )}
                      {pendingPct > 0 && (
                        <Box sx={{ width: `${pendingPct}%`, bgcolor: theme.palette.grey[300] }} />
                      )}
                    </Box>
                    <Stack direction="row" spacing={1.5} sx={{ mt: 0.5 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                        <Typography variant="caption" color="text.secondary">Passed</Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
                        <Typography variant="caption" color="text.secondary">In Progress</Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'grey.300' }} />
                        <Typography variant="caption" color="text.secondary">Pending</Typography>
                      </Stack>
                    </Stack>
                  </Box>

                  {/* Breaks + Sparkline */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
                    <Stack direction="row" spacing={1}>
                      {totalBreaks > 0 ? (
                        <Chip
                          icon={<ErrorOutlineIcon />}
                          label={`${totalBreaks} break${totalBreaks > 1 ? 's' : ''}`}
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ) : (
                        <Chip
                          icon={<CheckCircleOutlineIcon />}
                          label="No breaks"
                          size="small"
                          color="success"
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
                              stroke={totalBreaks > 0 ? theme.palette.error.main : theme.palette.success.main}
                              strokeWidth={1.5}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </Stack>

                  {/* Fund Types */}
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
                          <Avatar sx={{ bgcolor: m.role === 'FUND_ADMIN' ? 'secondary.main' : 'primary.main' }}>
                            {m.name.split(' ').map((n) => n[0]).join('')}
                          </Avatar>
                        </Tooltip>
                      ))}
                    </AvatarGroup>
                  </Stack>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 1.5, pt: 0 }}>
                  {(['RECONCILIATION', 'EXTRACTION', 'MAPPING'] as const).includes(event.status as any) ? (
                    <>
                      {!isReadOnly && (
                        <Button
                          size="small"
                          startIcon={<PlayArrowIcon />}
                          onClick={(e) => { e.stopPropagation(); openRunModal(event); }}
                        >
                          Run Validation
                        </Button>
                      )}
                      <Button
                        size="small"
                        startIcon={<VisibilityIcon />}
                        onClick={(e) => { e.stopPropagation(); navigateToEvent(event); }}
                      >
                        Details
                      </Button>
                    </>
                  ) : event.status === 'FILED' ? (
                    <Button
                      size="small"
                      startIcon={<DescriptionIcon />}
                      onClick={(e) => { e.stopPropagation(); navigateToEvent(event); }}
                    >
                      View Filing
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

      {/* Run Validation Modal */}
      <Dialog open={runModalOpen} onClose={() => setRunModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Run MMIF Validation — {runModalEvent?.eventName}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="caption" fontWeight={600}>Filing Period</Typography>
              <Typography variant="body2">{runModalEvent?.filingPeriod ? formatFilingPeriod(runModalEvent.filingPeriod) : ''}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={600}>Validation Rules (VR-001 to VR-020)</Typography>
              <FormGroup sx={{ mt: 0.5, maxHeight: 300, overflow: 'auto' }}>
                {checkSuiteOptions.map((opt) => (
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
            disabled={runValidating || runCheckSuite.length === 0}
          >
            {runValidating ? 'Running...' : 'Run Validation'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MmifDashboard;
