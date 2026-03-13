import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  alpha,
  useTheme,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { MmifAgentAnalysis, MmifAgentFinding } from '../../types';

interface MmifLevelDrillDownProps {
  analysis: MmifAgentAnalysis;
}

// ── Helpers ───────────────────────────────────────────────────

function confidenceChip(score: number) {
  const color = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error';
  return (
    <Chip
      label={`${Math.round(score * 100)}%`}
      size="small"
      color={color}
      sx={{ fontWeight: 700, fontSize: '0.7rem' }}
    />
  );
}

function formatEvidenceValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') {
    if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(3)}M`;
    if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(2)}K`;
    return val.toFixed(4);
  }
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

// ── Evidence accordion cell ───────────────────────────────────

const EvidenceCell: React.FC<{ evidence: Record<string, any> }> = ({ evidence }) => {
  const entries = Object.entries(evidence);
  if (entries.length === 0) return <Typography variant="caption" color="text.disabled">No evidence</Typography>;
  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{ border: 'none', '&:before': { display: 'none' }, bgcolor: 'transparent', maxWidth: 320 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ p: 0, minHeight: 28, '& .MuiAccordionSummary-content': { m: 0 } }}>
        <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
          {entries.length} data point{entries.length !== 1 ? 's' : ''}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0.5 }}>
        <Stack spacing={0.25}>
          {entries.map(([k, v]) => (
            <Stack key={k} direction="row" spacing={1} alignItems="flex-start">
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100, fontWeight: 500 }}>
                {k.replace(/_/g, ' ')}:
              </Typography>
              <Typography variant="caption" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                {formatEvidenceValue(v)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};

// ── Generic findings table ────────────────────────────────────

const FindingsTable: React.FC<{ findings: MmifAgentFinding[] }> = ({ findings }) => {
  const theme = useTheme();
  if (findings.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
          <CheckCircleIcon color="success" />
          <Typography variant="body2" color="success.main" fontWeight={600}>
            No issues detected at this level
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, width: 120 }}>Agent</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 90 }} align="center">Confidence</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 200 }}>Evidence</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Recommended Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {findings.map((f, i) => (
            <TableRow
              key={i}
              sx={{
                bgcolor:
                  f.confidence < 0.5
                    ? alpha(theme.palette.error.main, 0.03)
                    : f.confidence < 0.8
                    ? alpha(theme.palette.warning.main, 0.03)
                    : 'transparent',
              }}
            >
              <TableCell>
                <Typography variant="caption" fontWeight={600} fontFamily="monospace">
                  {f.agentName}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">{f.description}</Typography>
              </TableCell>
              <TableCell align="center">{confidenceChip(f.confidence)}</TableCell>
              <TableCell>
                <EvidenceCell evidence={f.evidence} />
              </TableCell>
              <TableCell>
                <Typography variant="caption" color="text.secondary">
                  {f.recommendedAction}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ── L1 Section table (with MMIF section badges) ───────────────

const L1SectionTable: React.FC<{ findings: MmifAgentFinding[] }> = ({ findings }) => {
  const theme = useTheme();
  if (findings.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
          <CheckCircleIcon color="success" />
          <Typography variant="body2" color="success.main" fontWeight={600}>
            No issues detected at this level
          </Typography>
        </Stack>
      </Box>
    );
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, width: 140 }}>MMIF Section</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 110 }} align="right">Eagle (LHS)</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 110 }} align="right">MMIF (RHS)</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 110 }} align="right">Variance</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 90 }} align="center">Confidence</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Recommended Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {findings.map((f, i) => {
            const section = f.evidence['section'] || f.agentName;
            const eagleVal = f.evidence['eagle_value'] ?? f.evidence['lhs_value'];
            const mmifVal = f.evidence['mmif_value'] ?? f.evidence['rhs_value'];
            const variance = f.evidence['variance'];
            return (
              <TableRow
                key={i}
                sx={{ bgcolor: variance ? alpha(theme.palette.error.main, 0.03) : 'transparent' }}
              >
                <TableCell>
                  <Chip
                    label={section}
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', fontWeight: 600, height: 22 }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{f.description}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace">
                    {eagleVal !== undefined ? formatEvidenceValue(eagleVal) : '—'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace">
                    {mmifVal !== undefined ? formatEvidenceValue(mmifVal) : '—'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" color="error" fontWeight={600}>
                    {variance !== undefined ? formatEvidenceValue(variance) : '—'}
                  </Typography>
                </TableCell>
                <TableCell align="center">{confidenceChip(f.confidence)}</TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {f.recommendedAction}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ── L2 Security table (ISIN / Eagle / MMIF / Variance) ───────

const L2SecurityTable: React.FC<{ findings: MmifAgentFinding[] }> = ({ findings }) => {
  const theme = useTheme();
  if (findings.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
          <CheckCircleIcon color="success" />
          <Typography variant="body2" color="success.main" fontWeight={600}>
            No issues detected at this level
          </Typography>
        </Stack>
      </Box>
    );
  }
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, width: 140 }}>ISIN / ID</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 110 }} align="right">Eagle Value</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 110 }} align="right">MMIF Value</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 110 }} align="right">Variance</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 90 }} align="center">Confidence</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {findings.map((f, i) => {
            const isin = f.evidence['isin'] || f.evidence['security_id'] || '—';
            const eagleVal = f.evidence['eagle_value'] ?? f.evidence['lhs_value'];
            const mmifVal = f.evidence['mmif_value'] ?? f.evidence['rhs_value'];
            const variance = f.evidence['variance'];
            return (
              <TableRow
                key={i}
                sx={{ bgcolor: variance ? alpha(theme.palette.error.main, 0.03) : 'transparent' }}
              >
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace" fontWeight={600} fontSize="0.75rem">
                    {isin}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{f.description}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace">
                    {eagleVal !== undefined ? formatEvidenceValue(eagleVal) : '—'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace">
                    {mmifVal !== undefined ? formatEvidenceValue(mmifVal) : '—'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontFamily="monospace" color="error" fontWeight={600}>
                    {variance !== undefined ? formatEvidenceValue(variance) : '—'}
                  </Typography>
                </TableCell>
                <TableCell align="center">{confidenceChip(f.confidence)}</TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {f.recommendedAction}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ── L3 Movements table (balance identity check) ───────────────

const L3MovementsTable: React.FC<{ findings: MmifAgentFinding[] }> = ({ findings }) => {
  const theme = useTheme();
  if (findings.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
          <CheckCircleIcon color="success" />
          <Typography variant="body2" color="success.main" fontWeight={600}>
            No issues detected at this level
          </Typography>
        </Stack>
      </Box>
    );
  }

  // Balance identity: Opening + Purchases - Sales + Valuation Changes = Closing
  return (
    <Box>
      <Box sx={{ px: 1, py: 1.5, mb: 1 }}>
        <Typography variant="caption" color="text.secondary" fontStyle="italic">
          Balance Identity Check: Opening + Purchases − Sales + Valuation Changes = Closing NAV
        </Typography>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100 }} align="right">Opening</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100 }} align="right">Purchases</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100 }} align="right">Sales</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100 }} align="right">Valuation</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 100 }} align="right">Closing</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 90 }} align="center">Confidence</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {findings.map((f, i) => {
              const opening = f.evidence['opening_balance'] ?? f.evidence['opening'];
              const purchases = f.evidence['purchases'];
              const sales = f.evidence['sales'] ?? f.evidence['redemptions'];
              const valuation = f.evidence['valuation_change'] ?? f.evidence['unrealised'];
              const closing = f.evidence['closing_balance'] ?? f.evidence['closing'];
              return (
                <TableRow
                  key={i}
                  sx={{ bgcolor: alpha(theme.palette.error.main, 0.03) }}
                >
                  <TableCell>
                    <Typography variant="body2">{f.description}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontFamily="monospace">
                      {opening !== undefined ? formatEvidenceValue(opening) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontFamily="monospace" color="success.main">
                      {purchases !== undefined ? formatEvidenceValue(purchases) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontFamily="monospace" color="error">
                      {sales !== undefined ? formatEvidenceValue(sales) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontFamily="monospace">
                      {valuation !== undefined ? formatEvidenceValue(valuation) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                      {closing !== undefined ? formatEvidenceValue(closing) : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">{confidenceChip(f.confidence)}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {f.recommendedAction}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

// ── Main Component ────────────────────────────────────────────

const MmifLevelDrillDown: React.FC<MmifLevelDrillDownProps> = ({ analysis }) => {
  const [activeTab, setActiveTab] = useState(0);

  const tabFindingCounts = [
    analysis.l0Findings?.length ?? 0,
    analysis.l1Findings?.length ?? 0,
    analysis.l2Findings?.length ?? 0,
    analysis.l3Findings?.length ?? 0,
  ];

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
        Multi-Level Reconciliation Drill-Down
      </Typography>

      <Paper sx={{ borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          {['L0: Total Assets', 'L1: Section Subtotals', 'L2: Security Match', 'L3: Movement Recon'].map(
            (label, i) => (
              <Tab
                key={label}
                label={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <span>{label}</span>
                    {tabFindingCounts[i] > 0 && (
                      <Chip
                        label={tabFindingCounts[i]}
                        size="small"
                        color="error"
                        sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                      />
                    )}
                  </Stack>
                }
              />
            )
          )}
        </Tabs>

        <Box sx={{ p: 2 }}>
          {activeTab === 0 && <FindingsTable findings={analysis.l0Findings ?? []} />}
          {activeTab === 1 && <L1SectionTable findings={analysis.l1Findings ?? []} />}
          {activeTab === 2 && <L2SecurityTable findings={analysis.l2Findings ?? []} />}
          {activeTab === 3 && <L3MovementsTable findings={analysis.l3Findings ?? []} />}
        </Box>
      </Paper>
    </Box>
  );
};

export default MmifLevelDrillDown;
