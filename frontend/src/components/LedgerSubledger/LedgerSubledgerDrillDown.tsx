/**
 * Ledger to Subledger Drill-Down Container
 * Contains tabs for Ledger Detail, Position Totals, and Unsettled Totals
 * Per spec Section 4.1
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import InventoryIcon from '@mui/icons-material/Inventory';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import LedgerDetailPanel from './LedgerDetailPanel';
import PositionTotalsPanel from './PositionTotalsPanel';
import UnsettledTotalsPanel from './UnsettledTotalsPanel';
import {
  fetchLedgerDetail,
  fetchPositionTotals,
  fetchUnsettledTotals,
} from '../../services/api';
import {
  LedgerDetailRow,
  PositionTotalRow,
  UnsettledTotalRow,
} from '../../types';

interface LedgerSubledgerDrillDownProps {
  fundAccount: string;
  category: string;
  valuationDt?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
  </div>
);

const LedgerSubledgerDrillDown: React.FC<LedgerSubledgerDrillDownProps> = ({
  fundAccount,
  category,
  valuationDt,
}) => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);

  // Ledger Detail state
  const [ledgerRows, setLedgerRows] = useState<LedgerDetailRow[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);

  // Position Totals state
  const [positionRows, setPositionRows] = useState<PositionTotalRow[]>([]);
  const [positionGrandTotal, setPositionGrandTotal] = useState(0);

  // Unsettled Totals state
  const [unsettledRows, setUnsettledRows] = useState<UnsettledTotalRow[]>([]);
  const [unsettledGrandTotal, setUnsettledGrandTotal] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [ledgerData, positionData, unsettledData] = await Promise.all([
          fetchLedgerDetail(fundAccount, category, valuationDt),
          fetchPositionTotals(fundAccount, category, valuationDt),
          fetchUnsettledTotals(fundAccount, category, valuationDt),
        ]);

        setLedgerRows(ledgerData.rows);
        setLedgerTotal(ledgerData.total);
        setPositionRows(positionData.rows);
        setPositionGrandTotal(positionData.grandTotal);
        setUnsettledRows(unsettledData.rows);
        setUnsettledGrandTotal(unsettledData.grandTotal);
      } catch (err) {
        console.error('Failed to load drill-down data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fundAccount, category, valuationDt]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Loading drill-down data...
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box
        sx={{
          px: 2,
          pt: 2,
          pb: 0,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: alpha(theme.palette.info.main, 0.04),
        }}
      >
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
          Drill-Down: {category}
        </Typography>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{
            '& .MuiTab-root': {
              minHeight: 40,
              textTransform: 'none',
              fontWeight: 500,
            },
          }}
        >
          <Tab
            icon={<AccountBalanceIcon fontSize="small" />}
            iconPosition="start"
            label={`Ledger Detail (${ledgerRows.length})`}
          />
          <Tab
            icon={<InventoryIcon fontSize="small" />}
            iconPosition="start"
            label={`Position Totals (${positionRows.filter(r => !r.isSubtotal).length})`}
          />
          <Tab
            icon={<PendingActionsIcon fontSize="small" />}
            iconPosition="start"
            label={`Unsettled (${unsettledRows.filter(r => !r.isSubtotal).length})`}
          />
        </Tabs>
      </Box>

      <Box sx={{ p: 2 }}>
        <TabPanel value={tabValue} index={0}>
          <LedgerDetailPanel rows={ledgerRows} total={ledgerTotal} category={category} />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <PositionTotalsPanel
            rows={positionRows}
            grandTotal={positionGrandTotal}
            category={category}
          />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <UnsettledTotalsPanel
            rows={unsettledRows}
            grandTotal={unsettledGrandTotal}
            category={category}
          />
        </TabPanel>
      </Box>
    </Paper>
  );
};

export default LedgerSubledgerDrillDown;
