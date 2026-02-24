import React from 'react';
import {
  Box, TextField, Button, Stack, Select, MenuItem, IconButton,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { ResolutionBreakCategory } from '../../types/breakResolution';

interface CommentaryEntryInput {
  breakCategory: ResolutionBreakCategory | '';
  amount: string;
  text: string;
  kdReference: string;
}

interface CommentaryEditorProps {
  entries: CommentaryEntryInput[];
  onChange: (entries: CommentaryEntryInput[]) => void;
  kdOptions?: { reference: string; description: string }[];
  disabled?: boolean;
}

const CATEGORY_OPTIONS: { value: ResolutionBreakCategory; label: string }[] = [
  { value: 'KNOWN_DIFFERENCE', label: 'Known Difference' },
  { value: 'BNY_TO_RESOLVE', label: 'BNY to Resolve' },
  { value: 'INCUMBENT_TO_RESOLVE', label: 'Incumbent to Resolve' },
  { value: 'UNDER_INVESTIGATION', label: 'Under Investigation' },
  { value: 'MATCH', label: 'Match' },
];

export default function CommentaryEditor({ entries, onChange, kdOptions = [], disabled = false }: CommentaryEditorProps) {
  const addEntry = () => {
    onChange([...entries, { breakCategory: '', amount: '', text: '', kdReference: '' }]);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof CommentaryEntryInput, value: string) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <Box>
      <Stack spacing={1.5}>
        {entries.map((entry, idx) => (
          <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <Select
              value={entry.breakCategory}
              onChange={(e) => updateEntry(idx, 'breakCategory', e.target.value)}
              size="small"
              displayEmpty
              disabled={disabled}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="" disabled><em>Category</em></MenuItem>
              {CATEGORY_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>

            <TextField
              value={entry.amount}
              onChange={(e) => updateEntry(idx, 'amount', e.target.value)}
              size="small"
              placeholder="Amount"
              disabled={disabled}
              sx={{ width: 120 }}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
            />

            {kdOptions.length > 0 && (
              <Select
                value={entry.kdReference}
                onChange={(e) => updateEntry(idx, 'kdReference', e.target.value)}
                size="small"
                displayEmpty
                disabled={disabled}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value=""><em>KD Ref</em></MenuItem>
                {kdOptions.map((kd) => (
                  <MenuItem key={kd.reference} value={kd.reference}>{kd.reference}</MenuItem>
                ))}
              </Select>
            )}

            <TextField
              value={entry.text}
              onChange={(e) => updateEntry(idx, 'text', e.target.value)}
              size="small"
              placeholder="Commentary text..."
              disabled={disabled}
              multiline
              maxRows={3}
              sx={{ flex: 1 }}
            />

            <IconButton size="small" onClick={() => removeEntry(idx)} disabled={disabled}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
      </Stack>

      <Button
        startIcon={<AddIcon />}
        size="small"
        onClick={addEntry}
        disabled={disabled}
        sx={{ mt: 1 }}
      >
        Add Comment
      </Button>
    </Box>
  );
}
