import React, { useState, useEffect, useCallback } from 'react';
import {
  IconButton, Badge, Popover, List, ListItem, ListItemText,
  Typography, Box, Divider,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, markNotificationRead, fetchNotificationCount } from '../../services/api';

interface NotificationItem {
  _id?: string;
  id?: string;
  eventId: string;
  breakType: string;
  entityReference: string;
  fundAccount: string;
  fundName: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const navigate = useNavigate();

  const loadCount = useCallback(async () => {
    try {
      const data = await fetchNotificationCount();
      setUnreadCount(data.unread || 0);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [loadCount]);

  const handleOpen = async (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    try {
      const data = await fetchNotifications();
      setNotifications(data.slice(0, 20));
    } catch {
      // Silently fail
    }
  };

  const handleClose = () => setAnchorEl(null);

  const handleClickNotification = async (notif: NotificationItem) => {
    const id = notif._id || notif.id;
    if (id && !notif.isRead) {
      try {
        await markNotificationRead(id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Silently fail
      }
    }
    handleClose();
    // Navigate to relevant view
    if (notif.eventId && notif.fundAccount) {
      navigate(`/events/${notif.eventId}/funds/${notif.fundAccount}/positions`);
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen} aria-label="notifications">
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ width: 360, maxHeight: 400 }}>
          <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" fontWeight={600}>Notifications</Typography>
            {unreadCount > 0 && (
              <Typography variant="caption" color="primary">{unreadCount} unread</Typography>
            )}
          </Box>
          <Divider />
          <List dense sx={{ maxHeight: 320, overflow: 'auto', p: 0 }}>
            {notifications.length === 0 ? (
              <ListItem>
                <ListItemText secondary="No notifications" />
              </ListItem>
            ) : (
              notifications.map((notif, idx) => (
                <ListItem
                  key={notif._id || notif.id || idx}
                  onClick={() => handleClickNotification(notif)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: notif.isRead ? 'transparent' : 'action.hover',
                    '&:hover': { bgcolor: 'action.selected' },
                  }}
                >
                  <ListItemText
                    primary={notif.message}
                    secondary={`${notif.breakType} · ${notif.fundName || notif.fundAccount} · ${new Date(notif.createdAt).toLocaleString()}`}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: notif.isRead ? 400 : 600 }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              ))
            )}
          </List>
        </Box>
      </Popover>
    </>
  );
}
