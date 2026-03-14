import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock react-router-dom before any imports that use it
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useParams: () => ({ ruleId: undefined }),
  useNavigate: () => mockNavigate,
}));

// Mock the API module
jest.mock('../../services/api', () => ({
  fetchMmifValidationRule: jest.fn(),
  createMmifValidationRule: jest.fn(),
  updateMmifValidationRule: jest.fn(),
  validateMmifExpression: jest.fn(),
  testMmifDslRule: jest.fn(),
  fetchMmifDslFunctions: jest.fn(),
  suggestMmifRule: jest.fn(),
}));

// Mock Monaco editor
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange }: any) => (
    <textarea data-testid="monaco-editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import MmifRuleEditor from './MmifRuleEditor';
import { fetchMmifDslFunctions } from '../../services/api';

const mockedFetchFunctions = fetchMmifDslFunctions as jest.MockedFunction<typeof fetchMmifDslFunctions>;

const MOCK_FUNCTIONS = [
  { name: 'sumByPrefix', signature: '(list, string, string) -> double', description: 'Sum by GL prefix', example: "sumByPrefix(ledger, '1', 'endingBalance')", category: 'accounting' },
  { name: 'abs', signature: '(double) -> double', description: 'Absolute value', example: 'abs(-42.5)', category: 'numeric' },
];

describe('MmifRuleEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchFunctions.mockResolvedValue(MOCK_FUNCTIONS);
  });

  it('renders Create form for new rule', async () => {
    render(<MmifRuleEditor />);
    await waitFor(() => {
      expect(screen.getByText('Create Validation Rule')).toBeInTheDocument();
    });
  });

  it('shows Rule ID input enabled for new rule', async () => {
    render(<MmifRuleEditor />);
    await waitFor(() => {
      const ruleIdInput = screen.getByLabelText('Rule ID');
      expect(ruleIdInput).not.toBeDisabled();
    });
  });

  it('shows Create Rule button for new rule', async () => {
    render(<MmifRuleEditor />);
    await waitFor(() => {
      expect(screen.getByText('Create Rule')).toBeInTheDocument();
    });
  });

  it('shows LHS and RHS expression sections', async () => {
    render(<MmifRuleEditor />);
    await waitFor(() => {
      expect(screen.getByText('LHS Expression (Left-Hand Side)')).toBeInTheDocument();
      expect(screen.getByText('RHS Expression (Right-Hand Side)')).toBeInTheDocument();
    });
  });

  it('shows Test Rule section', async () => {
    render(<MmifRuleEditor />);
    await waitFor(() => {
      expect(screen.getByText('Test Rule')).toBeInTheDocument();
      expect(screen.getByText('Run Test')).toBeInTheDocument();
    });
  });

  it('shows Function Reference section', async () => {
    render(<MmifRuleEditor />);
    await waitFor(() => {
      expect(screen.getByText('Function Reference')).toBeInTheDocument();
    });
  });

  it('loads function docs on mount', async () => {
    render(<MmifRuleEditor />);
    await waitFor(() => {
      expect(mockedFetchFunctions).toHaveBeenCalled();
    });
  });

  it('shows save error when required fields missing', async () => {
    render(<MmifRuleEditor />);
    await waitFor(() => screen.getByText('Create Rule'));

    fireEvent.click(screen.getByText('Create Rule'));

    await waitFor(() => {
      expect(screen.getByText('Rule ID and Name are required')).toBeInTheDocument();
    });
  });

  it('navigates back on Cancel', async () => {
    render(<MmifRuleEditor />);
    await waitFor(() => screen.getByText('Cancel'));

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/mmif');
  });

  it('shows AI Assist button for new rule', async () => {
    render(<MmifRuleEditor />);
    await waitFor(() => {
      expect(screen.getByText('AI Assist')).toBeInTheDocument();
    });
  });

  it('opens AI Assist dialog when button clicked', async () => {
    render(<MmifRuleEditor />);
    await waitFor(() => screen.getByText('AI Assist'));

    fireEvent.click(screen.getByText('AI Assist'));

    await waitFor(() => {
      expect(screen.getByText('AI Rule Assistant')).toBeInTheDocument();
    });
  });

  it('closes AI Assist dialog on Cancel', async () => {
    render(<MmifRuleEditor />);
    await waitFor(() => screen.getByText('AI Assist'));

    fireEvent.click(screen.getByText('AI Assist'));
    await waitFor(() => screen.getByText('AI Rule Assistant'));

    // Click the Cancel button inside the dialog (second Cancel on screen)
    const cancelButtons = screen.getAllByText('Cancel');
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('AI Rule Assistant')).not.toBeInTheDocument();
    });
  });
});
