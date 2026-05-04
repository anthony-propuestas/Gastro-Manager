import { useState } from "react";
import { useSellers } from "@/react-app/hooks/useSellers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Badge } from "@/react-app/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/react-app/components/ui/table";
import { Megaphone, Copy, CheckCircle, Loader2, DollarSign, Users, TrendingUp, Clock } from "lucide-react";

const ESTADO_BADGE: Record<string, string> = {
  confirmado: "bg-green-100 text-green-800",
  pendiente: "bg-blue-100 text-blue-800",
  cancelado: "bg-red-100 text-red-800",
};

const SUS_BADGE: Record<string, string> = {
  autorizada: "bg-green-100 text-green-800",
  en_gracia: "bg-amber-100 text-amber-800",
  pendiente: "bg-blue-100 text-blue-800",
  cancelada: "bg-red-100 text-red-800",
  pausada: "bg-gray-100 text-gray-700",
};

export default function Sellers() {
  const { vendedor, referidos, stats, isLoading, error, activate } = useSellers();
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);

  const referralLink = vendedor
    ? `${window.location.origin}/suscripcion?ref=${vendedor.codigo}`
    : "";

  const handleActivate = async () => {
    setActivating(true);
    await activate();
    setActivating(false);
  };

  const handleCopy = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Programa de Vendedores</h1>
          <p className="text-muted-foreground text-sm">Compartí La Hoja y ganá comisiones</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-md">{error}</div>
      )}

      {!vendedor ? (
        <Card>
          <CardHeader>
            <CardTitle>Convertite en vendedor</CardTitle>
            <CardDescription>Activá tu cuenta de vendedor y empezá a generar ingresos compartiendo La Hoja.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-100">
                <DollarSign className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-green-800">Comisión por venta</p>
                  <p className="text-2xl font-bold text-green-700">ARS 7.500</p>
                  <p className="text-xs text-green-600">50% de cada suscripción confirmada</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-100">
                <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm text-blue-800">Reembolso al comprador</p>
                  <p className="text-2xl font-bold text-blue-700">ARS 6.000</p>
                  <p className="text-xs text-blue-600">40% de devolución al nuevo suscriptor</p>
                </div>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0" />Obtenés un link único para compartir</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0" />Rastreás tus ventas en tiempo real</li>
              <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500 shrink-0" />El soporte coordina los pagos de comisiones</li>
            </ul>
            <Button onClick={handleActivate} disabled={activating} className="w-full sm:w-auto">
              {activating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Megaphone className="w-4 h-4 mr-2" />}
              Activarme como vendedor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-xs">Referidos</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.total_referidos}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs">Confirmados</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{stats.confirmados}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs">Comisión total</span>
                  </div>
                  <p className="text-2xl font-bold">ARS {stats.comision_total.toLocaleString("es-AR")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">Pendiente cobro</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">ARS {stats.comision_pendiente.toLocaleString("es-AR")}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Link */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tu link de referido</CardTitle>
              <CardDescription>Compartí este link para llevar nuevos usuarios a suscribirse.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono truncate select-all">
                  {referralLink}
                </div>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  <span className="ml-1 hidden sm:inline">{copied ? "Copiado" : "Copiar"}</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Código: <span className="font-mono font-semibold">{vendedor.codigo}</span></p>
            </CardContent>
          </Card>

          {/* Referidos table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mis referidos</CardTitle>
            </CardHeader>
            <CardContent>
              {referidos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aún no tenés referidos. ¡Compartí tu link para empezar!
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Suscripción</TableHead>
                      <TableHead>Estado ref.</TableHead>
                      <TableHead>Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referidos.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{r.referido_name}</p>
                          <p className="text-xs text-muted-foreground">{r.referido_email}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("es-AR")}
                        </TableCell>
                        <TableCell>
                          {r.suscripcion_estado ? (
                            <Badge className={`text-xs ${SUS_BADGE[r.suscripcion_estado] ?? "bg-gray-100 text-gray-700"}`}>
                              {r.suscripcion_estado.replace("_", " ")}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${ESTADO_BADGE[r.estado] ?? "bg-gray-100 text-gray-700"}`}>
                            {r.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.comision_monto != null ? (
                            <span className={r.comision_pagada ? "text-muted-foreground line-through" : "font-medium"}>
                              ARS {r.comision_monto.toLocaleString("es-AR")}
                              {r.comision_pagada ? " ✓" : ""}
                            </span>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
