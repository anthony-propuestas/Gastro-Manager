import { useEffect } from "react";
import { Navigate } from "react-router";
import { Crown, Lock, Calendar, Users, Banknote, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Switch } from "@/react-app/components/ui/switch";
import { Separator } from "@/react-app/components/ui/separator";

import { useAuth } from "@/react-app/context/AuthContext";
import { useOwnerPanel } from "@/react-app/hooks/useOwnerPanel";
import type { NegocioModuleRestrictions } from "@/shared/types";

const MODULE_LABELS: { key: keyof NegocioModuleRestrictions; label: string; icon: typeof Calendar }[] = [
  { key: "calendario", label: "Calendario",  icon: Calendar },
  { key: "personal",   label: "Personal",    icon: Users },
  { key: "sueldos",    label: "Sueldos",     icon: Banknote },
];

export default function OwnerPanel() {
  const { currentNegocio, refreshNegocios } = useAuth();
  const negocioId = currentNegocio?.id;
  const isOwner = currentNegocio?.my_role === 'owner';

  const {
    requests,
    restrictions,
    loadingRequests,
    loadingRestrictions,
    actionLoading,
    error,
    fetchRequests,
    fetchRestrictions,
    approveRequest,
    rejectRequest,
    toggleRestriction,
  } = useOwnerPanel(negocioId ?? 0);

  useEffect(() => {
    if (!isOwner || negocioId == null) return;
    fetchRequests();
    fetchRestrictions();
  }, [isOwner, negocioId, fetchRequests, fetchRestrictions]);

  if (!currentNegocio || currentNegocio.my_role !== 'owner') {
    return <Navigate to="/" replace />;
  }

  const handleApprove = async (requestId: number) => {
    const ok = await approveRequest(requestId);
    if (ok) await refreshNegocios();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-semibold text-foreground flex items-center gap-3">
          <Crown className="w-7 h-7 text-amber-500" />
          Panel Owner
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestiona el acceso de owners y los módulos visibles para los gerentes de{" "}
          <span className="font-medium">{currentNegocio.name}</span>
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">{error}</p>
      )}

      {/* Solicitudes de Owner */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Crown className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-lg font-serif">Solicitudes de Owner</CardTitle>
              <CardDescription>
                Aprueba o rechaza solicitudes de usuarios que quieren ser dueños
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingRequests ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando solicitudes...
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No hay solicitudes pendientes.</p>
          ) : (
            requests.map((req) => {
              const isProcessing = actionLoading === req.id;
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{req.user_name}</p>
                    <p className="text-sm text-muted-foreground truncate">{req.user_email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Solicitado: {new Date(req.requested_at).toLocaleDateString("es-MX", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(req.id)}
                      disabled={isProcessing}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><CheckCircle className="w-4 h-4 mr-1" />Aprobar</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => rejectRequest(req.id)}
                      disabled={isProcessing}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><XCircle className="w-4 h-4 mr-1" />Rechazar</>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Restricciones de módulos */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-serif">Restricciones de módulos</CardTitle>
              <CardDescription>
                Los módulos activados aquí serán ocultos para los gerentes de este negocio
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingRestrictions ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando restricciones...
            </div>
          ) : (
            MODULE_LABELS.map(({ key, label, icon: Icon }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {restrictions[key]
                        ? "Oculto para gerentes"
                        : "Visible para gerentes"}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={restrictions[key]}
                  onCheckedChange={() => toggleRestriction(key)}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
