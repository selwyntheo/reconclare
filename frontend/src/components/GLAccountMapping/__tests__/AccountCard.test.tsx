/**
 * Tests for AccountCard component.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import AccountCard from '../AccountCard';
import { IncumbentGLAccount, EagleGLAccount } from '../../../types/glMapping';

// Mock account data
const mockIncumbentAccount: IncumbentGLAccount = {
  glAccountNumber: '1050',
  glAccountDescription: 'CASH',
  ledgerSection: 'ASSETS',
  provider: 'STATE_STREET',
};

const mockEagleAccount: EagleGLAccount = {
  glAccountNumber: 'EAGLE-1050',
  glAccountDescription: 'Cash Account',
  ledgerSection: 'ASSETS',
  category: 'Cash',
};

// Wrapper component for DnD context
const DndWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DndContext>{children}</DndContext>
);

describe('AccountCard', () => {
  const defaultProps = {
    account: mockIncumbentAccount,
    type: 'INCUMBENT_ACCOUNT' as const,
    isMapped: false,
    isSelected: false,
    isDropTarget: false,
    onClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders account number and description', () => {
    render(
      <DndWrapper>
        <AccountCard {...defaultProps} />
      </DndWrapper>
    );

    expect(screen.getByText('1050')).toBeInTheDocument();
    expect(screen.getByText('CASH')).toBeInTheDocument();
  });

  it('shows unmapped status when not mapped', () => {
    render(
      <DndWrapper>
        <AccountCard {...defaultProps} isMapped={false} />
      </DndWrapper>
    );

    expect(screen.getByText(/ASSETS/)).toBeInTheDocument();
  });

  it('shows mapping type chip when mapped', () => {
    render(
      <DndWrapper>
        <AccountCard {...defaultProps} isMapped={true} mappingType="ONE_TO_ONE" />
      </DndWrapper>
    );

    expect(screen.getByText('1:1')).toBeInTheDocument();
  });

  it('shows 1:N chip for one-to-many mappings', () => {
    render(
      <DndWrapper>
        <AccountCard {...defaultProps} isMapped={true} mappingType="ONE_TO_MANY" />
      </DndWrapper>
    );

    expect(screen.getByText('1:N')).toBeInTheDocument();
  });

  it('shows N:1 chip for many-to-one mappings', () => {
    render(
      <DndWrapper>
        <AccountCard {...defaultProps} isMapped={true} mappingType="MANY_TO_ONE" />
      </DndWrapper>
    );

    expect(screen.getByText('N:1')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(
      <DndWrapper>
        <AccountCard {...defaultProps} onClick={onClick} />
      </DndWrapper>
    );

    const card = screen.getByText('1050');
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalled();
  });

  it('displays provider for incumbent accounts', () => {
    render(
      <DndWrapper>
        <AccountCard {...defaultProps} account={mockIncumbentAccount} />
      </DndWrapper>
    );

    expect(screen.getByText(/STATE_STREET/)).toBeInTheDocument();
  });

  it('displays category for eagle accounts', () => {
    render(
      <DndWrapper>
        <AccountCard
          {...defaultProps}
          account={mockEagleAccount}
          type="EAGLE_ACCOUNT"
        />
      </DndWrapper>
    );

    // Category appears in the caption line
    expect(screen.getByText(/Cash Account/)).toBeInTheDocument();
  });

  it('has data-account-number attribute for connection lines', () => {
    render(
      <DndWrapper>
        <AccountCard {...defaultProps} />
      </DndWrapper>
    );

    expect(screen.getByText('1050')).toBeInTheDocument();
  });
});
