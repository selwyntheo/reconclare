import React, { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { exportToExcel } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface ExportButtonProps {
  viewType: string;
  eventId: string;
  filters?: Record<string, unknown>;
  disabled?: boolean;
}

export default function ExportButton({ viewType, eventId, filters, disabled = false }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const { permissions } = useAuth();

  if (permissions.exportScope === 'none') return null;

  const handleExport = async () => {
    try {
      setLoading(true);
      const blob = await exportToExcel({ viewType, eventId, filters });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${viewType}_${eventId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={loading ? <CircularProgress size={16} /> : <FileDownloadIcon />}
      onClick={handleExport}
      disabled={disabled || loading}
    >
      Export Excel
    </Button>
  );
}
