import React from 'react';
import { Box, Typography, Divider, useTheme, alpha } from '@mui/material';

interface MarkdownRendererProps {
  content: string;
}

/**
 * Lightweight markdown renderer with MUI-themed typography.
 * Supports: # headings, **bold**, *italic*, - bullets, 1. numbered lists,
 * --- dividers, > blockquotes, nested indentation.
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const theme = useTheme();

  /** Parse inline formatting: **bold** and *italic* */
  const parseInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Match **bold** and *italic* patterns
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|_(.+?)_)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      // Bold: **text** or __text__
      if (match[2] || match[4]) {
        parts.push(
          <Typography key={match.index} component="span" variant="body2" sx={{ fontWeight: 700 }}>
            {match[2] || match[4]}
          </Typography>
        );
      }
      // Italic: *text* or _text_
      else if (match[3] || match[5]) {
        parts.push(
          <Typography key={match.index} component="span" variant="body2" sx={{ fontStyle: 'italic' }}>
            {match[3] || match[5]}
          </Typography>
        );
      }
      lastIndex = match.index + match[0].length;
    }
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts.length > 0 ? parts : [text];
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
      i++;
      continue;
    }

    // --- Horizontal rule
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      elements.push(<Divider key={i} sx={{ my: 2 }} />);
      i++;
      continue;
    }

    // # Heading 1
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      elements.push(
        <Typography
          key={i}
          variant="h5"
          sx={{
            fontWeight: 700,
            color: 'primary.main',
            mt: elements.length > 0 ? 3 : 0,
            mb: 1.5,
            pb: 1,
            borderBottom: `2px solid ${theme.palette.primary.main}`,
          }}
        >
          {parseInline(trimmed.slice(2))}
        </Typography>
      );
      i++;
      continue;
    }

    // ## Heading 2
    if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
      elements.push(
        <Typography
          key={i}
          variant="h6"
          sx={{
            fontWeight: 700,
            color: 'text.primary',
            mt: 2.5,
            mb: 1,
            pb: 0.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          {parseInline(trimmed.slice(3))}
        </Typography>
      );
      i++;
      continue;
    }

    // ### Heading 3
    if (trimmed.startsWith('### ')) {
      elements.push(
        <Typography
          key={i}
          variant="subtitle1"
          sx={{ fontWeight: 700, color: 'text.primary', mt: 2, mb: 0.75 }}
        >
          {parseInline(trimmed.slice(4))}
        </Typography>
      );
      i++;
      continue;
    }

    // > Blockquote
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <Box
          key={`bq-${i}`}
          sx={{
            borderLeft: `3px solid ${theme.palette.info.main}`,
            bgcolor: alpha(theme.palette.info.main, 0.04),
            pl: 2,
            py: 1,
            pr: 1.5,
            my: 1.5,
            borderRadius: '0 4px 4px 0',
          }}
        >
          {quoteLines.map((ql, qi) => (
            <Typography key={qi} variant="body2" sx={{ lineHeight: 1.7 }}>
              {parseInline(ql)}
            </Typography>
          ))}
        </Box>
      );
      continue;
    }

    // Ordered list: 1. item
    if (/^\d+\.\s/.test(trimmed)) {
      const items: { text: string; subItems: string[] }[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        const curTrimmed = cur.trim();
        if (/^\d+\.\s/.test(curTrimmed)) {
          items.push({ text: curTrimmed.replace(/^\d+\.\s/, ''), subItems: [] });
          i++;
        } else if ((cur.startsWith('   ') || cur.startsWith('\t')) && curTrimmed.startsWith('- ') && items.length > 0) {
          items[items.length - 1].subItems.push(curTrimmed.slice(2));
          i++;
        } else {
          break;
        }
      }
      elements.push(
        <Box
          key={`ol-${i}`}
          component="ol"
          sx={{
            pl: 2.5,
            mb: 1.5,
            mt: 0.5,
            '& > li': {
              mb: 0.75,
              color: 'text.primary',
              fontSize: '0.875rem',
              lineHeight: 1.7,
            },
            '& > li::marker': {
              color: theme.palette.primary.main,
              fontWeight: 600,
            },
          }}
        >
          {items.map((item, li) => (
            <li key={li}>
              {parseInline(item.text)}
              {item.subItems.length > 0 && (
                <Box
                  component="ul"
                  sx={{
                    pl: 2,
                    mt: 0.25,
                    '& li': { mb: 0.25, fontSize: '0.875rem', lineHeight: 1.7 },
                    '& li::marker': { color: theme.palette.text.secondary },
                  }}
                >
                  {item.subItems.map((si, sii) => (
                    <li key={sii}>{parseInline(si)}</li>
                  ))}
                </Box>
              )}
            </li>
          ))}
        </Box>
      );
      continue;
    }

    // Unordered list: - item
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: { text: string; indent: number; subItems: string[] }[] = [];
      while (i < lines.length) {
        const cur = lines[i];
        const curTrimmed = cur.trim();
        // Top-level bullet
        if (/^[-*]\s/.test(curTrimmed) && !cur.startsWith('  ')) {
          items.push({ text: curTrimmed.slice(2), indent: 0, subItems: [] });
          i++;
        }
        // Sub-bullet (indented)
        else if ((cur.startsWith('  ') || cur.startsWith('\t')) && /^[-*]\s/.test(curTrimmed) && items.length > 0) {
          items[items.length - 1].subItems.push(curTrimmed.slice(2));
          i++;
        } else {
          break;
        }
      }
      elements.push(
        <Box
          key={`ul-${i}`}
          component="ul"
          sx={{
            pl: 2.5,
            mb: 1.5,
            mt: 0.5,
            '& > li': {
              mb: 0.5,
              color: 'text.primary',
              fontSize: '0.875rem',
              lineHeight: 1.7,
            },
            '& > li::marker': {
              color: theme.palette.primary.main,
            },
          }}
        >
          {items.map((item, li) => (
            <li key={li}>
              {parseInline(item.text)}
              {item.subItems.length > 0 && (
                <Box
                  component="ul"
                  sx={{
                    pl: 2,
                    mt: 0.25,
                    '& li': { mb: 0.25, fontSize: '0.875rem', lineHeight: 1.7 },
                    '& li::marker': { color: theme.palette.text.secondary },
                  }}
                >
                  {item.subItems.map((si, sii) => (
                    <li key={sii}>{parseInline(si)}</li>
                  ))}
                </Box>
              )}
            </li>
          ))}
        </Box>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <Typography key={i} variant="body2" sx={{ lineHeight: 1.7, mb: 1.25, color: 'text.primary' }}>
        {parseInline(trimmed)}
      </Typography>
    );
    i++;
  }

  return (
    <Box
      sx={{
        '& > *:first-of-type': { mt: 0 },
        '& > *:last-child': { mb: 0 },
      }}
    >
      {elements}
    </Box>
  );
};

export default MarkdownRenderer;
