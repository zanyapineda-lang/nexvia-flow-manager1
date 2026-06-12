import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { LayoutDashboard, FileText, Users, MessageSquare, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const [stats, setStats] = useState({ clientes: 0, facturas: 0, mdr: 0, ingresos: 0, pendiente: 0 });

  useEffect(() => {
    (async () => {
      const [c, f, m, fp] = await Promise.all([
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("facturas").select("id,total,estado", { count: "exact" }),
        supabase.from("mdr_datasets").select("id", { count: "exact", head: true }),
        supabase.from("facturas").select("total").eq("estado", "pagada"),
      ]);
      const ingresos = (fp.data || []).reduce((s, r: any) => s + Number(r.total || 0), 0);
      const pendiente = (f.data || []).filter((r: any) => r.estado === "pendiente").reduce((s, r: any) => s + Number(r.total || 0), 0);
      setStats({ clientes: c.count || 0, facturas: f.count || 0, mdr: m.count || 0, ingresos, pendiente });
    })();
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  const cards = [
    { label: "Clientes", value: stats.clientes, icon: Users, color: "from-info to-blue-400" },
    { label: "Facturas emitidas", value: stats.facturas, icon: FileText, color: "from-primary to-primary-glow" },
    { label: "Datasets MDR/CDR", value: stats.mdr, icon: MessageSquare, color: "from-warning to-amber-400" },
    { label: "Ingresos cobrados", value: fmt(stats.ingresos), icon: TrendingUp, color: "from-success to-emerald-400" },
    { label: "Por cobrar", value: fmt(stats.pendiente), icon: TrendingUp, color: "from-destructive to-rose-400" },
  ];

  return (
    <>
      <PageTitle icon={LayoutDashboard} title="Dashboard" subtitle="Resumen general del panel NEXVIA" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-card border rounded-xl p-5 shadow-[var(--shadow-card)]">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center text-white mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{c.label}</div>
              <div className="text-2xl font-bold">{c.value}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-semibold mb-2">Bienvenido a NEXVIA</h3>
          <p className="text-sm text-muted-foreground">
            Gestiona tu operación SMS, factura a tus clientes, sube soportes de pago, analiza dashboards y descarga
            informes contables — todo en un único lugar.
          </p>
        </div>
        <div className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground rounded-xl p-6 shadow-[var(--shadow-elegant)]">
          <h3 className="font-semibold mb-2">Atajos rápidos</h3>
          <ul className="text-sm space-y-1 opacity-95">
            <li>• Sube un archivo MDR/CDR en el módulo correspondiente</li>
            <li>• Crea una nueva factura desde Facturación</li>
            <li>• Adjunta soportes de pago en Contabilidad</li>
            <li>• Cierra el mes con el módulo de Cierres</li>
          </ul>
        </div>
      </div>
    </>
  );
}
