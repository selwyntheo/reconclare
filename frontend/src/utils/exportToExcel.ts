/**
 * CSV/Excel export utility for AG-Grid data.
 * Uses CSV format with BOM for proper Excel compatibility.
 */

interface ExportColumn {
  headerName: string;
  field?: string;
  valueGetter?: (row: any) => any;
}

export function exportToCsv(
  filename: string,
  columns: ExportColumn[],
  rows: any[],
): void {
  const BOM = '\uFEFF';
  const header = columns.map((c) => `"${c.headerName}"`).join(',');
  const csvRows = rows.map((row) =>
    columns
      .map((col) => {
        const value = col.valueGetter ? col.valueGetter(row) : row[col.field || ''];
        if (value === null || value === undefined) return '""';
        const str = String(value).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(','),
  );
  const csvContent = BOM + [header, ...csvRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
