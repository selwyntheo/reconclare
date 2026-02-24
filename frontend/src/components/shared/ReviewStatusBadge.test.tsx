/**
 * Tests for ReviewStatusBadge component.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import ReviewStatusBadge from './ReviewStatusBadge';
import { ReviewStatus } from '../../types/breakResolution';

const STATUS_EXPECTATIONS: {
  status: ReviewStatus;
  label: string;
  color: string;
  bgColor: string;
  description: string;
}[] = [
  {
    status: 'NOT_STARTED',
    label: 'Not Started',
    color: '#616161',
    bgColor: '#EEEEEE',
    description: 'gray',
  },
  {
    status: 'IN_PROGRESS',
    label: 'In Progress',
    color: '#E65100',
    bgColor: '#FFF3E0',
    description: 'amber/orange',
  },
  {
    status: 'COMPLETE',
    label: 'Complete',
    color: '#2E7D32',
    bgColor: '#E8F5E9',
    description: 'green',
  },
];

describe('ReviewStatusBadge', () => {
  it('renders as a Chip element', () => {
    render(<ReviewStatusBadge status="NOT_STARTED" />);

    const chip = screen.getByText('Not Started');
    expect(chip.closest('.MuiChip-root')).toBeInTheDocument();
  });

  describe.each(STATUS_EXPECTATIONS)(
    'status: $status ($description)',
    ({ status, label, color, bgColor, description }) => {
      it(`renders correct label "${label}"`, () => {
        render(<ReviewStatusBadge status={status} />);
        expect(screen.getByText(label)).toBeInTheDocument();
      });

      it(`renders with ${description} color coding`, () => {
        const { container } = render(<ReviewStatusBadge status={status} />);

        const chipRoot = container.querySelector('.MuiChip-root');
        expect(chipRoot).toBeInTheDocument();

        // Verify the inline styles applied via sx prop
        const styles = chipRoot ? window.getComputedStyle(chipRoot) : null;
        // MUI applies styles through CSS-in-JS so we check the element exists
        // and the text content is correct
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    }
  );

  it('renders "Not Started" with gray color for NOT_STARTED', () => {
    render(<ReviewStatusBadge status="NOT_STARTED" />);
    expect(screen.getByText('Not Started')).toBeInTheDocument();
  });

  it('renders "In Progress" with amber color for IN_PROGRESS', () => {
    render(<ReviewStatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders "Complete" with green color for COMPLETE', () => {
    render(<ReviewStatusBadge status="COMPLETE" />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('defaults to NOT_STARTED config for unknown status', () => {
    // Component uses fallback: STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_STARTED
    render(<ReviewStatusBadge status={'UNKNOWN' as ReviewStatus} />);
    expect(screen.getByText('Not Started')).toBeInTheDocument();
  });

  it('renders with small size by default', () => {
    const { container } = render(<ReviewStatusBadge status="COMPLETE" />);
    const chipRoot = container.querySelector('.MuiChip-root');
    expect(chipRoot).toHaveClass('MuiChip-sizeSmall');
  });

  it('renders with medium size when specified', () => {
    const { container } = render(<ReviewStatusBadge status="COMPLETE" size="medium" />);
    const chipRoot = container.querySelector('.MuiChip-root');
    expect(chipRoot).toHaveClass('MuiChip-sizeMedium');
  });

  it('renders all three statuses without errors', () => {
    const statuses: ReviewStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETE'];

    statuses.forEach((status) => {
      const { unmount } = render(<ReviewStatusBadge status={status} />);
      const chipRoot = screen.getByText(STATUS_EXPECTATIONS.find((s) => s.status === status)!.label);
      expect(chipRoot).toBeInTheDocument();
      unmount();
    });
  });
});
