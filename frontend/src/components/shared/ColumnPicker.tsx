import React, { useState } from 'react';
import {
  Button,
  Popover,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Stack,
  Divider,
} from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';

export interface ColumnOption {
  id: string;
  label: string;
  group?: string;
}

interface ColumnPickerProps {
  availableColumns: ColumnOption[];
  visibleColumns: string[];
  onChange: (ids: string[]) => void;
}

const ColumnPicker: React.FC<ColumnPickerProps> = ({
  availableColumns,
  visibleColumns,
  onChange,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const open = Boolean(anchorEl);

  // Group columns
  const groups = new Map<string, ColumnOption[]>();
  for (const col of availableColumns) {
    const g = col.group || '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(col);
  }

  const handleToggle = (id: string) => {
    if (visibleColumns.includes(id)) {
      onChange(visibleColumns.filter((c) => c !== id));
    } else {
      onChange([...visibleColumns, id]);
    }
  };

  const handleGroupToggle = (groupCols: ColumnOption[]) => {
    const groupIds = groupCols.map((c) => c.id);
    const allVisible = groupIds.every((id) => visibleColumns.includes(id));
    if (allVisible) {
      onChange(visibleColumns.filter((id) => !groupIds.includes(id)));
    } else {
      const newIds = new Set(visibleColumns);
      groupIds.forEach((id) => newIds.add(id));
      onChange(Array.from(newIds));
    }
  };

  const handleShowAll = () => onChange(availableColumns.map((c) => c.id));
  const handleHideAll = () => onChange([]);

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ViewColumnIcon />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ textTransform: 'none' }}
      >
        Columns
      </Button>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, minWidth: 240, maxHeight: 400, overflow: 'auto' }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button size="small" variant="text" sx={{ textTransform: 'none', fontSize: '0.75rem' }} onClick={handleShowAll}>
              Show All
            </Button>
            <Button size="small" variant="text" sx={{ textTransform: 'none', fontSize: '0.75rem' }} onClick={handleHideAll}>
              Hide All
            </Button>
          </Stack>
          <Divider sx={{ mb: 1 }} />
          {Array.from(groups.entries()).map(([groupName, cols]) => {
            const allGroupVisible = cols.every((c) => visibleColumns.includes(c.id));
            const someGroupVisible = cols.some((c) => visibleColumns.includes(c.id));
            return (
              <Box key={groupName || '__ungrouped__'} sx={{ mb: 1 }}>
                {groupName && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={allGroupVisible}
                        indeterminate={someGroupVisible && !allGroupVisible}
                        onChange={() => handleGroupToggle(cols)}
                      />
                    }
                    label={
                      <Typography variant="caption" fontWeight={600}>
                        {groupName}
                      </Typography>
                    }
                  />
                )}
                <Box sx={{ pl: groupName ? 2 : 0 }}>
                  {cols.map((col) => (
                    <FormControlLabel
                      key={col.id}
                      control={
                        <Checkbox
                          size="small"
                          checked={visibleColumns.includes(col.id)}
                          onChange={() => handleToggle(col.id)}
                        />
                      }
                      label={<Typography variant="caption">{col.label}</Typography>}
                      sx={{ display: 'block', ml: 0 }}
                    />
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
};

export default ColumnPicker;
