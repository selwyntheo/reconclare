import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock API
jest.mock('../../services/api', () => ({
  fetchMmifReconciliationDetail: jest.fn(),
}));

import MmifBreakDetailView from './MmifBreakDetailView';
import { fetchMmifReconciliationDetail } from '../../services/api';

const mockedFetch = fetchMmifReconciliationDetail as jest.MockedFunction<typeof fetchMmifReconciliationDetail>;

const MOCK_FUNDS = [
  {
    account: 'IE-UCITS-EQ-001',
    fundName: 'Aria European Equity UCITS',
    fundType: 'UCITS' as const,
    fundDomicile: 'IE',
    shareClasses: ['I-EUR'],
    status: 'PENDING' as const,
  },
  {
    account: 'IE-UCITS-FI-002',
    fundName: 'Aria Fixed Income UCITS',
    fundType: 'UCITS' as const,
    fundDomicile: 'IE',
    shareClasses: ['A-EUR'],
    status: 'PENDING' as const,
  },
];

const MOCK_DETAIL = {
  eventId: 'MMIF-2026-Q1-001',
  account: 'IE-UCITS-EQ-001',
  fundName: 'Aria European Equity UCITS',
  filingPeriod: '2026Q1',
  assetLiabilityRows: [
    {
      account: '1100-0000-0000-0000',
      description: 'SECURITIES AT VALUE',
      category: 'asset',
      beginBal: 198450000.0,
      netActivity: 5230000.0,
      endBal: 203680000.0,
      netSecValue: 203660000.0,
      smaSource: 'Positions',
      smaValue: 203660000.0,
      variance: -20000.0,
      status: 'break',
    },
    {
      account: '1110-0000-1123-0000',
      description: 'EURO CASH',
      category: 'asset',
      beginBal: 12350000.0,
      netActivity: -850000.0,
      endBal: 11500000.0,
      netSecValue: 11500000.0,
      smaSource: 'Positions',
      smaValue: 11500000.0,
      variance: 0.0,
      status: 'match',
    },
  ],
  capitalRows: [
    {
      account: '3100-0000-0000-0000',
      description: 'SUBSCRIPTIONS',
      beginBal: 180000000.0,
      netActivity: -5200000.0,
      endBal: 185200000.0,
    },
  ],
  shareholderRows: [
    {
      isin: 'IE0003CU5OB7',
      openPosition: 155200000.0,
      issued: 4500000.0,
      redeemed: 2100000.0,
      closePosition: 157600000.0,
      matched: true,
    },
  ],
  navComparison: {
    capitalTotals: 239700000.0,
    pnlActivityFYE: 8900000.0,
    capitalIncPeriodEnd: 248600000.0,
    navFromSMA: 248600000.0,
    navFromShareholderPivot: 242100000.0,
  },
  ledgerCrossCheck: {
    assets: { start: 241345000.0, end: 248600000.0 },
    liabilities: { start: 1250000.0, end: 1400000.0 },
    capital: { start: 239700000.0, end: 241200000.0 },
    bsDiff: { start: 395000.0, end: 6000000.0 },
    income: { start: 4200000.0, end: 5500000.0 },
    expense: { start: 520000.0, end: 680000.0 },
    netIncome: { start: 3680000.0, end: 4820000.0 },
    rgl: { start: 850000.0, end: 420000.0 },
    urgl: { start: -4135000.0, end: 760000.0 },
    netGL: { start: -3285000.0, end: 1180000.0 },
    totalPnL: { start: 395000.0, end: 6000000.0 },
    tbBalanced: { start: 0.0, end: 0.0 },
  },
};

