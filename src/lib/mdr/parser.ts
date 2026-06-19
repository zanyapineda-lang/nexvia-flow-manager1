// Parser de logs SMS A2P NEXVIA — streaming, identificación de operador Colombia y detección de fraude.
// Formato esperado (TAB-separated):
// fecha \t cuenta \t seq \t OUT|RECEIVED \t origen \t destino \t contenido \t 0x0 \t PRV_OPERADOR \t ...

export type OperatorInfo = {
  name: "TIGO" | "ÉXITO" | "MOVISTAR" | "CLARO" | "WOM" | "VIRGIN" | "OTRO";
  color: string;
  bg: string;
};

// Bloques de numeración Colombia (sin indicativo 57).
// WOM tiene prioridad en 302; los demás por inclusión directa.
const OP_BY_PREFIX: Record<string, OperatorInfo> = {};
const PUSH = (prefixes: string[], info: OperatorInfo) => {
  prefixes.forEach((p) => (OP_BY_PREFIX[p] = info));
};
PUSH(["300", "301", "303", "304"], { name: "TIGO", color: "#2563EB", bg: "#EFF6FF" });
PUSH(["305", "333"], { name: "ÉXITO", color: "#EAB308", bg: "#FEFCE8" });
PUSH(["315", "316", "317", "318"], { name: "MOVISTAR", color: "#16A34A", bg: "#F0FDF4" });
PUSH(["310", "311", "312", "313", "314"], { name: "CLARO", color: "#DC2626", bg: "#FEF2F2" });
PUSH(["319"], { name: "VIRGIN", color: "#EC4899", bg: "#FDF2F8" });
// WOM al final para asegurar prioridad sobre TIGO en 302
PUSH(["302", "323", "324", "350"], { name: "WOM", color: "#7C3AED", bg: "#F3F0FF" });

const OP_OTRO: OperatorInfo = { name: "OTRO", color: "#6B7280", bg: "#F9FAFB" };

export function getOperatorByDestino(phone: string): OperatorInfo {
  if (!phone) return OP_OTRO;
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("57") && digits.length > 10 ? digits.slice(2) : digits;
  const prefix = local.substring(0, 3);
  return OP_BY_PREFIX[prefix] || OP_OTRO;
}

export type MdrRow = {
  fecha: string; // YYYY-MM-DD
  hora: number; // 0-23
  cuenta: string;
  direccion: string;
  origen: string;
  destino: string;
  contenido: string;
  operadorCarrier: string; // detectado por número (TIGO, CLARO, ...)
  operadorPrv: string; // proveedor en log (PRV_CLARO, etc.)
  prefijo: string; // 3 dígitos
  estado: string;
};

const STATUS_RE = /stat:([A-Z]+)/;

export function parseLine(line: string): MdrRow | null {
  if (!line || !line.trim()) return null;
  const parts = line.split("\t");
  if (parts.length < 6) return null;
  const [tsRaw, cuenta, , direccion, origen, destino, contenido, , operadorPrv] = parts;
  const ts = tsRaw || "";
  const fecha = ts.slice(0, 10);
  const horaStr = ts.slice(11, 13);
  const hora = /^\d{2}$/.test(horaStr) ? parseInt(horaStr, 10) : -1;
  const op = getOperatorByDestino(destino || "");
  let estado = "—";
  if (contenido) {
    const m = contenido.match(STATUS_RE);
    if (m) estado = m[1];
  }
  if (direccion === "RECEIVED") estado = "RECEIVED";
  return {
    fecha,
    hora,
    cuenta: cuenta || "",
    direccion: direccion || "",
    origen: origen || "",
    destino: destino || "",
    contenido: contenido || "",
    operadorCarrier: op.name,
    operadorPrv: operadorPrv || cuenta || "—",
    prefijo: (destino.replace(/\D/g, "").replace(/^57/, "").substring(0, 3)) || "—",
    estado,
  };
}

// ---------------- Fraude ----------------
export type FraudRisk = "alto" | "medio";
export type FraudPattern =
  | "ip_url"
  | "tld_sospechoso"
  | "headers_garbled"
  | "template_sin_resolver"
  | "apuestas"
  | "smishing_bancario"
  | "trial";

export type FraudHit = {
  fecha: string;
  hora: number;
  riesgo: FraudRisk;
  origen: string;
  destino: string;
  operador: string;
  patrones: FraudPattern[];
  preview: string;
};

const IP_URL_RE = /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}/i;
const TLD_RE = /https?:\/\/[^\s]+\.(?:online|xyz|bet|click|top|win)\b/i;
const GARBLED_RE = /[ÃÂ¥@¥]{2,}|[\u0080-\u009F]/;
const TEMPLATE_RE = /\$\{[^}]+\}/;
const TRIAL_RE = /\[TRIAL\]/i;
const APUESTAS_KW = /(Mundo\s*Winner|giros\s*gratis|cofre|templo|bono\s*doble|casino|tragamonedas|ruleta)/i;
const BANCO_KW = /(200\.?000\s*pesos|compensaci[oó]n|revise\s*su\s*saldo|bloqueo\s*de\s*cuenta|verifique\s*su\s*tarjeta)/i;

