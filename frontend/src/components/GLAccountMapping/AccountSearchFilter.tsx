/**
 * AccountSearchFilter - Search and filter controls for account columns.
 */

import React from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  SelectChangeEvent,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { LedgerSection } from '../../types/glMapping';

interface AccountSearchFilterProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  sectionFilter: LedgerSection | 'ALL';
  onSectionChange: (value: LedgerSection | 'ALL') => void;
  placeholder?: string;
}

const LEDGER_SECTIONS: Array<{ value: LedgerSection | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All Sections' },
  { value: 'ASSETS', label: 'Assets' },
  { value: 'LIABILITIES', label: 'Liabilities' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSE', label: 'Expense' },
];

const AccountSearchFilter: React.FC<AccountSearchFilterProps> = ({
  searchValue,
  onSearchChange,
  sectionFilter,
  onSectionChange,
  placeholder = 'Search accounts...',
}) => {
  const handleSectionChange = (event: SelectChangeEvent<string>) => {
    onSectionChange(event.target.value as LedgerSection | 'ALL');
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
      <TextField
        size="small"
        placeholder={placeholder}
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        }}
        sx={{ flex: 1 }}
      />
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel>Section</InputLabel>
        <Select
          value={sectionFilter}
          label="Section"
          onChange={handleSectionChange}
        >
          {LEDGER_SECTIONS.map((section) => (
            <MenuItem key={section.value} value={section.value}>
              {section.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default AccountSearchFilter;
