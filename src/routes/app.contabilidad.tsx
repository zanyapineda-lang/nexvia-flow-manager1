import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageTitle } from "@/components/AppShell";
import { Receipt, Upload, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/app/contabilidad")({ component: ContabPage });

function ContabPage() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [monto, setMonto] = useState("");
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: soportes = [] } = useQuery({
    queryKey: ["soportes"],
    queryFn: async () => (await supabase.from("soportes_pago").select("*").order("created_at", { ascending: false })).data || [],
  });

  const subir = async () => {
    if (!file) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setBusy(false); return; }
    const path = `${u.user.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("comprobantes").upload(path, file);
    if (upErr) { setBusy(false); return toast.error(upErr.message); }
    const { error } = await supabase.from("soportes_pago").insert({
      user_id: u.user.id, nombre_archivo: file.name, storage_path: path,
      mime_type: file.type, tamano_bytes: file.size,
      monto: monto ? Number(monto) : null, notas,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Soporte subido");
    setFile(null); setMonto(""); setNotas("");
    qc.invalidateQueries({ queryKey: ["soportes"] });
  };

  const descargar = async (s: any) => {
    const { data } = await supabase.storage.from("comprobantes").createSignedUrl(s.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const eliminar = async (s: any) => {
    if (!confirm("¿Eliminar soporte?")) return;
    await supabase.storage.from("comprobantes").remove([s.storage_path]);
    await supabase.from("soportes_pago").delete().eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["soportes"] });
  };

  return (
    <>
      <PageTitle icon={Receipt} title="Contabilidad" subtitle="Sube soportes de pago (imágenes y PDF de facturas)" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 bg-card border-2 border-dashed rounded-xl p-5 space-y-3">
          <Label>Archivo (imagen o PDF)</Label>
          <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Label>Monto</Label>
          <Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
          <Label>Notas</Label>
          <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
          <Button onClick={subir} disabled={!file || busy} className="w-full"><Upload className="w-4 h-4 mr-1" /> Subir soporte</Button>
        </div>
        <div className="lg:col-span-2 bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-muted/50">
              <tr><th className="text-left p-3">Archivo</th><th className="text-right p-3">Monto</th><th className="text-left p-3">Notas</th><th className="text-left p-3">Fecha</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {soportes.map((s: any) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3 text-xs">{s.nombre_archivo}</td>
                  <td className="p-3 text-right">{s.monto ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(s.monto)) : "—"}</td>
                  <td className="p-3 text-muted-foreground">{s.notas || "—"}</td>
                  <td className="p-3 text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => descargar(s)}><Download className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => eliminar(s)}><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
              {!soportes.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Aún no hay soportes</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