describe('MmifBreakDetailView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetch.mockResolvedValue(MOCK_DETAIL);
  });

  it('renders fund selector as Autocomplete', async () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Select Fund')).toBeInTheDocument();
    });
  });

  it('renders KPI strip with totals', async () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => {
      expect(screen.getByText('Total Checks')).toBeInTheDocument();
      expect(screen.getByText('Breaks')).toBeInTheDocument();
      expect(screen.getByText('TB Balanced')).toBeInTheDocument();
    });
  });

  it('renders Asset & Liability tab by default', async () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => {
      expect(screen.getByText('SECURITIES AT VALUE')).toBeInTheDocument();
      expect(screen.getByText('EURO CASH')).toBeInTheDocument();
    });
  });

  it('shows ACCOUNTING and MMIF column headers', async () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => {
      expect(screen.getByText('ACCOUNTING (Trial Balance)')).toBeInTheDocument();
      expect(screen.getByText('MMIF (Positions / SMA)')).toBeInTheDocument();
    });
  });

  it('shows view mode toggle buttons', async () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => {
      expect(screen.getByText('Split')).toBeInTheDocument();
      expect(screen.getByText('TB')).toBeInTheDocument();
      expect(screen.getAllByText('MMIF').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows Break and Tied status chips', async () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => {
      expect(screen.getByText('Break')).toBeInTheDocument();
      expect(screen.getAllByText('Tied').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows legend with color labels', async () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => {
      expect(screen.getByText('Accounting')).toBeInTheDocument();
      expect(screen.getAllByText('MMIF').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Variance')).toBeInTheDocument();
    });
  });

  it('switches to Capital tab', async () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => screen.getByRole('tab', { name: /Capital/ }));

    fireEvent.click(screen.getByRole('tab', { name: /Capital/ }));

    await waitFor(() => {
      expect(screen.getByText('SUBSCRIPTIONS')).toBeInTheDocument();
      expect(screen.getByText('Capital Totals')).toBeInTheDocument();
    });
  });

  it('switches to Shareholder tab', async () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => screen.getByRole('tab', { name: /Shareholder/ }));

    fireEvent.click(screen.getByRole('tab', { name: /Shareholder/ }));

    await waitFor(() => {
      expect(screen.getByText('IE0003CU5OB7')).toBeInTheDocument();
      expect(screen.getByText('TOTAL')).toBeInTheDocument();
    });
  });

  it('switches to NAV Tie-Out tab', async () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => screen.getByRole('tab', { name: /NAV Tie-Out/ }));

    fireEvent.click(screen.getByRole('tab', { name: /NAV Tie-Out/ }));

    await waitFor(() => {
      expect(screen.getByText('From TB (Capital + PnL)')).toBeInTheDocument();
      expect(screen.getByText(/From NAV/)).toBeInTheDocument();
      expect(screen.getByText(/From Shareholder Pivot/)).toBeInTheDocument();
    });
  });

  it('switches to Ledger Cross Check tab', async () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => screen.getByRole('tab', { name: /Ledger Cross Check/ }));

    fireEvent.click(screen.getByRole('tab', { name: /Ledger Cross Check/ }));

    await waitFor(() => {
      expect(screen.getByText('Assets (1x)')).toBeInTheDocument();
      expect(screen.getByText('Liabilities (2x)')).toBeInTheDocument();
      expect(screen.getByText('Capital (3x)')).toBeInTheDocument();
      expect(screen.getByText('TB Balanced?')).toBeInTheDocument();
    });
  });

  it('shows empty state when no detail available', async () => {
    mockedFetch.mockRejectedValue(new Error('not found'));
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => {
      expect(screen.getByText(/No reconciliation detail available/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no funds', () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={[]} />);
    expect(screen.getByText('No funds available')).toBeInTheDocument();
  });

  it('switches fund via Autocomplete', async () => {
    render(<MmifBreakDetailView eventId="MMIF-2026-Q1-001" funds={MOCK_FUNDS as any} />);
    await waitFor(() => screen.getByLabelText('Select Fund'));

    // Open autocomplete and type to filter
    const input = screen.getByLabelText('Select Fund');
    fireEvent.mouseDown(input);

    await waitFor(() => {
      // Both options should appear in the listbox
      const options = screen.getAllByRole('option');
      expect(options.length).toBe(2);
    });

    // Click second option
    const options = screen.getAllByRole('option');
    fireEvent.click(options[1]);

    expect(mockedFetch).toHaveBeenCalledWith('MMIF-2026-Q1-001', 'IE-UCITS-FI-002');
  });

  it('pre-selects fund from drillDownContext', async () => {
    const drillDown = {
      ruleId: 'VR_001',
      ruleName: 'Total Assets Tie-Out',
      mmifSection: '4.3',
      fundAccount: 'IE-UCITS-FI-002',
      fundName: 'Aria Fixed Income UCITS',
    };
    render(
      <MmifBreakDetailView
        eventId="MMIF-2026-Q1-001"
        funds={MOCK_FUNDS as any}
        drillDownContext={drillDown}
      />
    );

    // Should fetch with the drilled-down fund
    expect(mockedFetch).toHaveBeenCalledWith('MMIF-2026-Q1-001', 'IE-UCITS-FI-002');

    // Should show traceability banner
    await waitFor(() => {
      expect(screen.getByText(/Drilled from/)).toBeInTheDocument();
      expect(screen.getByText('VR-001')).toBeInTheDocument();
      expect(screen.getByText('Total Assets Tie-Out')).toBeInTheDocument();
    });
  });

  it('clears drill-down context when close button clicked', async () => {
    const onClear = jest.fn();
    const drillDown = {
      ruleId: 'VR_001',
      ruleName: 'Total Assets Tie-Out',
      mmifSection: '4.3',
      fundAccount: 'IE-UCITS-FI-002',
      fundName: 'Aria Fixed Income UCITS',
    };
    render(
      <MmifBreakDetailView
        eventId="MMIF-2026-Q1-001"
        funds={MOCK_FUNDS as any}
        drillDownContext={drillDown}
        onClearDrillDown={onClear}
      />
    );
    await waitFor(() => screen.getByText(/Drilled from/));

    fireEvent.click(screen.getByRole('button', { name: /close drill-down/ }));
    expect(onClear).toHaveBeenCalled();
  });
});
