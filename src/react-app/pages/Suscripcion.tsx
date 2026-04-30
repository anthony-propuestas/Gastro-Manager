import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useSuscripcion } from "@/react-app/hooks/useSuscripcion";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Badge } from "@/react-app/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/react-app/components/ui/table";
import { CheckCircle, AlertTriangle, Clock, Loader2 } from "lucide-react";

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  autorizada: { label: "Activa", className: "bg-green-100 text-green-800" },
  en_gracia: { label: "En gracia", className: "bg-amber-100 text-amber-800" },
  pendiente: { label: "Pendiente", className: "bg-blue-100 text-blue-800" },
  pausada: { label: "Pausada", className: "bg-gray-100 text-gray-700" },
  cancelada: { label: "Cancelada", className: "bg-red-100 text-red-800" },
};

const PAGO_BADGE: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  pending: "bg-blue-100 text-blue-800",
  cancelled: "bg-gray-100 text-gray-700",
};

export default function SuscripcionPage() {
  const navigate = useNavigate();
  const { suscripcion, pagos, isLoading, error, crear, cancelar, fetchPagos } = useSuscripcion();

  useEffect(() => { fetchPagos(); }, [fetchPagos]);

  const handleSuscribirse = async () => {
    const initPoint = await crear();
    if (initPoint) window.location.assign(initPoint);
  };

  const handleCancelar = async () => {
    if (!confirm("¿Estás seguro de que querés cancelar tu suscripción?")) return;
    await cancelar();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const estado = suscripcion?.estado;
  const sinSuscripcion = !estado || estado === "cancelada" || estado === "pausada";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Mi suscripción</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Plan Inteligente</span>
            {estado && ESTADO_BADGE[estado] && (
              <Badge className={ESTADO_BADGE[estado].className}>{ESTADO_BADGE[estado].label}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sinSuscripcion && (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Accedé a funciones avanzadas de IA, sin límites de uso y soporte prioritario.
              </p>
              <p className="text-2xl font-bold">ARS 15.000 <span className="text-base font-normal text-muted-foreground">/mes</span></p>
              <Button className="w-full" onClick={handleSuscribirse} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Suscribirse
              </Button>
            </div>
          )}

          {estado === "pendiente" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-blue-700">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">Pago pendiente de confirmación</span>
              </div>
              <Button variant="outline" className="w-full" onClick={handleSuscribirse}>
                Completar pago en MercadoPago
              </Button>
            </div>
          )}

          {estado === "autorizada" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Suscripción activa</span>
              </div>
              {suscripcion?.proximo_cobro && (
                <p className="text-sm text-muted-foreground">
                  Próximo cobro: <strong>{new Date(suscripcion.proximo_cobro).toLocaleDateString("es-AR")}</strong>
                </p>
              )}
              <Button variant="outline" className="w-full text-red-600 border-red-300 hover:bg-red-50" onClick={handleCancelar} disabled={isLoading}>
                Cancelar suscripción
              </Button>
            </div>
          )}

          {estado === "en_gracia" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Período de gracia — {suscripcion?.grace_days_left ?? 0} día{suscripcion?.grace_days_left !== 1 ? "s" : ""} para regularizar
                </span>
              </div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600" onClick={handleSuscribirse} disabled={isLoading}>
                Actualizar método de pago
              </Button>
              <Button variant="outline" className="w-full text-red-600 border-red-300 hover:bg-red-50" onClick={handleCancelar} disabled={isLoading}>
                Cancelar suscripción
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {pagos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      {p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString("es-AR") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.monto != null ? `${p.moneda} ${p.monto.toLocaleString("es-AR")}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={PAGO_BADGE[p.estado_pago] ?? "bg-gray-100 text-gray-700"}>
                        {p.estado_pago}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground">
        ← Volver al inicio
      </Button>
    </div>
  );
}
