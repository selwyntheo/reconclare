import React from 'react';
import { Chip } from '@mui/material';
import { ReviewStatus } from '../../types/breakResolution';

const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; bgColor: string }> = {
  NOT_STARTED: { label: 'Not Started', color: '#616161', bgColor: '#EEEEEE' },
  IN_PROGRESS: { label: 'In Progress', color: '#E65100', bgColor: '#FFF3E0' },
  COMPLETE: { label: 'Complete', color: '#2E7D32', bgColor: '#E8F5E9' },
};

interface ReviewStatusBadgeProps {
  status: ReviewStatus;
  size?: 'small' | 'medium';
}

export default function ReviewStatusBadge({ status, size = 'small' }: ReviewStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_STARTED;
  return (
    <Chip
      label={config.label}
      size={size}
      sx={{
        bgcolor: config.bgColor,
        color: config.color,
        fontWeight: 600,
        fontSize: size === 'small' ? '0.75rem' : '0.875rem',
      }}
    />
  );
}
