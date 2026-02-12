import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Paper,
  Divider,
  Stack,
  Chip,
  LinearProgress,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PatternIcon from '@mui/icons-material/Hub';
import SpeedIcon from '@mui/icons-material/Speed';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { AICommentaryData, SimilarBreak } from '../../types';

interface AICommentaryPanelProps {
  analysis: AICommentaryData | null;
  loading: boolean;
  level: 'nav' | 'trial-balance' | 'position';
  onRequestAnalysis?: () => void;
}

const DEFAULT_WIDTH = 350;
const COLLAPSED_WIDTH = 40;

export const AICommentaryPanel: React.FC<AICommentaryPanelProps> = ({
  analysis,
  loading,
  level,
  onRequestAnalysis,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const width = collapsed ? COLLAPSED_WIDTH : DEFAULT_WIDTH;

  const confidenceColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 50) return 'warning';
    return 'error';
  };

  return (
    <Paper
      sx={{
        width,
        minWidth: width,
        maxWidth: width,
        transition: 'width 0.2s ease',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid',
        borderColor: 'divider',
      }}
      elevation={0}
      square
      role="complementary"
      aria-label="AI Analysis Panel"
    >
      {/* Toggle Button */}
      <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'space-between', alignItems: 'center', p: 1 }}>
        {!collapsed && (
          <Stack direction="row" spacing={1} alignItems="center">
            <SmartToyIcon fontSize="small" color="secondary" />
            <Typography variant="subtitle2" fontWeight={700}>
              AI Analysis
            </Typography>
          </Stack>
        )}
        <IconButton size="small" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand AI panel' : 'Collapse AI panel'}>
          {collapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      {collapsed && (
        <Box sx={{ writingMode: 'vertical-rl', textOrientation: 'mixed', p: 1, opacity: 0.6 }}>
          <Typography variant="caption">AI Analysis</Typography>
        </Box>
      )}

      {!collapsed && (
        <Box sx={{ flex: 1, overflow: 'auto', px: 2, pb: 2 }}>
          {loading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Analyzing...
              </Typography>
            </Box>
          )}

          {!loading && !analysis && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <SmartToyIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Select an item to view AI analysis
              </Typography>
              {onRequestAnalysis && (
                <Chip
                  label="Request Analysis"
                  size="small"
                  color="secondary"
                  onClick={onRequestAnalysis}
                  sx={{ mt: 2 }}
                />
              )}
            </Box>
          )}

          {!loading && analysis && (
            <Stack spacing={2}>
              {/* Trend Summary */}
              <Box>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                  <TrendingUpIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight={700} textTransform="uppercase">
                    Trend Summary
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  {analysis.trendSummary}
                </Typography>
              </Box>

              <Divider />

              {/* Root Cause (position level) */}
              {level === 'position' && analysis.rootCauseSummary && (
                <>
                  <Box>
                    <Typography variant="caption" fontWeight={700} textTransform="uppercase" sx={{ mb: 0.5, display: 'block' }}>
                      Root Cause
                    </Typography>
                    <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                      {analysis.rootCauseSummary}
                    </Typography>
                  </Box>
                  <Divider />
                </>
              )}

              {/* Confidence Score */}
              <Box>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                  <SpeedIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight={700} textTransform="uppercase">
                    Confidence
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={analysis.confidenceScore}
                      color={confidenceColor(analysis.confidenceScore) as any}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                  <Typography variant="body2" fontWeight={700}>
                    {analysis.confidenceScore}%
                  </Typography>
                </Stack>
              </Box>

              <Divider />

              {/* Pattern Recognition */}
              {analysis.patternRecognition.length > 0 && (
                <>
                  <Box>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                      <PatternIcon fontSize="small" color="primary" />
                      <Typography variant="caption" fontWeight={700} textTransform="uppercase">
                        Similar Patterns
                      </Typography>
                    </Stack>
                    <List dense disablePadding>
                      {analysis.patternRecognition.slice(0, 3).map((item: SimilarBreak, i: number) => (
                        <ListItem key={i} disablePadding sx={{ py: 0.25 }}>
                          <ListItemText
                            primary={item.fundName}
                            secondary={`${item.date} · Variance: $${item.variance.toLocaleString()}`}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                  <Divider />
                </>
              )}

              {/* Recommended Next Step */}
              <Box>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                  <NavigateNextIcon fontSize="small" color="primary" />
                  <Typography variant="caption" fontWeight={700} textTransform="uppercase">
                    Recommended Next Step
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  {analysis.recommendedNextStep}
                </Typography>
              </Box>

              {/* Evidence Chain (position level) */}
              {level === 'position' && analysis.evidenceChain && analysis.evidenceChain.length > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" fontWeight={700} textTransform="uppercase" sx={{ mb: 0.5, display: 'block' }}>
                      Evidence Chain
                    </Typography>
                    <List dense disablePadding>
                      {analysis.evidenceChain.map((step) => (
                        <ListItem key={step.stepNumber} disablePadding sx={{ py: 0.25 }}>
                          <ListItemText
                            primary={`${step.stepNumber}. ${step.description}`}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </>
              )}
            </Stack>
          )}
        </Box>
      )}
    </Paper>
  );
};

export default AICommentaryPanel;
