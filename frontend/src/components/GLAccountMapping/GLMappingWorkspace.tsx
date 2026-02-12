/**
 * GLMappingWorkspace - Main workspace container with DndContext.
 * Orchestrates drag-and-drop mapping between Incumbent and Eagle columns.
 */

import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  useTheme,
  SelectChangeEvent,
} from '@mui/material';
import {
  GLAccountMapping,
  MappingChange,
  DropResult,
  MappingType,
} from '../../types/glMapping';
import {
  useMappingState,
  useUndoRedo,
  useDragAndDrop,
  useConnectionLines,
} from './hooks';
import AccountColumn from './AccountColumn';
import AccountCard from './AccountCard';
import MappingCanvas from './MappingCanvas';
import MappingControls from './MappingControls';
import MappingSidebar from './MappingSidebar';
import {
  fetchIncumbentAccounts,
  fetchEagleAccounts,
  fetchGLMappings,
  createGLMapping,
  updateGLMapping,
  deleteGLMapping,
  validateMappings,
} from '../../services/glMappingApi';

interface GLMappingWorkspaceProps {
  eventId: string;
  eventName: string;
  defaultProvider?: string;
}

const PROVIDERS = [
  { value: 'STATE_STREET', label: 'State Street' },
  { value: 'NORTHERN_TRUST', label: 'Northern Trust' },
  { value: 'BNP_PARIBAS', label: 'BNP Paribas' },
  { value: 'JP_MORGAN', label: 'JP Morgan' },
];

