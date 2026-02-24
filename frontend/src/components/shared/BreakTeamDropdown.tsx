import React from 'react';
import { Select, MenuItem, SelectChangeEvent, Stack } from '@mui/material';
import { BreakTeam } from '../../types/breakResolution';

const TEAM_CONFIG: Record<BreakTeam, { label: string; members: string[] }> = {
  NAV_OVERSIGHT: { label: 'NAV Oversight', members: ['David Park', 'Rachel Torres'] },
  PRICING: { label: 'Pricing', members: ['Mark Chen', 'Amy Liu'] },
  TRADE_CAPTURE: { label: 'Trade Capture', members: ['Sarah Kim', 'Tom Zhao'] },
  CORPORATE_ACTIONS: { label: 'Corporate Actions', members: ['Brian Lee', 'Nina Patel'] },
  INCOME: { label: 'Income', members: ['Karen Wu', 'Jason Miller'] },
  DERIVATIVES: { label: 'Derivatives', members: ['Alex Johnson', 'Maria Garcia'] },
};

interface BreakTeamDropdownProps {
  team: BreakTeam | '';
  owner: string;
  onTeamChange: (team: BreakTeam) => void;
  onOwnerChange: (owner: string) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

export default function BreakTeamDropdown({
  team,
  owner,
  onTeamChange,
  onOwnerChange,
  disabled = false,
  size = 'small',
}: BreakTeamDropdownProps) {
  const handleTeamChange = (event: SelectChangeEvent<string>) => {
    const newTeam = event.target.value as BreakTeam;
    onTeamChange(newTeam);
    // Reset owner when team changes
    onOwnerChange('');
  };

  const handleOwnerChange = (event: SelectChangeEvent<string>) => {
    onOwnerChange(event.target.value);
  };

  const members = team ? TEAM_CONFIG[team]?.members ?? [] : [];

  return (
    <Stack direction="row" spacing={1}>
      <Select
        value={team}
        onChange={handleTeamChange}
        disabled={disabled}
        size={size}
        displayEmpty
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="" disabled><em>Select team</em></MenuItem>
        {(Object.entries(TEAM_CONFIG) as [BreakTeam, typeof TEAM_CONFIG[BreakTeam]][]).map(
          ([key, config]) => (
            <MenuItem key={key} value={key}>{config.label}</MenuItem>
          )
        )}
      </Select>
      <Select
        value={owner}
        onChange={handleOwnerChange}
        disabled={disabled || !team}
        size={size}
        displayEmpty
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="" disabled><em>Select owner</em></MenuItem>
        {members.map((member) => (
          <MenuItem key={member} value={member}>{member}</MenuItem>
        ))}
      </Select>
    </Stack>
  );
}
