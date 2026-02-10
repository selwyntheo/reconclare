/**
 * MappingControls - Toolbar with Save, Discard, Undo, Redo, Export actions.
 */

import React from 'react';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Typography,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { UndoRedoState } from './hooks';

interface MappingControlsProps {
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  undoRedoState: UndoRedoState;
  onSave: () => void;
  onDiscard: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onValidate: () => void;
  pendingChangesCount: number;
}

const MappingControls: React.FC<MappingControlsProps> = ({
  hasUnsavedChanges,
  isSaving,
  undoRedoState,
  onSave,
  onDiscard,
  onUndo,
  onRedo,
  onExport,
  onValidate,
  pendingChangesCount,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        bgcolor: alpha(theme.palette.primary.main, 0.02),
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Save / Discard Group */}
      <Button
        variant="contained"
        size="small"
        startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
        onClick={onSave}
        disabled={!hasUnsavedChanges || isSaving}
        sx={{ minWidth: 100 }}
      >
        {isSaving ? 'Saving...' : 'Save'}
      </Button>

      <Button
        variant="outlined"
        size="small"
        startIcon={<DeleteIcon />}
        onClick={onDiscard}
        disabled={!hasUnsavedChanges || isSaving}
        color="error"
      >
        Discard
      </Button>

      {hasUnsavedChanges && (
        <Typography
          variant="caption"
          sx={{
            color: 'warning.main',
            ml: 1,
          }}
        >
          {pendingChangesCount} unsaved change{pendingChangesCount !== 1 ? 's' : ''}
        </Typography>
      )}

      <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

      {/* Undo / Redo */}
      <Tooltip title="Undo (Ctrl+Z)">
        <span>
          <IconButton
            size="small"
            onClick={onUndo}
            disabled={!undoRedoState.canUndo}
          >
            <UndoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title="Redo (Ctrl+Y)">
        <span>
          <IconButton
            size="small"
            onClick={onRedo}
            disabled={!undoRedoState.canRedo}
          >
            <RedoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

      {/* Validate */}
      <Tooltip title="Validate all mappings">
        <Button
          variant="outlined"
          size="small"
          startIcon={<CheckCircleIcon />}
          onClick={onValidate}
        >
          Validate
        </Button>
      </Tooltip>

      {/* Export */}
      <Tooltip title="Export mappings to CSV">
        <IconButton size="small" onClick={onExport}>
          <FileDownloadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default MappingControls;
