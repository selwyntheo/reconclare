import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useDrillDownState, useDrillDownDispatch } from '../../context/DrillDownContext';

interface BreadcrumbSegment {
  label: string;
  path?: string;
  action?: () => void;
}

export const DrillDownBreadcrumb: React.FC = () => {
  const state = useDrillDownState();
  const dispatch = useDrillDownDispatch();
  const navigate = useNavigate();
  const { context } = state;

  const segments: BreadcrumbSegment[] = [
    {
      label: 'Events',
      path: '/events',
      action: () => dispatch({ type: 'GO_BACK_TO_EVENTS' }),
    },
  ];

  if (context.eventId) {
    const navPath = `/events/${context.eventId}/nav-dashboard${context.valuationDt ? `?valuationDt=${context.valuationDt}` : ''}`;
    segments.push({
      label: context.eventName || context.eventId,
      path: navPath,
      action: () => dispatch({ type: 'GO_BACK_TO_NAV' }),
    });
  }

  if (context.account) {
    const tbPath = `/events/${context.eventId}/funds/${context.account}/trial-balance${context.valuationDt ? `?valuationDt=${context.valuationDt}` : ''}`;
    segments.push({
      label: `${context.accountName || context.account}`,
      path: tbPath,
      action: () => dispatch({ type: 'GO_BACK_TO_TRIAL_BALANCE' }),
    });
    segments.push({
      label: 'Trial Balance',
      path: tbPath,
      action: () => dispatch({ type: 'GO_BACK_TO_TRIAL_BALANCE' }),
    });
  }

  if (context.category) {
    segments.push({
      label: `${context.category} Positions`,
    });
  }

  // The last segment is the current page (not clickable)
  const lastIndex = segments.length - 1;

  return (
    <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="drill-down navigation" sx={{ mb: 2 }}>
      {segments.map((seg, i) => {
        if (i === lastIndex) {
          return (
            <Typography key={i} color="text.primary" variant="body2" fontWeight={600}>
              {seg.label}
            </Typography>
          );
        }
        return (
          <Link
            key={i}
            component="button"
            variant="body2"
            underline="hover"
            color="inherit"
            onClick={() => {
              seg.action?.();
              if (seg.path) navigate(seg.path);
            }}
            sx={{ cursor: 'pointer' }}
          >
            {seg.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
};

export default DrillDownBreadcrumb;
