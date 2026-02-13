import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import DualSystemTable from './DualSystemTable';
import { ValidationStatus } from '../shared/ValidationStatus';
import { fetchPositionValidation } from '../../services/api';
import { PositionValidationRow } from '../../types';

interface PositionValidationViewProps {
  account: string;
  valuationDt: string;
  category?: string;
}

const PositionValidationView: React.FC<PositionValidationViewProps> = ({ account, valuationDt, category }) => {
  const [rows, setRows] = useState<PositionValidationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded && account && valuationDt) {
      setLoading(true);
      fetchPositionValidation(account, valuationDt, category)
        .then((data) => { setRows(data); setLoaded(true); })
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }
  }, [account, valuationDt, category, loaded]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
  }

  if (rows.length === 0) {
    return <Typography color="text.secondary" sx={{ py: 2 }}>No validation data available.</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 2 }}>
      {rows.map((row) => (
        <Paper key={row.assetId} variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2">{row.issueDescription || row.assetId} ({row.assetId})</Typography>
            <ValidationStatus status={row.overallStatus} />
          </Box>
          <DualSystemTable checks={row.checks} />
        </Paper>
      ))}
    </Box>
  );
};

export default PositionValidationView;