const GLMappingWorkspace: React.FC<GLMappingWorkspaceProps> = ({
  eventId,
  eventName,
  defaultProvider = 'STATE_STREET',
}) => {
  const theme = useTheme();
  const incumbentColumnRef = useRef<HTMLDivElement>(null);
  const eagleColumnRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<SVGSVGElement>(null);

  const [selectedProvider, setSelectedProvider] = React.useState(defaultProvider);
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });

  // State management
  const {
    state,
    filteredIncumbentAccounts,
    filteredEagleAccounts,
    mappedIncumbentAccounts,
    mappedEagleAccounts,
    hasUnsavedChanges,
    setLoading,
    setSaving,
    setError,
    setIncumbentAccounts,
    setEagleAccounts,
    setMappings,
    addMapping,
    updateMapping,
    deleteMapping,
    addPendingChange,
    clearPendingChanges,
    selectIncumbentAccount,
    selectEagleAccount,
    selectMapping,
    clearSelection,
    setFilter,
    setSelectedMappingDetails,
  } = useMappingState();

  // Undo/redo
  const [undoRedoState, undoRedoActions] = useUndoRedo();

  // Connection lines
  const { lines, updateLines } = useConnectionLines({
    mappings: state.mappings,
    selectedMappingId: state.selection.selectedMappingId,
    incumbentColumnRef,
    eagleColumnRef,
    canvasRef,
  });

  // Get mapping type for an account
  const getIncumbentMappingType = useCallback(
    (accountNumber: string): MappingType | undefined => {
      const mappings = state.mappings.filter(
        (m) => m.sourceGlAccountNumber === accountNumber
      );
      if (mappings.length === 0) return undefined;
      if (mappings.length > 1) return 'ONE_TO_MANY';
      return mappings[0].mappingType as MappingType;
    },
    [state.mappings]
  );

  const getEagleMappingType = useCallback(
    (accountNumber: string): MappingType | undefined => {
      const mappings = state.mappings.filter(
        (m) => m.targetGlAccountNumber === accountNumber
      );
      if (mappings.length === 0) return undefined;
      if (mappings.length > 1) return 'MANY_TO_ONE';
      return mappings[0].mappingType as MappingType;
    },
    [state.mappings]
  );

  // Handle drop to create mapping
  const handleDrop = useCallback(
    async (result: DropResult) => {
      const { sourceAccountNumber, targetAccountNumber } = result;

      // Check if mapping already exists
      const existingMapping = state.mappings.find(
        (m) =>
          m.sourceGlAccountNumber === sourceAccountNumber &&
          m.targetGlAccountNumber === targetAccountNumber
      );
      if (existingMapping) {
        setSnackbar({
          open: true,
          message: 'This mapping already exists',
          severity: 'warning',
        });
        return;
      }

      // Determine mapping type
      const existingSourceMappings = state.mappings.filter(
        (m) => m.sourceGlAccountNumber === sourceAccountNumber
      );
      const existingTargetMappings = state.mappings.filter(
        (m) => m.targetGlAccountNumber === targetAccountNumber
      );

      let mappingType: MappingType = 'ONE_TO_ONE';
      let groupId: string | undefined;

      if (existingSourceMappings.length > 0) {
        // Adding another target to existing source -> 1:N
        mappingType = 'ONE_TO_MANY';
        groupId = existingSourceMappings[0].groupId || `GRP-${Date.now()}`;

        // Update existing mappings to be 1:N and recalculate weights
        const totalMappings = existingSourceMappings.length + 1;
        const newWeight = 1 / totalMappings;

        for (const m of existingSourceMappings) {
          updateMapping(m.mappingId, {
            mappingType: 'ONE_TO_MANY',
            splitWeight: newWeight,
            groupId,
          });
        }
      } else if (existingTargetMappings.length > 0) {
        // Adding another source to existing target -> N:1
        mappingType = 'MANY_TO_ONE';
        groupId = existingTargetMappings[0].groupId || `GRP-${Date.now()}`;

        // Update existing mappings to be N:1
        for (const m of existingTargetMappings) {
          updateMapping(m.mappingId, { mappingType: 'MANY_TO_ONE', groupId });
        }
      }

      // Create new mapping (local for now, will be saved on Save)
      const newMappingId = `MAP-LOCAL-${Date.now()}`;
      const sourceAccount = state.incumbentAccounts.find(
        (a) => a.glAccountNumber === sourceAccountNumber
      );
      const targetAccount = state.eagleAccounts.find(
        (a) => a.glAccountNumber === targetAccountNumber
      );

      if (!sourceAccount || !targetAccount) return;

      const splitWeight =
        mappingType === 'ONE_TO_MANY'
          ? 1 / (existingSourceMappings.length + 1)
          : 1.0;

      const newMapping: GLAccountMapping = {
        mappingId: newMappingId,
        eventId,
        sourceProvider: selectedProvider,
        sourceGlAccountNumber: sourceAccountNumber,
        sourceGlAccountDescription: sourceAccount.glAccountDescription,
        sourceLedgerSection: sourceAccount.ledgerSection,
        targetGlAccountNumber: targetAccountNumber,
        targetGlAccountDescription: targetAccount.glAccountDescription,
        targetLedgerSection: targetAccount.ledgerSection,
        mappingType,
        splitWeight,
        groupId,
        status: 'DRAFT',
        createdBy: 'u1',
        createdAt: new Date().toISOString(),
      };

      addMapping(newMapping);

      // Record change for undo/redo
      const change: MappingChange = {
        id: `change-${Date.now()}`,
        type: 'CREATE',
        mapping: newMapping,
        timestamp: Date.now(),
      };
      addPendingChange(change);
      undoRedoActions.recordChange(change);

      clearSelection();
      updateLines();

      setSnackbar({
        open: true,
        message: `Mapping created: ${sourceAccountNumber} → ${targetAccountNumber}`,
        severity: 'success',
      });
    },
    [
      state.mappings,
      state.incumbentAccounts,
      state.eagleAccounts,
      eventId,
      selectedProvider,
      addMapping,
      updateMapping,
      addPendingChange,
      undoRedoActions,
      clearSelection,
      updateLines,
    ]
  );

  // Drag and drop
  const {
    dragState,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    getActiveItem,
  } = useDragAndDrop({
    onDrop: handleDrop,
    incumbentAccounts: state.incumbentAccounts,
    eagleAccounts: state.eagleAccounts,
  });

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [incumbent, eagle, mappings] = await Promise.all([
          fetchIncumbentAccounts(selectedProvider),
          fetchEagleAccounts(),
          fetchGLMappings(eventId),
        ]);

        setIncumbentAccounts(incumbent);
        setEagleAccounts(eagle);
        setMappings(mappings);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [eventId, selectedProvider, setLoading, setError, setIncumbentAccounts, setEagleAccounts, setMappings]);

  // Handle save
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Process pending changes
      for (const change of state.pendingChanges) {
        if (change.type === 'CREATE') {
          const mapping = change.mapping as GLAccountMapping;
          if (mapping.mappingId.startsWith('MAP-LOCAL-')) {
            // Create on server
            await createGLMapping(eventId, {
              eventId,
              sourceProvider: selectedProvider,
              sourceGlAccountNumber: mapping.sourceGlAccountNumber,
              targetGlAccountNumber: mapping.targetGlAccountNumber,
              mappingType: mapping.mappingType,
              splitWeight: mapping.splitWeight,
              groupId: mapping.groupId,
            });
          }
        } else if (change.type === 'UPDATE') {
          const mapping = change.mapping as GLAccountMapping;
          await updateGLMapping(mapping.mappingId, {
            mappingType: mapping.mappingType,
            splitWeight: mapping.splitWeight,
            groupId: mapping.groupId,
            status: mapping.status,
          });
        } else if (change.type === 'DELETE') {
          const mapping = change.mapping as GLAccountMapping;
          await deleteGLMapping(mapping.mappingId);
        }
      }

      // Reload mappings
      const mappings = await fetchGLMappings(eventId);
      setMappings(mappings);
      clearPendingChanges();
      undoRedoActions.clear();

      setSnackbar({
        open: true,
        message: 'Mappings saved successfully',
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to save',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  }, [state.pendingChanges, eventId, selectedProvider, setMappings, clearPendingChanges, undoRedoActions, setSnackbar, setSaving]);

  // Handle discard
  const handleDiscard = async () => {
    const mappings = await fetchGLMappings(eventId);
    setMappings(mappings);
    clearPendingChanges();
    undoRedoActions.clear();
    setSnackbar({
      open: true,
      message: 'Changes discarded',
      severity: 'info',
    });
  };

  // Handle undo
  const handleUndo = useCallback(() => {
    const changes = undoRedoActions.undo();
    if (changes) {
      // Apply inverse changes
      for (const change of changes) {
        if (change.type === 'CREATE') {
          // Undo create = add back
          addMapping(change.mapping as GLAccountMapping);
        } else if (change.type === 'DELETE') {
          // Undo delete = delete
          deleteMapping((change.mapping as GLAccountMapping).mappingId);
        }
      }
      updateLines();
    }
  }, [undoRedoActions, addMapping, deleteMapping, updateLines]);

  // Handle redo
  const handleRedo = useCallback(() => {
    const changes = undoRedoActions.redo();
    if (changes) {
      for (const change of changes) {
        if (change.type === 'CREATE') {
          addMapping(change.mapping as GLAccountMapping);
        } else if (change.type === 'DELETE') {
          deleteMapping((change.mapping as GLAccountMapping).mappingId);
        }
      }
      updateLines();
    }
  }, [undoRedoActions, addMapping, deleteMapping, updateLines]);

  // Handle export
  const handleExport = () => {
    const csvRows = [
      [
        'Source Account',
        'Source Description',
        'Target Account',
        'Target Description',
        'Mapping Type',
        'Split Weight',
        'Status',
      ].join(','),
    ];

    for (const m of state.mappings) {
      csvRows.push(
        [
          m.sourceGlAccountNumber,
          `"${m.sourceGlAccountDescription}"`,
          m.targetGlAccountNumber,
          `"${m.targetGlAccountDescription}"`,
          m.mappingType,
          m.splitWeight.toString(),
          m.status,
        ].join(',')
      );
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gl-mappings-${eventId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle validate
  const handleValidate = async () => {
    try {
      const result = await validateMappings(eventId);

      if (result.isValid) {
        setSnackbar({
          open: true,
          message: `Validation passed: ${result.mappingCount} mappings`,
          severity: 'success',
        });
      } else {
        const errorCount = result.errors.length;
        const warningCount = result.warnings.length;
        setSnackbar({
          open: true,
          message: `Validation: ${errorCount} error(s), ${warningCount} warning(s)`,
          severity: errorCount > 0 ? 'error' : 'warning',
        });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: 'Validation failed',
        severity: 'error',
      });
    }
  };

  // Handle line click
  const handleLineClick = (mappingId: string) => {
    selectMapping(mappingId);
    const mapping = state.mappings.find((m) => m.mappingId === mappingId);
    if (mapping) {
      setSelectedMappingDetails(mapping);
    }
  };

  // Handle delete mapping
  const handleDeleteMapping = (mappingId: string) => {
    const mapping = state.mappings.find((m) => m.mappingId === mappingId);
    if (!mapping) return;

    deleteMapping(mappingId);

    const change: MappingChange = {
      id: `change-${Date.now()}`,
      type: 'DELETE',
      mapping,
      timestamp: Date.now(),
    };
    addPendingChange(change);
    undoRedoActions.recordChange(change);

    setSelectedMappingDetails(null);
    updateLines();
  };

  // Handle update weight
  const handleUpdateWeight = (mappingId: string, weight: number) => {
    updateMapping(mappingId, { splitWeight: weight });

    const mapping = state.mappings.find((m) => m.mappingId === mappingId);
    if (mapping) {
      const change: MappingChange = {
        id: `change-${Date.now()}`,
        type: 'UPDATE',
        mapping: { ...mapping, splitWeight: weight },
        timestamp: Date.now(),
      };
      addPendingChange(change);
    }
  };

  // Get related mappings for sidebar
  const relatedMappings = useMemo(() => {
    if (!state.selectedMappingDetails) return [];
    const { groupId, sourceGlAccountNumber, targetGlAccountNumber } =
      state.selectedMappingDetails;

    if (groupId) {
      return state.mappings.filter((m) => m.groupId === groupId);
    }

    // Find related by source or target
    return state.mappings.filter(
      (m) =>
        m.sourceGlAccountNumber === sourceGlAccountNumber ||
        m.targetGlAccountNumber === targetGlAccountNumber
    );
  }, [state.selectedMappingDetails, state.mappings]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges) {
          handleSave();
        }
      }
      if (e.key === 'Escape') {
        clearSelection();
        setSelectedMappingDetails(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, handleSave, handleUndo, handleRedo, clearSelection, setSelectedMappingDetails]);

  const handleProviderChange = (event: SelectChangeEvent<string>) => {
    setSelectedProvider(event.target.value);
  };

  const activeItem = getActiveItem();

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          GL Account Mapping
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {eventName}
        </Typography>

        <FormControl size="small" sx={{ minWidth: 180, ml: 2 }}>
          <InputLabel>Provider</InputLabel>
          <Select
            value={selectedProvider}
            label="Provider"
            onChange={handleProviderChange}
          >
            {PROVIDERS.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ flex: 1 }} />

        <MappingControls
          hasUnsavedChanges={hasUnsavedChanges}
          isSaving={state.isSaving}
          undoRedoState={undoRedoState}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onExport={handleExport}
          onValidate={handleValidate}
          pendingChangesCount={state.pendingChanges.length}
        />
      </Box>

      {/* Error Alert */}
      {state.error && (
        <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
          {state.error}
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', p: 2, gap: 2 }}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {/* Incumbent Column */}
          <AccountColumn
            ref={incumbentColumnRef}
            title="Incumbent Accounts"
            type="INCUMBENT_ACCOUNT"
            accounts={filteredIncumbentAccounts}
            mappedAccounts={mappedIncumbentAccounts}
            getMappingType={getIncumbentMappingType}
            selectedAccounts={state.selection.selectedIncumbentAccounts}
            onSelectAccount={selectIncumbentAccount}
            searchValue={state.filters.incumbentSearch}
            onSearchChange={(v) => setFilter({ incumbentSearch: v })}
            sectionFilter={state.filters.incumbentSection}
            onSectionChange={(v) => setFilter({ incumbentSection: v })}
            dropTargetAccount={
              dragState.overId?.startsWith('incumbent-')
                ? dragState.overId.replace('incumbent-', '')
                : null
            }
          />

          {/* Mapping Canvas */}
          <Box
            sx={{
              position: 'relative',
              width: 200,
              flexShrink: 0,
            }}
          >
            <MappingCanvas
              ref={canvasRef}
              lines={lines}
              onLineClick={handleLineClick}
              onCanvasClick={() => {
                clearSelection();
                setSelectedMappingDetails(null);
              }}
            />
          </Box>

          {/* Eagle Column */}
          <AccountColumn
            ref={eagleColumnRef}
            title="Eagle Accounts"
            type="EAGLE_ACCOUNT"
            accounts={filteredEagleAccounts}
            mappedAccounts={mappedEagleAccounts}
            getMappingType={getEagleMappingType}
            selectedAccounts={state.selection.selectedEagleAccounts}
            onSelectAccount={selectEagleAccount}
            searchValue={state.filters.eagleSearch}
            onSearchChange={(v) => setFilter({ eagleSearch: v })}
            sectionFilter={state.filters.eagleSection}
            onSectionChange={(v) => setFilter({ eagleSection: v })}
            dropTargetAccount={
              dragState.overId?.startsWith('eagle-')
                ? dragState.overId.replace('eagle-', '')
                : null
            }
          />

          {/* Drag Overlay */}
          <DragOverlay>
            {activeItem && (
              <Box sx={{ opacity: 0.8 }}>
                <AccountCard
                  account={activeItem}
                  type={
                    dragState.activeType === 'INCUMBENT_ACCOUNT'
                      ? 'INCUMBENT_ACCOUNT'
                      : 'EAGLE_ACCOUNT'
                  }
                  isMapped={false}
                  isSelected={true}
                  isDropTarget={false}
                  onClick={() => {}}
                />
              </Box>
            )}
          </DragOverlay>
        </DndContext>

        {/* Sidebar */}
        {state.selectedMappingDetails && (
          <MappingSidebar
            mapping={state.selectedMappingDetails}
            relatedMappings={relatedMappings}
            onClose={() => {
              setSelectedMappingDetails(null);
              selectMapping(null);
            }}
            onDelete={handleDeleteMapping}
            onUpdateWeight={handleUpdateWeight}
          />
        )}
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default GLMappingWorkspace;
