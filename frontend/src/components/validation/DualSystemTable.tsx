import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Chip,
} from '@mui/material';
import { ValidationStatus } from '../shared/ValidationStatus';
import { DualSystemCheck } from '../../types';

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return '';
  return v < 0
    ? `(${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
    : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface DualSystemTableProps {
  checks: DualSystemCheck[];
  label?: string;
}

const DualSystemTable: React.FC<DualSystemTableProps> = ({ checks, label }) => (
  <>
    {label && (
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{label}</Typography>
    )}
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Check</TableCell>
          <TableCell align="center" colSpan={3} sx={{ borderLeft: '2px solid #e0e0e0' }}>
            <Chip label="BNY (CPU)" size="small" color="primary" variant="outlined" />
          </TableCell>
          <TableCell align="center" colSpan={3} sx={{ borderLeft: '2px solid #e0e0e0' }}>
            <Chip label="Incumbent" size="small" color="secondary" variant="outlined" />
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell />
          <TableCell align="right" sx={{ borderLeft: '2px solid #e0e0e0' }}>LHS</TableCell>
          <TableCell align="right">RHS</TableCell>
          <TableCell align="center">Status</TableCell>
          <TableCell align="right" sx={{ borderLeft: '2px solid #e0e0e0' }}>LHS</TableCell>
          <TableCell align="right">RHS</TableCell>
          <TableCell align="center">Status</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {checks.map((check) => (
          <TableRow key={check.checkName}>
            <TableCell>
              <Typography variant="body2" fontWeight={500}>{check.checkName}</Typography>
            </TableCell>
            <TableCell align="right" sx={{ borderLeft: '2px solid #e0e0e0' }}>{formatCurrency(check.cpu.lhsValue)}</TableCell>
            <TableCell align="right">{formatCurrency(check.cpu.rhsValue)}</TableCell>
            <TableCell align="center"><ValidationStatus status={check.cpu.validationStatus} /></TableCell>
            <TableCell align="right" sx={{ borderLeft: '2px solid #e0e0e0' }}>{formatCurrency(check.incumbent.lhsValue)}</TableCell>
            <TableCell align="right">{formatCurrency(check.incumbent.rhsValue)}</TableCell>
            <TableCell align="center"><ValidationStatus status={check.incumbent.validationStatus} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </>
);

export default DualSystemTable;
