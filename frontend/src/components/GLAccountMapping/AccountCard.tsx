/**
 * AccountCard - Draggable account item with status indicators.
 * Shows account number, description, and mapping status.
 */

import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  Box,
  Typography,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import {
  IncumbentGLAccount,
  EagleGLAccount,
  MappingType,
  DragItemType,
} from '../../types/glMapping';
import { getDraggableId, getIncumbentDroppableId, getEagleDroppableId } from './hooks';

interface AccountCardProps {
  account: IncumbentGLAccount | EagleGLAccount;
  type: DragItemType;
  isMapped: boolean;
  mappingType?: MappingType;
  isSelected: boolean;
  isDropTarget: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const AccountCard: React.FC<AccountCardProps> = ({
  account,
  type,
  isMapped,
  mappingType,
  isSelected,
  isDropTarget,
  onClick,
}) => {
  const theme = useTheme();

  const draggableId = getDraggableId(type, account.glAccountNumber);
  const droppableId =
    type === 'INCUMBENT_ACCOUNT'
      ? getIncumbentDroppableId(account.glAccountNumber)
      : getEagleDroppableId(account.glAccountNumber);

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: draggableId,
    data: {
      type,
      accountNumber: account.glAccountNumber,
      account,
    },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: droppableId,
  });

  // Merge refs
  const setRefs = (node: HTMLDivElement | null) => {
    setDraggableRef(node);
    setDroppableRef(node);
  };

  // Get status color and icon
  const getStatusIndicator = () => {
    if (!isMapped) {
      return {
        color: theme.palette.warning.main,
        icon: <RadioButtonUncheckedIcon sx={{ fontSize: 12 }} />,
        label: 'Unmapped',
      };
    }

    switch (mappingType) {
      case 'ONE_TO_ONE':
        return {
          color: theme.palette.success.main,
          icon: <CircleIcon sx={{ fontSize: 12 }} />,
          label: '1:1',
        };
      case 'ONE_TO_MANY':
        return {
          color: '#0288D1',
          icon: <CircleIcon sx={{ fontSize: 12 }} />,
          label: '1:N',
        };
      case 'MANY_TO_ONE':
        return {
          color: '#4A90D9',
          icon: <CircleIcon sx={{ fontSize: 12 }} />,
          label: 'N:1',
        };
      default:
        return {
          color: theme.palette.success.main,
          icon: <CircleIcon sx={{ fontSize: 12 }} />,
          label: 'Mapped',
        };
    }
  };

  const status = getStatusIndicator();

  return (
    <Box
      ref={setRefs}
      data-account-number={account.glAccountNumber}
      onClick={onClick}
      {...attributes}
      {...listeners}
      sx={{
        p: 1.5,
        mb: 1,
        borderRadius: 1,
        border: `1px solid ${
          isSelected
            ? theme.palette.primary.main
            : isOver || isDropTarget
            ? theme.palette.info.main
            : theme.palette.divider
        }`,
        bgcolor: isDragging
          ? alpha(theme.palette.primary.main, 0.1)
          : isSelected
          ? alpha(theme.palette.primary.main, 0.08)
          : isOver || isDropTarget
          ? alpha(theme.palette.info.main, 0.08)
          : 'background.paper',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        transition: 'all 0.15s ease-in-out',
        '&:hover': {
          borderColor: theme.palette.primary.light,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        },
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
      }}
    >
      {/* Status Indicator */}
      <Box
        sx={{
          mt: 0.5,
          color: status.color,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {status.icon}
      </Box>

      {/* Account Details */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              fontFamily: 'monospace',
              fontSize: '0.8rem',
            }}
          >
            {account.glAccountNumber}
          </Typography>
          {isMapped && mappingType && (
            <Chip
              label={status.label}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                bgcolor: alpha(status.color, 0.1),
                color: status.color,
                fontWeight: 600,
              }}
            />
          )}
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            fontSize: '0.75rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={account.glAccountDescription}
        >
          {account.glAccountDescription}
        </Typography>
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ fontSize: '0.65rem' }}
        >
          {account.ledgerSection}
          {'provider' in account && ` | ${account.provider}`}
          {'category' in account && account.category && ` | ${account.category}`}
        </Typography>
      </Box>
    </Box>
  );
};

export default AccountCard;
