/**
 * Tests for BreakCategorySelector component.
 */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BreakCategorySelector from './BreakCategorySelector';
import { ResolutionBreakCategory } from '../../types/breakResolution';

const ALL_CATEGORIES: { key: ResolutionBreakCategory; label: string; color: string; bgColor: string }[] = [
  { key: 'KNOWN_DIFFERENCE', label: 'Known Difference', color: '#1565C0', bgColor: '#E3F2FD' },
  { key: 'BNY_TO_RESOLVE', label: 'BNY to Resolve', color: '#E65100', bgColor: '#FFF3E0' },
  { key: 'INCUMBENT_TO_RESOLVE', label: 'Incumbent to Resolve', color: '#7B1FA2', bgColor: '#F3E5F5' },
  { key: 'UNDER_INVESTIGATION', label: 'Under Investigation', color: '#F9A825', bgColor: '#FFFDE7' },
  { key: 'MATCH', label: 'Match', color: '#2E7D32', bgColor: '#E8F5E9' },
];

describe('BreakCategorySelector', () => {
  const defaultProps = {
    value: '' as ResolutionBreakCategory | '',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with placeholder text when no value is selected', () => {
    render(<BreakCategorySelector {...defaultProps} />);
    expect(screen.getByText('Select category')).toBeInTheDocument();
  });

  it('renders all 5 categories in the dropdown when opened', () => {
    render(<BreakCategorySelector {...defaultProps} />);

    // Open the dropdown by clicking on the Select
    const selectButton = screen.getByRole('combobox');
    fireEvent.mouseDown(selectButton);

    // Check all 5 categories are present in the dropdown listbox
    const listbox = screen.getByRole('listbox');
    ALL_CATEGORIES.forEach(({ label }) => {
      expect(within(listbox).getByText(label)).toBeInTheDocument();
    });
  });

  it('fires onChange callback with the selected category value', () => {
    const onChange = jest.fn();
    render(<BreakCategorySelector {...defaultProps} onChange={onChange} />);

    // Open dropdown
    const selectButton = screen.getByRole('combobox');
    fireEvent.mouseDown(selectButton);

    // Click on "BNY to Resolve"
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('BNY to Resolve'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('BNY_TO_RESOLVE');
  });

  it('fires onChange for each category when selected', () => {
    const onChange = jest.fn();

    ALL_CATEGORIES.forEach(({ key, label }) => {
      onChange.mockClear();
      const { unmount } = render(
        <BreakCategorySelector value="" onChange={onChange} />
      );

      const selectButton = screen.getByRole('combobox');
      fireEvent.mouseDown(selectButton);

      const listbox = screen.getByRole('listbox');
      fireEvent.click(within(listbox).getByText(label));

      expect(onChange).toHaveBeenCalledWith(key);
      unmount();
    });
  });

  it('renders the selected value as a colored Chip', () => {
    render(
      <BreakCategorySelector
        value="KNOWN_DIFFERENCE"
        onChange={jest.fn()}
      />
    );

    // When a value is selected, the Chip with label "Known Difference" should be visible
    expect(screen.getByText('Known Difference')).toBeInTheDocument();
  });

  it('displays the correct label for each selected value', () => {
    ALL_CATEGORIES.forEach(({ key, label }) => {
      const { unmount } = render(
        <BreakCategorySelector value={key} onChange={jest.fn()} />
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });

  it('disables the select when disabled prop is true', () => {
    render(
      <BreakCategorySelector {...defaultProps} disabled={true} />
    );

    // MUI Select renders an input with aria-disabled or a disabled attribute
    const selectButton = screen.getByRole('combobox');
    expect(selectButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not open dropdown when disabled', () => {
    render(
      <BreakCategorySelector {...defaultProps} disabled={true} />
    );

    const selectButton = screen.getByRole('combobox');
    fireEvent.mouseDown(selectButton);

    // Listbox should not appear
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders correct color coding for each category chip in the dropdown', () => {
    render(<BreakCategorySelector {...defaultProps} />);

    // Open the dropdown
    const selectButton = screen.getByRole('combobox');
    fireEvent.mouseDown(selectButton);

    const listbox = screen.getByRole('listbox');

    ALL_CATEGORIES.forEach(({ label, color, bgColor }) => {
      const chipElement = within(listbox).getByText(label);
      // The Chip element has the styled sx props applied
      // MUI Chips: the label text is inside a span.MuiChip-label, the chip root has the styles
      const chipRoot = chipElement.closest('.MuiChip-root');
      expect(chipRoot).toBeInTheDocument();
    });
  });

  it('renders with small size by default', () => {
    render(<BreakCategorySelector {...defaultProps} />);

    // The select should have small size class from MUI
    const selectButton = screen.getByRole('combobox');
    expect(selectButton).toBeInTheDocument();
  });
});
