import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import {
  Box, Typography, Button, Stack, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert,
} from '@mui/material';
import { ColDef, CellValueChangedEvent } from 'ag-grid-community';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useAuth } from '../../context/AuthContext';
import { canManageRoster } from '../../config/permissions';
import ReviewStatusBadge from '../../components/shared/ReviewStatusBadge';
import { ReviewStatus } from '../../types/breakResolution';
import {
  fetchAllocations, updateAllocations, copyAllocations, fetchReviewers,
  fetchAvailableDates,
} from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';

interface AllocationRow {
  account: string;
  fundName: string;
  reviewStatus: ReviewStatus;
  [date: string]: string | ReviewStatus; // dynamic date columns hold reviewer names
}

export default function ReviewerAllocation() {
  const { eventId } = useParams<{ eventId: string }>();
  const { role, userName } = useAuth();
  const isEditable = canManageRoster(role);

  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [reviewers, setReviewers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Copy dialog
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyTo, setCopyTo] = useState('');

  // Real-time updates
  useWebSocket({
    eventId: eventId || '',
    enabled: !!eventId,
    onMessage: (msg) => {
      if (msg.type === 'ALLOCATION_CHANGED') loadData();
    },
  });

  const loadData = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const [allocData, reviewerData, availDates] = await Promise.all([
        fetchAllocations(eventId),
        fetchReviewers(),
        fetchAvailableDates(eventId),
      ]);
      setDates(availDates);
      setReviewers(reviewerData.map((r: any) => r.name || r));

      // Build matrix: rows = funds, columns = dates
      const fundMap = new Map<string, AllocationRow>();
      for (const alloc of allocData) {
        const key = alloc.bnyAccount || alloc.fundAccount;
        if (!fundMap.has(key)) {
          fundMap.set(key, {
            account: key,
            fundName: alloc.fundName || key,
            reviewStatus: alloc.reviewStatus || 'NOT_STARTED',
          });
        }
        const row = fundMap.get(key)!;
        if (alloc.valuationDate) {
          row[alloc.valuationDate] = alloc.reviewer || '';
        }
      }
      setRows(Array.from(fundMap.values()));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadData(); }, [loadData]);

  const columnDefs = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [
      { field: 'fundName', headerName: 'Fund', pinned: 'left', width: 200 },
      {
        field: 'reviewStatus',
        headerName: 'Status',
        pinned: 'left',
        width: 130,
        cellRenderer: (params: any) => {
          const status = params.value as ReviewStatus;
          return <ReviewStatusBadge status={status || 'NOT_STARTED'} />;
        },
      },
    ];

    for (const date of dates) {
      cols.push({
        field: date,
        headerName: date,
        width: 150,
        editable: isEditable,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['', ...reviewers] },
      });
    }

    return cols;
  }, [dates, reviewers, isEditable]);

  const handleCellChange = useCallback(async (event: CellValueChangedEvent) => {
    if (!eventId) return;
    const { data, colDef } = event;
    const date = colDef.field!;
    try {
      await updateAllocations(eventId, {
        allocations: [{
          bnyAccount: data.account,
          fundName: data.fundName,
          valuationDate: date,
          reviewer: data[date],
        }],
        changedBy: userName,
      });
    } catch (e: any) {
      setError(e.message);
      loadData(); // revert on error
    }
  }, [eventId, userName, loadData]);

  const handleCopy = async () => {
    if (!eventId || !copyFrom || !copyTo) return;
    try {
      await copyAllocations(eventId, { fromDate: copyFrom, toDate: copyTo, changedBy: userName });
      setCopyOpen(false);
      loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Reviewer Allocation</Typography>
        {isEditable && (
          <Button
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={() => setCopyOpen(true)}
          >
            Copy Allocations
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}

      <Box className="ag-theme-alpine" sx={{ flex: 1, minHeight: 400 }}>
        <AgGridReact
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: true }}
          onCellValueChanged={handleCellChange}
          animateRows
          loading={loading}
        />
      </Box>

      {/* Copy Allocations Dialog */}
      <Dialog open={copyOpen} onClose={() => setCopyOpen(false)}>
        <DialogTitle>Copy Allocations Between Dates</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="From Date"
              value={copyFrom}
              onChange={(e) => setCopyFrom(e.target.value)}
              SelectProps={{ native: true }}
              fullWidth
            >
              <option value="">Select...</option>
              {dates.map((d) => <option key={d} value={d}>{d}</option>)}
            </TextField>
            <TextField
              select
              label="To Date"
              value={copyTo}
              onChange={(e) => setCopyTo(e.target.value)}
              SelectProps={{ native: true }}
              fullWidth
            >
              <option value="">Select...</option>
              {dates.map((d) => <option key={d} value={d}>{d}</option>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCopy} disabled={!copyFrom || !copyTo}>Copy</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
