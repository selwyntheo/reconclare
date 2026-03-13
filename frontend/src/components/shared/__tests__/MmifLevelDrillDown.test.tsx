import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import MmifLevelDrillDown from '../MmifLevelDrillDown';
import { MmifAgentAnalysis, MmifAgentFinding } from '../../../types';

const theme = createTheme();

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const makeFinding = (overrides: Partial<MmifAgentFinding> = {}): MmifAgentFinding => ({
  agentName: 'MmifL0_TotalAssets',
  level: 'L0_TOTAL_ASSETS',
  timestamp: '2025-12-01T00:00:00Z',
  description: 'VR-001 Total Assets Tie-Out: variance detected',
  evidence: { eagle_value: 100000000, mmif_value: 99985000, variance: 15000 },
  confidence: 0.95,
  recommendedAction: 'Drill into section subtotals',
  ...overrides,
});

const makeAnalysis = (overrides: Partial<MmifAgentAnalysis> = {}): MmifAgentAnalysis => ({
  eventId: 'EVT-001',
  phase: 'COMPLETED',
  overallConfidence: 85,
  rootCauseNarrative: 'Test narrative',
  l0Findings: [makeFinding()],
  l1Findings: [],
  l2Findings: [],
  l3Findings: [],
  specialistFindings: [],
  rootCauses: [],
  shouldEscalate: false,
  attestationStatus: 'CLEARED',
  pipelineSteps: [],
  ...overrides,
});

describe('MmifLevelDrillDown', () => {
  it('renders title', () => {
    wrap(<MmifLevelDrillDown analysis={makeAnalysis()} />);
    expect(screen.getByText('Multi-Level Reconciliation Drill-Down')).toBeInTheDocument();
  });

  it('renders 4 tabs', () => {
    wrap(<MmifLevelDrillDown analysis={makeAnalysis()} />);
    expect(screen.getByText(/L0: Total Assets/)).toBeInTheDocument();
    expect(screen.getByText(/L1: Section Subtotals/)).toBeInTheDocument();
    expect(screen.getByText(/L2: Security Match/)).toBeInTheDocument();
    expect(screen.getByText(/L3: Movement Recon/)).toBeInTheDocument();
  });

  it('shows L0 findings on initial render', () => {
    wrap(<MmifLevelDrillDown analysis={makeAnalysis()} />);
    expect(screen.getByText(/VR-001 Total Assets Tie-Out/)).toBeInTheDocument();
  });

  it('shows "No issues detected" when findings are empty', () => {
    wrap(<MmifLevelDrillDown analysis={makeAnalysis({ l0Findings: [] })} />);
    expect(screen.getByText(/No issues detected/)).toBeInTheDocument();
  });

  it('shows findings count badge on tab with findings', () => {
    wrap(<MmifLevelDrillDown analysis={makeAnalysis({
      l0Findings: [makeFinding(), makeFinding({ description: 'Second finding' })],
    })} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows agent name in findings table', () => {
    wrap(<MmifLevelDrillDown analysis={makeAnalysis()} />);
    expect(screen.getByText('MmifL0_TotalAssets')).toBeInTheDocument();
  });

  it('shows recommended action', () => {
    wrap(<MmifLevelDrillDown analysis={makeAnalysis()} />);
    expect(screen.getByText('Drill into section subtotals')).toBeInTheDocument();
  });

  it('switches to L1 tab when clicked', () => {
    wrap(<MmifLevelDrillDown analysis={makeAnalysis({
      l1Findings: [makeFinding({
        agentName: 'MmifL1_Section',
        level: 'L1_SECTION_SUBTOTALS',
        description: 'VR-002 Equity Subtotal break',
        evidence: { section: '3.1', eagle_value: 50000, mmif_value: 49000, variance: 1000 },
      })],
    })} />);
    fireEvent.click(screen.getByText(/L1: Section Subtotals/));
    expect(screen.getByText(/VR-002 Equity Subtotal break/)).toBeInTheDocument();
  });

  it('shows evidence data points accordion', () => {
    wrap(<MmifLevelDrillDown analysis={makeAnalysis()} />);
    expect(screen.getByText(/3 data point/)).toBeInTheDocument();
  });

  it('shows table headers for L0', () => {
    wrap(<MmifLevelDrillDown analysis={makeAnalysis()} />);
    expect(screen.getByText('Agent')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Confidence')).toBeInTheDocument();
    expect(screen.getByText('Evidence')).toBeInTheDocument();
    expect(screen.getByText('Recommended Action')).toBeInTheDocument();
  });

  it('shows L1 section columns when on L1 tab', () => {
    wrap(<MmifLevelDrillDown analysis={makeAnalysis({
      l1Findings: [makeFinding({
        agentName: 'MmifL1_Section',
        description: 'Section 3.1 breaking',
        evidence: { section: '3.1', eagle_value: 50000, mmif_value: 49000 },
      })],
    })} />);
    fireEvent.click(screen.getByText(/L1: Section Subtotals/));
    expect(screen.getByText('MMIF Section')).toBeInTheDocument();
  });
});
