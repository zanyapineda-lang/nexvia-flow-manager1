// Generador de informe ejecutivo NEXVIA pixel-perfect.
// Construye páginas A4 como nodos DOM offscreen, las rasteriza con html2canvas
// y las inserta como JPEG en un PDF jsPDF. Resultado: informe estilo revista.

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { MdrSummary } from "./parser";
import { OP_COLORS } from "./parser";

const A4_W = 794; // px @ 96dpi ≈ 210mm
const A4_H = 1123; // px @ 96dpi ≈ 297mm

const PATRON_LABEL: Record<string, string> = {
  ip_url: "URL con IP directa",
  tld_sospechoso: "TLD sospechoso",
  headers_garbled: "Encoding corrupto",
  template_sin_resolver: "Template sin resolver",
  apuestas: "Apuestas / casino",
  smishing_bancario: "Smishing bancario",
  trial: "Etiqueta [TRIAL]",
};

type Meta = {
  nombre: string;
  tipo: string;
  cliente?: string;
  periodoDesde?: string;
  periodoHasta?: string;
};

const baseStyle = `
  position: fixed; left: -10000px; top: 0;
  width: ${A4_W}px; min-height: ${A4_H}px;
  background: #FFFFFF; color: #1A1D1F;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  box-sizing: border-box;
`;

function fmt(n: number) {
  return n.toLocaleString("es-CO");
}

function coverPage(s: MdrSummary, meta: Meta): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("style", baseStyle);
  el.innerHTML = `
    <div style="height:${A4_H}px;background:linear-gradient(135deg,#3DA892 0%,#2C8070 55%,#1A1D1F 100%);position:relative;overflow:hidden;color:#fff;padding:80px 70px;display:flex;flex-direction:column;justify-content:space-between;">
      <div style="position:absolute;top:-120px;right:-120px;width:420px;height:420px;border-radius:50%;background:rgba(255,255,255,0.06);"></div>
      <div style="position:absolute;bottom:-160px;left:-100px;width:360px;height:360px;border-radius:50%;background:rgba(45,125,179,0.18);"></div>
      <div>
        <div style="display:flex;align-items:center;gap:18px;">
          <div style="width:74px;height:74px;border-radius:18px;background:#FFFFFF;color:#3DA892;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:30px;letter-spacing:-1px;">NX</div>
          <div>
            <div style="font-size:14px;letter-spacing:6px;opacity:0.8;">NEXVIA SUITE</div>
            <div style="font-size:24px;font-weight:600;margin-top:2px;">Informe ejecutivo</div>
          </div>
        </div>
      </div>
      <div>
        <div style="font-size:14px;letter-spacing:4px;text-transform:uppercase;opacity:0.7;">Reporte ${meta.tipo}</div>
        <div style="font-size:54px;line-height:1.05;font-weight:700;margin-top:14px;max-width:560px;">${meta.nombre || "Sin título"}</div>
        <div style="margin-top:28px;font-size:16px;opacity:0.85;">${meta.cliente ? `Cliente · ${meta.cliente}<br/>` : ""}Periodo · ${meta.periodoDesde || s.fechaDesde || "—"} → ${meta.periodoHasta || s.fechaHasta || "—"}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;">
        ${kpi("Total tráfico", fmt(s.total))}
        ${kpi("Mensajes OUT", fmt(s.out))}
        ${kpi("Entregados", fmt(s.delivered))}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;opacity:0.7;">
        <div>Generado por NEXVIA Suite · ${new Date().toLocaleDateString("es-CO")}</div>
        <div>Confidencial</div>
      </div>
    </div>
  `;
  return el;
}

function kpi(label: string, value: string) {
  return `
    <div style="background:rgba(255,255,255,0.1);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.18);border-radius:14px;padding:18px;">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.75;">${label}</div>
      <div style="font-size:30px;font-weight:700;margin-top:6px;font-family:'JetBrains Mono',monospace;">${value}</div>
    </div>
  `;
}

