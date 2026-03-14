import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Paper,
  LinearProgress,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SpeedIcon from '@mui/icons-material/Speed';
import { MmifAgentAnalysis, MmifPipelineStep } from '../../types';
import MarkdownRenderer from './MarkdownRenderer';

interface MmifAgentPipelineProps {
  analysis: MmifAgentAnalysis | null;
  loading: boolean;
}

// ── Custom Stepper Connector ─────────────────────────────────

const AgentConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 18,
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 3,
    border: 0,
    backgroundColor: theme.palette.divider,
    borderRadius: 1,
  },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    backgroundColor: theme.palette.primary.main,
  },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    backgroundColor: theme.palette.success.main,
  },
}));

// ── Step Icon ─────────────────────────────────────────────────

interface StepIconProps {
  status: MmifPipelineStep['status'];
  findingsCount: number;
}

const AgentStepIcon: React.FC<StepIconProps> = ({ status, findingsCount }) => {
  const theme = useTheme();

  const iconProps = { sx: { fontSize: 32 } };

  switch (status) {
    case 'complete':
      return findingsCount > 0 ? (
        <WarningAmberIcon {...iconProps} sx={{ ...iconProps.sx, color: theme.palette.warning.main }} />
      ) : (
        <CheckCircleIcon {...iconProps} sx={{ ...iconProps.sx, color: theme.palette.success.main }} />
      );
    case 'warning':
      return <WarningAmberIcon {...iconProps} sx={{ ...iconProps.sx, color: theme.palette.warning.main }} />;
    case 'error':
      return <ErrorIcon {...iconProps} sx={{ ...iconProps.sx, color: theme.palette.error.main }} />;
    case 'running':
      return <CircularProgress size={28} thickness={4} />;
    case 'skipped':
      return <SkipNextIcon {...iconProps} sx={{ ...iconProps.sx, color: theme.palette.text.disabled }} />;
    default:
      return <RadioButtonUncheckedIcon {...iconProps} sx={{ ...iconProps.sx, color: theme.palette.text.disabled }} />;
  }
};

// ── Default pipeline steps (used when no analysis data yet) ──

const DEFAULT_STEPS: MmifPipelineStep[] = [
  { name: 'supervisor_init', label: 'Supervisor Init', status: 'pending', findingsCount: 0 },
  { name: 'l0_total_assets', label: 'L0: Total Assets', status: 'pending', findingsCount: 0 },
  { name: 'l1_sections', label: 'L1: Sections', status: 'pending', findingsCount: 0 },
  { name: 'l2_securities', label: 'L2: Securities', status: 'pending', findingsCount: 0 },
  { name: 'l3_movements', label: 'L3: Movements', status: 'pending', findingsCount: 0 },
  { name: 'specialists', label: 'Specialists', status: 'pending', findingsCount: 0 },
  { name: 'attestation', label: 'Attestation', status: 'pending', findingsCount: 0 },
  { name: 'complete', label: 'Complete', status: 'pending', findingsCount: 0 },
];

const statusOrder = ['pending', 'running', 'complete', 'warning', 'error', 'skipped'] as const;

function getActiveStep(steps: MmifPipelineStep[]): number {
  const runningIdx = steps.findIndex((s) => s.status === 'running');
  if (runningIdx !== -1) return runningIdx;
  // Find last completed/warning/error step
  let lastDone = -1;
  steps.forEach((s, i) => {
    if (s.status === 'complete' || s.status === 'warning' || s.status === 'error') lastDone = i;
  });
  return lastDone + 1;
}

