/**
 * MappingSidebar - Details panel for selected mapping.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { GLAccountMapping, MappingType } from '../../types/glMapping';
import SplitWeightEditor from './SplitWeightEditor';

interface MappingSidebarProps {
  mapping: GLAccountMapping;
  relatedMappings: GLAccountMapping[];
  onClose: () => void;
  onDelete: (mappingId: string) => void;
  onUpdateWeight: (mappingId: string, weight: number) => void;
}

const MappingSidebar: React.FC<MappingSidebarProps> = ({
  mapping,
  relatedMappings,
  onClose,
  onDelete,
  onUpdateWeight,
}) => {
  const theme = useTheme();
  const [showWeightEditor, setShowWeightEditor] = useState(false);

  const getMappingTypeLabel = (type: MappingType) => {
    switch (type) {
      case 'ONE_TO_ONE':
        return { label: '1:1', color: theme.palette.success.main };
      case 'ONE_TO_MANY':
        return { label: '1:N', color: '#0288D1' };
      case 'MANY_TO_ONE':
        return { label: 'N:1', color: '#4A90D9' };
      default:
        return { label: 'Unknown', color: theme.palette.grey[500] };
    }
  };

  const typeInfo = getMappingTypeLabel(mapping.mappingType);

  const handleDelete = () => {
    onDelete(mapping.mappingId);
    onClose();
  };

  return (
    <Box
      sx={{
        width: 320,
        height: '100%',
        bgcolor: 'background.paper',
        borderLeft: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Mapping Details
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* Mapping Type */}
        <Box sx={{ mb: 3 }}>
          <Chip
            label={typeInfo.label}
            size="small"
            sx={{
              bgcolor: alpha(typeInfo.color, 0.1),
              color: typeInfo.color,
              fontWeight: 600,
            }}
          />
          <Chip
            label={mapping.status}
            size="small"
            sx={{
              ml: 1,
              bgcolor: alpha(
                mapping.status === 'ACTIVE'
                  ? theme.palette.success.main
                  : theme.palette.grey[500],
                0.1
              ),
              color:
                mapping.status === 'ACTIVE'
                  ? theme.palette.success.main
                  : theme.palette.grey[600],
            }}
          />
        </Box>

        {/* Source Account */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="overline" color="text.secondary">
            Source (Incumbent)
          </Typography>
          <Box
            sx={{
              mt: 1,
              p: 1.5,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.02),
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontFamily: 'monospace', fontWeight: 600 }}
            >
              {mapping.sourceGlAccountNumber}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mapping.sourceGlAccountDescription}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              {mapping.sourceLedgerSection} | {mapping.sourceProvider}
            </Typography>
          </Box>
        </Box>

        {/* Arrow */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: 2,
            color: typeInfo.color,
          }}
        >
          <ArrowForwardIcon />
        </Box>

        {/* Target Account */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="overline" color="text.secondary">
            Target (Eagle)
          </Typography>
          <Box
            sx={{
              mt: 1,
              p: 1.5,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.02),
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontFamily: 'monospace', fontWeight: 600 }}
            >
              {mapping.targetGlAccountNumber}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mapping.targetGlAccountDescription}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              {mapping.targetLedgerSection}
            </Typography>
          </Box>
        </Box>

        {/* Split Weight (for 1:N mappings) */}
        {mapping.mappingType === 'ONE_TO_MANY' && (
          <Box sx={{ mb: 3 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="overline" color="text.secondary">
                Split Weight
              </Typography>
              <IconButton
                size="small"
                onClick={() => setShowWeightEditor(!showWeightEditor)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Box>
            <Typography
              variant="h5"
              sx={{ mt: 1, fontWeight: 600, color: typeInfo.color }}
            >
              {(mapping.splitWeight * 100).toFixed(1)}%
            </Typography>
          </Box>
        )}

        {/* Weight Editor */}
        {showWeightEditor && relatedMappings.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <SplitWeightEditor
              mappings={relatedMappings}
              onUpdate={onUpdateWeight}
              onClose={() => setShowWeightEditor(false)}
            />
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Metadata */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Metadata
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Mapping ID: {mapping.mappingId}
            </Typography>
            {mapping.effectiveDate && (
              <Typography variant="caption" color="text.secondary" display="block">
                Effective Date: {mapping.effectiveDate}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" display="block">
              Created By: {mapping.createdBy}
            </Typography>
            {mapping.createdAt && (
              <Typography variant="caption" color="text.secondary" display="block">
                Created: {new Date(mapping.createdAt).toLocaleDateString()}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Related Mappings (for N:1 or 1:N) */}
        {relatedMappings.length > 1 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="overline" color="text.secondary">
              Related Mappings ({relatedMappings.length})
            </Typography>
            <Box sx={{ mt: 1 }}>
              {relatedMappings
                .filter((m) => m.mappingId !== mapping.mappingId)
                .map((m) => (
                  <Box
                    key={m.mappingId}
                    sx={{
                      p: 1,
                      mb: 0.5,
                      borderRadius: 0.5,
                      bgcolor: alpha(theme.palette.grey[500], 0.05),
                      fontSize: '0.75rem',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {m.sourceGlAccountNumber} → {m.targetGlAccountNumber}
                    </Typography>
                    {m.mappingType === 'ONE_TO_MANY' && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        ({(m.splitWeight * 100).toFixed(0)}%)
                      </Typography>
                    )}
                  </Box>
                ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Footer Actions */}
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Button
          fullWidth
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={handleDelete}
        >
          Delete Mapping
        </Button>
      </Box>
    </Box>
  );
};

export default MappingSidebar;
