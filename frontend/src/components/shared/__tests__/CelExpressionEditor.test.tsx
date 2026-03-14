import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CelExpressionEditor from '../CelExpressionEditor';

// Mock Monaco editor
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange, onMount }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe('CelExpressionEditor', () => {
  it('renders with label', () => {
    render(
      <CelExpressionEditor
        value=""
        onChange={() => {}}
        label="Test Expression"
      />
    );
    expect(screen.getByText('Test Expression')).toBeInTheDocument();
  });

  it('renders editor with initial value', () => {
    render(
      <CelExpressionEditor
        value="sumByPrefix(ledger, '1', 'endingBalance')"
        onChange={() => {}}
      />
    );
    const editor = screen.getByTestId('monaco-editor');
    expect(editor).toHaveValue("sumByPrefix(ledger, '1', 'endingBalance')");
  });

  it('calls onChange when editor content changes', () => {
    const handleChange = jest.fn();
    render(
      <CelExpressionEditor value="" onChange={handleChange} />
    );
    const editor = screen.getByTestId('monaco-editor');
    fireEvent.change(editor, { target: { value: '1.0 + 2.0' } });
    expect(handleChange).toHaveBeenCalledWith('1.0 + 2.0');
  });

  it('shows valid indicator when validation succeeds', async () => {
    const validateFn = jest.fn().mockResolvedValue({ isValid: true, error: null });
    render(
      <CelExpressionEditor
        value="1.0 + 2.0"
        onChange={() => {}}
        validateExpression={validateFn}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Valid expression')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('shows error indicator when validation fails', async () => {
    const validateFn = jest.fn().mockResolvedValue({ isValid: false, error: 'Parse error' });
    render(
      <CelExpressionEditor
        value="1.0 ++"
        onChange={() => {}}
        validateExpression={validateFn}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Parse error')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('does not show validation when value is empty', () => {
    const validateFn = jest.fn();
    render(
      <CelExpressionEditor
        value=""
        onChange={() => {}}
        validateExpression={validateFn}
      />
    );
    expect(validateFn).not.toHaveBeenCalled();
  });
});
