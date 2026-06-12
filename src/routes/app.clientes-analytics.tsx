import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { BarChart3 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/app/clientes-analytics")({ component: Analytics });

function Analytics() {
  const [raw, setRaw] = useState("");
  const [data, setData] = useState<any[]>([]);

  const procesar = () => {
    // Detect delimiter: tab, comma, or semicolon
    const lines = raw.trim().split(/\r?\n/);
    if (!lines.length) return;
    const first = lines[0];
    const delim = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
    const headers = first.split(delim).map((h) => h.trim());
    const rows = lines.slice(1).map((l) => {
      const cells = l.split(delim);
      const o: any = {};
      headers.forEach((h, i) => {
        const v = cells[i]?.trim() ?? "";
        const n = Number(v.replace(/[,.]/g, (m) => (m === "." ? "." : "")));
        o[h] = isNaN(n) || v === "" ? v : n;
      });
      return o;
    });
    setData(rows);
  };

  const numericKeys = data.length ? Object.keys(data[0]).filter((k) => typeof data[0][k] === "number") : [];
  const labelKey = data.length ? Object.keys(data[0]).find((k) => typeof data[0][k] === "string") || Object.keys(data[0])[0] : null;

  return (
    <>
      <PageTitle icon={BarChart3} title="Análisis de Clientes" subtitle="Pega datos tabulados (TSV, CSV) y obtén métricas al vuelo" />
      <div className="bg-card border-2 border-dashed rounded-xl p-5 mb-6">
        <Textarea
          rows={8}
          placeholder={`Pega aquí tus datos. Ejemplo:\ncliente\tenviados\tentregados\tfallidos\nClaro\t12000\t11500\t500\nMovistar\t8500\t8100\t400`}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="font-mono text-xs"
        />
        <Button onClick={procesar} className="mt-3">Analizar</Button>
      </div>

      {data.length > 0 && labelKey && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card label="Filas" value={data.length} />
            {numericKeys.slice(0, 3).map((k) => (
              <Card key={k} label={`Σ ${k}`} value={data.reduce((s, r) => s + (Number(r[k]) || 0), 0)} />
            ))}
          </div>
          {numericKeys.length > 0 && (
            <div className="bg-card border rounded-xl p-5 mb-6">
              <h3 className="font-semibold mb-3">Gráfico comparativo</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.slice(0, 20)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey={labelKey} fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Legend />
                  {numericKeys.map((k, i) => (
                    <Bar key={k} dataKey={k} fill={["#3DA892", "#2D7DB3", "#C98B2A", "#7C3AED", "#D9534F"][i % 5]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="bg-card border rounded-xl p-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/50">
                <tr>{Object.keys(data[0]).map((k) => <th key={k} className="p-2 text-left">{k}</th>)}</tr>
              </thead>
              <tbody>
                {data.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t">
                    {Object.keys(data[0]).map((k) => <td key={k} className="p-2">{String(r[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{Number(value).toLocaleString()}</div>
    </div>
  );
}
