export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    const blob = new Blob(["(no data)"], { type: "text/csv" });
    triggerDownload(blob, filename);
    return;
  }
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

// parseCSV reads a CSV string (with a header row) into an array of objects keyed
// by header. Handles quoted fields, escaped quotes ("") and commas/newlines
// inside quotes. Empty cells become "". Used by the bulk-import wizard.
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
      return obj;
    });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printHTML(title: string, bodyHTML: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;padding:32px;color:#0f172a}
      h1{margin:0 0 4px;font-size:22px}
      h2{font-size:14px;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.05em;color:#475569}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
      th,td{padding:8px 6px;border-bottom:1px solid #e2e8f0;text-align:left}
      th{background:#f1f5f9;font-weight:600}
      .right{text-align:right}
      .muted{color:#64748b;font-size:12px}
      .totals{margin-top:14px;float:right;width:280px}
      .totals .row{display:flex;justify-content:space-between;padding:4px 0}
      .totals .grand{border-top:2px solid #0f172a;margin-top:6px;padding-top:8px;font-weight:700;font-size:16px}
      .brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:18px}
      .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#dcfce7;color:#166534;font-size:11px;font-weight:600}
    </style></head><body>${bodyHTML}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 250);
}
