/**
 * Tests for CommentaryEditor component.
 */
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import CommentaryEditor from './CommentaryEditor';
import { ResolutionBreakCategory } from '../../types/breakResolution';

interface CommentaryEntryInput {
  breakCategory: ResolutionBreakCategory | '';
  amount: string;
  text: string;
  kdReference: string;
}

const EMPTY_ENTRY: CommentaryEntryInput = {
  breakCategory: '',
  amount: '',
  text: '',
  kdReference: '',
};

const SAMPLE_ENTRIES: CommentaryEntryInput[] = [
  {
    breakCategory: 'KNOWN_DIFFERENCE',
    amount: '1500',
    text: 'Timing difference on trade settlement',
    kdReference: '',
  },
  {
    breakCategory: 'BNY_TO_RESOLVE',
    amount: '3200',
    text: 'Missing corporate action adjustment',
    kdReference: '',
  },
];

const SAMPLE_KD_OPTIONS = [
  { reference: 'KD-001', description: 'Methodology difference in accrual calc' },
  { reference: 'KD-002', description: 'Timing difference on FX rate' },
];

describe('CommentaryEditor', () => {
  const defaultProps = {
    entries: SAMPLE_ENTRIES,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering existing entries ──────────────────────────────

  it('renders existing entries with their commentary text', () => {
    render(<CommentaryEditor {...defaultProps} />);

    expect(screen.getByDisplayValue('Timing difference on trade settlement')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Missing corporate action adjustment')).toBeInTheDocument();
  });

  it('renders existing entries with their amounts', () => {
    render(<CommentaryEditor {...defaultProps} />);

    expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3200')).toBeInTheDocument();
  });

  it('renders the correct number of entry rows', () => {
    render(<CommentaryEditor entries={SAMPLE_ENTRIES} onChange={jest.fn()} />);

    // Each entry has a delete button
    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    expect(deleteButtons).toHaveLength(2);
  });

  it('renders no entry rows when entries array is empty', () => {
    render(<CommentaryEditor entries={[]} onChange={jest.fn()} />);

    expect(screen.queryByDisplayValue('Timing difference')).not.toBeInTheDocument();
    // Should still show the Add Comment button
    expect(screen.getByText('Add Comment')).toBeInTheDocument();
  });

  // ── Add new entry ──────────────────────────────────────────

  it('renders the "Add Comment" button', () => {
    render(<CommentaryEditor {...defaultProps} />);

    expect(screen.getByText('Add Comment')).toBeInTheDocument();
  });

  it('calls onChange with a new empty entry appended when Add Comment is clicked', () => {
    const onChange = jest.fn();
    render(<CommentaryEditor entries={SAMPLE_ENTRIES} onChange={onChange} />);

    fireEvent.click(screen.getByText('Add Comment'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newEntries = onChange.mock.calls[0][0];
    expect(newEntries).toHaveLength(3);
    expect(newEntries[2]).toEqual(EMPTY_ENTRY);
  });

  it('preserves existing entries when adding a new one', () => {
    const onChange = jest.fn();
    render(<CommentaryEditor entries={SAMPLE_ENTRIES} onChange={onChange} />);

    fireEvent.click(screen.getByText('Add Comment'));

    const newEntries = onChange.mock.calls[0][0];
    expect(newEntries[0]).toEqual(SAMPLE_ENTRIES[0]);
    expect(newEntries[1]).toEqual(SAMPLE_ENTRIES[1]);
  });

  // ── Remove entry ────────────────────────────────────────────

  it('calls onChange with the entry removed when delete button is clicked', () => {
    const onChange = jest.fn();
    render(<CommentaryEditor entries={SAMPLE_ENTRIES} onChange={onChange} />);

    // Click the first delete button
    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    fireEvent.click(deleteButtons[0].closest('button')!);

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedEntries = onChange.mock.calls[0][0];
    expect(updatedEntries).toHaveLength(1);
    expect(updatedEntries[0]).toEqual(SAMPLE_ENTRIES[1]);
  });

  it('calls onChange removing the correct entry by index', () => {
    const onChange = jest.fn();
    render(<CommentaryEditor entries={SAMPLE_ENTRIES} onChange={onChange} />);

    // Click the second delete button (index 1)
    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    fireEvent.click(deleteButtons[1].closest('button')!);

    const updatedEntries = onChange.mock.calls[0][0];
    expect(updatedEntries).toHaveLength(1);
    expect(updatedEntries[0]).toEqual(SAMPLE_ENTRIES[0]);
  });

  // ── Update entry fields ─────────────────────────────────────

  it('calls onChange when commentary text is modified', () => {
    const onChange = jest.fn();
    render(<CommentaryEditor entries={SAMPLE_ENTRIES} onChange={onChange} />);

    const textInput = screen.getByDisplayValue('Timing difference on trade settlement');
    fireEvent.change(textInput, { target: { value: 'Updated commentary text' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedEntries = onChange.mock.calls[0][0];
    expect(updatedEntries[0].text).toBe('Updated commentary text');
    // Other entries should be unchanged
    expect(updatedEntries[1]).toEqual(SAMPLE_ENTRIES[1]);
  });

  it('calls onChange when amount is modified', () => {
    const onChange = jest.fn();
    render(<CommentaryEditor entries={SAMPLE_ENTRIES} onChange={onChange} />);

    const amountInput = screen.getByDisplayValue('1500');
    fireEvent.change(amountInput, { target: { value: '2500' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const updatedEntries = onChange.mock.calls[0][0];
    expect(updatedEntries[0].amount).toBe('2500');
  });

  // ── Disabled mode ────────────────────────────────────────────

  it('disables the Add Comment button when disabled is true', () => {
    render(<CommentaryEditor {...defaultProps} disabled={true} />);

    const addButton = screen.getByText('Add Comment').closest('button');
    expect(addButton).toBeDisabled();
  });

  it('disables delete buttons when disabled is true', () => {
    render(<CommentaryEditor {...defaultProps} disabled={true} />);

    const deleteButtons = screen.getAllByTestId('DeleteIcon');
    deleteButtons.forEach((icon) => {
      const button = icon.closest('button');
      expect(button).toBeDisabled();
    });
  });

  it('disables text inputs when disabled is true', () => {
    render(<CommentaryEditor {...defaultProps} disabled={true} />);

    const textInput = screen.getByDisplayValue('Timing difference on trade settlement');
    expect(textInput).toBeDisabled();
  });

  it('disables amount inputs when disabled is true', () => {
    render(<CommentaryEditor {...defaultProps} disabled={true} />);

    const amountInput = screen.getByDisplayValue('1500');
    expect(amountInput).toBeDisabled();
  });

  // ── KD Reference dropdown ──────────────────────────────────

  it('renders KD reference dropdowns when kdOptions are provided', () => {
    render(
      <CommentaryEditor
        entries={SAMPLE_ENTRIES}
        onChange={jest.fn()}
        kdOptions={SAMPLE_KD_OPTIONS}
      />
    );

    // There should be additional select elements for KD references
    // Each entry row has a category select + KD reference select = more comboboxes
    const selects = screen.getAllByRole('combobox');
    // 2 entries x (1 category + 1 KD ref) = 4 comboboxes
    expect(selects.length).toBeGreaterThanOrEqual(4);
  });

  it('does not render KD reference dropdowns when kdOptions is empty', () => {
    render(
      <CommentaryEditor
        entries={SAMPLE_ENTRIES}
        onChange={jest.fn()}
        kdOptions={[]}
      />
    );

    // Only category selects should exist (1 per entry)
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
  });

  // ── Category dropdown ──────────────────────────────────────

  it('renders category dropdown options for each entry', () => {
    render(<CommentaryEditor entries={[EMPTY_ENTRY]} onChange={jest.fn()} />);

    // Open category dropdown
    const selects = screen.getAllByRole('combobox');
    fireEvent.mouseDown(selects[0]);

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Known Difference')).toBeInTheDocument();
    expect(within(listbox).getByText('BNY to Resolve')).toBeInTheDocument();
    expect(within(listbox).getByText('Incumbent to Resolve')).toBeInTheDocument();
    expect(within(listbox).getByText('Under Investigation')).toBeInTheDocument();
    expect(within(listbox).getByText('Match')).toBeInTheDocument();
  });
});
