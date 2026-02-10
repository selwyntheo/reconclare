import React, { useState, useEffect } from 'react';
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
  Divider,
  LinearProgress,
  Collapse,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import BugReportIcon from '@mui/icons-material/BugReport';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { fetchEvent, fetchBreaks, fetchFundWaterfall, fetchFundPositions } from '../../services/api';
import { ReconTreeNode, AIAnalysis, ConversionEvent, BreakRecord, Fund, WaterfallItem } from '../../types';
import { LedgerSubledgerView } from '../../components/LedgerSubledger';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const formatCurrencyFull = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

// ── Reconciliation Tree Component ───────────────────────────

const TreeNode: React.FC<{ node: ReconTreeNode; depth?: number }> = ({ node, depth = 0 }) => {
  const [expanded, setExpanded] = useState(node.status === 'BREAK');
  const theme = useTheme();
  const hasChildren = node.children && node.children.length > 0;

  const statusIcon = node.status === 'BREAK'
    ? <CancelIcon fontSize="small" color="error" />
    : node.status === 'WARNING'
    ? <WarningAmberIcon fontSize="small" color="warning" />
    : <CheckCircleIcon fontSize="small" color="success" />;

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          py: 0.75,
          pl: depth * 3,
          cursor: hasChildren ? 'pointer' : 'default',
          borderRadius: 1,
          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) },
        }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ExpandMoreIcon fontSize="small" color="action" /> : <ChevronRightIcon fontSize="small" color="action" />
        ) : (
          <Box sx={{ width: 24 }} />
        )}
        {statusIcon}
        <Chip label={node.level} size="small" sx={{ fontWeight: 600, fontSize: '0.6rem', minWidth: 28 }} />
        <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
          {node.label}
        </Typography>
        <Typography
          variant="body2"
          fontWeight={600}
          color={node.variance !== 0 ? (node.status === 'BREAK' ? 'error.main' : 'warning.main') : 'text.secondary'}
        >
          {node.variance !== 0 ? formatCurrency(node.variance) : '$0'}
        </Typography>
      </Stack>
      {hasChildren && (
        <Collapse in={expanded}>
          {node.children!.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </Collapse>
      )}
    </Box>
  );
};

// ── Main Component ──────────────────────────────────────────

