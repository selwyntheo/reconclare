import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useDrillDownState, useDrillDownDispatch } from '../../context/DrillDownContext';

interface BreadcrumbSegment {
  label: string;
  path?: string;
  action?: () => void;
}

// Route-to-label mapping for leaf pages
const SUB_VIEW_LABELS: Record<string, string> = {
  'share-breaks': 'Share Breaks',
  'price-breaks': 'Price Breaks',
  'tax-lots': 'Tax Lots',
  dividends: 'Dividends',
  'fixed-income': 'Fixed Income',
  forwards: 'Forwards',
  futures: 'Futures',
};

export const DrillDownBreadcrumb: React.FC = () => {
  const state = useDrillDownState();
  const dispatch = useDrillDownDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { context } = state;
  const pathname = location.pathname;

  const segments: BreadcrumbSegment[] = [
    {
      label: 'Events',
      path: '/events',
      action: () => dispatch({ type: 'GO_BACK_TO_EVENTS' }),
    },
  ];

  if (context.eventId) {
    const qs = context.valuationDt ? `?valuationDt=${context.valuationDt}` : '';
    const navPath = `/events/${context.eventId}/nav-dashboard${qs}`;

    segments.push({
      label: context.eventName || context.eventId,
      path: navPath,
      action: () => dispatch({ type: 'GO_BACK_TO_NAV' }),
    });

    // Allocations (Roster) page
    if (pathname.includes('/allocations')) {
      segments.push({ label: 'Reviewer Allocation' });
      return renderBreadcrumbs(segments, navigate);
    }

    // NAV sub-views (scorecard, rag-tracker, share-class)
    if (pathname.includes('/nav-dashboard/scorecard')) {
      segments.push({ label: 'Client Scorecard' });
      return renderBreadcrumbs(segments, navigate);
    }
    if (pathname.includes('/nav-dashboard/rag-tracker')) {
      segments.push({ label: 'RAG Tracker' });
      return renderBreadcrumbs(segments, navigate);
    }
    if (pathname.includes('/nav-dashboard/share-class/')) {
      const accountMatch = pathname.match(/share-class\/([^/]+)/);
      const acct = accountMatch?.[1] || '';
      segments.push({
        label: context.accountName || acct || 'Share Class',
      });
      segments.push({ label: 'Share Class' });
      return renderBreadcrumbs(segments, navigate);
    }
  }

  if (context.account) {
    const qs = context.valuationDt ? `?valuationDt=${context.valuationDt}` : '';
    const tbPath = `/events/${context.eventId}/funds/${context.account}/trial-balance${qs}`;
    const posPath = `/events/${context.eventId}/funds/${context.account}/positions${qs}`;

    segments.push({
      label: context.accountName || context.account,
      path: tbPath,
      action: () => dispatch({ type: 'GO_BACK_TO_TRIAL_BALANCE' }),
    });

    // Position sub-views
    if (pathname.includes('/positions/share-breaks') || pathname.includes('/positions/price-breaks') || pathname.includes('/positions/tax-lots')) {
      segments.push({
        label: 'Positions',
        path: posPath,
      });
      const leaf = pathname.split('/').pop() || '';
      segments.push({ label: SUB_VIEW_LABELS[leaf] || leaf });
      return renderBreadcrumbs(segments, navigate);
    }

    // Income sub-views
    if (pathname.includes('/income/dividends') || pathname.includes('/income/fixed-income')) {
      segments.push({
        label: 'Positions',
        path: posPath,
      });
      const leaf = pathname.split('/').pop() || '';
      segments.push({ label: SUB_VIEW_LABELS[leaf] || 'Income' });
      return renderBreadcrumbs(segments, navigate);
    }

    // Derivatives sub-views
    if (pathname.includes('/derivatives/forwards') || pathname.includes('/derivatives/futures')) {
      segments.push({
        label: 'Positions',
        path: posPath,
      });
      const leaf = pathname.split('/').pop() || '';
      segments.push({ label: SUB_VIEW_LABELS[leaf] || 'Derivatives' });
      return renderBreadcrumbs(segments, navigate);
    }

    // Default: Trial Balance
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

  return renderBreadcrumbs(segments, navigate);
};

function renderBreadcrumbs(segments: BreadcrumbSegment[], navigate: ReturnType<typeof useNavigate>) {
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
}

export default DrillDownBreadcrumb;
