import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Chip,
  Stack,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { suggestMmifRule, AiRuleSuggestResponse } from '../../services/api';

interface AiRuleSuggestDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (result: AiRuleSuggestResponse) => void;
  currentDataSource?: string;
  currentLhsExpr?: string;
  currentRhsExpr?: string;
}

const QUICK_SUGGESTIONS = [
  { label: 'Total assets tie-out', prompt: 'Total assets from Eagle TB must equal MMIF total assets' },
  { label: 'BS equation', prompt: 'Assets minus liabilities minus capital should equal total P&L (income minus expenses plus gains/losses)' },
  { label: 'Net income', prompt: 'Income (4xxx accounts) minus expenses (5xxx accounts) equals net income' },
  { label: 'Cash subtotal', prompt: 'Cash and deposit accounts from Section 3.5 must match between Eagle and MMIF' },
  { label: 'Net gains/losses', prompt: 'Realized gains (61xx) plus unrealized gains (6xxx excluding 61xx) equals net gains and losses' },
];

export default function AiRuleSuggestDialog({
  open,
  onClose,
  onApply,
  currentDataSource,
  currentLhsExpr,
  currentRhsExpr,
}: AiRuleSuggestDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<AiRuleSuggestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setResult(null);
    setError(null);
    try {
      const suggestion = await suggestMmifRule({
        prompt: prompt.trim(),
        dataSource: currentDataSource,
        existingLhsExpr: currentLhsExpr,
        existingRhsExpr: currentRhsExpr,
      });
      setResult(suggestion);
    } catch (e: any) {
      setError(e.message || 'Failed to generate suggestion');
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply(result);
      handleClose();
    }
  };

  const handleClose = () => {
    setPrompt('');
    setResult(null);
    setError(null);
    setGenerating(false);
    onClose();
  };

  const handleQuickSuggestion = (text: string) => {
    setPrompt(text);
    setResult(null);
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { minHeight: 400 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <SmartToyIcon color="secondary" />
        <Box component="span" sx={{ fontWeight: 700 }}>
          AI Rule Assistant
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Prompt input */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Describe the validation rule you want to create:
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Total assets minus liabilities minus capital should equal total P&L"
          disabled={generating}
          sx={{ mb: 2 }}
        />

        {/* Quick suggestions */}
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          Quick suggestions:
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          {QUICK_SUGGESTIONS.map((s) => (
            <Chip
              key={s.label}
              label={s.label}
              size="small"
              variant="outlined"
              color="secondary"
              onClick={() => handleQuickSuggestion(s.prompt)}
              disabled={generating}
              sx={{ cursor: 'pointer', mb: 0.5 }}
            />
          ))}
        </Stack>

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Loading */}
        {generating && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4, justifyContent: 'center' }}>
            <CircularProgress size={24} />
            <Typography color="text.secondary">Generating rule suggestion...</Typography>
          </Box>
        )}

        {/* Result preview */}
        {result && !generating && (
          <>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
              Generated Rule
            </Typography>
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Rule ID</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{result.ruleId}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Severity</Typography>
                  <Typography variant="body2">
                    <Chip label={result.severity} size="small" color={result.severity === 'HARD' ? 'error' : result.severity === 'SOFT' ? 'warning' : 'default'} />
                  </Typography>
                </Box>
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Typography variant="caption" color="text.secondary">Name</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{result.ruleName}</Typography>
                </Box>
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Typography variant="caption" color="text.secondary">Description</Typography>
                  <Typography variant="body2">{result.description}</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* LHS */}
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">LHS: {result.lhs.label}</Typography>
                  {result.lhsValidated ? (
                    <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                  ) : (
                    <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                  )}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    bgcolor: 'background.paper',
                    p: 1,
                    borderRadius: 0.5,
                    border: '1px solid',
                    borderColor: result.lhsValidated ? 'success.light' : 'warning.light',
                    fontSize: '0.8rem',
                    wordBreak: 'break-all',
                  }}
                >
                  {result.lhs.expr}
                </Typography>
              </Box>

              {/* RHS */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">RHS: {result.rhs.label}</Typography>
                  {result.rhsValidated ? (
                    <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
                  ) : (
                    <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                  )}
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    bgcolor: 'background.paper',
                    p: 1,
                    borderRadius: 0.5,
                    border: '1px solid',
                    borderColor: result.rhsValidated ? 'success.light' : 'warning.light',
                    fontSize: '0.8rem',
                    wordBreak: 'break-all',
                  }}
                >
                  {result.rhs.expr}
                </Typography>
              </Box>

              <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
                <Chip label={result.dataSource} size="small" variant="outlined" />
                <Chip label={result.category} size="small" variant="outlined" />
                {result.mmifSection && <Chip label={`Section ${result.mmifSection}`} size="small" variant="outlined" />}
                <Chip label={`Tolerance: ${result.tolerance}`} size="small" variant="outlined" />
              </Box>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={handleClose} disabled={generating}>
          Cancel
        </Button>
        <Button
          variant="outlined"
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          startIcon={generating ? <CircularProgress size={16} /> : <SmartToyIcon />}
        >
          {result ? 'Regenerate' : 'Generate'}
        </Button>
        {result && (
          <Button variant="contained" onClick={handleApply}>
            Apply to Form
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
