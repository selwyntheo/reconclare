/**
 * Unsettled Totals Panel Component
 * Shows unsettled transaction amounts by transaction code
 * Per spec Section 7
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
import { UnsettledTotalRow } from '../../types';

interface UnsettledTotalsPanelProps {
  rows: UnsettledTotalRow[];
  grandTotal: number;
  category: string;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const TRANS_CODE_LABELS: Record<string, string> = {
  DIV: 'Dividend',
  RECL: 'Tax Reclaim',
  'RECL-': 'Reclaim Reversal',
  'RECL+': 'Reclaim Adjustment',
  BUY: 'Purchase',
  SELL: 'Sale',
  COVER: 'Short Cover',
  INT: 'Interest',
};

const UnsettledTotalsPanel: React.FC<UnsettledTotalsPanelProps> = ({
  rows,
  grandTotal,
  category,
}) => {
  const theme = useTheme();

  if (rows.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No unsettled transactions for category "{category}"
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Unsettled Totals — {category}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Unsettled transaction amounts by transaction code
        </Typography>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <TableCell sx={{ fontWeight: 600 }}>Account</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Trans Code</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow
                key={`${row.transCode}-${idx}`}
                sx={{
                  bgcolor: row.isSubtotal
                    ? alpha(theme.palette.secondary.main, 0.06)
                    : row.isGrandTotal
                    ? alpha(theme.palette.primary.main, 0.08)
                    : undefined,
                }}
              >
                <TableCell>{row.account}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={row.isSubtotal ? 700 : 400}>
                    {row.category}
                  </Typography>
                </TableCell>
                <TableCell>
                  {!row.isSubtotal && !row.isGrandTotal && (
                    <Chip
                      label={row.transCode}
                      size="small"
                      color="info"
                      sx={{ fontSize: '0.65rem', height: 20, minWidth: 40 }}
                      title={TRANS_CODE_LABELS[row.transCode] || row.transCode}
                    />
                  )}
                  {row.isSubtotal && (
                    <Typography variant="body2" fontWeight={700}>
                      Subtotal
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    fontWeight={row.isSubtotal || row.isGrandTotal ? 700 : 400}
                    fontFamily="monospace"
                    color={row.amount < 0 ? 'error.main' : 'text.primary'}
                  >
                    {formatCurrency(row.amount)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}

            {/* Grand Total Row */}
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12) }}>
              <TableCell colSpan={3}>
                <Typography variant="body2" fontWeight={700}>
                  Total
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

export default UnsettledTotalsPanel;
