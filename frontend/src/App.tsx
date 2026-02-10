import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme/theme';
import MainLayout from './layouts/MainLayout';
import EventDashboard from './pages/EventDashboard/EventDashboard';
import EventDetail from './pages/EventDetail/EventDetail';
import ValidationRunView from './pages/ValidationRunView/ValidationRunView';
import FundBreakDetail from './pages/FundBreakDetail/FundBreakDetail';
import HumanReview from './pages/HumanReview/HumanReview';
import LedgerMapping from './pages/LedgerMapping/LedgerMapping';
import GLAccountMapping from './pages/GLAccountMapping/GLAccountMapping';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<EventDashboard />} />
            <Route path="events/:eventId" element={<EventDetail />} />
            <Route path="events/:eventId/runs/:runId" element={<ValidationRunView />} />
            <Route path="events/:eventId/funds/:fundAccount" element={<FundBreakDetail />} />
            <Route path="review" element={<HumanReview />} />
            <Route path="ledger-mapping" element={<LedgerMapping />} />
            <Route path="gl-account-mapping" element={<GLAccountMapping />} />
            <Route path="gl-account-mapping/:eventId" element={<GLAccountMapping />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
