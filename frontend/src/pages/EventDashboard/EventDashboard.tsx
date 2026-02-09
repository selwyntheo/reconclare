import React, { useState, useEffect } from 'react';
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
  LinearProgress,
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
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { fetchEvents, fetchActivity } from '../../services/api';
import { ConversionEvent, EventStatus, ActivityFeedItem } from '../../types';

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

const EventDashboard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<ConversionEvent[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  const filteredEvents = events.filter((e) => {
    if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
    if (search && !e.eventName.toLowerCase().includes(search.toLowerCase()) && !e.eventId.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getEventProgress = (event: ConversionEvent) => {
    const passed = event.funds.filter((f) => f.status === 'PASSED' || f.status === 'SIGNED_OFF').length;
    return event.funds.length > 0 ? (passed / event.funds.length) * 100 : 0;
  };

  const getAttentionCount = (event: ConversionEvent) =>
    event.funds.filter((f) => f.status === 'FAILED' || (f.breakCount && f.breakCount > 0)).length;

  const formatTimeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  };

  return (
    <Box>
      {/* ── Header ──────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Event Dashboard
        </Typography>
        <Typography variant="subtitle1">
          Portfolio view of all conversion events — <strong>February 7, 2026</strong>
        </Typography>
      </Box>

      {/* ── Filters ─────────────────────────────────── */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 240 }}
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
      </Stack>

      {/* ── Main Content: Cards + Activity Feed ────── */}
      <Grid container spacing={3}>
        {/* Event Cards */}
        <Grid size={{ xs: 12, lg: 9 }}>
          <Grid container spacing={2}>
            {filteredEvents.map((event) => {
              const progress = getEventProgress(event);
              const attention = getAttentionCount(event);
              const passed = event.funds.filter((f) => f.status === 'PASSED' || f.status === 'SIGNED_OFF').length;
              const sparkData = (event.breakTrend7d || []).map((v, i) => ({ d: i, v }));

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
                    }}
                    onClick={() => navigate(`/events/${event.eventId}`)}
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
                        From: {event.incumbentProvider} · Go-live: {event.targetGoLiveDate}
                      </Typography>

                      {/* Progress */}
                      <Box sx={{ mt: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="caption" fontWeight={600}>
                            {passed} of {event.funds.length} funds passed
                          </Typography>
                          <Typography variant="caption" fontWeight={600}>
                            {progress.toFixed(0)}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 4,
                              bgcolor: progress === 100 ? 'success.main' : 'primary.main',
                            },
                          }}
                        />
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
                            onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.eventId}`); }}
                          >
                            Run Validation
                          </Button>
                          <Button
                            size="small"
                            startIcon={<VisibilityIcon />}
                            onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.eventId}`); }}
                          >
                            Details
                          </Button>
                        </>
                      ) : (['SIGNED_OFF', 'COMPLETE'] as const).includes(event.status as any) ? (
                        <Button
                          size="small"
                          startIcon={<AssessmentIcon />}
                          onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.eventId}`); }}
                        >
                          View Report
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          startIcon={<SettingsIcon />}
                          onClick={(e) => { e.stopPropagation(); navigate(`/events/${event.eventId}`); }}
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
                <Stack key={item.id} direction="row" spacing={1.5} alignItems="flex-start">
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
    </Box>
  );
};

export default EventDashboard;
