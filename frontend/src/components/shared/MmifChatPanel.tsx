import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Stack,
  Chip,
  TextField,
  Paper,
  Divider,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import { MmifChatMessage } from '../../types';
import { createMmifChatSession, sendMmifChatMessage, fetchMmifChatHistory } from '../../services/api';

interface MmifChatPanelProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
}

const PANEL_WIDTH = 420;

const QUICK_ACTIONS = [
  'Explain breaks',
  'Check mappings',
  'Filing readiness',
  'Compare prior quarter',
];

// ── Loading dots component ────────────────────────────────────

const LoadingDots: React.FC = () => (
  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ py: 0.5, px: 1 }}>
    {[0, 1, 2].map((i) => (
      <Box
        key={i}
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: 'text.disabled',
          animation: 'mmifDotBounce 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
          '@keyframes mmifDotBounce': {
            '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: 0.5 },
            '40%': { transform: 'scale(1)', opacity: 1 },
          },
        }}
      />
    ))}
  </Stack>
);

// ── Message bubble ────────────────────────────────────────────

interface MessageBubbleProps {
  message: MmifChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const theme = useTheme();
  const isUser = message.role === 'user';

  // Render assistant content with simple markdown-like formatting
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      // Bold: **text**
      const boldParsed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Bullet
      if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
        return (
          <Box key={i} component="li" sx={{ ml: 1, pl: 0.5, fontSize: '0.85rem', lineHeight: 1.6 }}>
            <span dangerouslySetInnerHTML={{ __html: boldParsed.replace(/^[\-•]\s*/, '') }} />
          </Box>
        );
      }
      return (
        <Typography
          key={i}
          variant="body2"
          sx={{ lineHeight: 1.6, fontSize: '0.85rem', mb: line === '' ? 0.5 : 0 }}
          dangerouslySetInnerHTML={{ __html: boldParsed || '&nbsp;' }}
        />
      );
    });
  };

  return (
    <Stack
      direction={isUser ? 'row-reverse' : 'row'}
      spacing={1}
      alignItems="flex-start"
      sx={{ mb: 1.5 }}
    >
      {/* Avatar */}
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: isUser ? 'primary.main' : alpha(theme.palette.secondary.main, 0.15),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {isUser ? (
          <PersonIcon sx={{ fontSize: 16, color: 'white' }} />
        ) : (
          <SmartToyIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
        )}
      </Box>

      {/* Bubble */}
      <Box
        sx={{
          maxWidth: '78%',
          bgcolor: isUser ? 'primary.main' : alpha(theme.palette.grey[500], 0.1),
          color: isUser ? 'primary.contrastText' : 'text.primary',
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          px: 1.5,
          py: 1,
          boxShadow: isUser ? theme.shadows[1] : 'none',
        }}
      >
        {isUser ? (
          <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
            {message.content}
          </Typography>
        ) : (
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {renderContent(message.content)}
          </Box>
        )}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            opacity: 0.65,
            fontSize: '0.65rem',
            textAlign: isUser ? 'right' : 'left',
          }}
        >
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </Box>
    </Stack>
  );
};

// ── Main Chat Panel ───────────────────────────────────────────

const MmifChatPanel: React.FC<MmifChatPanelProps> = ({ open, onClose, eventId }) => {
  const theme = useTheme();
  const [messages, setMessages] = useState<MmifChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const [sessionInitializing, setSessionInitializing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, responding]);

  // Load history if session already exists
  useEffect(() => {
    if (sessionId) {
      fetchMmifChatHistory(sessionId)
        .then((data) => {
          if (Array.isArray(data.messages)) {
            setMessages(data.messages);
          }
        })
        .catch(() => {
          // Silently fail — session may be new
        });
    }
  }, [sessionId]);

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    setSessionInitializing(true);
    try {
      const res = await createMmifChatSession(eventId);
      const sid = res.sessionId || res.session_id || res.id;
      setSessionId(sid);
      return sid;
    } finally {
      setSessionInitializing(false);
    }
  };

  const handleSend = async (overrideMessage?: string) => {
    const text = (overrideMessage ?? inputValue).trim();
    if (!text || responding) return;

    setInputValue('');

    const userMsg: MmifChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setResponding(true);

    try {
      const sid = await ensureSession();
      const res = await sendMmifChatMessage(sid, text);
      const assistantMsg: MmifChatMessage = {
        role: 'assistant',
        content: res.message || res.content || res.response || 'I could not generate a response.',
        timestamp: res.timestamp || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg: MmifChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setResponding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        right: 0,
        top: 64, // below the top app bar
        bottom: 0,
        width: open ? PANEL_WIDTH : 0,
        minWidth: open ? PANEL_WIDTH : 0,
        maxWidth: open ? PANEL_WIDTH : 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease, min-width 0.25s ease',
        zIndex: theme.zIndex.drawer + 1,
        borderLeft: `1px solid ${theme.palette.divider}`,
        borderRadius: 0,
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: alpha(theme.palette.secondary.main, 0.06),
          flexShrink: 0,
        }}
      >
        <SmartToyIcon color="secondary" fontSize="small" />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
          MMIF Agent Chat
        </Typography>
        {sessionInitializing && <CircularProgress size={14} />}
        <IconButton size="small" onClick={onClose} aria-label="Close chat panel">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* Quick Action Chips */}
      <Box sx={{ px: 1.5, pt: 1, pb: 0.5, flexShrink: 0 }}>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {QUICK_ACTIONS.map((action) => (
            <Chip
              key={action}
              label={action}
              size="small"
              variant="outlined"
              color="secondary"
              onClick={() => handleSend(action)}
              disabled={responding}
              sx={{ fontSize: '0.7rem', cursor: 'pointer', mb: 0.5 }}
            />
          ))}
        </Stack>
      </Box>

      <Divider />

      {/* Messages area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          py: 1.5,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 && !responding && (
          <Box sx={{ textAlign: 'center', py: 6, opacity: 0.5 }}>
            <SmartToyIcon sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Ask me anything about this MMIF filing.
            </Typography>
            <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
              Use the quick actions above or type your question.
            </Typography>
          </Box>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {responding && (
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.secondary.main, 0.15),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                mt: 0.25,
              }}
            >
              <SmartToyIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
            </Box>
            <Box
              sx={{
                bgcolor: alpha(theme.palette.grey[500], 0.1),
                borderRadius: '4px 16px 16px 16px',
                px: 1.5,
                py: 0.75,
              }}
            >
              <LoadingDots />
            </Box>
          </Stack>
        )}

        <div ref={messagesEndRef} />
      </Box>

      <Divider />

      {/* Input area */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          flexShrink: 0,
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            fullWidth
            size="small"
            multiline
            maxRows={4}
            placeholder="Ask about breaks, mappings, filing readiness..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={responding}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                fontSize: '0.875rem',
              },
            }}
          />
          <IconButton
            color="primary"
            onClick={() => handleSend()}
            disabled={responding || !inputValue.trim()}
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
              width: 38,
              height: 38,
              flexShrink: 0,
            }}
            aria-label="Send message"
          >
            {responding ? <CircularProgress size={18} color="inherit" /> : <SendIcon fontSize="small" />}
          </IconButton>
        </Stack>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5, fontSize: '0.65rem' }}>
          Press Enter to send · Shift+Enter for new line
        </Typography>
      </Box>
    </Paper>
  );
};

export default MmifChatPanel;
