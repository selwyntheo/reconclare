import { createTheme, alpha } from '@mui/material/styles';

// Accountant-first design: clean, professional, data-dense
// Muted blues/grays with high-contrast status indicators
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1B3A5C',      // Deep navy — trust, authority
      light: '#2E5A8A',
      dark: '#0F2440',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#4A90D9',      // Bright blue — interactive elements
      light: '#6BAAF0',
      dark: '#2E6DB5',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#D32F2F',      // Red — critical breaks
      light: '#EF5350',
      dark: '#C62828',
    },
    warning: {
      main: '#ED6C02',      // Orange — aging / attention
      light: '#FF9800',
      dark: '#E65100',
    },
    success: {
      main: '#2E7D32',      // Green — matched / resolved
      light: '#4CAF50',
      dark: '#1B5E20',
    },
    info: {
      main: '#0288D1',
      light: '#03A9F4',
      dark: '#01579B',
    },
    background: {
      default: '#F5F6FA',   // Light gray-blue canvas
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1A2E',
      secondary: '#5A6178',
    },
    divider: alpha('#1B3A5C', 0.12),
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
    h4: {
      fontWeight: 700,
      fontSize: '1.75rem',
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.35rem',
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.1rem',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: '0.95rem',
      color: '#5A6178',
    },
    subtitle2: {
      fontWeight: 500,
      fontSize: '0.85rem',
      color: '#5A6178',
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.8125rem',
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '0.75rem',
      color: '#8A8FA8',
    },
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
          border: '1px solid rgba(27,58,92,0.08)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontSize: '0.75rem',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 6,
        },
        sizeSmall: {
          fontSize: '0.8125rem',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.8125rem',
          padding: '10px 16px',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#F5F6FA',
          color: '#5A6178',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.875rem',
          minHeight: 44,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(27,58,92,0.08)',
        },
      },
    },
  },
});

export default theme;
