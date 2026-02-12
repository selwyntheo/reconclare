import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Stack,
  Paper,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  alpha,
  useTheme,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import SortIcon from '@mui/icons-material/Sort';
import { fetchReviewableBreaks, annotateBreak } from '../../services/api';
import { BreakRecord, BreakCategory, ReviewAction } from '../../types';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const stateColorMap: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  DETECTED: 'default',
  ANALYZING: 'info',
  AI_PASSED: 'success',
  HUMAN_REVIEW_PENDING: 'warning',
  IN_REVIEW: 'warning',
  APPROVED: 'success',
  MODIFIED: 'info',
  ESCALATED: 'error',
  ACTION_PENDING: 'warning',
  CLOSED: 'default',
  RESOLVED: 'success',
};

const HumanReview: React.FC = () => {
  const theme = useTheme();
  const [sortBy, setSortBy] = useState<'variance' | 'confidence' | 'state'>('variance');
  const [selectedBreak, setSelectedBreak] = useState<BreakRecord | null>(null);
  const [annotationNotes, setAnnotationNotes] = useState('');
  const [resolutionCategory, setResolutionCategory] = useState<BreakCategory | ''>('');
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [reviewableBreaks, setReviewableBreaks] = useState<BreakRecord[]>([]);
  const [, setLoading] = useState(true);
  const [, setSubmitting] = useState(false);

  const loadBreaks = async () => {
    try {
      setLoading(true);
      const breaks = await fetchReviewableBreaks();
      setReviewableBreaks(breaks as BreakRecord[]);
    } catch (err) {
      console.error('Failed to load reviewable breaks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBreaks(); }, []);

  const sortedBreaks = [...reviewableBreaks].sort((a, b) => {
    if (sortBy === 'variance') return Math.abs(b.variance) - Math.abs(a.variance);
    if (sortBy === 'confidence') {
      const ac = a.aiAnalysis?.confidenceScore ?? 0;
      const bc = b.aiAnalysis?.confidenceScore ?? 0;
      return ac - bc;
    }
    return 0;
  });

  const handleOpenAnnotation = (brk: BreakRecord, action: ReviewAction) => {
    setSelectedBreak(brk);
    setReviewAction(action);
    setAnnotationNotes('');
    setResolutionCategory(brk.aiAnalysis?.breakCategory || '');
  };

  const handleSubmitAnnotation = async () => {
    if (!selectedBreak || !reviewAction) return;
    try {
      setSubmitting(true);
      await annotateBreak(selectedBreak.breakId, {
        breakId: selectedBreak.breakId,
        action: reviewAction,
        notes: annotationNotes,
        resolutionCategory: resolutionCategory || undefined,
      });
      setSelectedBreak(null);
      setReviewAction(null);
      setAnnotationNotes('');
      setResolutionCategory('');
      // Reload breaks to reflect updated state
      await loadBreaks();
    } catch (err) {
      console.error('Failed to submit annotation:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = reviewableBreaks.filter((b) => b.state === 'HUMAN_REVIEW_PENDING').length;
  const inReviewCount = reviewableBreaks.filter((b) => b.state === 'IN_REVIEW').length;
  const totalVariance = reviewableBreaks.reduce((s, b) => s + Math.abs(b.variance), 0);

  return (
    <Box>
      {/* ── Header ──────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Human Review Queue
        </Typography>
        <Typography variant="subtitle1">
          Breaks requiring human annotation and approval
        </Typography>
      </Box>

      {/* ── Summary KPIs ─────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Queue Size</Typography>
              <Typography variant="h4" fontWeight={700} color="primary.main">{reviewableBreaks.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Pending Review</Typography>
              <Typography variant="h4" fontWeight={700} color="warning.main">{pendingCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">In Review</Typography>
              <Typography variant="h4" fontWeight={700} color="info.main">{inReviewCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <Card>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary">Total Variance</Typography>
              <Typography variant="h5" fontWeight={700} color="error.main">{formatCurrency(totalVariance)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Sort Controls ────────────────────────────── */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <SortIcon color="action" />
        <Typography variant="body2" fontWeight={500}>Sort by:</Typography>
        <ToggleButtonGroup
          value={sortBy}
          exclusive
          onChange={(_, v) => v && setSortBy(v)}
          size="small"
        >
          <ToggleButton value="variance">Variance</ToggleButton>
          <ToggleButton value="confidence">Confidence</ToggleButton>
          <ToggleButton value="state">State</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* ── Break Review Cards ───────────────────────── */}
      <Stack spacing={2}>
        {sortedBreaks.map((brk) => (
          <Card
            key={brk.breakId}
            sx={{
              borderLeft: `4px solid ${
                brk.state === 'HUMAN_REVIEW_PENDING'
                  ? theme.palette.warning.main
                  : brk.state === 'IN_REVIEW'
                  ? theme.palette.info.main
                  : theme.palette.grey[400]
              }`,
            }}
          >
            <CardContent>
              <Grid container spacing={2}>
                {/* Break Info */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Chip label={brk.breakId} size="small" color="primary" sx={{ fontWeight: 600 }} />
                    <Chip
                      label={brk.state.replace(/_/g, ' ')}
                      size="small"
                      color={stateColorMap[brk.state] || 'default'}
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', textTransform: 'capitalize' }}
                    />
                  </Stack>
                  <Typography variant="body2" fontWeight={600}>{brk.fundName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {brk.checkType.replace(/_/g, ' ')} · {brk.level} · {brk.glCategory}
                  </Typography>
                  <Typography variant="h6" fontWeight={700} color="error.main" sx={{ mt: 1 }}>
                    {formatCurrency(Math.abs(brk.variance))}
                  </Typography>
                </Grid>

                {/* AI Analysis Summary */}
                <Grid size={{ xs: 12, md: 5 }}>
                  {brk.aiAnalysis ? (
                    <Paper sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.03), height: '100%' }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <SmartToyIcon fontSize="small" color="primary" />
                        <Typography variant="subtitle2">AI Findings</Typography>
                        <Chip
                          label={`${(brk.aiAnalysis.confidenceScore * 100).toFixed(0)}%`}
                          size="small"
                          color={brk.aiAnalysis.confidenceScore >= 0.85 ? 'success' : brk.aiAnalysis.confidenceScore >= 0.7 ? 'warning' : 'error'}
                          sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                        />
                        <Chip label={brk.aiAnalysis.breakCategory} size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                      </Stack>
                      <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                        {brk.aiAnalysis.rootCauseSummary}
                      </Typography>
                    </Paper>
                  ) : (
                    <Paper sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.04), height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" color="text.secondary">AI analysis pending</Typography>
                    </Paper>
                  )}
                </Grid>

                {/* Actions */}
                <Grid size={{ xs: 12, md: 3 }}>
                  <Stack spacing={1} sx={{ height: '100%', justifyContent: 'center' }}>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<CheckCircleIcon />}
                      onClick={() => handleOpenAnnotation(brk, 'ACCEPT')}
                      fullWidth
                    >
                      Accept AI Analysis
                    </Button>
                    <Button
                      variant="outlined"
                      color="info"
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleOpenAnnotation(brk, 'MODIFY')}
                      fullWidth
                    >
                      Modify Root Cause
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<ErrorOutlineIcon />}
                      onClick={() => handleOpenAnnotation(brk, 'REJECT')}
                      fullWidth
                    >
                      Reject & Escalate
                    </Button>
                  </Stack>

                  {/* Existing annotation */}
                  {brk.humanAnnotation && (
                    <Paper variant="outlined" sx={{ p: 1.5, mt: 1, borderRadius: 1.5 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="caption" fontWeight={600}>
                          {brk.humanAnnotation.reviewerName}
                        </Typography>
                        <Chip
                          label={brk.humanAnnotation.action}
                          size="small"
                          color={brk.humanAnnotation.action === 'ACCEPT' ? 'success' : brk.humanAnnotation.action === 'MODIFY' ? 'info' : 'error'}
                          sx={{ fontSize: '0.6rem' }}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {brk.humanAnnotation.notes}
                      </Typography>
                    </Paper>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* ── Annotation Dialog ────────────────────────── */}
      <Dialog
        open={!!selectedBreak && !!reviewAction}
        onClose={() => { setSelectedBreak(null); setReviewAction(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {reviewAction === 'ACCEPT' && 'Accept AI Analysis'}
          {reviewAction === 'MODIFY' && 'Modify Root Cause'}
          {reviewAction === 'REJECT' && 'Reject and Escalate'}
        </DialogTitle>
        <DialogContent>
          {selectedBreak && (
            <>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
                <Typography variant="body2"><strong>Break:</strong> {selectedBreak.breakId}</Typography>
                <Typography variant="body2"><strong>Fund:</strong> {selectedBreak.fundName}</Typography>
                <Typography variant="body2"><strong>Variance:</strong> {formatCurrency(Math.abs(selectedBreak.variance))}</Typography>
                {selectedBreak.aiAnalysis && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    <strong>AI Summary:</strong> {selectedBreak.aiAnalysis.rootCauseSummary}
                  </Typography>
                )}
              </Paper>

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Resolution Category</InputLabel>
                <Select
                  value={resolutionCategory}
                  label="Resolution Category"
                  onChange={(e) => setResolutionCategory(e.target.value as BreakCategory)}
                >
                  {['TIMING', 'METHODOLOGY', 'DATA', 'PRICING', 'FX', 'ACCRUAL', 'CORPORATE_ACTION', 'POSITION', 'MAPPING', 'UNKNOWN'].map((cat) => (
                    <MenuItem key={cat} value={cat}>{cat.replace(/_/g, ' ')}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Annotation Notes"
                placeholder="Explain your decision rationale..."
                value={annotationNotes}
                onChange={(e) => setAnnotationNotes(e.target.value)}
                size="small"
              />

              <Paper variant="outlined" sx={{ p: 1.5, mt: 2, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>Audit Signature:</strong> Jane Doe · Conversion Manager · {new Date().toISOString()}
                </Typography>
              </Paper>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setSelectedBreak(null); setReviewAction(null); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={reviewAction === 'ACCEPT' ? 'success' : reviewAction === 'MODIFY' ? 'info' : 'error'}
            onClick={handleSubmitAnnotation}
          >
            {reviewAction === 'ACCEPT' && 'Accept & Close'}
            {reviewAction === 'MODIFY' && 'Save Modification'}
            {reviewAction === 'REJECT' && 'Escalate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HumanReview;
