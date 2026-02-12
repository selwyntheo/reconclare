import React from 'react';
import { Box, Tooltip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CancelIcon from '@mui/icons-material/Cancel';
import { ValidationStatusType } from '../../types';

interface ValidationStatusProps {
  status: ValidationStatusType;
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

interface ValidationStatusFromValueProps {
  value: number;
  threshold: number;
  marginalThreshold?: number;
  size?: 'small' | 'medium';
  showLabel?: boolean;
}

const statusConfig: Record<ValidationStatusType, { color: string; icon: React.ReactNode; label: string }> = {
  pass: {
    color: '#2e7d32',
    icon: <CheckCircleIcon />,
    label: 'Pass',
  },
  marginal: {
    color: '#ed6c02',
    icon: <WarningIcon />,
    label: 'Marginal',
  },
  break: {
    color: '#d32f2f',
    icon: <CancelIcon />,
    label: 'Break',
  },
};

export function getValidationStatus(
  value: number,
  threshold: number,
  marginalThreshold?: number
): ValidationStatusType {
  const absValue = Math.abs(value);
  if (absValue < threshold) return 'pass';
  if (marginalThreshold !== undefined && absValue < marginalThreshold) return 'marginal';
  return 'break';
}

export const ValidationStatus: React.FC<ValidationStatusProps> = ({ status, size = 'small', showLabel = false }) => {
  const config = statusConfig[status];
  const iconSize = size === 'small' ? 18 : 22;

  return (
    <Tooltip title={config.label} arrow>
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          color: config.color,
          '& .MuiSvgIcon-root': { fontSize: iconSize },
        }}
        role="img"
        aria-label={`Validation status: ${config.label}`}
      >
        {config.icon}
        {showLabel && (
          <Box component="span" sx={{ fontSize: size === 'small' ? '0.75rem' : '0.85rem', fontWeight: 600 }}>
            {config.label}
          </Box>
        )}
      </Box>
    </Tooltip>
  );
};

export const ValidationStatusFromValue: React.FC<ValidationStatusFromValueProps> = ({
  value,
  threshold,
  marginalThreshold,
  size,
  showLabel,
}) => {
  const status = getValidationStatus(value, threshold, marginalThreshold);
  return <ValidationStatus status={status} size={size} showLabel={showLabel} />;
};

export default ValidationStatus;
