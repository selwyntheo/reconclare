import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Paper, Stack, Button } from '@mui/material';

type NavSubView = 'fund-level' | 'share-class-dashboard' | 'scorecard' | 'rag-tracker';

interface NavSubViewNavProps {
  currentView: NavSubView;
}

const NAV_VIEWS: { key: NavSubView; label: string; path: (eventId: string, qs: string) => string }[] = [
  { key: 'fund-level', label: 'Fund Level', path: (eid, qs) => `/events/${eid}/nav-dashboard${qs}` },
  { key: 'share-class-dashboard', label: 'Share Class', path: (eid, qs) => `/events/${eid}/nav-dashboard/share-class-dashboard${qs}` },
  { key: 'scorecard', label: 'Client Scorecard', path: (eid, qs) => `/events/${eid}/nav-dashboard/scorecard${qs}` },
  { key: 'rag-tracker', label: 'RAG Status', path: (eid) => `/events/${eid}/nav-dashboard/rag-tracker` },
];

const NavSubViewNav: React.FC<NavSubViewNavProps> = ({ currentView }) => {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const valuationDt = searchParams.get('valuationDt') || '';
  const qs = valuationDt ? `?valuationDt=${valuationDt}` : '';

  return (
    <Paper sx={{ mb: 1 }} elevation={0}>
      <Stack direction="row" spacing={1} sx={{ px: 1, pt: 0.5 }}>
        {NAV_VIEWS.map((view) => (
          <Button
            key={view.key}
            size="small"
            variant="text"
            sx={{ textTransform: 'none', fontWeight: currentView === view.key ? 600 : 400 }}
            disabled={currentView === view.key}
            onClick={() => navigate(view.path(eventId || '', qs))}
          >
            {view.label}
          </Button>
        ))}
      </Stack>
    </Paper>
  );
};

export default NavSubViewNav;
