import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown, Download, Info, FileDown, CornerUpLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/app/movimientos")({ component: MovimientosPage });

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

function MovimientosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"ingreso" | "egreso">("ingreso");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState<number>(0);
  const [clienteId, setClienteId] = useState<string>("");
  const [notas, setNotas] = useState("");
  const [soporte, setSoporte] = useState<File | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "ingreso" | "egreso">("todos");
  const [importando, setImportando] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("id,nombre").order("nombre")).data || [],
  });

  const { data: movs = [] } = useQuery({
    queryKey: ["movimientos", desde, hasta, filtroTipo],
    queryFn: async () => {
      let q = supabase.from("movimientos_contables").select("*, clientes(nombre)").order("fecha", { ascending: false });
      if (desde) q = q.gte("fecha", desde);
      if (hasta) q = q.lte("fecha", hasta);
      if (filtroTipo !== "todos") q = q.eq("tipo", filtroTipo);
      return (await q).data || [];
    },
  });

  const totalIngresos = movs.filter((m: any) => m.tipo === "ingreso").reduce((s: number, m: any) => s + Number(m.monto), 0);
  const totalEgresos = movs.filter((m: any) => m.tipo === "egreso").reduce((s: number, m: any) => s + Number(m.monto), 0);
  const balance = totalIngresos - totalEgresos;

  const guardar = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("No autenticado");
    if (!descripcion || !monto) return toast.error("Descripción y monto son requeridos");
    let soporte_path: string | null = null;
    let soporte_mime: string | null = null;
    if (soporte) {
      const path = `${u.user.id}/${Date.now()}-${soporte.name}`;
      const { error: upErr } = await supabase.storage.from("comprobantes").upload(path, soporte);
      if (upErr) return toast.error(upErr.message);
      soporte_path = path;
      soporte_mime = soporte.type;
    }
    const { error } = await supabase.from("movimientos_contables").insert({
      user_id: u.user.id, tipo, fecha, categoria, descripcion, monto,
      cliente_id: clienteId || null, notas, soporte_path, soporte_mime,
    });
    if (error) return toast.error(error.message);
    toast.success("Movimiento registrado");
    setOpen(false);
    setDescripcion(""); setMonto(0); setCategoria(""); setNotas(""); setSoporte(null); setClienteId("");
    qc.invalidateQueries({ queryKey: ["movimientos"] });
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar movimiento?")) return;
    await supabase.from("movimientos_contables").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["movimientos"] });
  };

  const verSoporte = async (path: string) => {
    const { data } = await supabase.storage.from("comprobantes").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt" });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(61, 168, 146);
    doc.rect(0, 0, W, 60, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("NEXVIA · Movimientos contables", 40, 38);
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.text(`Periodo: ${desde || "—"} a ${hasta || "—"}`, 40, 80);
    doc.text(`Ingresos: ${fmt(totalIngresos)}   Egresos: ${fmt(totalEgresos)}   Balance: ${fmt(balance)}`, 40, 95);
    autoTable(doc, {
      startY: 115,
      head: [["Fecha", "Tipo", "Categoría", "Descripción", "Cliente", "Monto"]],
      body: movs.map((m: any) => [
        m.fecha, m.tipo, m.categoria || "—", m.descripcion,
        m.clientes?.nombre || "—",
        (m.tipo === "egreso" ? "-" : "") + fmt(Number(m.monto)),
      ]),
      headStyles: { fillColor: [61, 168, 146] },
      styles: { fontSize: 9 },
    });
    doc.save(`movimientos-${desde || "todos"}.pdf`);
  };

  // -------- CSV Export / Import --------
  const CSV_HEADERS = ["fecha", "tipo", "categoria", "descripcion", "monto", "cliente", "notas"];

  const csvEscape = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const exportCSV = () => {
    const rows = [CSV_HEADERS.join(",")];
    movs.forEach((m: any) => {
      rows.push([
        m.fecha, m.tipo, m.categoria || "", m.descripcion, m.monto,
        m.clientes?.nombre || "", m.notas || "",
      ].map(csvEscape).join(","));
    });
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos-nexvia-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${movs.length} movimientos exportados`);
  };

  const importCSV = async (file: File) => {
    setImportando(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return toast.error("No autenticado");

      const text = await file.text();
      const cleanText = text.replace(/^\uFEFF/, "");
      const firstLine = cleanText.split(/\r?\n/).find((l) => l.trim()) || "";
      const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

      const parseCSVText = (csv: string) => {
        const rows: string[][] = [];
        let row: string[] = [];
        let cur = "";
        let inQ = false;
        for (let i = 0; i < csv.length; i++) {
          const c = csv[i];
          if (inQ) {
            if (c === '"' && csv[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') inQ = false;
            else cur += c;
          } else if (c === '"') inQ = true;
          else if (c === delimiter) { row.push(cur.trim()); cur = ""; }
          else if (c === "\n") { row.push(cur.trim()); rows.push(row); row = []; cur = ""; }
          else if (c !== "\r") cur += c;
        }
        row.push(cur.trim());
        if (row.some(Boolean)) rows.push(row);
        return rows.filter((r) => r.some((v) => v.trim()));
      };

      const normalize = (value: string) => value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
      const parseAmount = (value: string) => {
        const cleaned = String(value || "").replace(/[^\d,.-]/g, "");
        const normalized = cleaned.includes(",") && cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
          ? cleaned.replace(/\./g, "").replace(",", ".")
          : cleaned.replace(/,/g, "");
        return Math.abs(Number(normalized));
      };

      const parsed = parseCSVText(cleanText);
      if (parsed.length < 2) return toast.error("CSV vacío o sin filas para importar");

      const headers = parsed[0].map(normalize);
      const idx = (...keys: string[]) => keys.map(normalize).map((k) => headers.indexOf(k)).find((i) => i >= 0) ?? -1;
      const iFecha = idx("fecha", "date");
      const iTipo = idx("tipo", "movimiento");
      const iCategoria = idx("categoria", "categoría");
      const iDescripcion = idx("descripcion", "descripción", "detalle", "concepto");
      const iMonto = idx("monto", "valor", "importe", "total");
      const iCliente = idx("cliente", "customer");
      const iNotas = idx("notas", "nota", "observaciones");

      if (iDescripcion < 0 || iMonto < 0) {
        return toast.error("El CSV debe tener las columnas descripción y monto");
      }

      const clientesMap = new Map<string, string>(clientes.map((c: any) => [normalize(c.nombre), c.id]));
      const payload = parsed.slice(1)
        .map((r) => {
          const descripcion = r[iDescripcion]?.trim();
          const monto = parseAmount(r[iMonto]);
          if (!descripcion || !monto) return null;
          const tipoRaw = normalize(iTipo >= 0 ? r[iTipo] || "" : "");
          const clienteName = normalize(iCliente >= 0 ? r[iCliente] || "" : "");
          return {
            user_id: u.user!.id,
            fecha: (iFecha >= 0 && r[iFecha]) || new Date().toISOString().slice(0, 10),
            tipo: tipoRaw.includes("egreso") || tipoRaw.includes("gasto") || tipoRaw.includes("salida") ? "egreso" : "ingreso",
            categoria: (iCategoria >= 0 && r[iCategoria]) || null,
            descripcion,
            monto,
            notas: (iNotas >= 0 && r[iNotas]) || null,
            cliente_id: clientesMap.get(clienteName) || null,
          };
        })
        .filter(Boolean);

      if (!payload.length) return toast.error("Sin filas válidas para importar");
      const { error } = await supabase.from("movimientos_contables").insert(payload as any);
      if (error) return toast.error(error.message);
      toast.success(`${payload.length} movimientos importados`);
      qc.invalidateQueries({ queryKey: ["movimientos"] });
    } catch (error: any) {
      toast.error(error?.message || "No se pudo importar el CSV");
    } finally {
      setImportando(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  const borrarTodo = async () => {
    if (!confirm("¿Borrar TODOS tus movimientos? Esta acción no se puede deshacer.")) return;
    if (!confirm("Confirma una segunda vez para continuar.")) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("movimientos_contables").delete().eq("user_id", u.user.id);
    if (error) return toast.error(error.message);
    toast.success("Todos los movimientos eliminados");
    qc.invalidateQueries({ queryKey: ["movimientos"] });
  };

  return (
    <>
      <PageTitle icon={Wallet} title="Movimientos contables" subtitle="Registra ingresos, egresos y adjunta soportes"
        actions={
          <>
            <Button variant="outline" onClick={exportPDF}><Download className="w-4 h-4 mr-1" /> PDF</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Nuevo movimiento</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nuevo movimiento contable</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo</Label>
                    <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ingreso">Ingreso</SelectItem>
                        <SelectItem value="egreso">Egreso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
                  <div><Label>Categoría</Label><Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ej: SMS, Nómina, Servicios" /></div>
                  <div><Label>Monto (COP)</Label><Input type="number" value={monto} onChange={(e) => setMonto(Number(e.target.value))} /></div>
                  <div className="col-span-2"><Label>Descripción *</Label><Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
                  <div className="col-span-2"><Label>Cliente (opcional)</Label>
                    <Select value={clienteId} onValueChange={setClienteId}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{clientes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>Soporte (imagen o PDF)</Label>
                    <Input type="file" accept="image/*,application/pdf" onChange={(e) => setSoporte(e.target.files?.[0] || null)} />
                  </div>
                  <div className="col-span-2"><Label>Notas</Label><Textarea value={notas} onChange={(e) => setNotas(e.target.value)} /></div>
                </div>
                <Button onClick={guardar}>Registrar</Button>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card border rounded-xl p-4">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Ingresos</div>
          <div className="text-2xl font-bold mt-1 text-success">{fmt(totalIngresos)}</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="text-xs text-muted-foreground uppercase flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Egresos</div>
          <div className="text-2xl font-bold mt-1 text-destructive">{fmt(totalEgresos)}</div>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="text-xs text-muted-foreground uppercase">Balance</div>
          <div className={`text-2xl font-bold mt-1 ${balance >= 0 ? "text-success" : "text-destructive"}`}>{fmt(balance)}</div>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div><Label className="text-xs">Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><Label className="text-xs">Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <div><Label className="text-xs">Tipo</Label>
          <Select value={filtroTipo} onValueChange={(v: any) => setFiltroTipo(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ingreso">Ingresos</SelectItem>
              <SelectItem value="egreso">Egresos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-muted/50">
            <tr>
              <th className="text-left p-3">Fecha</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Descripción</th>
              <th className="text-left p-3">Categoría</th>
              <th className="text-left p-3">Cliente</th>
              <th className="text-right p-3">Monto</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {movs.map((m: any) => (
              <tr key={m.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{m.fecha}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.tipo === "ingreso" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {m.tipo}
                  </span>
                </td>
                <td className="p-3">{m.descripcion}</td>
                <td className="p-3 text-xs text-muted-foreground">{m.categoria || "—"}</td>
                <td className="p-3">{m.clientes?.nombre || "—"}</td>
                <td className={`p-3 text-right font-semibold ${m.tipo === "ingreso" ? "text-success" : "text-destructive"}`}>
                  {m.tipo === "egreso" ? "-" : ""}{fmt(Number(m.monto))}
                </td>
                <td className="p-3 text-right">
                  {m.soporte_path && <Button size="sm" variant="ghost" onClick={() => verSoporte(m.soporte_path)}>Soporte</Button>}
                  <Button size="sm" variant="ghost" onClick={() => eliminar(m.id)}><Trash2 className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
            {!movs.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Sin movimientos</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Exportar / Importar */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-3">
          <FileDown className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">Exportar / Importar</h2>
        </div>
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wider text-muted-foreground">
            <Info className="w-3.5 h-3.5 text-primary" />
            Cómo guardar los datos en tu computador
          </div>
          <ol className="space-y-2.5 mb-5 text-sm">
            {[
              <>Haz clic en <b className="text-primary">Descargar CSV</b> — se guarda en tu carpeta de Descargas.</>,
              <>Abre el CSV con <b className="text-primary">Excel</b> (doble clic) o desde Google Sheets en Drive.</>,
              <>Los documentos adjuntos (facturas, comprobantes) quedan guardados en la nube. El CSV guarda los movimientos contables.</>,
              <>Descarga el CSV regularmente como respaldo. Si cambias de equipo o navegador usa <b className="text-primary">Importar CSV</b> para recuperar los movimientos.</>,
            ].map((txt, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="leading-relaxed pt-0.5">{txt}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportCSV} className="gap-1.5">
              <Download className="w-4 h-4" /> Descargar CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => csvInputRef.current?.click()} disabled={importando} className="gap-1.5">
              <CornerUpLeft className="w-4 h-4" /> {importando ? "Importando..." : "Importar CSV"}
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCSV(f);
              }}
            />
            <Button
              variant="outline"
              onClick={borrarTodo}
              className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" /> Borrar todo
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
