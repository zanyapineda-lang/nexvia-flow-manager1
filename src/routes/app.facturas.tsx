import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { FileText, Plus, Download, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { generarFacturaPDF } from "@/lib/pdf/factura";

export const Route = createFileRoute("/app/facturas")({ component: FacturasPage });

type Item = { descripcion: string; cantidad: number; precio_unitario: number };

function FacturasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [numero, setNumero] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState("factura");
  const [ivaPct, setIvaPct] = useState(19);
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<Item[]>([{ descripcion: "", cantidad: 1, precio_unitario: 0 }]);
  const [emisor, setEmisor] = useState<any>({ nombre: "NEXVIA", nit: "", email: "", telefono: "", direccion: "" });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("*").order("nombre")).data || [],
  });

  const { data: facturas = [] } = useQuery({
    queryKey: ["facturas"],
    queryFn: async () => (await supabase.from("facturas").select("*, clientes(nombre,email)").order("created_at", { ascending: false })).data || [],
  });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
        if (p) setEmisor((e: any) => ({ ...e, nombre: p.empresa || p.nombre || "NEXVIA", email: p.email || "" }));
      }
    });
  }, []);

  const subtotal = items.reduce((s, i) => s + Number(i.cantidad) * Number(i.precio_unitario), 0);
  const iva = (subtotal * ivaPct) / 100;
  const total = subtotal + iva;

  const guardar = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const cli = clientes.find((c: any) => c.id === clienteId);
    const { data: fact, error } = await supabase.from("facturas").insert({
      user_id: u.user.id, cliente_id: clienteId || null, numero, fecha, tipo,
      subtotal, iva, total, notas, cliente_snapshot: cli || null,
    }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("factura_items").insert(items.map((it, idx) => ({
      factura_id: fact.id, user_id: u.user!.id,
      descripcion: it.descripcion, cantidad: it.cantidad, precio_unitario: it.precio_unitario,
      total: it.cantidad * it.precio_unitario, orden: idx,
    })));
    toast.success("Factura creada");
    setOpen(false);
    setItems([{ descripcion: "", cantidad: 1, precio_unitario: 0 }]);
    setNumero("");
    qc.invalidateQueries({ queryKey: ["facturas"] });
  };

  const descargar = async (f: any) => {
    const { data: its } = await supabase.from("factura_items").select("*").eq("factura_id", f.id).order("orden");
    const doc = generarFacturaPDF({
      numero: f.numero, tipo: f.tipo, fecha: f.fecha, fecha_vencimiento: f.fecha_vencimiento,
      emisor, cliente: f.cliente_snapshot || f.clientes || { nombre: "—" },
      items: (its || []).map((i: any) => ({ descripcion: i.descripcion, cantidad: Number(i.cantidad), precio_unitario: Number(i.precio_unitario), total: Number(i.total) })),
      subtotal: Number(f.subtotal), iva: Number(f.iva), total: Number(f.total), moneda: f.moneda, notas: f.notas,
    });
    doc.save(`${f.tipo}-${f.numero}.pdf`);
  };

  const enviarEmail = (f: any) => {
    const cli = f.cliente_snapshot || f.clientes;
    if (!cli?.email) return toast.error("El cliente no tiene email");
    const body = `Adjunto factura ${f.numero} por un total de ${new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(f.total))}.`;
    window.location.href = `mailto:${cli.email}?subject=${encodeURIComponent("Factura " + f.numero + " - NEXVIA")}&body=${encodeURIComponent(body)}`;
    toast.info("Descarga el PDF y adjúntalo al correo");
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar factura?")) return;
    await supabase.from("facturas").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["facturas"] });
  };

  const fmt = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  return (
    <>
      <PageTitle icon={FileText} title="Facturación" subtitle="Crea facturas, proformas y envíalas a tus clientes"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Nueva factura</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nueva factura</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Número *</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="0001" /></div>
                <div><Label>Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="factura">Factura</SelectItem>
                      <SelectItem value="proforma">Proforma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
                <div><Label>Cliente</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>{clientes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between items-center mb-2">
                  <Label>Líneas</Label>
                  <Button size="sm" variant="outline" onClick={() => setItems([...items, { descripcion: "", cantidad: 1, precio_unitario: 0 }])}>+ Línea</Button>
                </div>
                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <Input className="col-span-6" placeholder="Descripción" value={it.descripcion} onChange={(e) => { const c = [...items]; c[idx].descripcion = e.target.value; setItems(c); }} />
                      <Input className="col-span-2" type="number" value={it.cantidad} onChange={(e) => { const c = [...items]; c[idx].cantidad = Number(e.target.value); setItems(c); }} />
                      <Input className="col-span-3" type="number" placeholder="Precio" value={it.precio_unitario} onChange={(e) => { const c = [...items]; c[idx].precio_unitario = Number(e.target.value); setItems(c); }} />
                      <Button size="sm" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><Label>IVA %</Label><Input type="number" value={ivaPct} onChange={(e) => setIvaPct(Number(e.target.value))} /></div>
                <div className="text-right self-end">
                  <div className="text-xs text-muted-foreground">Subtotal: {fmt(subtotal)}</div>
                  <div className="text-xs text-muted-foreground">IVA: {fmt(iva)}</div>
                  <div className="text-lg font-bold">Total: {fmt(total)}</div>
                </div>
              </div>
              <div><Label>Notas</Label><Textarea value={notas} onChange={(e) => setNotas(e.target.value)} /></div>
              <Button onClick={guardar} disabled={!numero}>Guardar factura</Button>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-muted/50">
            <tr><th className="text-left p-3">N°</th><th className="text-left p-3">Cliente</th><th className="text-left p-3">Fecha</th><th className="text-left p-3">Tipo</th><th className="text-right p-3">Total</th><th className="text-left p-3">Estado</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {facturas.map((f: any) => (
              <tr key={f.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{f.numero}</td>
                <td className="p-3">{f.clientes?.nombre || f.cliente_snapshot?.nombre || "—"}</td>
                <td className="p-3">{f.fecha}</td>
                <td className="p-3 text-xs uppercase">{f.tipo}</td>
                <td className="p-3 text-right font-semibold">{fmt(Number(f.total))}</td>
                <td className="p-3"><span className={`text-xs px-2 py-0.5 rounded-full ${f.estado === "pagada" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>{f.estado}</span></td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => descargar(f)}><Download className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => enviarEmail(f)}><Mail className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => eliminar(f.id)}><Trash2 className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
            {!facturas.length && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Sin facturas aún</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
