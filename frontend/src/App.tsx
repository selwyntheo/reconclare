import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme/theme';
import MainLayout from './layouts/MainLayout';
import ControlCenter from './pages/ControlCenter/ControlCenter';
import BreakExplorer from './pages/BreakExplorer/BreakExplorer';
import InvestigationWorkspace from './pages/InvestigationWorkspace/InvestigationWorkspace';
import ValidationMatrix from './pages/ValidationMatrix/ValidationMatrix';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<ControlCenter />} />
            <Route path="breaks" element={<BreakExplorer />} />
            <Route path="investigate" element={<InvestigationWorkspace />} />
            <Route path="validation" element={<ValidationMatrix />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
