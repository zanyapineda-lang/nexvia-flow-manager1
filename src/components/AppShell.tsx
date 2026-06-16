import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  FileText,
  Receipt,
  Lock,
  LogOut,
  BarChart3,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { ReactNode } from "react";

const nav: { to: string; label: string; icon: any; exact?: boolean }[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/mdr", label: "MDR / CDR", icon: MessageSquare },
  { to: "/app/clientes", label: "Clientes", icon: Users },
  { to: "/app/clientes-analytics", label: "Análisis de Clientes", icon: BarChart3 },
  { to: "/app/facturas", label: "Facturación", icon: FileText },
  { to: "/app/movimientos", label: "Movimientos", icon: Wallet },
  { to: "/app/contabilidad", label: "Soportes", icon: Receipt },
  { to: "/app/cierres", label: "Cierres", icon: Lock },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground font-bold text-sm shadow-[var(--shadow-elegant)]">
            NX
          </div>
          <div>
            <div className="font-semibold text-sidebar-foreground leading-tight">NEXVIA</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Panel de Gestión</div>
          </div>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Módulos
          </div>
          {nav.map((it) => {
            const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-3 px-5 py-2.5 text-sm border-l-[3px] border-transparent transition-colors",
                  active
                    ? "bg-sidebar-accent text-primary border-primary font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="text-xs text-muted-foreground truncate mb-2">{user?.email}</div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-md border border-border hover:bg-muted transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="h-16 border-b bg-card/50 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-8">
          <div className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
          <div className="text-xs px-3 py-1 rounded-full bg-success/10 text-success border border-success/20">
            Online
          </div>
        </div>
        <div className="p-8 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}

export function PageTitle({ icon: Icon, title, subtitle, actions }: { icon?: any; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          {Icon && <Icon className="w-6 h-6 text-primary" />}
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
