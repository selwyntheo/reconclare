/**
 * MappingCanvas - SVG overlay for all connection lines.
 */

import React, { forwardRef } from 'react';
import { Box } from '@mui/material';
import { ConnectionLine } from '../../types/glMapping';
import MappingLine from './MappingLine';

interface MappingCanvasProps {
  lines: ConnectionLine[];
  onLineClick: (mappingId: string) => void;
  onCanvasClick: () => void;
}

const MappingCanvas = forwardRef<SVGSVGElement, MappingCanvasProps>(
  ({ lines, onLineClick, onCanvasClick }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      // Only deselect if clicking on the canvas background
      if (e.target === e.currentTarget) {
        onCanvasClick();
      }
    };

    return (
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <svg
          ref={ref}
          width="100%"
          height="100%"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'all',
          }}
          onClick={handleClick}
        >
          <defs>
            {/* Gradient for line highlighting */}
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2E7D32" />
              <stop offset="100%" stopColor="#4A90D9" />
            </linearGradient>
            {/* Arrow marker for direction */}
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#2E7D32" />
            </marker>
          </defs>
          {lines.map((line) => (
            <MappingLine
              key={line.id}
              line={line}
              onClick={onLineClick}
            />
          ))}
        </svg>
      </Box>
    );
  }
);

MappingCanvas.displayName = 'MappingCanvas';

export default MappingCanvas;
