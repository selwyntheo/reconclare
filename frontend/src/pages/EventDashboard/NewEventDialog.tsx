import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Stack,
  Box,
  IconButton,
  Chip,
  Stepper,
  Step,
  StepLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Alert,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import DescriptionIcon from '@mui/icons-material/Description';
import { createConversionEvent, createMmifEvent } from '../../services/api';

interface NewEventDialogProps {
  open: boolean;
  onClose: (created?: boolean) => void;
}

interface ConversionFundRow {
  account: string;
  fundName: string;
  fundType: string;
  shareClasses: string;
}

interface MmifFundRow {
  account: string;
  fundName: string;
  fundType: string;
  fundDomicile: string;
  cbiCode: string;
  shareClasses: string;
}

const STEPS = ['Event Type', 'Event Details', 'Fund List'];

const CONVERSION_FUND_TYPES = ['EQUITY', 'FIXED_INCOME', 'MULTI_ASSET', 'MONEY_MARKET'];
const MMIF_FUND_TYPES = ['UCITS', 'AIF', 'MMF', 'HEDGE'];

const EMPTY_CONVERSION_FUND: ConversionFundRow = {
  account: '',
  fundName: '',
  fundType: 'EQUITY',
  shareClasses: '',
};

const EMPTY_MMIF_FUND: MmifFundRow = {
  account: '',
  fundName: '',
  fundType: 'UCITS',
  fundDomicile: 'IE',
  cbiCode: '',
  shareClasses: '',
};

