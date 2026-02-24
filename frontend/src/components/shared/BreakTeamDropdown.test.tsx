/**
 * Tests for BreakTeamDropdown component.
 */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import BreakTeamDropdown from './BreakTeamDropdown';
import { BreakTeam } from '../../types/breakResolution';

const TEAMS: { key: BreakTeam; label: string; members: string[] }[] = [
  { key: 'NAV_OVERSIGHT', label: 'NAV Oversight', members: ['David Park', 'Rachel Torres'] },
  { key: 'PRICING', label: 'Pricing', members: ['Mark Chen', 'Amy Liu'] },
  { key: 'TRADE_CAPTURE', label: 'Trade Capture', members: ['Sarah Kim', 'Tom Zhao'] },
  { key: 'CORPORATE_ACTIONS', label: 'Corporate Actions', members: ['Brian Lee', 'Nina Patel'] },
  { key: 'INCOME', label: 'Income', members: ['Karen Wu', 'Jason Miller'] },
  { key: 'DERIVATIVES', label: 'Derivatives', members: ['Alex Johnson', 'Maria Garcia'] },
];

describe('BreakTeamDropdown', () => {
  const defaultProps = {
    team: '' as BreakTeam | '',
    owner: '',
    onTeamChange: jest.fn(),
    onOwnerChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders two select dropdowns (team and owner)', () => {
    render(<BreakTeamDropdown {...defaultProps} />);

    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
  });

  it('renders all 6 team options when team dropdown is opened', () => {
    render(<BreakTeamDropdown {...defaultProps} />);

    // Open the first (team) dropdown
    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[0]);

    const listbox = screen.getByRole('listbox');
    TEAMS.forEach(({ label }) => {
      expect(within(listbox).getByText(label)).toBeInTheDocument();
    });
  });

  it('calls onTeamChange when a team is selected', () => {
    const onTeamChange = jest.fn();
    render(<BreakTeamDropdown {...defaultProps} onTeamChange={onTeamChange} />);

    // Open team dropdown
    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[0]);

    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Pricing'));

    expect(onTeamChange).toHaveBeenCalledTimes(1);
    expect(onTeamChange).toHaveBeenCalledWith('PRICING');
  });

  it('resets owner when team changes (calls onOwnerChange with empty string)', () => {
    const onOwnerChange = jest.fn();
    render(<BreakTeamDropdown {...defaultProps} onOwnerChange={onOwnerChange} />);

    // Open team dropdown
    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[0]);

    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Trade Capture'));

    // When team changes, owner is reset
    expect(onOwnerChange).toHaveBeenCalledWith('');
  });

  it('shows correct team members in owner dropdown when a team is selected', () => {
    render(
      <BreakTeamDropdown
        {...defaultProps}
        team="PRICING"
        owner=""
      />
    );

    // Open the owner dropdown (second select)
    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[1]);

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Mark Chen')).toBeInTheDocument();
    expect(within(listbox).getByText('Amy Liu')).toBeInTheDocument();
  });

  it('owner dropdown filters members based on the selected team', () => {
    // Test each team's members appear correctly
    TEAMS.forEach(({ key, members }) => {
      const { unmount } = render(
        <BreakTeamDropdown
          {...defaultProps}
          team={key}
          owner=""
        />
      );

      const selects = screen.getAllByRole('combobox');
      fireEvent.mouseDown(selects[1]);

      const listbox = screen.getByRole('listbox');
      members.forEach((member) => {
        expect(within(listbox).getByText(member)).toBeInTheDocument();
      });

      unmount();
    });
  });

  it('calls onOwnerChange when an owner is selected', () => {
    const onOwnerChange = jest.fn();
    render(
      <BreakTeamDropdown
        {...defaultProps}
        team="NAV_OVERSIGHT"
        owner=""
        onOwnerChange={onOwnerChange}
      />
    );

    // Open owner dropdown
    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[1]);

    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('David Park'));

    expect(onOwnerChange).toHaveBeenCalledTimes(1);
    expect(onOwnerChange).toHaveBeenCalledWith('David Park');
  });

  it('disables owner dropdown when no team is selected', () => {
    render(<BreakTeamDropdown {...defaultProps} team="" owner="" />);

    const selects = screen.getAllByRole('combobox');
    // Owner dropdown (second) should be disabled when no team selected
    expect(selects[1]).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables both dropdowns when disabled prop is true', () => {
    render(<BreakTeamDropdown {...defaultProps} disabled={true} />);

    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveAttribute('aria-disabled', 'true');
    expect(selects[1]).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not open team dropdown when disabled', () => {
    render(<BreakTeamDropdown {...defaultProps} disabled={true} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[0]);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows placeholder text in both dropdowns', () => {
    render(<BreakTeamDropdown {...defaultProps} />);

    expect(screen.getByText('Select team')).toBeInTheDocument();
    expect(screen.getByText('Select owner')).toBeInTheDocument();
  });
});
