/**
 * MappingLine - SVG connection line component for mapping visualization.
 */

import React from 'react';
import { ConnectionLine } from '../../types/glMapping';
import { generateLinePath, getLineStyle } from './hooks';

interface MappingLineProps {
  line: ConnectionLine;
  onClick: (mappingId: string) => void;
}

const MappingLine: React.FC<MappingLineProps> = ({ line, onClick }) => {
  const path = generateLinePath(
    line.sourcePosition,
    line.targetPosition,
    line.mappingType
  );

  const style = getLineStyle(line.mappingType, line.isSelected);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(line.mappingId);
  };

  return (
    <g onClick={handleClick} style={{ cursor: 'pointer' }}>
      {/* Invisible wider path for easier clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
      />
      {/* Visible path */}
      <path
        d={path}
        fill="none"
        stroke={style.stroke}
        strokeWidth={style.strokeWidth}
        strokeDasharray={style.strokeDasharray}
        style={{
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
      />
      {/* Source dot */}
      <circle
        cx={line.sourcePosition.x}
        cy={line.sourcePosition.y}
        r={4}
        fill={style.stroke}
      />
      {/* Target dot */}
      <circle
        cx={line.targetPosition.x}
        cy={line.targetPosition.y}
        r={4}
        fill={style.stroke}
      />
      {/* Split weight label for 1:N mappings */}
      {line.mappingType === 'ONE_TO_MANY' && line.splitWeight < 1 && (
        <text
          x={(line.sourcePosition.x + line.targetPosition.x) / 2}
          y={(line.sourcePosition.y + line.targetPosition.y) / 2 - 8}
          textAnchor="middle"
          fill={style.stroke}
          fontSize={10}
          fontWeight={600}
        >
          {(line.splitWeight * 100).toFixed(0)}%
        </text>
      )}
    </g>
  );
};

export default MappingLine;
