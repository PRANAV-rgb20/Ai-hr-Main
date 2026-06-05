/**
 * Export an array of objects to a CSV file download.
 * @param {Object[]} data - Array of plain objects
 * @param {string} filename - Filename without .csv extension
 */
export const exportToCsv = (data, filename) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data
    .map((row) =>
      Object.values(row)
        .map((v) => (v === null || v === undefined ? '' : String(v).replace(/,/g, ';')))
        .join(',')
    )
    .join('\n');
  const blob = new Blob([headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
