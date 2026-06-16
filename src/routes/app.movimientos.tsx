import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown, Download } from "lucide-react";
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
    </>
  );
}