function confidenceColor(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

// ── Main Component ────────────────────────────────────────────

const MmifAgentPipeline: React.FC<MmifAgentPipelineProps> = ({ analysis, loading }) => {
  const theme = useTheme();
  const steps = analysis?.pipelineSteps?.length ? analysis.pipelineSteps : DEFAULT_STEPS;
  const activeStep = getActiveStep(steps);

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <SmartToyIcon color="secondary" />
        <Typography variant="subtitle1" fontWeight={700}>
          6-Agent Analysis Pipeline
        </Typography>
        {analysis && (
          <Chip
            label={analysis.phase}
            size="small"
            color={analysis.phase === 'COMPLETE' ? 'success' : 'primary'}
            sx={{ fontWeight: 600, fontSize: '0.7rem', ml: 1 }}
          />
        )}
        {loading && <CircularProgress size={16} sx={{ ml: 1 }} />}
      </Stack>

      {/* Stepper */}
      <Paper variant="outlined" sx={{ p: 3, mb: 2, borderRadius: 2 }}>
        <Stepper
          activeStep={activeStep}
          alternativeLabel
          connector={<AgentConnector />}
        >
          {steps.map((step) => (
            <Step key={step.name} completed={step.status === 'complete' || step.status === 'warning'}>
              <StepLabel
                StepIconComponent={() => (
                  <Tooltip
                    title={
                      <Box>
                        <Typography variant="caption" fontWeight={600}>{step.label}</Typography>
                        <Typography variant="caption" display="block">Status: {step.status}</Typography>
                        {step.findingsCount > 0 && (
                          <Typography variant="caption" display="block">
                            Findings: {step.findingsCount}
                          </Typography>
                        )}
                        {step.duration !== undefined && (
                          <Typography variant="caption" display="block">
                            Duration: {step.duration}ms
                          </Typography>
                        )}
                      </Box>
                    }
                    arrow
                  >
                    <Box sx={{ position: 'relative', display: 'inline-flex', cursor: 'default' }}>
                      <AgentStepIcon status={step.status} findingsCount={step.findingsCount} />
                      {step.findingsCount > 0 && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: -4,
                            right: -8,
                            bgcolor: step.status === 'error' ? 'error.main' : 'warning.main',
                            color: 'white',
                            borderRadius: '50%',
                            width: 18,
                            height: 18,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            lineHeight: 1,
                          }}
                        >
                          {step.findingsCount > 9 ? '9+' : step.findingsCount}
                        </Box>
                      )}
                    </Box>
                  </Tooltip>
                )}
              >
                <Typography
                  variant="caption"
                  fontWeight={step.status === 'running' ? 700 : 400}
                  color={
                    step.status === 'running'
                      ? 'primary'
                      : step.status === 'error'
                      ? 'error'
                      : step.status === 'warning'
                      ? 'warning.main'
                      : step.status === 'complete'
                      ? 'success.main'
                      : 'text.secondary'
                  }
                >
                  {step.label}
                </Typography>
                {step.duration !== undefined && (
                  <Typography variant="caption" color="text.disabled" display="block" sx={{ fontSize: '0.6rem' }}>
                    {step.duration}ms
                  </Typography>
                )}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Confidence Gauge & Root Cause */}
      {analysis && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack spacing={2}>
            {/* Confidence */}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <SpeedIcon fontSize="small" color="primary" />
                <Typography variant="caption" fontWeight={700} textTransform="uppercase">
                  Overall Confidence
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Chip
                  label={`${analysis.overallConfidence}%`}
                  size="small"
                  color={confidenceColor(analysis.overallConfidence)}
                  sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                />
              </Stack>
              <LinearProgress
                variant="determinate"
                value={analysis.overallConfidence}
                color={confidenceColor(analysis.overallConfidence)}
                sx={{ height: 10, borderRadius: 5 }}
              />
            </Box>

            {/* Root Cause Narrative */}
            {analysis.rootCauseNarrative && (
              <Box sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.03), borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <SmartToyIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight={700} textTransform="uppercase" color="primary">
                    AI Analysis Report
                  </Typography>
                </Stack>
                <MarkdownRenderer content={analysis.rootCauseNarrative} />
              </Box>
            )}

            {/* Root Causes Summary */}
            {analysis.rootCauses?.length > 0 && (
              <Box>
                <Typography variant="caption" fontWeight={700} textTransform="uppercase" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Root Causes Identified ({analysis.rootCauses.length})
                </Typography>
                <Stack spacing={1}>
                  {analysis.rootCauses.map((rc, i) => (
                    <Paper
                      key={i}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderColor:
                          rc.confidence >= 80
                            ? theme.palette.success.light
                            : rc.confidence >= 50
                            ? theme.palette.warning.light
                            : theme.palette.error.light,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ flex: 1, pr: 1 }}>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.25 }}>
                            <Chip label={rc.level} size="small" color="info" variant="outlined" sx={{ fontSize: '0.65rem', height: 18 }} />
                            <Typography variant="caption" fontWeight={600}>{rc.agent}</Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {rc.description}
                          </Typography>
                        </Box>
                        <Chip
                          label={`${rc.confidence}%`}
                          size="small"
                          color={confidenceColor(rc.confidence)}
                          sx={{ fontSize: '0.7rem', fontWeight: 700 }}
                        />
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Escalation / Attestation Status */}
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {analysis.shouldEscalate && (
                <Chip
                  icon={<WarningAmberIcon />}
                  label="Escalation Required"
                  size="small"
                  color="error"
                  sx={{ fontWeight: 600 }}
                />
              )}
              {analysis.attestationStatus && (
                <Chip
                  label={`Attestation: ${analysis.attestationStatus}`}
                  size="small"
                  color={analysis.attestationStatus === 'CLEARED' ? 'success' : analysis.attestationStatus === 'BLOCKED' ? 'error' : 'warning'}
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              )}
            </Stack>
          </Stack>
        </Paper>
      )}

      {!analysis && !loading && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <SmartToyIcon sx={{ fontSize: 48, opacity: 0.25, mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No analysis data yet. Click "Run Analysis" to start the 6-agent pipeline.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default MmifAgentPipeline;
