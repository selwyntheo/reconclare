/**
 * GLAccountMapping Page - Main page for GL Account Mapping feature.
 * Allows users to map GL accounts between Incumbent and Eagle.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Button,
  Breadcrumbs,
  Link,
  SelectChangeEvent,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { GLMappingWorkspace } from '../../components/GLAccountMapping';
import { fetchEvents } from '../../services/api';
import { ConversionEvent } from '../../types';

const GLAccountMapping: React.FC = () => {
  const { eventId: urlEventId } = useParams<{ eventId?: string }>();
  const navigate = useNavigate();

  const [events, setEvents] = useState<ConversionEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(urlEventId || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load events
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const data = await fetchEvents();
        setEvents(data);

        // Auto-select first event if none selected
        if (!selectedEventId && data.length > 0) {
          setSelectedEventId(data[0].eventId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [selectedEventId]);

  const selectedEvent = events.find((e) => e.eventId === selectedEventId);

  const handleEventChange = (event: SelectChangeEvent<string>) => {
    setSelectedEventId(event.target.value);
  };

  // Get provider mapping from event's incumbent provider
  const getProviderCode = (provider: string): string => {
    const mapping: Record<string, string> = {
      'State Street': 'STATE_STREET',
      'Northern Trust': 'NORTHERN_TRUST',
      'BNP Paribas': 'BNP_PARIBAS',
      'JP Morgan': 'JP_MORGAN',
    };
    return mapping[provider] || 'STATE_STREET';
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          minHeight: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

  if (events.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          No conversion events found. Create an event first to set up GL mappings.
        </Alert>
        <Button
          variant="contained"
          sx={{ mt: 2 }}
          onClick={() => navigate('/')}
        >
          Go to Dashboard
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Breadcrumbs */}
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        sx={{ mb: 2 }}
      >
        <Link
          color="inherit"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Dashboard
        </Link>
        <Typography color="text.primary">GL Account Mapping</Typography>
      </Breadcrumbs>

      {/* Event Selector (if not in URL) */}
      {!urlEventId && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 300 }}>
            <InputLabel>Conversion Event</InputLabel>
            <Select
              value={selectedEventId}
              label="Conversion Event"
              onChange={handleEventChange}
            >
              {events.map((event) => (
                <MenuItem key={event.eventId} value={event.eventId}>
                  {event.eventName} ({event.eventId})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedEvent && (
            <Typography variant="body2" color="text.secondary">
              Provider: {selectedEvent.incumbentProvider} | Status: {selectedEvent.status}
            </Typography>
          )}
        </Box>
      )}

      {/* Main Workspace */}
      {selectedEvent && (
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <GLMappingWorkspace
            eventId={selectedEvent.eventId}
            eventName={selectedEvent.eventName}
            defaultProvider={getProviderCode(selectedEvent.incumbentProvider)}
          />
        </Box>
      )}
    </Box>
  );
};

export default GLAccountMapping;