const FundBreakDetail: React.FC = () => {
  const { eventId, fundAccount } = useParams<{ eventId: string; fundAccount: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  const [event, setEvent] = useState<ConversionEvent | null>(null);
  const [fund, setFund] = useState<Fund | null>(null);
  const [fundBreaks, setFundBreaks] = useState<BreakRecord[]>([]);
  const [waterfallData, setWaterfallData] = useState<WaterfallItem[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!eventId || !fundAccount) return;
      try {
        setLoading(true);
        const [evt, breaks, waterfall, pos] = await Promise.all([
          fetchEvent(eventId),
          fetchBreaks({ fundAccount }),
          fetchFundWaterfall(fundAccount),
          fetchFundPositions(fundAccount),
        ]);
        const evtTyped = evt as ConversionEvent;
        setEvent(evtTyped);
        setFund(evtTyped.funds.find((f: Fund) => f.account === fundAccount) || null);
        setFundBreaks(breaks as BreakRecord[]);
        setWaterfallData(waterfall as WaterfallItem[]);
        setPositions(pos);
      } catch (err) {
        console.error('Failed to load fund detail:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId, fundAccount]);

  // Use the first break's AI analysis as the primary one
  const primaryAI: AIAnalysis | undefined = fundBreaks.find((b) => b.aiAnalysis)?.aiAnalysis;

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><Typography>Loading...</Typography></Box>;
  }

  if (!event || !fund) {
    return (
      <Box>
        <Typography variant="h5">Fund not found</Typography>
        <Button onClick={() => navigate('/')}>Back</Button>
      </Box>
    );
  }

  const totalVariance = fundBreaks.reduce((sum, b) => sum + Math.abs(b.variance), 0);

  // Waterfall chart data transformation
  const chartData = waterfallData.map((item, idx) => {
    if (item.type === 'start' || item.type === 'end') {
      return { name: item.label, value: item.value / 1000000, base: 0, fill: theme.palette.primary.main, hasBreak: false };
    }
    return {
      name: item.label,
      value: Math.abs(item.value) / 1000,
      base: 0,
      fill: item.hasBreak ? theme.palette.error.main : theme.palette.grey[400],
      hasBreak: item.hasBreak || false,
      isNegative: item.value < 0,
    };
  });

  // Build a simple recon tree from breaks
  const reconTree: ReconTreeNode = {
    id: 'root',
    label: `${fund.fundName} — NAV Reconciliation`,
    level: 'L0',
    status: fundBreaks.length > 0 ? 'BREAK' : 'PASS',
    variance: totalVariance,
    children: fundBreaks.map((b) => ({
      id: b.breakId,
      label: `${b.checkType.replace(/_/g, ' ')} — ${b.glCategory || b.securityId || 'Variance'}`,
      level: b.level as any,
      status: 'BREAK' as const,
      variance: b.variance,
    })),
  };

  return (
    <Box>
      {/* ── Breadcrumb Header ────────────────────────── */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <IconButton onClick={() => navigate(`/events/${eventId}`)}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {event.eventId} &gt; {fund.fundName} &gt; Feb 7, 2026
          </Typography>
          <Typography variant="h5" fontWeight={700}>
            {fund.fundName} — Break Analysis
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Chip
          label={`${fundBreaks.length} breaks`}
          color="error"
          sx={{ fontWeight: 600 }}
        />
      </Stack>

      {/* ── View Tabs ── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              minHeight: 48,
            },
          }}
        >
          <Tab
            icon={<BugReportIcon />}
            iconPosition="start"
            label="Break Analysis"
          />
          <Tab
            icon={<AccountBalanceWalletIcon />}
            iconPosition="start"
            label="Ledger to Subledger"
          />
        </Tabs>
      </Box>

      {/* ── Tab Content ── */}
      {activeTab === 1 ? (
        <LedgerSubledgerView fundAccount={fundAccount!} valuationDt="2026-02-07" />
      ) : (
      /* ── Main Layout: Left (Charts + Tree + Grid) | Right (AI Panel) ── */
      <Grid container spacing={3}>
        {/* Left Column */}
        <Grid size={{ xs: 12, lg: 8 }}>
          {/* NAV Waterfall Chart */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                NAV Waterfall
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha('#000', 0.06)} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      formatter={(value: any, name: any) => {
                        return [typeof value === 'number' ? `$${value.toLocaleString()}` : value, name];
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              <Stack direction="row" justifyContent="center" spacing={3} sx={{ mt: 1 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: theme.palette.error.main }} />
                  <Typography variant="caption">Break Component</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: theme.palette.grey[400] }} />
                  <Typography variant="caption">No Break</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: theme.palette.primary.main }} />
                  <Typography variant="caption">NAV Total</Typography>
                </Stack>
              </Stack>
              <Paper variant="outlined" sx={{ p: 1.5, mt: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2">
                  Total Variance: <strong style={{ color: theme.palette.error.main }}>{formatCurrency(totalVariance)}</strong>
                </Typography>
              </Paper>
            </CardContent>
          </Card>

          {/* Reconciliation Tree */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Reconciliation Tree
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <TreeNode node={reconTree} />
              </Paper>
            </CardContent>
          </Card>

          {/* Break Records Detail Grid */}
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Break Records
                </Typography>
                <Button size="small" startIcon={<FileDownloadIcon />} variant="outlined">
                  Export to Excel
                </Button>
              </Stack>
              <Box sx={{ overflowX: 'auto' }}>
                <Box
                  component="table"
                  sx={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    '& th': { textAlign: 'left', p: 1.5, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary', bgcolor: 'background.default', borderBottom: `2px solid ${theme.palette.divider}` },
                    '& td': { p: 1.5, fontSize: '0.8125rem', borderBottom: `1px solid ${theme.palette.divider}` },
                  }}
                >
                  <thead>
                    <tr>
                      <th>Break ID</th>
                      <th>Check Type</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>LHS Value</th>
                      <th style={{ textAlign: 'right' }}>RHS Value</th>
                      <th style={{ textAlign: 'right' }}>Variance</th>
                      <th>State</th>
                      <th>AI Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fundBreaks.map((brk) => (
                      <tr key={brk.breakId}>
                        <td><Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>{brk.breakId}</Typography></td>
                        <td><Typography variant="body2">{brk.checkType.replace(/_/g, ' ')}</Typography></td>
                        <td><Typography variant="body2">{brk.glCategory || brk.securityId || '—'}</Typography></td>
                        <td style={{ textAlign: 'right' }}>{formatCurrencyFull(brk.lhsValue)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrencyFull(brk.rhsValue)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: theme.palette.error.main }}>
                          {formatCurrencyFull(brk.variance)}
                        </td>
                        <td><Chip label={brk.state.replace(/_/g, ' ')} size="small" variant="outlined" sx={{ fontSize: '0.65rem', textTransform: 'capitalize' }} /></td>
                        <td>
                          {brk.aiAnalysis ? (
                            <Chip
                              icon={<SmartToyIcon />}
                              label={`${(brk.aiAnalysis.confidenceScore * 100).toFixed(0)}%`}
                              size="small"
                              color={brk.aiAnalysis.confidenceScore >= 0.85 ? 'success' : 'warning'}
                              sx={{ fontSize: '0.65rem' }}
                            />
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: AI Analysis Panel */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ p: 2.5, borderRadius: 2, position: 'sticky', top: 80 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <SmartToyIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                AI Analysis
              </Typography>
            </Stack>

            {primaryAI ? (
              <>
                {/* Root Cause */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="overline" color="text.secondary">Root Cause</Typography>
                  <Paper sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.04), border: `1px solid ${alpha(theme.palette.info.main, 0.15)}` }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                      {primaryAI.rootCauseSummary}
                    </Typography>
                  </Paper>
                </Box>

                {/* Confidence */}
                <Box sx={{ mb: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="overline" color="text.secondary">Confidence</Typography>
                    <Typography variant="h6" fontWeight={700} color={primaryAI.confidenceScore >= 0.85 ? 'success.main' : 'warning.main'}>
                      {(primaryAI.confidenceScore * 100).toFixed(0)}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={primaryAI.confidenceScore * 100}
                    sx={{
                      height: 10,
                      borderRadius: 5,
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 5,
                        bgcolor: primaryAI.confidenceScore >= 0.85 ? 'success.main' : primaryAI.confidenceScore >= 0.7 ? 'warning.main' : 'error.main',
                      },
                    }}
                  />
                </Box>

                {/* Evidence Chain */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="overline" color="text.secondary">Evidence Chain</Typography>
                  <Stack spacing={1} sx={{ mt: 0.5 }}>
                    {primaryAI.evidenceChain.map((step) => (
                      <Stack key={step.stepNumber} direction="row" spacing={1} alignItems="flex-start">
                        <Chip label={step.stepNumber} size="small" color="primary" sx={{ fontWeight: 700, minWidth: 24, height: 22 }} />
                        <Typography variant="body2" sx={{ lineHeight: 1.5 }}>{step.description}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Similar Breaks */}
                {primaryAI.similarBreaks.length > 0 && (
                  <Box sx={{ mb: 2.5 }}>
                    <Typography variant="overline" color="text.secondary">Similar Breaks</Typography>
                    <Stack spacing={1} sx={{ mt: 0.5 }}>
                      {primaryAI.similarBreaks.map((sb) => (
                        <Paper key={sb.breakId} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                          <Typography variant="body2" fontWeight={500}>{sb.fundName}, {sb.date}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatCurrency(sb.variance)} · {sb.resolution}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Feedback */}
                <Divider sx={{ my: 2 }} />
                <Stack direction="row" spacing={1} justifyContent="center">
                  <Button variant="outlined" startIcon={<ThumbUpIcon />} color="success" size="small">
                    Good
                  </Button>
                  <Button variant="outlined" startIcon={<ThumbDownIcon />} color="error" size="small">
                    Bad
                  </Button>
                </Stack>
              </>
            ) : (
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: alpha(theme.palette.warning.main, 0.04), borderRadius: 2 }}>
                <SmartToyIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="body1" fontWeight={600}>Analysis Pending</Typography>
                <Typography variant="body2" color="text.secondary">AI agents are still processing.</Typography>
              </Paper>
            )}
          </Paper>
        </Grid>
      </Grid>
      )}
    </Box>
  );
};

export default FundBreakDetail;
