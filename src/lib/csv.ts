type Cell = string | number | null | undefined;

/** Quotes every field and neutralizes spreadsheet formulas in text. */
export function toCsv(rows: Cell[][]) {
  const escape = (value: Cell) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return String(value);
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return rows.map((row) => row.map(escape).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, rows: Cell[][]) {
  // The BOM makes Excel read UTF-8 (Romanian diacritics) correctly.
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
