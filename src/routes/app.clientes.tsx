import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { Users, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/app/clientes")({
  component: ClientesPage,
});

type Cliente = { id: string; nombre: string; nit?: string; email?: string; telefono?: string; direccion?: string; ciudad?: string; notas?: string; codigo_smpp?: string };

function ClientesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Cliente>>({});

  const { data = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("*").order("nombre");
      return (data || []) as Cliente[];
    },
  });

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload = { ...edit, user_id: u.user.id };
    if (edit.id) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("clientes").insert(payload as any);
      if (error) return toast.error(error.message);
    }
    toast.success("Guardado");
    setOpen(false);
    setEdit({});
    qc.invalidateQueries({ queryKey: ["clientes"] });
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar cliente?")) return;
    await supabase.from("clientes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["clientes"] });
  };

  return (
    <>
      <PageTitle
        icon={Users}
        title="Clientes"
        subtitle="Administra tu cartera de clientes"
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit({}); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-1" /> Nuevo cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{edit.id ? "Editar" : "Nuevo"} cliente</DialogTitle></DialogHeader>
              <form onSubmit={guardar} className="space-y-3">
                <div><Label>Nombre *</Label><Input required value={edit.nombre || ""} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>NIT</Label><Input value={edit.nit || ""} onChange={(e) => setEdit({ ...edit, nit: e.target.value })} /></div>
                  <div><Label>Teléfono</Label><Input value={edit.telefono || ""} onChange={(e) => setEdit({ ...edit, telefono: e.target.value })} /></div>
                </div>
                <div><Label>Email</Label><Input type="email" value={edit.email || ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
                <div>
                  <Label>Código SMPP</Label>
                  <Input value={edit.codigo_smpp || ""} onChange={(e) => setEdit({ ...edit, codigo_smpp: e.target.value })} placeholder="Electcapital_mkt" />
                  <p className="text-xs text-muted-foreground mt-1">Identificador de cuenta usado en los logs de Jasmin, ej: Electcapital_mkt</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Dirección</Label><Input value={edit.direccion || ""} onChange={(e) => setEdit({ ...edit, direccion: e.target.value })} /></div>
                  <div><Label>Ciudad</Label><Input value={edit.ciudad || ""} onChange={(e) => setEdit({ ...edit, ciudad: e.target.value })} /></div>
                </div>
                <div><Label>Notas</Label><Textarea value={edit.notas || ""} onChange={(e) => setEdit({ ...edit, notas: e.target.value })} /></div>
                <Button type="submit" className="w-full">Guardar</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-muted/50">
            <tr>
              <th className="text-left p-3">Nombre</th>
              <th className="text-left p-3">NIT</th>
              <th className="text-left p-3">Código SMPP</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Teléfono</th>
              <th className="text-left p-3">Ciudad</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-medium">{c.nombre}</td>
                <td className="p-3 text-muted-foreground">{c.nit || "—"}</td>
                <td className="p-3 text-muted-foreground font-mono text-xs">{c.codigo_smpp || "—"}</td>
                <td className="p-3 text-muted-foreground">{c.email || "—"}</td>
                <td className="p-3 text-muted-foreground">{c.telefono || "—"}</td>
                <td className="p-3 text-muted-foreground">{c.ciudad || "—"}</td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => eliminar(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </td>
              </tr>
            ))}
            {!data.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aún no tienes clientes</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
