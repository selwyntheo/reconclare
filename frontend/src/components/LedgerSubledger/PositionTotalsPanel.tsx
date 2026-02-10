/**
 * Position Totals Panel Component
 * Shows position-level data aggregated by security type
 * Per spec Section 5
 */
import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import { PositionTotalRow } from '../../types';

interface PositionTotalsPanelProps {
  rows: PositionTotalRow[];
  grandTotal: number;
  category: string;
}

const formatCurrency = (value: number | null): string => {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const SEC_TYPE_LABELS: Record<string, string> = {
  CA: 'Corporate Actions',
  CU: 'Cash/Currency',
  FT: 'Futures',
  MF: 'Mutual Funds',
  RP: 'Repo',
  S: 'Stocks',
  TI: 'Treasury/Fixed Income',
};

const PositionTotalsPanel: React.FC<PositionTotalsPanelProps> = ({
  rows,
  grandTotal,
  category,
}) => {
  const theme = useTheme();

  if (rows.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No position data for category "{category}"
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Position Totals — {category}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Position-level data grouped by security type
        </Typography>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <TableCell sx={{ fontWeight: 600 }}>Sec Type</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Issue Description</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Book Value</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Unrealized</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Net Income</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Daily Var Margin</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow
                key={`${row.secType}-${row.issueDescription}-${idx}`}
                sx={{
                  bgcolor: row.isSubtotal
                    ? alpha(theme.palette.secondary.main, 0.06)
                    : row.isGrandTotal
                    ? alpha(theme.palette.primary.main, 0.08)
                    : undefined,
                }}
              >
                <TableCell>
                  {!row.isSubtotal && !row.isGrandTotal && (
                    <Chip
                      label={row.secType}
                      size="small"
                      color="default"
                      sx={{ fontSize: '0.65rem', height: 20, minWidth: 28 }}
                      title={SEC_TYPE_LABELS[row.secType] || row.secType}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    fontWeight={row.isSubtotal || row.isGrandTotal ? 700 : 400}
                    noWrap
                    sx={{ maxWidth: 200 }}
                  >
                    {row.issueDescription || (row.isSubtotal ? `${row.secType} Total` : '—')}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                    {formatCurrency(row.bookValue)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                    {formatCurrency(row.unrealized)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                    {formatCurrency(row.netIncome)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                    {formatCurrency(row.dailyVarMargin)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    fontWeight={row.isSubtotal || row.isGrandTotal ? 700 : 500}
                    fontFamily="monospace"
                  >
                    {formatCurrency(row.total)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}

            {/* Grand Total Row */}
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12) }}>
              <TableCell colSpan={6}>
                <Typography variant="body2" fontWeight={700}>
                  Grand Total
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                  {formatCurrency(grandTotal)}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default PositionTotalsPanel;
