/**
 * SplitWeightEditor - Edit split percentages for 1:N mappings.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Slider,
  InputAdornment,
  Alert,
  alpha,
  useTheme,
} from '@mui/material';
import { GLAccountMapping } from '../../types/glMapping';

interface SplitWeightEditorProps {
  mappings: GLAccountMapping[];
  onUpdate: (mappingId: string, weight: number) => void;
  onClose: () => void;
}

interface WeightEntry {
  mappingId: string;
  targetAccountNumber: string;
  targetDescription: string;
  weight: number;
}

const SplitWeightEditor: React.FC<SplitWeightEditorProps> = ({
  mappings,
  onUpdate,
  onClose,
}) => {
  const theme = useTheme();

  const [weights, setWeights] = useState<WeightEntry[]>(() =>
    mappings.map((m) => ({
      mappingId: m.mappingId,
      targetAccountNumber: m.targetGlAccountNumber,
      targetDescription: m.targetGlAccountDescription,
      weight: m.splitWeight * 100,
    }))
  );

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  const isValid = Math.abs(totalWeight - 100) < 0.01;

  const handleWeightChange = (mappingId: string, value: number) => {
    setWeights((prev) =>
      prev.map((w) =>
        w.mappingId === mappingId ? { ...w, weight: value } : w
      )
    );
  };

  const handleDistributeEvenly = () => {
    const evenWeight = 100 / weights.length;
    setWeights((prev) =>
      prev.map((w) => ({ ...w, weight: evenWeight }))
    );
  };

  const handleApply = () => {
    if (!isValid) return;

    for (const entry of weights) {
      onUpdate(entry.mappingId, entry.weight / 100);
    }
    onClose();
  };

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
        Edit Split Weights
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        Weights must sum to 100%
      </Typography>

      {weights.map((entry) => (
        <Box
          key={entry.mappingId}
          sx={{
            mb: 2,
            p: 1.5,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.02),
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem' }}
          >
            {entry.targetAccountNumber}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 1 }}
          >
            {entry.targetDescription}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Slider
              value={entry.weight}
              onChange={(_, value) =>
                handleWeightChange(entry.mappingId, value as number)
              }
              min={0}
              max={100}
              step={0.1}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              type="number"
              value={entry.weight.toFixed(1)}
              onChange={(e) =>
                handleWeightChange(
                  entry.mappingId,
                  Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                )
              }
              InputProps={{
                endAdornment: <InputAdornment position="end">%</InputAdornment>,
              }}
              sx={{ width: 100 }}
              inputProps={{ step: 0.1, min: 0, max: 100 }}
            />
          </Box>
        </Box>
      ))}

      {/* Total and validation */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          p: 1,
          borderRadius: 1,
          bgcolor: isValid
            ? alpha(theme.palette.success.main, 0.1)
            : alpha(theme.palette.error.main, 0.1),
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Total:
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: isValid ? 'success.main' : 'error.main',
          }}
        >
          {totalWeight.toFixed(1)}%
        </Typography>
      </Box>

      {!isValid && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Weights must sum to exactly 100%
        </Alert>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleDistributeEvenly}
        >
          Distribute Evenly
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" size="small" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleApply}
          disabled={!isValid}
        >
          Apply
        </Button>
      </Box>
    </Box>
  );
};

export default SplitWeightEditor;
