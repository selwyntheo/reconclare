/**
 * Ledger Detail Panel Component
 * Shows individual GL accounts within the selected category
 * Per spec Section 4.2
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
import { LedgerDetailRow } from '../../types';

interface LedgerDetailPanelProps {
  rows: LedgerDetailRow[];
  total: number;
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

const LedgerDetailPanel: React.FC<LedgerDetailPanelProps> = ({ rows, total, category }) => {
  const theme = useTheme();

  if (rows.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No GL accounts found for category "{category}"
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Ledger Detail — {category}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          GL accounts that roll up into this category
        </Typography>
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
              <TableCell sx={{ fontWeight: 600 }}>Account</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>BS/INCST</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>GL Account</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Ending Balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={`${row.glAccountNumber}-${idx}`} hover>
                <TableCell>{row.account}</TableCell>
                <TableCell>
                  <Chip
                    label={row.bsIncst}
                    size="small"
                    color={row.bsIncst === 'BS' ? 'primary' : 'secondary'}
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={500}>
                    {row.glAccountNumber}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                    {row.glAccountDescription}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace">
                    {formatCurrency(row.endingBalance)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}

            {/* Total Row */}
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
              <TableCell colSpan={4}>
                <Typography variant="body2" fontWeight={700}>
                  Total
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={700} fontFamily="monospace">
                  {formatCurrency(total)}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default LedgerDetailPanel;
