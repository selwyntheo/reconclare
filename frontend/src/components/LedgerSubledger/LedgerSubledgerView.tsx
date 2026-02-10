/**
 * Ledger to Subledger View Component
 * Main component combining summary grid and drill-down panels
 * Per spec Sections 2-7
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Chip,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LedgerSubledgerSummary from './LedgerSubledgerSummary';
import LedgerSubledgerDrillDown from './LedgerSubledgerDrillDown';
import { fetchLedgerSubledgerSummary } from '../../services/api';
import { LedgerSubledgerSummaryRow } from '../../types';

interface LedgerSubledgerViewProps {
  fundAccount: string;
  valuationDt?: string;
}

const LedgerSubledgerView: React.FC<LedgerSubledgerViewProps> = ({
  fundAccount,
  valuationDt,
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LedgerSubledgerSummaryRow[]>([]);
  const [totals, setTotals] = useState({ ledger: 0, subLedger: 0, variance: 0 });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchLedgerSubledgerSummary(fundAccount, valuationDt);
      setRows(data.rows);
      setTotals(data.totals);
    } catch (err) {
      console.error('Failed to load ledger-subledger data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fundAccount, valuationDt]);

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(selectedCategory === category ? null : category);
  };

  const handleRefresh = () => {
    loadData();
  };

  // Count breaks (non-zero variances in supported categories)
  const breakCount = rows.filter(
    (r) => r.subledgerSupported && r.variance !== 0
  ).length;
  const passedCount = rows.filter(
    (r) => r.subledgerSupported && r.variance === 0
  ).length;

  if (loading) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Loading Ledger to Subledger data...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Ledger to Subledger Validation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Account: {fundAccount} | Valuation: {valuationDt || '2026-02-07'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {breakCount > 0 ? (
            <Chip
              icon={<WarningAmberIcon />}
              label={`${breakCount} variance${breakCount > 1 ? 's' : ''}`}
              color="error"
              size="small"
            />
          ) : (
            <Chip
              icon={<CheckCircleIcon />}
              label="All categories match"
              color="success"
              size="small"
            />
          )}
          <Chip
            label={`${passedCount} passed`}
            color="success"
            variant="outlined"
            size="small"
          />
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            variant="outlined"
          >
            Refresh
          </Button>
          <Button
            size="small"
            startIcon={<FileDownloadIcon />}
            variant="outlined"
          >
            Export
          </Button>
        </Stack>
      </Stack>

      {/* Summary Grid */}
      <Box sx={{ mb: 3 }}>
        <LedgerSubledgerSummary
          rows={rows}
          totals={totals}
          selectedCategory={selectedCategory}
          onCategorySelect={handleCategorySelect}
        />
      </Box>

      {/* Drill-Down Panel */}
      {selectedCategory && (
        <Box
          sx={{
            animation: 'fadeIn 0.3s ease-in',
            '@keyframes fadeIn': {
              from: { opacity: 0, transform: 'translateY(-10px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          <LedgerSubledgerDrillDown
            fundAccount={fundAccount}
            category={selectedCategory}
            valuationDt={valuationDt}
          />
        </Box>
      )}

      {/* Help text when no selection */}
      {!selectedCategory && (
        <Card
          sx={{
            bgcolor: alpha(theme.palette.info.main, 0.04),
            border: `1px dashed ${alpha(theme.palette.info.main, 0.3)}`,
          }}
        >
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              Click on a category row above to view drill-down details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Drill-down shows: Ledger Detail (GL accounts), Position Totals (by
              security type), and Unsettled Totals (by transaction code)
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default LedgerSubledgerView;
