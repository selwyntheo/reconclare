import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import MmifAgentPipeline from '../MmifAgentPipeline';
import { MmifAgentAnalysis, MmifPipelineStep } from '../../../types';

const theme = createTheme();

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const mockStep = (overrides: Partial<MmifPipelineStep> = {}): MmifPipelineStep => ({
  name: 'test_step',
  label: 'Test Step',
  status: 'pending',
  findingsCount: 0,
  ...overrides,
});

const mockAnalysis = (overrides: Partial<MmifAgentAnalysis> = {}): MmifAgentAnalysis => ({
  eventId: 'EVT-001',
  phase: 'COMPLETED',
  overallConfidence: 85,
  rootCauseNarrative: 'The break is caused by FX rate inconsistency.',
  l0Findings: [],
  l1Findings: [],
  l2Findings: [],
  l3Findings: [],
  specialistFindings: [],
  rootCauses: [
    { agent: 'MmifL0', level: 'L0_TOTAL_ASSETS', description: 'Total assets variance detected', confidence: 90 },
  ],
  shouldEscalate: false,
  attestationStatus: 'CLEARED',
  pipelineSteps: [
    mockStep({ name: 'supervisor_init', label: 'Supervisor Init', status: 'complete' }),
    mockStep({ name: 'l0_total_assets', label: 'L0: Total Assets', status: 'complete', findingsCount: 2 }),
    mockStep({ name: 'l1_sections', label: 'L1: Sections', status: 'complete' }),
    mockStep({ name: 'l2_securities', label: 'L2: Securities', status: 'complete' }),
    mockStep({ name: 'l3_movements', label: 'L3: Movements', status: 'complete' }),
    mockStep({ name: 'specialists', label: 'Specialists', status: 'complete' }),
    mockStep({ name: 'attestation', label: 'Attestation', status: 'complete' }),
    mockStep({ name: 'complete', label: 'Complete', status: 'complete' }),
  ],
  ...overrides,
});

describe('MmifAgentPipeline', () => {
  it('renders pipeline title', () => {
    wrap(<MmifAgentPipeline analysis={null} loading={false} />);
    expect(screen.getByText('6-Agent Analysis Pipeline')).toBeInTheDocument();
  });

  it('shows empty state when no analysis and not loading', () => {
    wrap(<MmifAgentPipeline analysis={null} loading={false} />);
    expect(screen.getByText(/No analysis data yet/)).toBeInTheDocument();
  });

  it('shows loading spinner when loading', () => {
    wrap(<MmifAgentPipeline analysis={null} loading={true} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows phase chip when analysis provided', () => {
    wrap(<MmifAgentPipeline analysis={mockAnalysis()} loading={false} />);
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
  });

  it('shows confidence percentage', () => {
    wrap(<MmifAgentPipeline analysis={mockAnalysis({ overallConfidence: 85 })} loading={false} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('shows root cause narrative', () => {
    wrap(<MmifAgentPipeline analysis={mockAnalysis()} loading={false} />);
    expect(screen.getByText('AI Analysis Report')).toBeInTheDocument();
    expect(screen.getByText(/FX rate inconsistency/)).toBeInTheDocument();
  });

  it('shows root causes with confidence', () => {
    wrap(<MmifAgentPipeline analysis={mockAnalysis()} loading={false} />);
    expect(screen.getByText(/Root Causes Identified/)).toBeInTheDocument();
    expect(screen.getByText(/Total assets variance detected/)).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('shows escalation chip when shouldEscalate is true', () => {
    wrap(<MmifAgentPipeline analysis={mockAnalysis({ shouldEscalate: true })} loading={false} />);
    expect(screen.getByText('Escalation Required')).toBeInTheDocument();
  });

  it('does not show escalation chip when shouldEscalate is false', () => {
    wrap(<MmifAgentPipeline analysis={mockAnalysis({ shouldEscalate: false })} loading={false} />);
    expect(screen.queryByText('Escalation Required')).not.toBeInTheDocument();
  });

  it('shows attestation status', () => {
    wrap(<MmifAgentPipeline analysis={mockAnalysis({ attestationStatus: 'CLEARED' })} loading={false} />);
    expect(screen.getByText('Attestation: CLEARED')).toBeInTheDocument();
  });

  it('shows blocked attestation status', () => {
    wrap(<MmifAgentPipeline analysis={mockAnalysis({ attestationStatus: 'BLOCKED' })} loading={false} />);
    expect(screen.getByText('Attestation: BLOCKED')).toBeInTheDocument();
  });

  it('shows pipeline step labels', () => {
    wrap(<MmifAgentPipeline analysis={mockAnalysis()} loading={false} />);
    expect(screen.getByText('Supervisor Init')).toBeInTheDocument();
    expect(screen.getByText('L0: Total Assets')).toBeInTheDocument();
    expect(screen.getByText('L1: Sections')).toBeInTheDocument();
    expect(screen.getByText('Attestation')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('shows default 8 steps when analysis has empty pipelineSteps', () => {
    wrap(<MmifAgentPipeline analysis={mockAnalysis({ pipelineSteps: [] })} loading={false} />);
    // Default steps show
    expect(screen.getByText('Supervisor Init')).toBeInTheDocument();
  });

  it('shows Overall Confidence label', () => {
    wrap(<MmifAgentPipeline analysis={mockAnalysis()} loading={false} />);
    expect(screen.getByText('Overall Confidence')).toBeInTheDocument();
  });
});
