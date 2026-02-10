/**
 * AccountColumn - Scrollable column with search/filter for GL accounts.
 */

import React, { forwardRef } from 'react';
import { Box, Typography, alpha, useTheme, Chip } from '@mui/material';
import {
  IncumbentGLAccount,
  EagleGLAccount,
  DragItemType,
  MappingType,
} from '../../types/glMapping';
import AccountCard from './AccountCard';
import AccountSearchFilter from './AccountSearchFilter';
import { LedgerSection } from '../../types/glMapping';

type GLAccount = IncumbentGLAccount | EagleGLAccount;

interface AccountColumnProps {
  title: string;
  type: DragItemType;
  accounts: GLAccount[];
  mappedAccounts: Set<string>;
  getMappingType: (accountNumber: string) => MappingType | undefined;
  selectedAccounts: string[];
  onSelectAccount: (accountNumber: string, multiSelect: boolean) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sectionFilter: LedgerSection | 'ALL';
  onSectionChange: (value: LedgerSection | 'ALL') => void;
  dropTargetAccount?: string | null;
}

const AccountColumn = forwardRef<HTMLDivElement, AccountColumnProps>(
  (
    {
      title,
      type,
      accounts,
      mappedAccounts,
      getMappingType,
      selectedAccounts,
      onSelectAccount,
      searchValue,
      onSearchChange,
      sectionFilter,
      onSectionChange,
      dropTargetAccount,
    },
    ref
  ) => {
    const theme = useTheme();

    const mappedCount = accounts.filter((a) =>
      mappedAccounts.has(a.glAccountNumber)
    ).length;
    const unmappedCount = accounts.length - mappedCount;

    const handleAccountClick = (
      accountNumber: string,
      e: React.MouseEvent
    ) => {
      const multiSelect = e.ctrlKey || e.metaKey || e.shiftKey;
      onSelectAccount(accountNumber, multiSelect);
    };

    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.primary.main, 0.02),
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
              {title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Chip
                label={`${mappedCount} mapped`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  color: theme.palette.success.main,
                }}
              />
              <Chip
                label={`${unmappedCount} unmapped`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  color: theme.palette.warning.main,
                }}
              />
            </Box>
          </Box>
          <AccountSearchFilter
            searchValue={searchValue}
            onSearchChange={onSearchChange}
            sectionFilter={sectionFilter}
            onSectionChange={onSectionChange}
            placeholder={`Search ${title.toLowerCase()}...`}
          />
        </Box>

        {/* Account List */}
        <Box
          ref={ref}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 1.5,
          }}
        >
          {accounts.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 120,
                color: 'text.secondary',
              }}
            >
              <Typography variant="body2">
                {searchValue || sectionFilter !== 'ALL'
                  ? 'No accounts match your filters'
                  : 'No accounts available'}
              </Typography>
            </Box>
          ) : (
            accounts.map((account) => (
              <AccountCard
                key={account.glAccountNumber}
                account={account}
                type={type}
                isMapped={mappedAccounts.has(account.glAccountNumber)}
                mappingType={getMappingType(account.glAccountNumber)}
                isSelected={selectedAccounts.includes(account.glAccountNumber)}
                isDropTarget={dropTargetAccount === account.glAccountNumber}
                onClick={(e) => handleAccountClick(account.glAccountNumber, e)}
              />
            ))
          )}
        </Box>
      </Box>
    );
  }
);

AccountColumn.displayName = 'AccountColumn';

export default AccountColumn;
