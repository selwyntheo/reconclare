import React from 'react';
import { Select, MenuItem, Chip, SelectChangeEvent } from '@mui/material';
import { ResolutionBreakCategory } from '../../types/breakResolution';

const CATEGORY_CONFIG: Record<ResolutionBreakCategory, { label: string; color: string; bgColor: string }> = {
  KNOWN_DIFFERENCE: { label: 'Known Difference', color: '#1565C0', bgColor: '#E3F2FD' },
  BNY_TO_RESOLVE: { label: 'BNY to Resolve', color: '#E65100', bgColor: '#FFF3E0' },
  INCUMBENT_TO_RESOLVE: { label: 'Incumbent to Resolve', color: '#7B1FA2', bgColor: '#F3E5F5' },
  UNDER_INVESTIGATION: { label: 'Under Investigation', color: '#F9A825', bgColor: '#FFFDE7' },
  MATCH: { label: 'Match', color: '#2E7D32', bgColor: '#E8F5E9' },
};

interface BreakCategorySelectorProps {
  value: ResolutionBreakCategory | '';
  onChange: (category: ResolutionBreakCategory) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

export default function BreakCategorySelector({
  value,
  onChange,
  disabled = false,
  size = 'small',
}: BreakCategorySelectorProps) {
  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value as ResolutionBreakCategory);
  };

  return (
    <Select
      value={value}
      onChange={handleChange}
      disabled={disabled}
      size={size}
      displayEmpty
      sx={{ minWidth: 160 }}
      renderValue={(selected) => {
        if (!selected) return <em style={{ color: '#999' }}>Select category</em>;
        const config = CATEGORY_CONFIG[selected as ResolutionBreakCategory];
        return (
          <Chip
            label={config.label}
            size="small"
            sx={{ bgcolor: config.bgColor, color: config.color, fontWeight: 600 }}
          />
        );
      }}
    >
      {(Object.entries(CATEGORY_CONFIG) as [ResolutionBreakCategory, typeof CATEGORY_CONFIG[ResolutionBreakCategory]][]).map(
        ([key, config]) => (
          <MenuItem key={key} value={key}>
            <Chip
              label={config.label}
              size="small"
              sx={{ bgcolor: config.bgColor, color: config.color, fontWeight: 600 }}
            />
          </MenuItem>
        )
      )}
    </Select>
  );
}
