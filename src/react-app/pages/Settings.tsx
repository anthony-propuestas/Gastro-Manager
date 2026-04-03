import { useEffect, useState } from "react";
import { User, Bell, Link, UsersRound, UserMinus, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Switch } from "@/react-app/components/ui/switch";
import { Label } from "@/react-app/components/ui/label";
import { Input } from "@/react-app/components/ui/input";
import { Separator } from "@/react-app/components/ui/separator";
import { useAuth } from "@/react-app/context/AuthContext";
import { useNegocios } from "@/react-app/hooks/useNegocios";
import type { NegocioMember } from "@/shared/types";

type InvitationResponse = {
  success: boolean;
  data?: {
    invite_url: string;
  };
  error?: {
    message?: string;
  };
};

export default function Settings() {
  const { user, currentNegocio, setCurrentNegocio, refreshNegocios } = useAuth();
  const { getNegocioDetail, removeMember, leaveNegocio } = useNegocios();
  const [members, setMembers] = useState<NegocioMember[]>([]);
  const [isCreator, setIsCreator] = useState(false);
  const [invite, setInvite] = useState({ url: "", error: "", loading: false });
  const [teamError, setTeamError] = useState("");
  const [loadingMember, setLoadingMember] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const loadTeam = async () => {
      if (!currentNegocio) {
        setMembers([]);
        setIsCreator(false);
        return;
      }

      const detail = await getNegocioDetail(currentNegocio.id);
      if (detail) {
        setMembers(detail.members);
        setIsCreator(detail.created_by === user?.id);
        setTeamError("");
      } else {
        setTeamError("No se pudo cargar el equipo del negocio.");
      }
    };

    loadTeam();
  }, [currentNegocio?.id, getNegocioDetail, user?.id]);

  const handleGenerateInvite = async () => {
    if (!currentNegocio) {
      setInvite(prev => ({ ...prev, error: "No hay un negocio seleccionado." }));
      return;
    }

    setInvite({ url: "", error: "", loading: true });

    try {
      const response = await fetch(`/api/negocios/${currentNegocio.id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = (await response.json()) as InvitationResponse;

      if (!response.ok || !data.success || !data.data?.invite_url) {
        throw new Error(data.error?.message || "No se pudo generar la invitacion.");
      }

      setInvite({ url: data.data.invite_url, error: "", loading: false });
    } catch (error) {
      setInvite({
        url: "",
        error: error instanceof Error ? error.message : "Error inesperado al generar la invitacion.",
        loading: false,
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentNegocio) return;
    setTeamError("");
    setLoadingMember(userId);

    const ok = await removeMember(currentNegocio.id, userId);
    if (ok) {
      const detail = await getNegocioDetail(currentNegocio.id);
      if (detail) {
        setMembers(detail.members);
      }
    } else {
      setTeamError("No se pudo remover el miembro.");
    }

    setLoadingMember(null);
  };

  const handleLeaveBusiness = async () => {
    if (!currentNegocio) return;
    setLeaving(true);
    setTeamError("");

    const ok = await leaveNegocio(currentNegocio.id);
    if (ok) {
      setCurrentNegocio(null);
      await refreshNegocios();
    } else {
      setTeamError("No se pudo salir del negocio.");
    }

    setLeaving(false);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-semibold text-foreground">
          Configuración
        </h1>
        <p className="text-muted-foreground mt-1">
          Administra las preferencias de tu cuenta
        </p>
      </div>

      {/* Profile Settings */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-serif">Perfil</CardTitle>
              <CardDescription>
                Información de tu cuenta de gerente
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-chart-3 flex items-center justify-center">
              <span className="text-2xl font-semibold text-primary-foreground">
                GM
              </span>
            </div>
            <div>
              <p className="font-medium">Gerente del Restaurante</p>
              <p className="text-sm text-muted-foreground">
                gerente@restaurante.com
              </p>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="restaurant-name">Nombre del Restaurante</Label>
              <Input
                id="restaurant-name"
                placeholder="Mi Restaurante"
                defaultValue="La Casa del Chef"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timezone">Zona Horaria</Label>
              <Input
                id="timezone"
                placeholder="America/Mexico_City"
                defaultValue="America/Mexico_City"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Link className="w-5 h-5 text-accent" />
            </div>
            <div>
              <CardTitle className="text-lg font-serif">Integraciones</CardTitle>
              <CardDescription>
                Conecta servicios externos a tu cuenta
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium">Google Calendar</p>
                <p className="text-sm text-muted-foreground">
                  Sincroniza tus eventos
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Conectar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-chart-3/10">
              <Bell className="w-5 h-5 text-chart-3" />
            </div>
            <div>
              <CardTitle className="text-lg font-serif">
                Notificaciones
              </CardTitle>
              <CardDescription>
                Configura cómo recibir alertas
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Recordatorios de eventos</p>
              <p className="text-sm text-muted-foreground">
                Recibe alertas antes de tus reuniones
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Actualizaciones de empleados</p>
              <p className="text-sm text-muted-foreground">
                Notificaciones sobre cambios en el personal
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Resumen semanal</p>
              <p className="text-sm text-muted-foreground">
                Recibe un reporte cada lunes
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UsersRound className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-serif">Equipo del negocio</CardTitle>
              <CardDescription>
                Genera enlaces para invitar miembros y administra el equipo del negocio actual.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!currentNegocio ? (
            <p className="text-sm text-muted-foreground">Selecciona un negocio para administrar su equipo.</p>
          ) : (
            <>
              <div className="space-y-3 rounded-lg bg-muted/40 p-4">
                <div>
                  <p className="font-medium">{currentNegocio.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Genera un enlace y compartelo manualmente con la persona que quieras invitar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateInvite}
                  disabled={invite.loading}
                  className="inline-flex h-10 items-center justify-center rounded-4xl border border-border bg-input/30 px-4 text-sm font-medium hover:bg-input/50 disabled:opacity-50"
                >
                  {invite.loading ? "Generando..." : "Generar link de invitacion"}
                </button>
                <div className={invite.url ? "space-y-2" : "hidden"}>
                  <Label htmlFor="invite-url">Link generado</Label>
                  <Input id="invite-url" value={invite.url} readOnly />
                  <p className="text-xs text-muted-foreground">
                    Copia este enlace manualmente y compartelo con tu equipo.
                  </p>
                </div>
                <p className={invite.error ? "text-sm text-destructive" : "hidden"}>
                  {invite.error}
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <p className="font-medium">Miembros</p>
                  <p className="text-sm text-muted-foreground">{members.length} personas con acceso a este negocio.</p>
                </div>
                {members.map((member) => {
                  const isCurrentUser = member.user_id === user?.id;
                  const isRemoving = loadingMember === member.user_id;

                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {member.user_name}
                          {isCurrentUser && <span className="ml-2 text-sm text-muted-foreground">(tú)</span>}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">{member.user_email}</p>
                      </div>
                      {isCreator && !isCurrentUser && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.user_id)}
                          disabled={isRemoving}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <UserMinus className="w-4 h-4 mr-2" />
                          {isRemoving ? "Removiendo..." : "Remover"}
                        </Button>
                      )}
                    </div>
                  );
                })}
                {teamError && <p className="text-sm text-destructive">{teamError}</p>}
              </div>

              <Separator />

              <div className="flex justify-start">
                <Button
                  variant="ghost"
                  onClick={handleLeaveBusiness}
                  disabled={leaving}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {leaving ? "Saliendo..." : "Salir del negocio"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button className="bg-primary hover:bg-primary/90">
          Guardar Cambios
        </Button>
      </div>
    </div>
  );
}
