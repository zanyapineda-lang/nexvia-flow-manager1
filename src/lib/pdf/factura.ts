import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type FacturaPDFData = {
  numero: string;
  tipo: string;
  fecha: string;
  fecha_vencimiento?: string | null;
  emisor: { nombre: string; nit?: string; direccion?: string; email?: string; telefono?: string };
  cliente: { nombre: string; nit?: string; direccion?: string; email?: string; telefono?: string };
  items: { descripcion: string; cantidad: number; precio_unitario: number; total: number }[];
  subtotal: number;
  iva: number;
  total: number;
  moneda: string;
  notas?: string;
};

const fmt = (n: number, moneda = "COP") =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(n);

export function generarFacturaPDF(d: FacturaPDFData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // header
  doc.setFillColor(61, 168, 146);
  doc.rect(0, 0, W, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("NEXVIA", 40, 38);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Panel de Gestión", 40, 54);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(d.tipo.toUpperCase(), W - 40, 38, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`N°: ${d.numero}`, W - 40, 56, { align: "right" });
  doc.text(`Fecha: ${d.fecha}`, W - 40, 70, { align: "right" });

  doc.setTextColor(40, 40, 40);

  // emisor / cliente
  let y = 110;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("EMISOR", 40, y);
  doc.text("CLIENTE", W / 2 + 10, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 14;
  const renderParty = (p: FacturaPDFData["emisor"], x: number) => {
    let yy = y;
    doc.setFont("helvetica", "bold");
    doc.text(p.nombre || "—", x, yy);
    yy += 12;
    doc.setFont("helvetica", "normal");
    if (p.nit) { doc.text(`NIT: ${p.nit}`, x, yy); yy += 12; }
    if (p.direccion) { doc.text(p.direccion, x, yy); yy += 12; }
    if (p.email) { doc.text(p.email, x, yy); yy += 12; }
    if (p.telefono) { doc.text(`Tel: ${p.telefono}`, x, yy); yy += 12; }
    return yy;
  };
  const y1 = renderParty(d.emisor, 40);
  const y2 = renderParty(d.cliente, W / 2 + 10);
  y = Math.max(y1, y2) + 10;

  // items table
  autoTable(doc, {
    startY: y,
    head: [["Descripción", "Cant.", "Precio Unit.", "Total"]],
    body: d.items.map((it) => [
      it.descripcion,
      String(it.cantidad),
      fmt(it.precio_unitario, d.moneda),
      fmt(it.total, d.moneda),
    ]),
    headStyles: { fillColor: [61, 168, 146], textColor: 255, fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 6 },
    columnStyles: { 1: { halign: "right", cellWidth: 60 }, 2: { halign: "right", cellWidth: 90 }, 3: { halign: "right", cellWidth: 90 } },
    margin: { left: 40, right: 40 },
  });

  // totals
  const finalY = (doc as any).lastAutoTable.finalY + 16;
  const xLabel = W - 220;
  const xVal = W - 40;
  doc.setFontSize(10);
  doc.text("Subtotal:", xLabel, finalY);
  doc.text(fmt(d.subtotal, d.moneda), xVal, finalY, { align: "right" });
  doc.text("IVA:", xLabel, finalY + 16);
  doc.text(fmt(d.iva, d.moneda), xVal, finalY + 16, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setFillColor(61, 168, 146);
  doc.rect(xLabel - 10, finalY + 26, W - xLabel - 30, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL:", xLabel, finalY + 42);
  doc.text(fmt(d.total, d.moneda), xVal, finalY + 42, { align: "right" });
  doc.setTextColor(40, 40, 40);

  if (d.notas) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Notas:", 40, finalY + 80);
    const lines = doc.splitTextToSize(d.notas, W - 80);
    doc.text(lines, 40, finalY + 94);
  }

  // footer
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Generado con NEXVIA · Panel de Gestión", W / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });

  return doc;
}
