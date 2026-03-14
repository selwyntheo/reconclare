import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useParams: () => ({ eventId: 'MMIF-2026-Q1-002', fundType: 'AIF' }),
  useNavigate: () => mockNavigate,
}));

// Mock API
jest.mock('../../services/api', () => ({
  fetchMmifEvent: jest.fn(),
  fetchMmifMapping: jest.fn(),
  saveMmifMapping: jest.fn(),
  fetchMmifMappingTemplate: jest.fn(),
}));

import MmifMappingEditor from './MmifMappingEditor';
import { fetchMmifEvent, fetchMmifMapping } from '../../services/api';

const mockedFetchEvent = fetchMmifEvent as jest.MockedFunction<typeof fetchMmifEvent>;
const mockedFetchMapping = fetchMmifMapping as jest.MockedFunction<typeof fetchMmifMapping>;

const MOCK_EVENT = {
  eventId: 'MMIF-2026-Q1-002',
  eventType: 'REGULATORY_FILING',
  eventName: 'Q1 2026 CBI Filing — AIF Range',
  regulatoryBody: 'CBI',
  filingPeriod: '2026Q1',
  filingDeadline: '2026-05-15',
  filingFrequency: 'QUARTERLY',
  status: 'DRAFT',
  assignedTeam: [],
  funds: [
    {
      account: 'IE-AIF-PE-001',
      fundName: 'Aria Private Equity AIF',
      fundType: 'AIF',
      fundDomicile: 'IE',
      cbiCode: 'C23456',
      shareClasses: ['I-EUR'],
      status: 'PENDING',
    },
    {
      account: 'IE-HEDGE-001',
      fundName: 'Aria Long/Short Equity Hedge',
      fundType: 'HEDGE',
      fundDomicile: 'IE',
      cbiCode: 'C23457',
      shareClasses: ['A-USD', 'I-USD'],
      status: 'PENDING',
    },
  ],
};

const MOCK_MAPPING = [
  {
    configId: 'MMIF-TPL-AIF',
    eventId: 'MMIF-2026-Q1-002',
    account: 'AIF',
    fundType: 'AIF',
    baseCurrency: 'EUR',
    mappings: [
      {
        eagleGlPattern: '1000*',
        eagleSourceTable: 'dataSubLedgerPosition',
        eagleSourceField: 'posMarketValueBase',
        mmifSection: '3.1',
        mmifField: 'closing_position',
        instrumentType: 1,
        codeType: 1,
        transformation: null,
        signConvention: 1,
        isReported: true,
        notes: 'PE / equity positions',
      },
      {
        eagleGlPattern: '1100*',
        eagleSourceTable: 'dataLedger',
        eagleSourceField: 'endingBalance',
        mmifSection: '3.5',
        mmifField: 'closing_balance',
        instrumentType: null,
        codeType: 4,
        transformation: null,
        signConvention: 1,
        isReported: true,
        notes: 'Cash and deposits',
      },
    ],
    counterpartyEnrichment: {},
    investorClassification: {},
    unmappedAccounts: [],
  },
];

describe('MmifMappingEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchEvent.mockResolvedValue(MOCK_EVENT as any);
    mockedFetchMapping.mockResolvedValue(MOCK_MAPPING);
  });

  it('renders page title with fund type', async () => {
    render(<MmifMappingEditor />);
    await waitFor(() => {
      expect(screen.getByText('AIF Mapping Template')).toBeInTheDocument();
    });
  });

  it('renders fund type metadata', async () => {
    render(<MmifMappingEditor />);
    await waitFor(() => {
      expect(screen.getByText('AIF')).toBeInTheDocument();
      expect(screen.getByText('Applies to 1 fund')).toBeInTheDocument();
    });
  });

  it('shows Reset to Defaults button', async () => {
    render(<MmifMappingEditor />);
    await waitFor(() => {
      expect(screen.getByText('Reset to Defaults')).toBeInTheDocument();
    });
  });

  it('shows mapping rows count', async () => {
    render(<MmifMappingEditor />);
    await waitFor(() => {
      expect(screen.getByText('GL to MMIF Section Mappings (2)')).toBeInTheDocument();
    });
  });

  it('shows Add Row button', async () => {
    render(<MmifMappingEditor />);
    await waitFor(() => {
      expect(screen.getByText('Add Row')).toBeInTheDocument();
    });
  });

  it('shows Save Configuration button', async () => {
    render(<MmifMappingEditor />);
    await waitFor(() => {
      expect(screen.getByText('Save Configuration')).toBeInTheDocument();
    });
  });

  it('shows Cancel button', async () => {
    render(<MmifMappingEditor />);
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('navigates back on Cancel', async () => {
    render(<MmifMappingEditor />);
    await waitFor(() => screen.getByText('Cancel'));

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/mmif/MMIF-2026-Q1-002');
  });

  it('shows empty state when no mappings', async () => {
    mockedFetchMapping.mockResolvedValue([]);
    render(<MmifMappingEditor />);
    await waitFor(() => {
      expect(screen.getByText(/No mappings configured/)).toBeInTheDocument();
    });
  });

  it('opens reset dialog when Reset to Defaults clicked', async () => {
    render(<MmifMappingEditor />);
    await waitFor(() => screen.getByText('Reset to Defaults'));

    fireEvent.click(screen.getByText('Reset to Defaults'));

    await waitFor(() => {
      expect(screen.getByText(/Reset the/)).toBeInTheDocument();
    });
  });

  it('shows counterparty enrichment section', async () => {
    render(<MmifMappingEditor />);
    await waitFor(() => {
      expect(screen.getByText(/Counterparty Enrichment/)).toBeInTheDocument();
    });
  });

  it('shows investor classification section', async () => {
    render(<MmifMappingEditor />);
    await waitFor(() => {
      expect(screen.getByText(/Investor Classification/)).toBeInTheDocument();
    });
  });

  it('shows unmapped accounts section', async () => {
    render(<MmifMappingEditor />);
    await waitFor(() => {
      expect(screen.getByText(/Unmapped Accounts/)).toBeInTheDocument();
    });
  });
});
