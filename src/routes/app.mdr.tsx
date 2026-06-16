import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { MessageSquare, Upload, Save, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseFileStream, parseText, type MdrSummary } from "@/lib/mdr/parser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/app/mdr")({
  component: MdrPage,
});

const COLORS = ["#3DA892", "#2D7DB3", "#C98B2A", "#D9534F", "#7C3AED", "#10B981", "#F59E0B"];

function MdrPage() {
  const qc = useQueryClient();
  const [summary, setSummary] = useState<MdrSummary | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<"MDR" | "CDR">("MDR");
  const [pasted, setPasted] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [periodoDesde, setPeriodoDesde] = useState<string>("");
  const [periodoHasta, setPeriodoHasta] = useState<string>("");

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("id,nombre").order("nombre")).data || [],
  });

  const { data: datasets = [] } = useQuery({
    queryKey: ["mdr_datasets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("mdr_datasets")
        .select("*, clientes(nombre)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleFile = async (file: File) => {
    setBusy(true);
    setProgress(0);
    setNombre(file.name);
    try {
      const s = await parseFileStream(file, (read, total) => {
        setProgress(total ? (read / total) * 100 : 0);
      });
      setSummary(s);
      if (s.fechaDesde) setPeriodoDesde(s.fechaDesde);
      if (s.fechaHasta) setPeriodoHasta(s.fechaHasta);
      toast.success(`Procesados ${s.total.toLocaleString()} registros`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const procesarPegado = () => {
    if (!pasted.trim()) return;
    setBusy(true);
    setTimeout(() => {
      const s = parseText(pasted);
      setSummary(s);
      if (!nombre) setNombre(`Pegado-${new Date().toISOString().slice(0, 10)}`);
      toast.success(`Procesados ${s.total.toLocaleString()} registros`);
      setBusy(false);
    }, 50);
  };

  const guardar = async () => {
    if (!summary) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("No autenticado");
    const { error } = await supabase.from("mdr_datasets").insert({
      user_id: u.user.id,
      nombre: nombre || "Sin título",
      tipo,
      cliente_id: clienteId || null,
      fecha_desde: periodoDesde || summary.fechaDesde || null,
      fecha_hasta: periodoHasta || summary.fechaHasta || null,
      total_registros: summary.total,
      total_out: summary.out,
      total_in: summary.in,
      total_delivered: summary.delivered,
      total_failed: summary.failed,
      resumen: summary as any,
    });
    if (error) return toast.error(error.message);
    toast.success("Dataset guardado");
    qc.invalidateQueries({ queryKey: ["mdr_datasets"] });
  };

  const eliminarDataset = async (id: string) => {
    if (!confirm("¿Eliminar dataset?")) return;
    await supabase.from("mdr_datasets").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["mdr_datasets"] });
  };

  const exportPDF = () => {
    if (!summary) return;
    const doc = new jsPDF({ unit: "pt" });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(61, 168, 146);
    doc.rect(0, 0, W, 60, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`NEXVIA · Reporte ${tipo}`, 40, 38);
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.text(`Dataset: ${nombre}`, 40, 80);
    doc.text(`Periodo: ${summary.fechaDesde || "—"} a ${summary.fechaHasta || "—"}`, 40, 95);
    doc.text(`Total: ${summary.total.toLocaleString()}  OUT: ${summary.out}  IN: ${summary.in}  Entregados: ${summary.delivered}  Fallidos: ${summary.failed}`, 40, 110);

    autoTable(doc, {
      startY: 130,
      head: [["Operador", "Total", "OUT", "IN", "Entregados", "Fallidos"]],
      body: Object.entries(summary.porOperador).map(([op, v]) => [op, v.total, v.out, v.in, v.delivered, v.failed]),
      headStyles: { fillColor: [61, 168, 146] },
      styles: { fontSize: 9 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [["Día", "Total", "Entregados", "Fallidos"]],
      body: Object.entries(summary.porDia).sort().map(([d, v]) => [d, v.total, v.delivered, v.failed]),
      headStyles: { fillColor: [45, 125, 179] },
      styles: { fontSize: 9 },
    });

    doc.save(`${tipo}-${nombre || "reporte"}.pdf`);
  };

  const operadorData = summary
    ? Object.entries(summary.porOperador).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total).slice(0, 10)
    : [];
  const diaData = summary
    ? Object.entries(summary.porDia).sort().map(([name, v]) => ({ name, ...v }))
    : [];
  const dirData = summary ? [{ name: "OUT", value: summary.out }, { name: "IN", value: summary.in }] : [];

  return (
    <>
      <PageTitle
        icon={MessageSquare}
        title="MDR / CDR Analytics"
        subtitle="Procesa archivos masivos de logs SMS (>1GB) directo en tu navegador"
        actions={
          summary && (
            <>
              <Button variant="outline" onClick={exportPDF}><Download className="w-4 h-4 mr-1" /> PDF</Button>
              <Button onClick={guardar}><Save className="w-4 h-4 mr-1" /> Guardar</Button>
            </>
          )
        }
      />

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-card border-2 border-dashed rounded-xl p-6">
          <Tabs defaultValue="file">
            <TabsList>
              <TabsTrigger value="file">Subir archivo</TabsTrigger>
              <TabsTrigger value="paste">Copiar/Pegar</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-4">
              <label className="flex flex-col items-center justify-center gap-3 py-8 cursor-pointer hover:bg-muted/40 rounded-lg transition">
                <Upload className="w-10 h-10 text-primary" />
                <div className="text-sm">Arrastra o selecciona un archivo de log SMS</div>
                <div className="text-xs text-muted-foreground">Sin límite de tamaño · streaming en navegador</div>
                <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </label>
              {busy && <Progress value={progress} className="mt-4" />}
            </TabsContent>
            <TabsContent value="paste" className="mt-4 space-y-3">
              <Textarea
                rows={8}
                placeholder="Pega aquí líneas de log con columnas separadas por tabulación..."
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                className="font-mono text-xs"
              />
              <Button onClick={procesarPegado} disabled={busy}>Procesar</Button>
            </TabsContent>
          </Tabs>
        </div>
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <div>
            <Label>Nombre del dataset</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Junio 2026" />
          </div>
          <div>
            <Label>Tipo</Label>
            <div className="flex gap-2 mt-1">
              {(["MDR", "CDR"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`px-3 py-1.5 text-xs rounded-md border ${tipo === t ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <Metric label="Total" value={summary.total} />
            <Metric label="Salientes (OUT)" value={summary.out} />
            <Metric label="Entrantes (IN)" value={summary.in} />
            <Metric label="Entregados" value={summary.delivered} tone="success" />
            <Metric label="Fallidos" value={summary.failed} tone="destructive" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-card border rounded-xl p-5">
              <h3 className="font-semibold mb-3">Top operadores</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={operadorData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" fontSize={10} angle={-20} textAnchor="end" height={60} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Bar dataKey="delivered" stackId="a" fill="#3DA892" name="Entregados" />
                  <Bar dataKey="failed" stackId="a" fill="#D9534F" name="Fallidos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border rounded-xl p-5">
              <h3 className="font-semibold mb-3">Distribución dirección</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={dirData} dataKey="value" nameKey="name" outerRadius={100} label>
                    {dirData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {diaData.length > 0 && (
            <div className="bg-card border rounded-xl p-5 mb-6">
              <h3 className="font-semibold mb-3">Evolución por día</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={diaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="delivered" fill="#3DA892" name="Entregados" />
                  <Bar dataKey="failed" fill="#D9534F" name="Fallidos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-semibold mb-3">Detalle por operador</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Operador</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">OUT</th>
                    <th className="text-right p-2">IN</th>
                    <th className="text-right p-2">Entregados</th>
                    <th className="text-right p-2">Fallidos</th>
                    <th className="text-right p-2">% Éxito</th>
                  </tr>
                </thead>
                <tbody>
                  {operadorData.map((o) => (
                    <tr key={o.name} className="border-t">
                      <td className="p-2 font-mono text-xs">{o.name}</td>
                      <td className="text-right p-2">{o.total.toLocaleString()}</td>
                      <td className="text-right p-2">{o.out.toLocaleString()}</td>
                      <td className="text-right p-2">{o.in.toLocaleString()}</td>
                      <td className="text-right p-2 text-success">{o.delivered.toLocaleString()}</td>
                      <td className="text-right p-2 text-destructive">{o.failed.toLocaleString()}</td>
                      <td className="text-right p-2 font-semibold">
                        {o.total ? ((o.delivered / o.total) * 100).toFixed(1) : "0"}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {datasets.length > 0 && (
        <div className="mt-8 bg-card border rounded-xl p-5">
          <h3 className="font-semibold mb-3">Datasets guardados</h3>
          <div className="space-y-2">
            {datasets.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                <div>
                  <div className="font-medium text-sm">{d.nombre} <span className="text-xs text-muted-foreground">· {d.tipo}</span></div>
                  <div className="text-xs text-muted-foreground">
                    {d.fecha_desde || "—"} → {d.fecha_hasta || "—"} · {Number(d.total_registros).toLocaleString()} registros
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSummary(d.resumen)}>Ver</Button>
                  <Button size="sm" variant="ghost" onClick={() => eliminarDataset(d.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" }) {
  const toneCls = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${toneCls}`}>{value.toLocaleString()}</div>
    </div>
  );
}
