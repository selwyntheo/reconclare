/**
 * Tests for NotificationBell component.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import NotificationBell from './NotificationBell';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock the API service functions
jest.mock('../../services/api', () => ({
  fetchNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  fetchNotificationCount: jest.fn(),
}));

import {
  fetchNotifications,
  markNotificationRead,
  fetchNotificationCount,
} from '../../services/api';

const mockedFetchNotifications = fetchNotifications as jest.MockedFunction<typeof fetchNotifications>;
const mockedMarkNotificationRead = markNotificationRead as jest.MockedFunction<typeof markNotificationRead>;
const mockedFetchNotificationCount = fetchNotificationCount as jest.MockedFunction<typeof fetchNotificationCount>;

const mockNotifications = [
  {
    _id: 'n1',
    eventId: 'EVT-001',
    breakType: 'SHARE',
    entityReference: 'SEC-001',
    fundAccount: 'FUND-A',
    fundName: 'Alpha Fund',
    message: 'New share break detected in Alpha Fund',
    isRead: false,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    _id: 'n2',
    eventId: 'EVT-002',
    breakType: 'PRICE',
    entityReference: 'SEC-002',
    fundAccount: 'FUND-B',
    fundName: 'Beta Fund',
    message: 'Price break resolved in Beta Fund',
    isRead: true,
    createdAt: '2026-01-14T09:00:00Z',
  },
];

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockedFetchNotificationCount.mockResolvedValue({ unread: 3 });
    mockedFetchNotifications.mockResolvedValue(mockNotifications);
    mockedMarkNotificationRead.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the bell icon button', async () => {
    await act(async () => {
      render(<NotificationBell />);
    });

    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toBeInTheDocument();
  });

  it('shows the unread count badge from API', async () => {
    await act(async () => {
      render(<NotificationBell />);
    });

    // Wait for the count to load
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('fetches notification count on mount', async () => {
    await act(async () => {
      render(<NotificationBell />);
    });

    expect(mockedFetchNotificationCount).toHaveBeenCalledTimes(1);
  });

  it('polls notification count every 30 seconds', async () => {
    await act(async () => {
      render(<NotificationBell />);
    });

    expect(mockedFetchNotificationCount).toHaveBeenCalledTimes(1);

    // Advance time by 30 seconds
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(mockedFetchNotificationCount).toHaveBeenCalledTimes(2);

    // Advance another 30 seconds
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(mockedFetchNotificationCount).toHaveBeenCalledTimes(3);
  });

  it('opens popover with notifications on click', async () => {
    await act(async () => {
      render(<NotificationBell />);
    });

    const button = screen.getByRole('button', { name: /notifications/i });

    await act(async () => {
      fireEvent.click(button);
    });

    // Wait for notifications to load and popover to appear
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    expect(screen.getByText('New share break detected in Alpha Fund')).toBeInTheDocument();
    expect(screen.getByText('Price break resolved in Beta Fund')).toBeInTheDocument();
  });

  it('fetches notifications when popover is opened', async () => {
    await act(async () => {
      render(<NotificationBell />);
    });

    const button = screen.getByRole('button', { name: /notifications/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockedFetchNotifications).toHaveBeenCalledTimes(1);
  });

  it('shows "No notifications" when list is empty', async () => {
    mockedFetchNotifications.mockResolvedValue([]);

    await act(async () => {
      render(<NotificationBell />);
    });

    const button = screen.getByRole('button', { name: /notifications/i });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('shows "unread" text in the popover header when there are unread notifications', async () => {
    await act(async () => {
      render(<NotificationBell />);
    });

    const button = screen.getByRole('button', { name: /notifications/i });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText('3 unread')).toBeInTheDocument();
    });
  });

  it('marks notification as read and navigates when clicked', async () => {
    await act(async () => {
      render(<NotificationBell />);
    });

    const button = screen.getByRole('button', { name: /notifications/i });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText('New share break detected in Alpha Fund')).toBeInTheDocument();
    });

    // Click the unread notification
    await act(async () => {
      fireEvent.click(screen.getByText('New share break detected in Alpha Fund'));
    });

    expect(mockedMarkNotificationRead).toHaveBeenCalledWith('n1');
    expect(mockNavigate).toHaveBeenCalledWith('/events/EVT-001/funds/FUND-A/positions');
  });

  it('does not call markNotificationRead for already read notifications', async () => {
    await act(async () => {
      render(<NotificationBell />);
    });

    const button = screen.getByRole('button', { name: /notifications/i });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText('Price break resolved in Beta Fund')).toBeInTheDocument();
    });

    // Click the already-read notification
    await act(async () => {
      fireEvent.click(screen.getByText('Price break resolved in Beta Fund'));
    });

    expect(mockedMarkNotificationRead).not.toHaveBeenCalled();
  });

  it('handles API errors gracefully without crashing', async () => {
    mockedFetchNotificationCount.mockRejectedValue(new Error('Network error'));

    await act(async () => {
      render(<NotificationBell />);
    });

    // Component should still render without crashing
    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toBeInTheDocument();
  });

  it('does not show badge when unread count is 0', async () => {
    mockedFetchNotificationCount.mockResolvedValue({ unread: 0 });

    await act(async () => {
      render(<NotificationBell />);
    });

    // Badge with 0 should not render visible content (MUI hides it)
    await waitFor(() => {
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });
});
