import React from 'react';
import { Box, Paper, Stack, Typography, LinearProgress } from '@mui/material';

// ── RAG Colors ────────────────────────────────────────────
const RAG_GREEN = '#E2F0D9';
const RAG_GREEN_TEXT = '#2E7D32';
const RAG_AMBER = '#FFF2CC';
const RAG_AMBER_TEXT = '#ED6C02';
const RAG_RED = '#FCE4EC';
const RAG_RED_TEXT = '#d32f2f';

// ── Types ─────────────────────────────────────────────────

export interface NavKpiData {
  /** Total NAV variance (BNY - Incumbent) in dollars */
  totalVariance: number;
  /** Total NAV variance in basis points */
  totalVarianceBP: number;
  /** RAG distribution counts */
  greenCount: number;
  amberCount: number;
  redCount: number;
  /** Total items (funds or share classes) */
  totalItems: number;
  /** Label for total items (e.g. "Funds" or "Share Classes") */
  itemLabel: string;
  /** Largest absolute break: fund name and BP value */
  largestBreak?: { name: string; bpValue: number };
  /** Review progress: completed / total */
  reviewProgress?: { completed: number; total: number };
}

// ── Helpers ───────────────────────────────────────────────

function ragColorForBP(bp: number): string {
  const abs = Math.abs(bp);
  if (abs <= 5) return RAG_GREEN;
  if (abs <= 50) return RAG_AMBER;
  return RAG_RED;
}

function ragTextForBP(bp: number): string {
  const abs = Math.abs(bp);
  if (abs <= 5) return RAG_GREEN_TEXT;
  if (abs <= 50) return RAG_AMBER_TEXT;
  return RAG_RED_TEXT;
}

const fmtCurrency = (v: number) =>
  v < 0
    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`
    : v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// ── Component ─────────────────────────────────────────────

export default function NavKpiCards({ data }: { data: NavKpiData }) {
  const total = data.greenCount + data.amberCount + data.redCount;
  const greenPct = total > 0 ? (data.greenCount / total) * 100 : 0;
  const amberPct = total > 0 ? (data.amberCount / total) * 100 : 0;
  const redPct = total > 0 ? (data.redCount / total) * 100 : 0;

  const reviewPct =
    data.reviewProgress && data.reviewProgress.total > 0
      ? (data.reviewProgress.completed / data.reviewProgress.total) * 100
      : null;

  return (
    <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
      {/* Card 1: Total Variance */}
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          flex: 1,
          p: 1.5,
          borderLeft: `4px solid ${ragColorForBP(data.totalVarianceBP)}`,
          minWidth: 0,
        }}
      >
        <Typography variant="caption" color="text.secondary" noWrap>
          Total NAV Variance
        </Typography>
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ color: ragTextForBP(data.totalVarianceBP), fontSize: '1.1rem' }}
          noWrap
        >
          {fmtCurrency(data.totalVariance)}
        </Typography>
        <Typography variant="caption" sx={{ color: ragTextForBP(data.totalVarianceBP) }}>
          {data.totalVarianceBP.toFixed(2)} bp
        </Typography>
      </Paper>

      {/* Card 2: RAG Distribution */}
      <Paper elevation={0} variant="outlined" sx={{ flex: 1.3, p: 1.5, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" noWrap>
          RAG Distribution ({data.totalItems} {data.itemLabel})
        </Typography>
        {/* Stacked bar */}
        <Box sx={{ display: 'flex', height: 20, borderRadius: 1, overflow: 'hidden', mt: 0.5, mb: 0.5 }}>
          {greenPct > 0 && (
            <Box
              sx={{ width: `${greenPct}%`, bgcolor: RAG_GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700, color: RAG_GREEN_TEXT }}>
                {data.greenCount}
              </Typography>
            </Box>
          )}
          {amberPct > 0 && (
            <Box
              sx={{ width: `${amberPct}%`, bgcolor: RAG_AMBER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700, color: RAG_AMBER_TEXT }}>
                {data.amberCount}
              </Typography>
            </Box>
          )}
          {redPct > 0 && (
            <Box
              sx={{ width: `${redPct}%`, bgcolor: RAG_RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700, color: RAG_RED_TEXT }}>
                {data.redCount}
              </Typography>
            </Box>
          )}
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Typography variant="caption" sx={{ color: RAG_GREEN_TEXT, fontWeight: 600 }}>
            {data.greenCount} Green
          </Typography>
          <Typography variant="caption" sx={{ color: RAG_AMBER_TEXT, fontWeight: 600 }}>
            {data.amberCount} Amber
          </Typography>
          <Typography variant="caption" sx={{ color: RAG_RED_TEXT, fontWeight: 600 }}>
            {data.redCount} Red
          </Typography>
        </Stack>
      </Paper>

      {/* Card 3: Largest Break */}
      {data.largestBreak && (
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            flex: 1,
            p: 1.5,
            borderLeft: `4px solid ${ragColorForBP(data.largestBreak.bpValue)}`,
            minWidth: 0,
          }}
        >
          <Typography variant="caption" color="text.secondary" noWrap>
            Largest Break
          </Typography>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{ color: ragTextForBP(data.largestBreak.bpValue), fontSize: '1.1rem' }}
            noWrap
          >
            {Math.abs(data.largestBreak.bpValue).toFixed(2)} bp
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {data.largestBreak.name}
          </Typography>
        </Paper>
      )}

      {/* Card 4: Review Progress */}
      {data.reviewProgress && reviewPct !== null && (
        <Paper elevation={0} variant="outlined" sx={{ flex: 1, p: 1.5, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" noWrap>
            Review Progress
          </Typography>
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>
            {data.reviewProgress.completed}/{data.reviewProgress.total}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={reviewPct}
            sx={{
              height: 6,
              borderRadius: 3,
              mt: 0.5,
              bgcolor: '#f0f0f0',
              '& .MuiLinearProgress-bar': {
                bgcolor: reviewPct >= 100 ? RAG_GREEN_TEXT : reviewPct >= 50 ? RAG_AMBER_TEXT : '#1976d2',
                borderRadius: 3,
              },
            }}
          />
        </Paper>
      )}
    </Stack>
  );
}
