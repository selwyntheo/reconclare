import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import DualSystemTable from './DualSystemTable';
import { ValidationStatus } from '../shared/ValidationStatus';
import { fetchNavValidation } from '../../services/api';
import { NavValidationRow } from '../../types';

interface NavValidationViewProps {
  eventId: string;
  valuationDt: string;
}

const NavValidationView: React.FC<NavValidationViewProps> = ({ eventId, valuationDt }) => {
  const [rows, setRows] = useState<NavValidationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded && eventId && valuationDt) {
      setLoading(true);
      fetchNavValidation(eventId, valuationDt)
        .then((data) => { setRows(data); setLoaded(true); })
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }
  }, [eventId, valuationDt, loaded]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>;
  }

  if (rows.length === 0) {
    return <Typography color="text.secondary" sx={{ py: 2 }}>No validation data available.</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 2 }}>
      {rows.map((row) => (
        <Paper key={row.account} variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2">{row.accountName} ({row.account})</Typography>
            <ValidationStatus status={row.overallStatus} />
          </Box>
          <DualSystemTable checks={row.checks} />
        </Paper>
      ))}
    </Box>
  );
};

export default NavValidationView;