export function detectFraud(row: MdrRow): FraudHit | null {
  const text = row.contenido || "";
  const patrones: FraudPattern[] = [];
  if (IP_URL_RE.test(text)) patrones.push("ip_url");
  if (TLD_RE.test(text)) patrones.push("tld_sospechoso");
  if (GARBLED_RE.test(text)) patrones.push("headers_garbled");
  if (TEMPLATE_RE.test(text)) patrones.push("template_sin_resolver");
  if (APUESTAS_KW.test(text)) patrones.push("apuestas");
  if (BANCO_KW.test(text)) patrones.push("smishing_bancario");
  if (TRIAL_RE.test(text)) patrones.push("trial");
  if (patrones.length === 0) return null;
  const altoSet: FraudPattern[] = ["ip_url", "smishing_bancario", "apuestas", "tld_sospechoso"];
  const riesgo: FraudRisk = patrones.some((p) => altoSet.includes(p)) ? "alto" : "medio";
  return {
    fecha: row.fecha,
    hora: row.hora,
    riesgo,
    origen: row.origen,
    destino: row.destino,
    operador: row.operadorCarrier,
    patrones,
    preview: text.slice(0, 140),
  };
}

// ---------------- Summary ----------------
export type OperatorBucket = {
  total: number;
  delivered: number;
  failed: number;
  out: number;
  in: number;
  color: string;
};

export type MdrSummary = {
  total: number;
  out: number;
  in: number;
  delivered: number;
  failed: number;
  sinEstado: number;
  porOperador: Record<string, OperatorBucket>;
  porPrefijo: Record<string, { total: number; operador: string; color: string }>;
  porDia: Record<string, { total: number; delivered: number; failed: number }>;
  porCuenta: Record<string, number>;
  porHora: number[]; // 24 buckets de OUT
  topDestinos: Record<string, { total: number; operador: string; color: string }>;
  fraude: {
    total: number;
    alto: number;
    medio: number;
    porPatron: Record<FraudPattern, number>;
    muestras: FraudHit[]; // hasta 200
  };
  ultimos: MdrRow[]; // últimos 50 OUT
  fechaDesde?: string;
  fechaHasta?: string;
};

export function emptySummary(): MdrSummary {
  return {
    total: 0,
    out: 0,
    in: 0,
    delivered: 0,
    failed: 0,
    sinEstado: 0,
    porOperador: {},
    porPrefijo: {},
    porDia: {},
    porCuenta: {},
    porHora: new Array(24).fill(0),
    topDestinos: {},
    fraude: {
      total: 0,
      alto: 0,
      medio: 0,
      porPatron: {
        ip_url: 0,
        tld_sospechoso: 0,
        headers_garbled: 0,
        template_sin_resolver: 0,
        apuestas: 0,
        smishing_bancario: 0,
        trial: 0,
      },
      muestras: [],
    },
    ultimos: [],
  };
}

const OP_COLORS: Record<string, string> = {
  TIGO: "#2563EB",
  ÉXITO: "#EAB308",
  MOVISTAR: "#16A34A",
  CLARO: "#DC2626",
  WOM: "#7C3AED",
  VIRGIN: "#EC4899",
  OTRO: "#6B7280",
};

export function accumulate(s: MdrSummary, r: MdrRow) {
  s.total++;
  const isOut = r.direccion === "OUT";
  const isIn = r.direccion === "RECEIVED" || r.direccion === "IN";
  if (isOut) s.out++;
  if (isIn) s.in++;

  const delivrd = r.estado === "DELIVRD";
  const fallido = r.estado && r.estado !== "RECEIVED" && r.estado !== "—" && !delivrd;
  if (delivrd) s.delivered++;
  else if (fallido) s.failed++;
  else if (isOut) s.sinEstado++;

  // operador carrier (por destino)
  if (isOut) {
    const opName = r.operadorCarrier;
    const color = OP_COLORS[opName] || "#6B7280";
    if (!s.porOperador[opName])
      s.porOperador[opName] = { total: 0, delivered: 0, failed: 0, out: 0, in: 0, color };
    const o = s.porOperador[opName];
    o.total++;
    o.out++;
    if (delivrd) o.delivered++;
    else if (fallido) o.failed++;

    // por prefijo
    if (r.prefijo && r.prefijo !== "—") {
      if (!s.porPrefijo[r.prefijo])
        s.porPrefijo[r.prefijo] = { total: 0, operador: opName, color };
      s.porPrefijo[r.prefijo].total++;
    }

    // por hora
    if (r.hora >= 0 && r.hora <= 23) s.porHora[r.hora]++;

    // top destinos
    if (r.destino) {
      if (!s.topDestinos[r.destino])
        s.topDestinos[r.destino] = { total: 0, operador: opName, color };
      s.topDestinos[r.destino].total++;
    }

    // últimos eventos OUT (mantener tamaño 50)
    s.ultimos.push(r);
    if (s.ultimos.length > 50) s.ultimos.shift();
  }

  if (r.fecha) {
    if (!s.porDia[r.fecha]) s.porDia[r.fecha] = { total: 0, delivered: 0, failed: 0 };
    if (isOut) {
      s.porDia[r.fecha].total++;
      if (delivrd) s.porDia[r.fecha].delivered++;
      else if (fallido) s.porDia[r.fecha].failed++;
    }
    if (!s.fechaDesde || r.fecha < s.fechaDesde) s.fechaDesde = r.fecha;
    if (!s.fechaHasta || r.fecha > s.fechaHasta) s.fechaHasta = r.fecha;
  }

  if (r.cuenta) s.porCuenta[r.cuenta] = (s.porCuenta[r.cuenta] || 0) + 1;

  // fraude (analiza todo el tráfico, incluso entrante)
  const hit = detectFraud(r);
  if (hit) {
    s.fraude.total++;
    if (hit.riesgo === "alto") s.fraude.alto++;
    else s.fraude.medio++;
    hit.patrones.forEach((p) => s.fraude.porPatron[p]++);
    if (s.fraude.muestras.length < 200) s.fraude.muestras.push(hit);
  }
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

export { OP_COLORS };
