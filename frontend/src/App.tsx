import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CircularProgress, Box } from '@mui/material';
import theme from './theme/theme';
import MainLayout from './layouts/MainLayout';
import { DrillDownProvider } from './context/DrillDownContext';
import HumanReview from './pages/HumanReview/HumanReview';
import LedgerMapping from './pages/LedgerMapping/LedgerMapping';
import GLAccountMapping from './pages/GLAccountMapping/GLAccountMapping';
import MappingConfiguration from './pages/MappingConfiguration/MappingConfiguration';

// Lazy-loaded drill-down screens
const EventDashboard = lazy(() => import('./pages/EventDashboard/EventDashboard'));
const NavDashboard = lazy(() => import('./pages/NavDashboard/NavDashboard'));
const TrialBalance = lazy(() => import('./pages/TrialBalance/TrialBalance'));
const PositionDrillDown = lazy(() => import('./pages/PositionDrillDown/PositionDrillDown'));
const ValidationRunView = lazy(() => import('./pages/ValidationRunView/ValidationRunView'));

const LoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
    <CircularProgress />
  </Box>
);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              {/* Redirect root to /events */}
              <Route index element={<Navigate to="/events" replace />} />

              {/* Drill-down routes wrapped in DrillDownProvider */}
              <Route path="events" element={<DrillDownProvider><EventDashboard /></DrillDownProvider>} />
              <Route path="events/:eventId/nav-dashboard" element={<DrillDownProvider><NavDashboard /></DrillDownProvider>} />
              <Route path="events/:eventId/funds/:account/trial-balance" element={<DrillDownProvider><TrialBalance /></DrillDownProvider>} />
              <Route path="events/:eventId/funds/:account/positions" element={<DrillDownProvider><PositionDrillDown /></DrillDownProvider>} />

              {/* Preserved routes */}
              <Route path="events/:eventId/runs/:runId" element={<ValidationRunView />} />
              <Route path="review" element={<HumanReview />} />
              <Route path="ledger-mapping" element={<LedgerMapping />} />
              <Route path="gl-account-mapping" element={<GLAccountMapping />} />
              <Route path="gl-account-mapping/:eventId" element={<GLAccountMapping />} />
              <Route path="admin/mappings" element={<MappingConfiguration />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
