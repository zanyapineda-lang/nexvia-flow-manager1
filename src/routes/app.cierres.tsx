import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { Lock, Plus, Upload, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/app/cierres")({ component: CierresPage });

function CierresPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [ingresos, setIngresos] = useState(0);
  const [egresos, setEgresos] = useState(0);
  const [notas, setNotas] = useState("");

  const { data: cierres = [] } = useQuery({
    queryKey: ["cierres"],
    queryFn: async () => (await supabase.from("cierres_contables").select("*").order("periodo", { ascending: false })).data || [],
  });

  const crear = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("cierres_contables").insert({
      user_id: u.user.id, periodo, total_ingresos: ingresos, total_egresos: egresos, notas,
    });
    if (error) return toast.error(error.message);
    toast.success("Cierre creado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["cierres"] });
  };

  const subirArchivo = async (cierre: any, file: File) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const path = `${u.user.id}/cierres/${cierre.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("cierres").upload(path, file);
    if (error) return toast.error(error.message);
    const archivos = [...(cierre.archivos || []), { nombre: file.name, path, mime: file.type, size: file.size }];
    await supabase.from("cierres_contables").update({ archivos }).eq("id", cierre.id);
    toast.success("Archivo subido");
    qc.invalidateQueries({ queryKey: ["cierres"] });
  };

  const descargarArchivo = async (path: string) => {
    const { data } = await supabase.storage.from("cierres").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const eliminarArchivo = async (cierre: any, idx: number) => {
    const arch = cierre.archivos[idx];
    await supabase.storage.from("cierres").remove([arch.path]);
    const archivos = cierre.archivos.filter((_: any, i: number) => i !== idx);
    await supabase.from("cierres_contables").update({ archivos }).eq("id", cierre.id);
    qc.invalidateQueries({ queryKey: ["cierres"] });
  };

  const informePDF = (c: any) => {
    const doc = new jsPDF({ unit: "pt" });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(61, 168, 146);
    doc.rect(0, 0, W, 60, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`NEXVIA · Cierre Contable`, 40, 38);
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(11);
    doc.text(`Período: ${c.periodo}`, 40, 90);
    doc.text(`Estado: ${c.estado}`, 40, 108);
    autoTable(doc, {
      startY: 130,
      head: [["Concepto", "Monto"]],
      body: [
        ["Ingresos", new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(c.total_ingresos))],
        ["Egresos", new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(c.total_egresos))],
        ["Utilidad", new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(c.total_ingresos) - Number(c.total_egresos))],
      ],
      headStyles: { fillColor: [61, 168, 146] },
    });
    if (c.archivos?.length) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [["Soportes adjuntos"]],
        body: c.archivos.map((a: any) => [a.nombre]),
        headStyles: { fillColor: [45, 125, 179] },
      });
    }
    if (c.notas) doc.text(`Notas: ${c.notas}`, 40, (doc as any).lastAutoTable.finalY + 30);
    doc.save(`cierre-${c.periodo}.pdf`);
  };

  return (
    <>
      <PageTitle icon={Lock} title="Cierres Contables" subtitle="Genera, descarga y re-actualiza cierres mensuales"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Nuevo cierre</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo cierre</DialogTitle></DialogHeader>
              <Label>Período (YYYY-MM)</Label>
              <Input value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
              <Label>Ingresos</Label>
              <Input type="number" value={ingresos} onChange={(e) => setIngresos(Number(e.target.value))} />
              <Label>Egresos</Label>
              <Input type="number" value={egresos} onChange={(e) => setEgresos(Number(e.target.value))} />
              <Label>Notas</Label>
              <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} />
              <Button onClick={crear}>Crear</Button>
            </DialogContent>
          </Dialog>
        } />
      <div className="space-y-3">
        {cierres.map((c: any) => (
          <div key={c.id} className="bg-card border rounded-xl p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-lg font-bold">{c.periodo}</div>
                <div className="text-xs text-muted-foreground">{c.estado}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => informePDF(c)}><Download className="w-4 h-4 mr-1" /> Informe PDF</Button>
                <label className="inline-flex">
                  <Button size="sm" variant="outline" asChild><span><Upload className="w-4 h-4 mr-1" /> Subir soporte</span></Button>
                  <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && subirArchivo(c, e.target.files[0])} />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Stat label="Ingresos" value={c.total_ingresos} tone="success" />
              <Stat label="Egresos" value={c.total_egresos} tone="destructive" />
              <Stat label="Utilidad" value={Number(c.total_ingresos) - Number(c.total_egresos)} />
            </div>
            {c.archivos?.length > 0 && (
              <div className="border-t pt-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Archivos ({c.archivos.length})</div>
                <div className="space-y-1">
                  {c.archivos.map((a: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                      <span>{a.nombre}</span>
                      <div>
                        <Button size="sm" variant="ghost" onClick={() => descargarArchivo(a.path)}><Download className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => eliminarArchivo(c, idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {!cierres.length && <div className="bg-card border rounded-xl p-12 text-center text-muted-foreground">Aún no tienes cierres</div>}
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" }) {
  const cls = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${cls}`}>{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value))}</div>
    </div>
  );
}
