import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { MessageSquare, Upload, Save, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseFileStream, parseText, emptySummary, type MdrSummary } from "@/lib/mdr/parser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { generateExecutivePDF } from "@/lib/mdr/pdf-report";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { OP_COLORS } from "@/lib/mdr/parser";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/mdr")({
  component: MdrPage,
});

const PATRON_LABEL: Record<string, string> = {
  ip_url: "URL con IP directa",
  tld_sospechoso: "TLD sospechoso",
  headers_garbled: "Encoding corrupto",
  template_sin_resolver: "Template sin resolver",
  apuestas: "Apuestas / casino",
  smishing_bancario: "Smishing bancario",
  trial: "Etiqueta [TRIAL]",
};

function normalizeSummary(raw: any): MdrSummary {
  const base = emptySummary();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    porOperador: raw.porOperador || {},
    porPrefijo: raw.porPrefijo || {},
    porDia: raw.porDia || {},
    porCuenta: raw.porCuenta || {},
    porHora: Array.isArray(raw.porHora) && raw.porHora.length === 24 ? raw.porHora : base.porHora,
    topDestinos: raw.topDestinos || {},
    ultimos: Array.isArray(raw.ultimos) ? raw.ultimos : [],
    fraude: {
      ...base.fraude,
      ...(raw.fraude || {}),
      porPatron: { ...base.fraude.porPatron, ...((raw.fraude && raw.fraude.porPatron) || {}) },
      muestras: Array.isArray(raw.fraude?.muestras) ? raw.fraude.muestras : [],
    },
  };
}

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
    ? Object.entries(summary.porOperador)
        .map(([name, v]) => ({ name, ...v, color: v.color || OP_COLORS[name] || "#6B7280" }))
        .sort((a, b) => b.total - a.total)
    : [];
  const prefijoData = summary
    ? Object.entries(summary.porPrefijo)
        .map(([prefijo, v]) => ({ prefijo, ...v }))
        .sort((a, b) => b.total - a.total)
    : [];
  const horaData = summary
    ? summary.porHora.map((v, i) => ({ hora: `${i.toString().padStart(2, "0")}h`, total: v }))
    : [];
  const topDestinos = summary
    ? Object.entries(summary.topDestinos)
        .map(([numero, v]) => ({ numero, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 20)
    : [];
  const diaData = summary
    ? Object.entries(summary.porDia).sort().map(([name, v]) => ({ name, ...v }))
    : [];
  const entregaData = summary
    ? [
        { name: "DELIVRD", value: summary.delivered, color: "#0F6E56" },
        { name: "UNDELIV / fallidos", value: summary.failed, color: "#C0392B" },
        { name: "Sin estado", value: summary.sinEstado, color: "#9CA3AF" },
      ].filter((d) => d.value > 0)
    : [];
  const tasaEntrega = summary && summary.out > 0 ? (summary.delivered / summary.out) * 100 : 0;
  const totalOp = (op: string) => summary?.porOperador[op]?.total || 0;

  return (
    <>
      <PageTitle
        icon={MessageSquare}
        title="MDR / CDR Analytics"
        subtitle="Procesa archivos masivos de logs SMS (>1GB) directo en tu navegador"
        actions={
          summary && (
            <>
              <Button variant="outline" onClick={exportPDF}><Download className="w-4 h-4 mr-1" /> PDF simple</Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const cliente = clientes.find((c: any) => c.id === clienteId)?.nombre;
                  toast.promise(
                    generateExecutivePDF(summary, {
                      nombre,
                      tipo,
                      cliente,
                      periodoDesde,
                      periodoHasta,
                    }),
                    { loading: "Generando informe ejecutivo…", success: "Informe listo", error: "Error generando PDF" },
                  );
                }}
              >
                <Download className="w-4 h-4 mr-1" /> Informe ejecutivo
              </Button>
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
          <div>
            <Label>Cliente</Label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full mt-1 h-9 rounded-md border bg-card px-2 text-sm"
            >
              <option value="">— sin asignar —</option>
              {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Periodo desde</Label>
              <Input type="date" value={periodoDesde} onChange={(e) => setPeriodoDesde(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Periodo hasta</Label>
              <Input type="date" value={periodoHasta} onChange={(e) => setPeriodoHasta(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {summary && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            <Metric label="Total OUT" value={summary.out} />
            <Metric label="Tasa entrega" value={tasaEntrega} suffix="%" decimals={1} tone="success" />
            <Metric label="No entregados" value={summary.failed} tone="destructive" />
            <Metric label="CLARO" value={totalOp("CLARO")} color="#DC2626" />
            <Metric label="TIGO" value={totalOp("TIGO")} color="#2563EB" />
            <Metric label="MOVISTAR" value={totalOp("MOVISTAR")} color="#16A34A" />
            <Metric label="WOM" value={totalOp("WOM")} color="#7C3AED" />
            <Metric label="Sospechosos" value={summary.fraude.total} tone="destructive" />
          </div>

          {/* Donuts: operador + entrega */}
          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-card border rounded-xl p-5 nx-accent-strip">
              <h3 className="font-semibold mb-3">Distribución por operador (OUT)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={operadorData}
                    dataKey="total"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {operadorData.map((o) => <Cell key={o.name} fill={o.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card border rounded-xl p-5 nx-accent-strip">
              <h3 className="font-semibold mb-3">Estado de entrega</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={entregaData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}>
                    {entregaData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Por bloque de numeración */}
          {prefijoData.length > 0 && (
            <div className="bg-card border rounded-xl p-5 mb-6">
              <h3 className="font-semibold mb-3">Por bloque de numeración (prefijo)</h3>
              <div className="space-y-1.5">
                {prefijoData.map((p) => {
                  const pct = summary.out ? (p.total / summary.out) * 100 : 0;
                  return (
                    <div key={p.prefijo} className="flex items-center gap-3 text-sm">
                      <span className="font-mono text-xs w-10 text-muted-foreground">{p.prefijo}</span>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-white w-20 text-center"
                        style={{ background: p.color }}
                      >
                        {p.operador}
                      </span>
                      <div className="flex-1 h-5 rounded bg-muted relative overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{ width: `${pct}%`, background: p.color }}
                        />
                      </div>
                      <span className="font-mono text-xs w-20 text-right">{p.total.toLocaleString()}</span>
                      <span className="font-mono text-xs w-14 text-right text-muted-foreground">{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actividad horaria + por día */}
          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-card border rounded-xl p-5">
              <h3 className="font-semibold mb-3">Actividad por hora (OUT)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={horaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="hora" fontSize={9} interval={1} />
                  <YAxis fontSize={10} />
                  <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
                  <Bar dataKey="total" fill="#3DA892" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {diaData.length > 0 && (
              <div className="bg-card border rounded-xl p-5">
                <h3 className="font-semibold mb-3">Evolución por día</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={diaData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="delivered" stackId="a" fill="#0F6E56" name="Entregados" />
                    <Bar dataKey="failed" stackId="a" fill="#C0392B" name="Fallidos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Panel de fraude */}
          <div className="bg-card border rounded-xl p-5 mb-6 nx-accent-strip">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                {summary.fraude.total > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-success" />
                )}
                Detección de fraude / smishing
              </h3>
              <div className="flex gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                  Alto: {summary.fraude.alto.toLocaleString()}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning border border-warning/20 font-medium">
                  Medio: {summary.fraude.medio.toLocaleString()}
                </span>
              </div>
            </div>
            {summary.fraude.total === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No se detectaron patrones sospechosos en este dataset.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(summary.fraude.porPatron)
                    .filter(([, n]) => n > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, n]) => (
                      <span key={k} className="text-xs px-2 py-1 rounded-md bg-muted border font-mono">
                        {PATRON_LABEL[k] || k}: <b>{n.toLocaleString()}</b>
                      </span>
                    ))}
                </div>
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase text-muted-foreground bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Hora</th>
                        <th className="text-left p-2">Riesgo</th>
                        <th className="text-left p-2">Origen</th>
                        <th className="text-left p-2">Destino</th>
                        <th className="text-left p-2">Operador</th>
                        <th className="text-left p-2">Patrón</th>
                        <th className="text-left p-2">Preview</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.fraude.muestras.slice(0, 100).map((f, i) => (
                        <tr key={i} className="border-t hover:bg-muted/30">
                          <td className="p-2 font-mono">{f.hora >= 0 ? `${f.hora}h` : "—"}</td>
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${f.riesgo === "alto" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                              {f.riesgo}
                            </span>
                          </td>
                          <td className="p-2 font-mono">{f.origen}</td>
                          <td className="p-2 font-mono">{f.destino}</td>
                          <td className="p-2" style={{ color: OP_COLORS[f.operador] }}>{f.operador}</td>
                          <td className="p-2 text-[10px]">{f.patrones.map((p) => PATRON_LABEL[p]).join(", ")}</td>
                          <td className="p-2 font-mono text-[10px] truncate max-w-md">{f.preview}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Top destinos */}
          {topDestinos.length > 0 && (
            <div className="bg-card border rounded-xl p-5 mb-6">
              <h3 className="font-semibold mb-3">Top 20 destinos</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-muted/50">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Destino</th>
                      <th className="text-left p-2">Operador</th>
                      <th className="text-right p-2">Mensajes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDestinos.map((d, i) => (
                      <tr key={d.numero} className="border-t">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2 font-mono">{d.numero}</td>
                        <td className="p-2">
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded text-white"
                            style={{ background: d.color }}
                          >
                            {d.operador}
                          </span>
                        </td>
                        <td className="text-right p-2 font-mono">{d.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabla detalle operador */}
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-semibold mb-3">Detalle por operador</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Operador</th>
                    <th className="text-right p-2">Total OUT</th>
                    <th className="text-right p-2">Entregados</th>
                    <th className="text-right p-2">Fallidos</th>
                    <th className="text-right p-2">% Éxito</th>
                  </tr>
                </thead>
                <tbody>
                  {operadorData.map((o) => (
                    <tr key={o.name} className="border-t">
                      <td className="p-2 font-semibold" style={{ color: o.color }}>{o.name}</td>
                      <td className="text-right p-2 font-mono">{o.total.toLocaleString()}</td>
                      <td className="text-right p-2 font-mono text-success">{o.delivered.toLocaleString()}</td>
                      <td className="text-right p-2 font-mono text-destructive">{o.failed.toLocaleString()}</td>
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
                  <div className="font-medium text-sm">{d.nombre} <span className="text-xs text-muted-foreground">· {d.tipo}</span>{d.clientes?.nombre && <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary">{d.clientes.nombre}</span>}</div>
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

function Metric({
  label,
  value,
  tone,
  color,
  suffix,
  decimals = 0,
}: {
  label: string;
  value: number;
  tone?: "success" | "destructive";
  color?: string;
  suffix?: string;
  decimals?: number;
}) {
  const toneCls = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();
  return (
    <div
      className="bg-card border rounded-xl p-4 relative overflow-hidden"
      style={color ? { borderLeft: `4px solid ${color}` } : undefined}
    >
      <div className="text-[10px] text-muted-foreground uppercase tracking-[0.12em] font-semibold truncate">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 font-mono ${toneCls}`} style={color && !tone ? { color } : undefined}>
        {formatted}
        {suffix && <span className="text-sm font-normal text-muted-foreground ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

