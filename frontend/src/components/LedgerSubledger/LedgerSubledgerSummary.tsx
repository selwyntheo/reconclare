/**
 * Ledger to Subledger Summary Grid Component
 * Displays the main validation grid comparing ledger vs subledger values
 * Per spec Section 2.1
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { LedgerSubledgerSummaryRow } from '../../types';

interface LedgerSubledgerSummaryProps {
  rows: LedgerSubledgerSummaryRow[];
  totals: {
    ledger: number;
    subLedger: number;
    variance: number;
  };
  selectedCategory: string | null;
  onCategorySelect: (category: string) => void;
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

const LedgerSubledgerSummary: React.FC<LedgerSubledgerSummaryProps> = ({
  rows,
  totals,
  selectedCategory,
  onCategorySelect,
}) => {
  const theme = useTheme();

  return (
    <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h6" fontWeight={600}>
          Ledger to Subledger Summary
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Click on a category row to view drill-down details
        </Typography>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <TableCell sx={{ fontWeight: 600 }}>Account</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Supported</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Ledger</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Sub-Ledger</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Variance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => {
              const hasVariance = row.subledgerSupported && row.variance !== 0;
              const isSelected = selectedCategory === row.category;

              return (
                <TableRow
                  key={`${row.account}-${row.category}-${idx}`}
                  hover
                  selected={isSelected}
                  onClick={() => row.subledgerSupported && onCategorySelect(row.category)}
                  sx={{
                    cursor: row.subledgerSupported ? 'pointer' : 'default',
                    bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : undefined,
                    '&:hover': {
                      bgcolor: row.subledgerSupported
                        ? alpha(theme.palette.primary.main, 0.04)
                        : undefined,
                    },
                  }}
                >
                  <TableCell>{row.account}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      fontWeight={hasVariance ? 700 : 400}
                      color={hasVariance ? 'error.main' : 'text.primary'}
                    >
                      {row.category}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={row.subledgerSupported ? 'Y' : 'N'}
                      size="small"
                      color={row.subledgerSupported ? 'success' : 'default'}
                      sx={{ minWidth: 32, height: 22, fontSize: '0.7rem' }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontFamily="monospace">
                      {formatCurrency(row.ledger)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                      {formatCurrency(row.subLedger)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      {hasVariance ? (
                        <WarningAmberIcon fontSize="small" color="error" />
                      ) : row.subledgerSupported ? (
                        <CheckCircleIcon fontSize="small" color="success" />
                      ) : null}
                      <Typography
                        variant="body2"
                        fontWeight={hasVariance ? 700 : 400}
                        fontFamily="monospace"
                        color={hasVariance ? 'error.main' : 'text.secondary'}
                      >
                        {formatCurrency(row.variance)}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Totals Row */}
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
              <TableCell colSpan={3}>
                <Typography variant="body2" fontWeight={700}>
                  Total
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                  {formatCurrency(totals.ledger)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                  {formatCurrency(totals.subLedger)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography
                  variant="body2"
                  fontWeight={700}
                  fontFamily="monospace"
                  color={totals.variance !== 0 ? 'error.main' : 'success.main'}
                >
                  {formatCurrency(totals.variance)}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default LedgerSubledgerSummary;
