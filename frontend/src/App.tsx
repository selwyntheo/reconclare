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
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
