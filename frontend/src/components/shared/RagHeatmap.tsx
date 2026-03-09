import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';

// ── RAG Colors ────────────────────────────────────────────
const RAG_GREEN = '#E2F0D9';
const RAG_GREEN_BORDER = '#A9D18E';
const RAG_AMBER = '#FFF2CC';
const RAG_AMBER_BORDER = '#FFD966';
const RAG_RED = '#FCE4EC';
const RAG_RED_BORDER = '#F48FB1';
const RAG_NULL = '#f5f5f5';

// ── Types ─────────────────────────────────────────────────

export interface HeatmapFund {
  fund: string;
  fundName: string;
  [dateKey: string]: any;
}

export interface RagHeatmapProps {
  funds: HeatmapFund[];
  dates: string[];
  onCellClick?: (fund: string, fundName: string, date: string, bpValue: number) => void;
}

// ── Helpers ───────────────────────────────────────────────

function ragColors(bp: number | null | undefined): { bg: string; border: string } {
  if (bp == null) return { bg: RAG_NULL, border: '#e0e0e0' };
  const abs = Math.abs(bp);
  if (abs <= 5) return { bg: RAG_GREEN, border: RAG_GREEN_BORDER };
  if (abs <= 50) return { bg: RAG_AMBER, border: RAG_AMBER_BORDER };
  return { bg: RAG_RED, border: RAG_RED_BORDER };
}

function ragLabel(bp: number | null | undefined): string {
  if (bp == null) return 'N/A';
  const abs = Math.abs(bp);
  if (abs <= 5) return 'Green';
  if (abs <= 50) return 'Amber';
  return 'Red';
}

const formatDateShort = (dateStr: string): string => {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

// ── Component ─────────────────────────────────────────────

export default function RagHeatmap({ funds, dates, onCellClick }: RagHeatmapProps) {
  if (funds.length === 0 || dates.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No heatmap data available.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ overflow: 'auto', flex: 1 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `200px repeat(${dates.length}, minmax(80px, 1fr))`,
          gap: '2px',
          minWidth: 200 + dates.length * 82,
        }}
      >
        {/* Header Row */}
        <Box
          sx={{
            position: 'sticky',
            left: 0,
            zIndex: 2,
            bgcolor: '#fafafa',
            p: 1,
            display: 'flex',
            alignItems: 'flex-end',
            fontWeight: 700,
            borderBottom: '2px solid #e0e0e0',
          }}
        >
          <Typography variant="caption" fontWeight={700}>Fund</Typography>
        </Box>
        {dates.map((dt) => (
          <Box
            key={dt}
            sx={{
              p: 1,
              textAlign: 'center',
              bgcolor: '#fafafa',
              borderBottom: '2px solid #e0e0e0',
            }}
          >
            <Typography variant="caption" fontWeight={700}>{formatDateShort(dt)}</Typography>
          </Box>
        ))}

        {/* Data Rows */}
        {funds.map((fund) => (
          <React.Fragment key={fund.fund}>
            {/* Fund Label */}
            <Box
              sx={{
                position: 'sticky',
                left: 0,
                zIndex: 1,
                bgcolor: '#fff',
                p: 1,
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <Tooltip title={fund.fund} arrow placement="right">
                <Typography
                  variant="caption"
                  fontWeight={600}
                  noWrap
                  sx={{ maxWidth: 180 }}
                >
                  {fund.fundName || fund.fund}
                </Typography>
              </Tooltip>
            </Box>

            {/* Date Cells */}
            {dates.map((dt) => {
              const bp = fund[dt] as number | null | undefined;
              const { bg, border } = ragColors(bp);
              const label = ragLabel(bp);

              return (
                <Tooltip
                  key={dt}
                  title={`${fund.fundName} | ${formatDateShort(dt)} | ${bp != null ? `${bp.toFixed(2)} bp (${label})` : 'No data'}`}
                  arrow
                >
                  <Box
                    onClick={() => {
                      if (bp != null && onCellClick) {
                        onCellClick(fund.fund, fund.fundName, dt, bp);
                      }
                    }}
                    sx={{
                      bgcolor: bg,
                      border: `1px solid ${border}`,
                      borderRadius: 0.5,
                      p: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: bp != null && onCellClick ? 'pointer' : 'default',
                      transition: 'transform 0.1s, box-shadow 0.1s',
                      '&:hover': bp != null && onCellClick ? {
                        transform: 'scale(1.05)',
                        boxShadow: `0 0 0 2px ${border}`,
                        zIndex: 1,
                      } : {},
                      minHeight: 36,
                    }}
                  >
                    <Typography
                      variant="caption"
                      fontWeight={600}
                      sx={{
                        fontSize: '0.7rem',
                        color: bp == null ? '#999' : undefined,
                      }}
                    >
                      {bp != null ? `${bp.toFixed(1)}` : '--'}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}
