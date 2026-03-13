import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import MmifChatPanel from '../MmifChatPanel';

// scrollIntoView is not available in JSDOM
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

jest.mock('../../../services/api', () => ({
  createMmifChatSession: jest.fn().mockResolvedValue({ sessionId: 'SESS-001' }),
  sendMmifChatMessage: jest.fn().mockResolvedValue({
    message: 'AI response',
    timestamp: new Date().toISOString(),
  }),
  fetchMmifChatHistory: jest.fn().mockResolvedValue({ messages: [] }),
}));

const theme = createTheme();

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('MmifChatPanel', () => {
  it('renders header when open', () => {
    wrap(<MmifChatPanel open={true} onClose={jest.fn()} eventId="EVT-001" />);
    expect(screen.getByText('MMIF Agent Chat')).toBeInTheDocument();
  });

  it('shows empty state message when no messages', () => {
    wrap(<MmifChatPanel open={true} onClose={jest.fn()} eventId="EVT-001" />);
    expect(screen.getByText(/Ask me anything about this MMIF filing/)).toBeInTheDocument();
  });

  it('shows quick action chips', () => {
    wrap(<MmifChatPanel open={true} onClose={jest.fn()} eventId="EVT-001" />);
    expect(screen.getByText('Explain breaks')).toBeInTheDocument();
    expect(screen.getByText('Check mappings')).toBeInTheDocument();
    expect(screen.getByText('Filing readiness')).toBeInTheDocument();
    expect(screen.getByText('Compare prior quarter')).toBeInTheDocument();
  });

  it('shows input placeholder', () => {
    wrap(<MmifChatPanel open={true} onClose={jest.fn()} eventId="EVT-001" />);
    expect(screen.getByPlaceholderText(/Ask about breaks/)).toBeInTheDocument();
  });

  it('has close button that calls onClose', () => {
    const onClose = jest.fn();
    wrap(<MmifChatPanel open={true} onClose={onClose} eventId="EVT-001" />);
    fireEvent.click(screen.getByLabelText('Close chat panel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('send button is disabled when input is empty', () => {
    wrap(<MmifChatPanel open={true} onClose={jest.fn()} eventId="EVT-001" />);
    const sendButton = screen.getByLabelText('Send message');
    expect(sendButton).toBeDisabled();
  });

  it('send button enables when input has text', () => {
    wrap(<MmifChatPanel open={true} onClose={jest.fn()} eventId="EVT-001" />);
    const input = screen.getByPlaceholderText(/Ask about breaks/);
    fireEvent.change(input, { target: { value: 'Hello' } });
    const sendButton = screen.getByLabelText('Send message');
    expect(sendButton).not.toBeDisabled();
  });

  it('shows helper text about Enter key', () => {
    wrap(<MmifChatPanel open={true} onClose={jest.fn()} eventId="EVT-001" />);
    expect(screen.getByText(/Press Enter to send/)).toBeInTheDocument();
  });

  it('shows quick action hint text', () => {
    wrap(<MmifChatPanel open={true} onClose={jest.fn()} eventId="EVT-001" />);
    expect(screen.getByText(/Use the quick actions above/)).toBeInTheDocument();
  });
});
