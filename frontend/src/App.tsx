import React, { Suspense, lazy } from 'react';
import './styles/print.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CircularProgress, Box } from '@mui/material';
import theme from './theme/theme';
import MainLayout from './layouts/MainLayout';
import { DrillDownProvider } from './context/DrillDownContext';
import { AuthProvider } from './context/AuthContext';
import HumanReview from './pages/HumanReview/HumanReview';
import LedgerMapping from './pages/LedgerMapping/LedgerMapping';
import GLAccountMapping from './pages/GLAccountMapping/GLAccountMapping';
import MappingConfiguration from './pages/MappingConfiguration/MappingConfiguration';
import ProtectedRoute from './components/shared/ProtectedRoute';

// Lazy-loaded drill-down screens
const EventDashboard = lazy(() => import('./pages/EventDashboard/EventDashboard'));
const NavDashboard = lazy(() => import('./pages/NavDashboard/NavDashboard'));
const TrialBalance = lazy(() => import('./pages/TrialBalance/TrialBalance'));
const PositionDrillDown = lazy(() => import('./pages/PositionDrillDown/PositionDrillDown'));
const ValidationRunView = lazy(() => import('./pages/ValidationRunView/ValidationRunView'));

// Data Mapping Utility — lazy-loaded
const DataMappingList = lazy(() => import('./pages/DataMapping/DataMappingList'));
const DataMappingDesigner = lazy(() => import('./pages/DataMapping/DataMappingDesigner'));

// Break Resolution & Dashboarding — lazy-loaded
const ReviewerAllocation = lazy(() => import('./pages/ReviewerAllocation/ReviewerAllocation'));
const NavShareClass = lazy(() => import('./pages/NavShareClass/NavShareClass'));
const NavShareClassDashboard = lazy(() => import('./pages/NavShareClassDashboard/NavShareClassDashboard'));
const NavClientScorecard = lazy(() => import('./pages/NavClientScorecard/NavClientScorecard'));
const NavRagTracker = lazy(() => import('./pages/NavRagTracker/NavRagTracker'));
const PositionsShareBreaks = lazy(() => import('./pages/PositionsShareBreaks/PositionsShareBreaks'));
const PositionsPriceBreaks = lazy(() => import('./pages/PositionsPriceBreaks/PositionsPriceBreaks'));
const PositionsTaxLots = lazy(() => import('./pages/PositionsTaxLots/PositionsTaxLots'));
const IncomeDividends = lazy(() => import('./pages/IncomeDividends/IncomeDividends'));
const IncomeFixedIncome = lazy(() => import('./pages/IncomeFixedIncome/IncomeFixedIncome'));
const DerivativesForwards = lazy(() => import('./pages/DerivativesForwards/DerivativesForwards'));
const DerivativesFutures = lazy(() => import('./pages/DerivativesFutures/DerivativesFutures'));

const LoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
    <CircularProgress />
  </Box>
);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
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

              {/* Reviewer Allocation */}
              <Route path="events/:eventId/allocations" element={<DrillDownProvider><ProtectedRoute screen="reviewerAllocation"><ReviewerAllocation /></ProtectedRoute></DrillDownProvider>} />

              {/* NAV Sub-Views */}
              <Route path="events/:eventId/nav-dashboard/share-class-dashboard" element={<DrillDownProvider><ProtectedRoute screen="navShareClassDashboard"><NavShareClassDashboard /></ProtectedRoute></DrillDownProvider>} />
              <Route path="events/:eventId/nav-dashboard/share-class/:account" element={<DrillDownProvider><ProtectedRoute screen="navShareClass"><NavShareClass /></ProtectedRoute></DrillDownProvider>} />
              <Route path="events/:eventId/nav-dashboard/scorecard" element={<DrillDownProvider><ProtectedRoute screen="navClientScorecard"><NavClientScorecard /></ProtectedRoute></DrillDownProvider>} />
              <Route path="events/:eventId/nav-dashboard/rag-tracker" element={<DrillDownProvider><ProtectedRoute screen="navRagTracker"><NavRagTracker /></ProtectedRoute></DrillDownProvider>} />

              {/* Position Sub-Views */}
              <Route path="events/:eventId/funds/:account/positions/share-breaks" element={<DrillDownProvider><ProtectedRoute screen="positionsShareBreaks"><PositionsShareBreaks /></ProtectedRoute></DrillDownProvider>} />
              <Route path="events/:eventId/funds/:account/positions/price-breaks" element={<DrillDownProvider><ProtectedRoute screen="positionsPriceBreaks"><PositionsPriceBreaks /></ProtectedRoute></DrillDownProvider>} />
              <Route path="events/:eventId/funds/:account/positions/tax-lots" element={<DrillDownProvider><ProtectedRoute screen="positionsTaxLots"><PositionsTaxLots /></ProtectedRoute></DrillDownProvider>} />

              {/* Income Sub-Views */}
              <Route path="events/:eventId/funds/:account/income/dividends" element={<DrillDownProvider><ProtectedRoute screen="incomeDividends"><IncomeDividends /></ProtectedRoute></DrillDownProvider>} />
              <Route path="events/:eventId/funds/:account/income/fixed-income" element={<DrillDownProvider><ProtectedRoute screen="incomeFixedIncome"><IncomeFixedIncome /></ProtectedRoute></DrillDownProvider>} />

              {/* Derivatives Sub-Views */}
              <Route path="events/:eventId/funds/:account/derivatives/forwards" element={<DrillDownProvider><ProtectedRoute screen="derivativesForwards"><DerivativesForwards /></ProtectedRoute></DrillDownProvider>} />
              <Route path="events/:eventId/funds/:account/derivatives/futures" element={<DrillDownProvider><ProtectedRoute screen="derivativesFutures"><DerivativesFutures /></ProtectedRoute></DrillDownProvider>} />

              {/* Preserved routes */}
              <Route path="events/:eventId/runs/:runId" element={<ValidationRunView />} />
              <Route path="review" element={<HumanReview />} />
              <Route path="ledger-mapping" element={<LedgerMapping />} />
              <Route path="gl-account-mapping" element={<GLAccountMapping />} />
              <Route path="gl-account-mapping/:eventId" element={<GLAccountMapping />} />
              <Route path="admin/mappings" element={<MappingConfiguration />} />

              {/* Data Mapping Utility */}
              <Route path="data-mapping" element={<ProtectedRoute screen="dataMapping"><DataMappingList /></ProtectedRoute>} />
              <Route path="data-mapping/:mappingId" element={<ProtectedRoute screen="dataMapping"><DataMappingDesigner /></ProtectedRoute>} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
