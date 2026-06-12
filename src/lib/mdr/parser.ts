// Parser de logs SMS estilo NEXVIA / CDR-MDR (streaming).
// Lee cada línea separada por tabs:
// fecha \t cuenta \t id \t direccion \t origen \t destino \t texto \t ... \t operador \t ...
export type MdrRow = {
  fecha: string;
  cuenta: string;
  direccion: string; // OUT / RECEIVED / IN
  origen: string;
  destino: string;
  operador: string;
  estado: string; // DELIVRD / FAILED / ...
};

const STATUS_RE = /stat:([A-Z]+)/;

export function parseLine(line: string): MdrRow | null {
  if (!line || !line.trim()) return null;
  const parts = line.split("\t");
  if (parts.length < 6) return null;
  const [fecha, cuenta, , direccion, origen, destino, texto, , operador] = parts;
  let estado = "—";
  if (texto) {
    const m = texto.match(STATUS_RE);
    if (m) estado = m[1];
  }
  if (direccion === "RECEIVED") estado = "RECEIVED";
  return {
    fecha: (fecha || "").slice(0, 10),
    cuenta: cuenta || "",
    direccion: direccion || "",
    origen: origen || "",
    destino: destino || "",
    operador: operador || cuenta || "—",
    estado,
  };
}

export type MdrSummary = {
  total: number;
  out: number;
  in: number;
  delivered: number;
  failed: number;
  porOperador: Record<string, { total: number; delivered: number; failed: number; out: number; in: number }>;
  porDia: Record<string, { total: number; delivered: number; failed: number }>;
  porCuenta: Record<string, number>;
  fechaDesde?: string;
  fechaHasta?: string;
};

export function emptySummary(): MdrSummary {
  return { total: 0, out: 0, in: 0, delivered: 0, failed: 0, porOperador: {}, porDia: {}, porCuenta: {} };
}

export function accumulate(s: MdrSummary, r: MdrRow) {
  s.total++;
  if (r.direccion === "OUT") s.out++;
  if (r.direccion === "RECEIVED" || r.direccion === "IN") s.in++;
  if (r.estado === "DELIVRD") s.delivered++;
  else if (r.estado && r.estado !== "RECEIVED" && r.estado !== "—") s.failed++;

  const op = r.operador || "—";
  if (!s.porOperador[op]) s.porOperador[op] = { total: 0, delivered: 0, failed: 0, out: 0, in: 0 };
  const o = s.porOperador[op];
  o.total++;
  if (r.direccion === "OUT") o.out++;
  if (r.direccion === "RECEIVED" || r.direccion === "IN") o.in++;
  if (r.estado === "DELIVRD") o.delivered++;
  else if (r.estado && r.estado !== "RECEIVED" && r.estado !== "—") o.failed++;

  if (r.fecha) {
    if (!s.porDia[r.fecha]) s.porDia[r.fecha] = { total: 0, delivered: 0, failed: 0 };
    s.porDia[r.fecha].total++;
    if (r.estado === "DELIVRD") s.porDia[r.fecha].delivered++;
    else if (r.estado && r.estado !== "RECEIVED" && r.estado !== "—") s.porDia[r.fecha].failed++;
    if (!s.fechaDesde || r.fecha < s.fechaDesde) s.fechaDesde = r.fecha;
    if (!s.fechaHasta || r.fecha > s.fechaHasta) s.fechaHasta = r.fecha;
  }

  if (r.cuenta) s.porCuenta[r.cuenta] = (s.porCuenta[r.cuenta] || 0) + 1;
}

// Streaming parser para archivos enormes (>1GB)
export async function parseFileStream(
  file: File,
  onProgress?: (bytesRead: number, totalBytes: number, summary: MdrSummary) => void,
): Promise<MdrSummary> {
  const summary = emptySummary();
  const reader = file.stream().getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let buffer = "";
  let bytesRead = 0;
  const total = file.size;
  let lastReport = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      const r = parseLine(line);
      if (r) accumulate(summary, r);
    }
    if (onProgress && bytesRead - lastReport > 2_000_000) {
      onProgress(bytesRead, total, summary);
      lastReport = bytesRead;
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  if (buffer.trim()) {
    const r = parseLine(buffer);
    if (r) accumulate(summary, r);
  }
  if (onProgress) onProgress(total, total, summary);
  return summary;
}

export function parseText(text: string): MdrSummary {
  const s = emptySummary();
  for (const line of text.split(/\r?\n/)) {
    const r = parseLine(line);
    if (r) accumulate(s, r);
  }
  return s;
}