function header(title: string, meta: Meta) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:32px 60px 18px;border-bottom:1px solid #E5E7EB;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#3DA892,#2C8070);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;">NX</div>
        <div>
          <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#6B7280;">NEXVIA · ${meta.tipo}</div>
          <div style="font-size:16px;font-weight:600;">${title}</div>
        </div>
      </div>
      <div style="font-size:11px;color:#6B7280;text-align:right;">
        ${meta.nombre}<br/>${meta.periodoDesde || "—"} → ${meta.periodoHasta || "—"}
      </div>
    </div>
  `;
}

function footer(page: number, total: number) {
  return `
    <div style="position:absolute;bottom:24px;left:60px;right:60px;display:flex;justify-content:space-between;font-size:10px;color:#9CA3AF;">
      <div>NEXVIA Suite — Informe confidencial</div>
      <div>${page} / ${total}</div>
    </div>
  `;
}

function metricsPage(s: MdrSummary, meta: Meta, page: number, total: number): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("style", baseStyle + "position:fixed;");
  const tasaEntrega = s.out > 0 ? (s.delivered / s.out) * 100 : 0;
  const tasaFallo = s.out > 0 ? (s.failed / s.out) * 100 : 0;

  const tarjetas = [
    { label: "Total registros", value: fmt(s.total), tone: "#1A1D1F" },
    { label: "Mensajes OUT", value: fmt(s.out), tone: "#2D7DB3" },
    { label: "Entregados", value: fmt(s.delivered), tone: "#0F6E56" },
    { label: "Tasa entrega", value: tasaEntrega.toFixed(1) + "%", tone: "#3DA892" },
    { label: "Fallidos", value: fmt(s.failed), tone: "#C0392B" },
    { label: "Tasa fallo", value: tasaFallo.toFixed(1) + "%", tone: "#B45309" },
    { label: "Mensajes IN", value: fmt(s.in), tone: "#6B7280" },
    { label: "Sospechosos", value: fmt(s.fraude.total), tone: s.fraude.alto ? "#C0392B" : "#B45309" },
  ];

  const opEntries = Object.entries(s.porOperador).sort((a, b) => b[1].total - a[1].total);
  const maxOp = Math.max(1, ...opEntries.map(([, v]) => v.total));

  el.innerHTML = `
    <div style="height:${A4_H}px;position:relative;">
      ${header("Resumen y operadores", meta)}
      <div style="padding:24px 60px;">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
          ${tarjetas.map((t) => `
            <div style="border:1px solid #E5E7EB;border-radius:12px;padding:14px;background:#FFFFFF;border-left:4px solid ${t.tone};">
              <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6B7280;">${t.label}</div>
              <div style="font-size:22px;font-weight:700;margin-top:4px;font-family:'JetBrains Mono',monospace;color:${t.tone};">${t.value}</div>
            </div>
          `).join("")}
        </div>

        <div style="margin-top:28px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#1A1D1F;">Distribución por operador (OUT)</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${opEntries.map(([name, v]) => {
              const pct = (v.total / maxOp) * 100;
              const share = s.out > 0 ? (v.total / s.out) * 100 : 0;
              const color = OP_COLORS[name] || "#6B7280";
              return `
                <div>
                  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                    <div style="display:flex;align-items:center;gap:8px;"><span style="width:10px;height:10px;border-radius:3px;background:${color};display:inline-block;"></span><b>${name}</b></div>
                    <div style="font-family:'JetBrains Mono',monospace;color:#6B7280;">${fmt(v.total)} · ${share.toFixed(1)}%</div>
                  </div>
                  <div style="background:#F4F6F8;border-radius:6px;height:14px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${color};"></div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <div style="margin-top:28px;">
          <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Calidad de entrega por operador</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:#F4F6F8;">
                <th style="text-align:left;padding:10px;border-bottom:1px solid #E5E7EB;">Operador</th>
                <th style="text-align:right;padding:10px;border-bottom:1px solid #E5E7EB;">OUT</th>
                <th style="text-align:right;padding:10px;border-bottom:1px solid #E5E7EB;">Entregados</th>
                <th style="text-align:right;padding:10px;border-bottom:1px solid #E5E7EB;">Fallidos</th>
                <th style="text-align:right;padding:10px;border-bottom:1px solid #E5E7EB;">% Entrega</th>
              </tr>
            </thead>
            <tbody>
              ${opEntries.map(([name, v]) => {
                const pct = v.out > 0 ? (v.delivered / v.out) * 100 : 0;
                return `
                  <tr>
                    <td style="padding:9px 10px;border-bottom:1px solid #F3F4F6;font-weight:600;">${name}</td>
                    <td style="padding:9px 10px;border-bottom:1px solid #F3F4F6;text-align:right;font-family:'JetBrains Mono',monospace;">${fmt(v.out)}</td>
                    <td style="padding:9px 10px;border-bottom:1px solid #F3F4F6;text-align:right;font-family:'JetBrains Mono',monospace;color:#0F6E56;">${fmt(v.delivered)}</td>
                    <td style="padding:9px 10px;border-bottom:1px solid #F3F4F6;text-align:right;font-family:'JetBrains Mono',monospace;color:#C0392B;">${fmt(v.failed)}</td>
                    <td style="padding:9px 10px;border-bottom:1px solid #F3F4F6;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;">${pct.toFixed(1)}%</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
      ${footer(page, total)}
    </div>
  `;
  return el;
}

function activityPage(s: MdrSummary, meta: Meta, page: number, total: number): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("style", baseStyle + "position:fixed;");
  const maxHora = Math.max(1, ...s.porHora);
  const dias = Object.entries(s.porDia).sort();
  const maxDia = Math.max(1, ...dias.map(([, v]) => v.total));
  const topDest = Object.entries(s.topDestinos).sort((a, b) => b[1].total - a[1].total).slice(0, 15);

  el.innerHTML = `
    <div style="height:${A4_H}px;position:relative;">
      ${header("Actividad y destinos", meta)}
      <div style="padding:24px 60px;">
        <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Actividad por hora del día (OUT)</div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:140px;border-bottom:1px solid #E5E7EB;padding-bottom:6px;">
          ${s.porHora.map((v, i) => {
            const h = Math.max(2, (v / maxHora) * 130);
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
              <div style="font-size:8px;color:#9CA3AF;font-family:'JetBrains Mono',monospace;">${fmt(v)}</div>
              <div style="width:100%;height:${h}px;background:linear-gradient(180deg,#3DA892,#2C8070);border-radius:3px 3px 0 0;"></div>
              <div style="font-size:9px;color:#6B7280;">${i.toString().padStart(2, "0")}</div>
            </div>`;
          }).join("")}
        </div>

        <div style="margin-top:26px;font-size:14px;font-weight:600;margin-bottom:10px;">Evolución diaria</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          ${dias.slice(-12).map(([d, v]) => {
            const pct = (v.total / maxDia) * 100;
            return `
              <div style="display:grid;grid-template-columns:90px 1fr 80px;gap:10px;align-items:center;font-size:11px;">
                <div style="font-family:'JetBrains Mono',monospace;color:#6B7280;">${d}</div>
                <div style="background:#F4F6F8;border-radius:4px;height:12px;overflow:hidden;">
                  <div style="height:100%;width:${pct}%;background:#2D7DB3;"></div>
                </div>
                <div style="font-family:'JetBrains Mono',monospace;text-align:right;">${fmt(v.total)}</div>
              </div>
            `;
          }).join("")}
        </div>

        <div style="margin-top:26px;font-size:14px;font-weight:600;margin-bottom:10px;">Top destinos</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#F4F6F8;">
              <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #E5E7EB;">Destino</th>
              <th style="text-align:left;padding:8px 10px;border-bottom:1px solid #E5E7EB;">Operador</th>
              <th style="text-align:right;padding:8px 10px;border-bottom:1px solid #E5E7EB;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${topDest.map(([num, v]) => `
              <tr>
                <td style="padding:7px 10px;border-bottom:1px solid #F3F4F6;font-family:'JetBrains Mono',monospace;">${num}</td>
                <td style="padding:7px 10px;border-bottom:1px solid #F3F4F6;">
                  <span style="display:inline-block;padding:2px 8px;border-radius:99px;background:${v.color}20;color:${v.color};font-weight:600;font-size:10px;">${v.operador}</span>
                </td>
                <td style="padding:7px 10px;border-bottom:1px solid #F3F4F6;text-align:right;font-family:'JetBrains Mono',monospace;">${fmt(v.total)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${footer(page, total)}
    </div>
  `;
  return el;
}

function fraudPage(s: MdrSummary, meta: Meta, page: number, total: number): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("style", baseStyle + "position:fixed;");
  const patrones = Object.entries(s.fraude.porPatron).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const muestras = s.fraude.muestras.slice(0, 12);

  el.innerHTML = `
    <div style="height:${A4_H}px;position:relative;">
      ${header("Detección de fraude y abusos", meta)}
      <div style="padding:24px 60px;">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
          <div style="border-radius:12px;padding:18px;background:linear-gradient(135deg,#C0392B,#7f1d1d);color:#fff;">
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Riesgo alto</div>
            <div style="font-size:32px;font-weight:800;font-family:'JetBrains Mono',monospace;">${fmt(s.fraude.alto)}</div>
          </div>
          <div style="border-radius:12px;padding:18px;background:linear-gradient(135deg,#B45309,#78350f);color:#fff;">
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">Riesgo medio</div>
            <div style="font-size:32px;font-weight:800;font-family:'JetBrains Mono',monospace;">${fmt(s.fraude.medio)}</div>
          </div>
          <div style="border-radius:12px;padding:18px;background:#F4F6F8;border:1px solid #E5E7EB;">
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6B7280;">Total sospechosos</div>
            <div style="font-size:32px;font-weight:800;font-family:'JetBrains Mono',monospace;color:#1A1D1F;">${fmt(s.fraude.total)}</div>
          </div>
        </div>

        <div style="font-size:14px;font-weight:600;margin-bottom:10px;">Patrones detectados</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;">
          ${patrones.length === 0
            ? `<div style="font-size:12px;color:#6B7280;">Sin patrones de riesgo detectados.</div>`
            : patrones.map(([k, v]) => `
              <div style="border:1px solid #E5E7EB;border-radius:99px;padding:6px 14px;font-size:11px;display:flex;align-items:center;gap:8px;background:#fff;">
                <span style="font-weight:600;">${PATRON_LABEL[k] || k}</span>
                <span style="font-family:'JetBrains Mono',monospace;color:#C0392B;font-weight:700;">${fmt(v)}</span>
              </div>
            `).join("")}
        </div>

        <div style="font-size:14px;font-weight:600;margin-bottom:10px;">Muestras de mensajes sospechosos</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${muestras.length === 0
            ? `<div style="font-size:12px;color:#6B7280;">Sin muestras.</div>`
            : muestras.map((m) => `
              <div style="border-left:3px solid ${m.riesgo === "alto" ? "#C0392B" : "#B45309"};background:#FBFBFC;border-radius:6px;padding:10px 12px;">
                <div style="display:flex;justify-content:space-between;font-size:10px;color:#6B7280;margin-bottom:4px;">
                  <div><b style="color:${m.riesgo === "alto" ? "#C0392B" : "#B45309"};text-transform:uppercase;">${m.riesgo}</b> · ${m.operador} · ${m.fecha} ${m.hora >= 0 ? m.hora.toString().padStart(2, "0") + "h" : ""}</div>
                  <div style="font-family:'JetBrains Mono',monospace;">${m.origen} → ${m.destino}</div>
                </div>
                <div style="font-size:11px;font-family:'JetBrains Mono',monospace;color:#1A1D1F;word-break:break-all;">${escapeHtml(m.preview)}</div>
                <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
                  ${m.patrones.map((p) => `<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:#F4F6F8;color:#6B7280;">${PATRON_LABEL[p] || p}</span>`).join("")}
                </div>
              </div>
            `).join("")}
        </div>
      </div>
      ${footer(page, total)}
    </div>
  `;
  return el;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function renderToCanvas(node: HTMLDivElement) {
  document.body.appendChild(node);
  try {
    return await html2canvas(node, {
      scale: 2,
      backgroundColor: "#FFFFFF",
      useCORS: true,
      logging: false,
      windowWidth: A4_W,
      windowHeight: A4_H,
    });
  } finally {
    node.remove();
  }
}

export async function generateExecutivePDF(summary: MdrSummary, meta: Meta): Promise<void> {
  const totalPages = 4;
  const pages = [
    coverPage(summary, meta),
    metricsPage(summary, meta, 2, totalPages),
    activityPage(summary, meta, 3, totalPages),
    fraudPage(summary, meta, 4, totalPages),
  ];

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    const canvas = await renderToCanvas(pages[i]);
    const img = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage();
    pdf.addImage(img, "JPEG", 0, 0, pdfW, pdfH, undefined, "FAST");
  }

  pdf.save(`NEXVIA-${meta.tipo}-${(meta.nombre || "informe").replace(/[^\w\-]+/g, "_")}.pdf`);
}