export default function NewEventDialog({ open, onClose }: NewEventDialogProps) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Event Type
  const [eventType, setEventType] = useState<'CONVERSION' | 'REGULATORY_FILING'>('CONVERSION');

  // Step 2 — Conversion fields
  const [eventName, setEventName] = useState('');
  const [incumbentProvider, setIncumbentProvider] = useState('');
  const [targetGoLiveDate, setTargetGoLiveDate] = useState('');
  const [parallelStartDate, setParallelStartDate] = useState('');

  // Step 2 — MMIF fields
  const [regulatoryBody, setRegulatoryBody] = useState('CBI');
  const [filingPeriod, setFilingPeriod] = useState('');
  const [filingDeadline, setFilingDeadline] = useState('');
  const [filingFrequency, setFilingFrequency] = useState('QUARTERLY');

  // Step 3 — Fund lists
  const [conversionFunds, setConversionFunds] = useState<ConversionFundRow[]>([{ ...EMPTY_CONVERSION_FUND }]);
  const [mmifFunds, setMmifFunds] = useState<MmifFundRow[]>([{ ...EMPTY_MMIF_FUND }]);

  const resetForm = () => {
    setActiveStep(0);
    setEventType('CONVERSION');
    setEventName('');
    setIncumbentProvider('');
    setTargetGoLiveDate('');
    setParallelStartDate('');
    setRegulatoryBody('CBI');
    setFilingPeriod('');
    setFilingDeadline('');
    setFilingFrequency('QUARTERLY');
    setConversionFunds([{ ...EMPTY_CONVERSION_FUND }]);
    setMmifFunds([{ ...EMPTY_MMIF_FUND }]);
    setError('');
    setSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose(false);
  };

  const canProceed = (): boolean => {
    if (activeStep === 0) return true;
    if (activeStep === 1) {
      if (eventType === 'CONVERSION') {
        return !!(eventName && incumbentProvider && targetGoLiveDate);
      }
      return !!(eventName && filingPeriod && filingDeadline);
    }
    if (activeStep === 2) {
      const funds = eventType === 'CONVERSION' ? conversionFunds : mmifFunds;
      return funds.length > 0 && funds.every((f) => f.account && f.fundName);
    }
    return false;
  };

  const handleNext = () => setActiveStep((s) => Math.min(s + 1, 2));
  const handleBack = () => setActiveStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const year = new Date().getFullYear();
      const seq = String(Math.floor(Math.random() * 900) + 100);

      if (eventType === 'CONVERSION') {
        const eventId = `EVT-${year}-${seq}`;
        const payload = {
          eventId,
          eventType: 'CONVERSION',
          eventName,
          incumbentProvider,
          status: 'DRAFT',
          targetGoLiveDate,
          parallelStartDate: parallelStartDate || undefined,
          assignedTeam: [],
          funds: conversionFunds.map((f) => ({
            account: f.account,
            fundName: f.fundName,
            fundType: f.fundType,
            shareClasses: f.shareClasses ? f.shareClasses.split(',').map((s) => s.trim()) : [],
            status: 'PENDING',
            breakCount: 0,
          })),
        };
        await createConversionEvent(payload);
        resetForm();
        onClose(true);
        navigate(`/events/${eventId}/funds/${payload.funds[0].account}`);
      } else {
        const eventId = `MMIF-${year}-${filingPeriod}-${seq}`;
        const payload = {
          eventId,
          eventType: 'REGULATORY_FILING',
          eventName,
          regulatoryBody,
          filingPeriod,
          filingDeadline,
          filingFrequency,
          status: 'DRAFT',
          assignedTeam: [],
          funds: mmifFunds.map((f) => ({
            account: f.account,
            fundName: f.fundName,
            fundType: f.fundType,
            fundDomicile: f.fundDomicile || 'IE',
            cbiCode: f.cbiCode || undefined,
            shareClasses: f.shareClasses ? f.shareClasses.split(',').map((s) => s.trim()) : [],
            status: 'PENDING',
            breakCount: 0,
          })),
        };
        await createMmifEvent(payload);
        resetForm();
        onClose(true);
        navigate(`/mmif/${eventId}`);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Fund row helpers ──────────────────────────────────

  const updateConversionFund = (index: number, field: keyof ConversionFundRow, value: string) => {
    setConversionFunds((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  };

  const updateMmifFund = (index: number, field: keyof MmifFundRow, value: string) => {
    setMmifFunds((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  };

  // ── Render Steps ──────────────────────────────────────

  const renderStep0 = () => (
    <Box sx={{ py: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 2 }}>
        Select the type of event to create:
      </Typography>
      <RadioGroup value={eventType} onChange={(e) => setEventType(e.target.value as any)}>
        <FormControlLabel
          value="CONVERSION"
          control={<Radio />}
          label={
            <Stack direction="row" spacing={1} alignItems="center">
              <SwapHorizIcon fontSize="small" color="primary" />
              <Box>
                <Typography variant="body2" fontWeight={600}>Conversion</Typography>
                <Typography variant="caption" color="text.secondary">
                  Custodian migration — Incumbent to Eagle fund accounting
                </Typography>
              </Box>
            </Stack>
          }
          sx={{ mb: 1, p: 1.5, border: `1px solid ${eventType === 'CONVERSION' ? theme.palette.primary.main : theme.palette.divider}`, borderRadius: 1, bgcolor: eventType === 'CONVERSION' ? alpha(theme.palette.primary.main, 0.04) : 'transparent' }}
        />
        <FormControlLabel
          value="REGULATORY_FILING"
          control={<Radio />}
          label={
            <Stack direction="row" spacing={1} alignItems="center">
              <DescriptionIcon fontSize="small" color="secondary" />
              <Box>
                <Typography variant="body2" fontWeight={600}>Regulatory Filing</Typography>
                <Typography variant="caption" color="text.secondary">
                  MMIF CBI regulatory filing — monetary fund reporting
                </Typography>
              </Box>
            </Stack>
          }
          sx={{ p: 1.5, border: `1px solid ${eventType === 'REGULATORY_FILING' ? theme.palette.secondary.main : theme.palette.divider}`, borderRadius: 1, bgcolor: eventType === 'REGULATORY_FILING' ? alpha(theme.palette.secondary.main, 0.04) : 'transparent' }}
        />
      </RadioGroup>
    </Box>
  );

  const renderStep1 = () => (
    <Stack spacing={2.5} sx={{ py: 2 }}>
      <TextField
        label="Event Name"
        value={eventName}
        onChange={(e) => setEventName(e.target.value)}
        required
        fullWidth
        placeholder={eventType === 'CONVERSION' ? 'e.g., Vanguard Fixed Income Migration' : 'e.g., Q2 2026 CBI Filing — Irish UCITS Range'}
      />

      {eventType === 'CONVERSION' ? (
        <>
          <TextField
            label="Incumbent Provider"
            value={incumbentProvider}
            onChange={(e) => setIncumbentProvider(e.target.value)}
            required
            fullWidth
            placeholder="e.g., State Street, Northern Trust"
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Target Go-Live Date"
              type="date"
              value={targetGoLiveDate}
              onChange={(e) => setTargetGoLiveDate(e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Parallel Start Date (Optional)"
              type="date"
              value={parallelStartDate}
              onChange={(e) => setParallelStartDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </>
      ) : (
        <>
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Regulatory Body</InputLabel>
              <Select value={regulatoryBody} label="Regulatory Body" onChange={(e) => setRegulatoryBody(e.target.value)}>
                <MenuItem value="CBI">CBI (Central Bank of Ireland)</MenuItem>
                <MenuItem value="ECB">ECB (European Central Bank)</MenuItem>
                <MenuItem value="FCA">FCA (Financial Conduct Authority)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Filing Frequency</InputLabel>
              <Select value={filingFrequency} label="Filing Frequency" onChange={(e) => setFilingFrequency(e.target.value)}>
                <MenuItem value="QUARTERLY">Quarterly</MenuItem>
                <MenuItem value="MONTHLY">Monthly</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Filing Period"
              value={filingPeriod}
              onChange={(e) => setFilingPeriod(e.target.value)}
              required
              fullWidth
              placeholder="e.g., 2026Q2 or 2026M06"
            />
            <TextField
              label="Filing Deadline"
              type="date"
              value={filingDeadline}
              onChange={(e) => setFilingDeadline(e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </>
      )}
    </Stack>
  );

  const renderStep2 = () => {
    if (eventType === 'CONVERSION') {
      return (
        <Box sx={{ py: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Funds ({conversionFunds.length})</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => setConversionFunds((prev) => [...prev, { ...EMPTY_CONVERSION_FUND }])}>
              Add Fund
            </Button>
          </Stack>
          <TableContainer sx={{ maxHeight: 300 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Account</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Fund Name</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', width: 140 }}>Fund Type</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Share Classes</TableCell>
                  <TableCell sx={{ width: 40 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {conversionFunds.map((fund, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <TextField size="small" value={fund.account} onChange={(e) => updateConversionFund(i, 'account', e.target.value)} placeholder="ACC-001" variant="standard" fullWidth />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" value={fund.fundName} onChange={(e) => updateConversionFund(i, 'fundName', e.target.value)} placeholder="Fund Name" variant="standard" fullWidth />
                    </TableCell>
                    <TableCell>
                      <Select size="small" value={fund.fundType} onChange={(e) => updateConversionFund(i, 'fundType', e.target.value)} variant="standard" fullWidth>
                        {CONVERSION_FUND_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField size="small" value={fund.shareClasses} onChange={(e) => updateConversionFund(i, 'shareClasses', e.target.value)} placeholder="A, I, R" variant="standard" fullWidth />
                    </TableCell>
                    <TableCell>
                      {conversionFunds.length > 1 && (
                        <IconButton size="small" onClick={() => setConversionFunds((prev) => prev.filter((_, j) => j !== i))}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );
    }

    // MMIF funds
    return (
      <Box sx={{ py: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle2">Funds ({mmifFunds.length})</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setMmifFunds((prev) => [...prev, { ...EMPTY_MMIF_FUND }])}>
            Add Fund
          </Button>
        </Stack>
        <TableContainer sx={{ maxHeight: 300 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Account</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Fund Name</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', width: 110 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', width: 70 }}>Domicile</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>CBI Code</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Share Classes</TableCell>
                <TableCell sx={{ width: 40 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mmifFunds.map((fund, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <TextField size="small" value={fund.account} onChange={(e) => updateMmifFund(i, 'account', e.target.value)} placeholder="IE-UCITS-001" variant="standard" fullWidth />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={fund.fundName} onChange={(e) => updateMmifFund(i, 'fundName', e.target.value)} placeholder="Fund Name" variant="standard" fullWidth />
                  </TableCell>
                  <TableCell>
                    <Select size="small" value={fund.fundType} onChange={(e) => updateMmifFund(i, 'fundType', e.target.value)} variant="standard" fullWidth>
                      {MMIF_FUND_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={fund.fundDomicile} onChange={(e) => updateMmifFund(i, 'fundDomicile', e.target.value)} placeholder="IE" variant="standard" sx={{ width: 50 }} />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={fund.cbiCode} onChange={(e) => updateMmifFund(i, 'cbiCode', e.target.value)} placeholder="C12345" variant="standard" fullWidth />
                  </TableCell>
                  <TableCell>
                    <TextField size="small" value={fund.shareClasses} onChange={(e) => updateMmifFund(i, 'shareClasses', e.target.value)} placeholder="A-EUR, I-EUR" variant="standard" fullWidth />
                  </TableCell>
                  <TableCell>
                    {mmifFunds.length > 1 && (
                      <IconButton size="small" onClick={() => setMmifFunds((prev) => prev.filter((_, j) => j !== i))}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h6" fontWeight={700}>Create New Event</Typography>
          {eventType === 'CONVERSION' && activeStep > 0 && <Chip label="Conversion" size="small" color="primary" variant="outlined" />}
          {eventType === 'REGULATORY_FILING' && activeStep > 0 && <Chip label="Regulatory Filing" size="small" color="secondary" variant="outlined" />}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && renderStep0()}
        {activeStep === 1 && renderStep1()}
        {activeStep === 2 && renderStep2()}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={submitting}>
            Back
          </Button>
        )}
        {activeStep < 2 ? (
          <Button variant="contained" onClick={handleNext} disabled={!canProceed()}>
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!canProceed() || submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : undefined}
          >
            {submitting ? 'Creating...' : 'Create Event'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
