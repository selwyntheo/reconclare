import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  Alert,
  AlertTitle,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  matchRateMetrics,
  breakAgingSummary,
  breakPatternDeltas,
  configDriftAlerts,
  dashboardStats,
} from '../../data/mockData';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const TrendIcon: React.FC<{ trend: 'up' | 'down' | 'flat' }> = ({ trend }) => {
  if (trend === 'up') return <TrendingUpIcon fontSize="small" color="success" />;
  if (trend === 'down') return <TrendingDownIcon fontSize="small" color="error" />;
  return <TrendingFlatIcon fontSize="small" color="disabled" />;
};

const ControlCenter: React.FC = () => {
  const theme = useTheme();

  const agingChartData = breakAgingSummary.map((b) => ({
    name: b.bucket,
    count: b.count,
    variance: b.totalVariance,
  }));

  const agingBarColors = ['#4CAF50', '#8BC34A', '#FF9800', '#F44336', '#B71C1C'];

  return (
    <Box>
      {/* ── Header ──────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Control Center
        </Typography>
        <Typography variant="subtitle1">
          Reconciliation overview for <strong>February 6, 2026</strong>
        </Typography>
      </Box>

      {/* ── Config Drift Alerts ─────────────────────── */}
      {configDriftAlerts.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {configDriftAlerts.map((alert) => (
            <Alert
              key={alert.id}
              severity={alert.severity}
              icon={alert.severity === 'error' ? <ErrorOutlineIcon /> : <WarningAmberIcon />}
              action={
                <IconButton size="small" color="inherit">
                  <CloseIcon fontSize="small" />
                </IconButton>
              }
              sx={{ mb: 1, borderRadius: 2 }}
            >
              <AlertTitle sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                Config Drift Detected
              </AlertTitle>
              <Typography variant="body2">{alert.message}</Typography>
              <Typography variant="caption" color="text.secondary">
                {alert.source} · {new Date(alert.detectedAt).toLocaleTimeString()}
              </Typography>
            </Alert>
          ))}
        </Box>
      )}

      {/* ── KPI Cards ───────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Total Open Breaks
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                {dashboardStats.openBreaks}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Chip
                  label={`${dashboardStats.newToday} new today`}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Critical Breaks
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                {dashboardStats.criticalBreaks}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <ErrorOutlineIcon fontSize="small" color="error" />
                <Typography variant="caption">Requires immediate attention</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Total Variance
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {formatCurrency(dashboardStats.totalVariance)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Across {dashboardStats.totalBreaks} breaks
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                Resolved Today
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                {dashboardStats.resolvedToday}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <CheckCircleOutlineIcon fontSize="small" color="success" />
                <Typography variant="caption">Auto + manual</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Match Rates + Break Aging ───────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Match Rates */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Match Rates
              </Typography>
              <Stack spacing={2}>
                {matchRateMetrics.map((m) => (
                  <Box key={m.label}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={500}>
                        {m.label}
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="body2" fontWeight={700}>
                          {m.rate}%
                        </Typography>
                        <TrendIcon trend={m.trend} />
                        <Typography variant="caption" color="text.secondary">
                          ({m.previousRate}%)
                        </Typography>
                      </Stack>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={m.rate}
                      sx={{
                        mt: 0.5,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          bgcolor:
                            m.rate >= 95
                              ? 'success.main'
                              : m.rate >= 90
                              ? 'primary.main'
                              : 'warning.main',
                        },
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Break Aging Chart */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Break Aging Distribution
              </Typography>
              <Box sx={{ width: '100%', height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={agingChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha('#000', 0.06)} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip
                      formatter={(value: any, name: any) =>
                        name === 'variance' ? formatCurrency(value) : value
                      }
                    />
                    <Bar dataKey="count" name="Break Count" radius={[4, 4, 0, 0]}>
                      {agingChartData.map((_, idx) => (
                        <Cell key={idx} fill={agingBarColors[idx]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Break Pattern Deltas ────────────────────── */}
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <NewReleasesIcon color="secondary" />
            <Typography variant="h6">Break Patterns — Today vs Yesterday</Typography>
          </Stack>
          <Grid container spacing={2}>
            {breakPatternDeltas.map((p) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }} key={p.pattern}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    borderColor:
                      p.delta > 0
                        ? alpha(theme.palette.error.main, 0.3)
                        : p.delta < 0
                        ? alpha(theme.palette.success.main, 0.3)
                        : 'divider',
                    bgcolor:
                      p.delta > 0
                        ? alpha(theme.palette.error.main, 0.03)
                        : p.delta < 0
                        ? alpha(theme.palette.success.main, 0.03)
                        : 'transparent',
                  }}
                >
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {p.pattern}
                  </Typography>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mt: 1 }}>
                    <Typography variant="h5" fontWeight={700}>
                      {p.todayCount}
                    </Typography>
                    <Tooltip title={`Yesterday: ${p.yesterdayCount}`}>
                      <Chip
                        size="small"
                        label={p.delta > 0 ? `+${p.delta}` : p.delta === 0 ? '—' : `${p.delta}`}
                        color={p.delta > 0 ? 'error' : p.delta < 0 ? 'success' : 'default'}
                        variant={p.delta === 0 ? 'outlined' : 'filled'}
                        sx={{ fontWeight: 600 }}
                      />
                    </Tooltip>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ControlCenter;
