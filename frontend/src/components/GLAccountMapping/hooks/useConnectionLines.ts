/**
 * Calculate SVG connection line positions for mapping visualization.
 * Updates positions when elements scroll or resize.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GLAccountMapping, ConnectionLine, MappingType } from '../../../types/glMapping';

export interface UseConnectionLinesProps {
  mappings: GLAccountMapping[];
  selectedMappingId: string | null;
  incumbentColumnRef: React.RefObject<HTMLDivElement | null>;
  eagleColumnRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<SVGSVGElement | null>;
}

export interface UseConnectionLinesResult {
  lines: ConnectionLine[];
  updateLines: () => void;
}

export function useConnectionLines({
  mappings,
  selectedMappingId,
  incumbentColumnRef,
  eagleColumnRef,
  canvasRef,
}: UseConnectionLinesProps): UseConnectionLinesResult {
  const [lines, setLines] = useState<ConnectionLine[]>([]);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  const calculateLines = useCallback(() => {
    if (!incumbentColumnRef.current || !eagleColumnRef.current || !canvasRef.current) {
      return [];
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const incumbentRect = incumbentColumnRef.current.getBoundingClientRect();
    const eagleRect = eagleColumnRef.current.getBoundingClientRect();

    const newLines: ConnectionLine[] = [];

    for (const mapping of mappings) {
      // Find the source element in the incumbent column
      const sourceElement = incumbentColumnRef.current.querySelector(
        `[data-account-number="${mapping.sourceGlAccountNumber}"]`
      );

      // Find the target element in the eagle column
      const targetElement = eagleColumnRef.current.querySelector(
        `[data-account-number="${mapping.targetGlAccountNumber}"]`
      );

      if (!sourceElement || !targetElement) {
        continue;
      }

      const sourceRect = sourceElement.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();

      // Check if elements are visible within their scroll containers
      const sourceVisible =
        sourceRect.bottom > incumbentRect.top &&
        sourceRect.top < incumbentRect.bottom;
      const targetVisible =
        targetRect.bottom > eagleRect.top &&
        targetRect.top < eagleRect.bottom;

      if (!sourceVisible && !targetVisible) {
        continue;
      }

      // Calculate positions relative to canvas
      const sourcePosition = {
        x: sourceRect.right - canvasRect.left,
        y: Math.max(
          incumbentRect.top - canvasRect.top,
          Math.min(sourceRect.top + sourceRect.height / 2 - canvasRect.top, incumbentRect.bottom - canvasRect.top)
        ),
      };

      const targetPosition = {
        x: targetRect.left - canvasRect.left,
        y: Math.max(
          eagleRect.top - canvasRect.top,
          Math.min(targetRect.top + targetRect.height / 2 - canvasRect.top, eagleRect.bottom - canvasRect.top)
        ),
      };

      newLines.push({
        id: `line-${mapping.mappingId}`,
        mappingId: mapping.mappingId,
        sourceAccountNumber: mapping.sourceGlAccountNumber,
        targetAccountNumber: mapping.targetGlAccountNumber,
        mappingType: mapping.mappingType as MappingType,
        splitWeight: mapping.splitWeight,
        groupId: mapping.groupId,
        isSelected: selectedMappingId === mapping.mappingId,
        sourcePosition,
        targetPosition,
      });
    }

    return newLines;
  }, [mappings, selectedMappingId, incumbentColumnRef, eagleColumnRef, canvasRef]);

  const updateLines = useCallback(() => {
    const newLines = calculateLines();
    setLines(newLines);
  }, [calculateLines]);

  // Set up scroll listeners
  useEffect(() => {
    const incumbentColumn = incumbentColumnRef.current;
    const eagleColumn = eagleColumnRef.current;

    if (incumbentColumn) {
      incumbentColumn.addEventListener('scroll', updateLines);
    }
    if (eagleColumn) {
      eagleColumn.addEventListener('scroll', updateLines);
    }

    return () => {
      if (incumbentColumn) {
        incumbentColumn.removeEventListener('scroll', updateLines);
      }
      if (eagleColumn) {
        eagleColumn.removeEventListener('scroll', updateLines);
      }
    };
  }, [incumbentColumnRef, eagleColumnRef, updateLines]);

  // Set up resize observer
  useEffect(() => {
    resizeObserver.current = new ResizeObserver(() => {
      updateLines();
    });

    if (incumbentColumnRef.current) {
      resizeObserver.current.observe(incumbentColumnRef.current);
    }
    if (eagleColumnRef.current) {
      resizeObserver.current.observe(eagleColumnRef.current);
    }

    return () => {
      resizeObserver.current?.disconnect();
    };
  }, [incumbentColumnRef, eagleColumnRef, updateLines]);

  // Update lines when mappings change
  useEffect(() => {
    updateLines();
  }, [mappings, selectedMappingId, updateLines]);

  // Update lines on window resize
  useEffect(() => {
    window.addEventListener('resize', updateLines);
    return () => {
      window.removeEventListener('resize', updateLines);
    };
  }, [updateLines]);

  return { lines, updateLines };
}

// ── Line Path Generator ──────────────────────────────────────

export function generateLinePath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  mappingType: MappingType
): string {
  const dx = target.x - source.x;
  const controlOffset = Math.min(Math.abs(dx) * 0.4, 100);

  // Create a bezier curve
  const path = `M ${source.x} ${source.y} C ${source.x + controlOffset} ${source.y}, ${target.x - controlOffset} ${target.y}, ${target.x} ${target.y}`;

  return path;
}

// ── Line Style Generator ─────────────────────────────────────

export function getLineStyle(
  mappingType: MappingType,
  isSelected: boolean
): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
} {
  const baseWidth = isSelected ? 3 : 2;

  switch (mappingType) {
    case 'ONE_TO_ONE':
      return {
        stroke: isSelected ? '#1B3A5C' : '#2E7D32',
        strokeWidth: baseWidth,
      };
    case 'ONE_TO_MANY':
      return {
        stroke: isSelected ? '#1B3A5C' : '#0288D1',
        strokeWidth: baseWidth,
      };
    case 'MANY_TO_ONE':
      return {
        stroke: isSelected ? '#1B3A5C' : '#4A90D9',
        strokeWidth: baseWidth,
      };
    default:
      return {
        stroke: isSelected ? '#1B3A5C' : '#9E9E9E',
        strokeWidth: baseWidth,
      };
  }
}

export default useConnectionLines;
