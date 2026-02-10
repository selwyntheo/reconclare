import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Avatar,
  Tooltip,
  Badge,
  useTheme,
  alpha,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import RateReviewIcon from '@mui/icons-material/RateReview';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

const DRAWER_WIDTH = 260;
const DRAWER_COLLAPSED = 72;

interface NavItem {
  label: string;
  icon: React.ReactElement;
  path: string;
}

const navItems: NavItem[] = [
  { label: 'Event Dashboard', icon: <DashboardIcon />, path: '/' },
  { label: 'Human Review', icon: <RateReviewIcon />, path: '/review' },
  { label: 'Ledger Mapping', icon: <AccountBalanceWalletIcon />, path: '/ledger-mapping' },
  { label: 'GL Account Mapping', icon: <SwapHorizIcon />, path: '/gl-account-mapping' },
];

const MainLayout: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const currentWidth = drawerOpen ? DRAWER_WIDTH : DRAWER_COLLAPSED;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />

      {/* ── App Bar ─────────────────────────────────── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          bgcolor: 'primary.main',
          borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
        }}
      >
        <Toolbar sx={{ minHeight: '56px !important' }}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: 2 }}
          >
            {drawerOpen ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>

          <AccountBalanceIcon sx={{ mr: 1.5, fontSize: 28 }} />
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            RECON
          </Typography>
          <Typography
            variant="h6"
            noWrap
            sx={{ fontWeight: 300, ml: 0.5, opacity: 0.85 }}
          >
            Clare AI
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="Notifications">
            <IconButton color="inherit" sx={{ mr: 1 }}>
              <Badge badgeContent={2} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton color="inherit" sx={{ mr: 1.5 }}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: 'secondary.main',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            JD
          </Avatar>
        </Toolbar>
      </AppBar>

      {/* ── Side Drawer ─────────────────────────────── */}
      <Drawer
        variant="permanent"
        sx={{
          width: currentWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: currentWidth,
            boxSizing: 'border-box',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflowX: 'hidden',
            bgcolor: 'background.paper',
          },
        }}
      >
        <Toolbar sx={{ minHeight: '56px !important' }} />
        <Box sx={{ mt: 1 }}>
          <List>
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <ListItemButton
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    mx: 1,
                    mb: 0.5,
                    borderRadius: 1.5,
                    minHeight: 44,
                    justifyContent: drawerOpen ? 'initial' : 'center',
                    bgcolor: active ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    color: active ? 'primary.main' : 'text.secondary',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: drawerOpen ? 2 : 'auto',
                      justifyContent: 'center',
                      color: active ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {drawerOpen && (
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        fontWeight: active ? 600 : 400,
                      }}
                    />
                  )}
                </ListItemButton>
              );
            })}
          </List>
          <Divider sx={{ my: 1 }} />
          {drawerOpen && (
            <Box sx={{ px: 2.5, py: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Reconciliation Engine
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                Last run: 2026-02-06 08:15 EST
              </Typography>
              <Typography variant="caption" display="block">
                Status: <span style={{ color: '#2E7D32', fontWeight: 600 }}>Healthy</span>
              </Typography>
            </Box>
          )}
        </Box>
      </Drawer>

      {/* ── Main Content ────────────────────────────── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
          mt: '56px',
          minHeight: 'calc(100vh - 56px)',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default MainLayout;
