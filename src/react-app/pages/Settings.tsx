import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { User, UsersRound, UserMinus, LogOut, Calendar, Users, Banknote, LayoutGrid, Crown, Loader2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/react-app/components/ui/card";
import { Button } from "@/react-app/components/ui/button";
import { Separator } from "@/react-app/components/ui/separator";
import { Switch } from "@/react-app/components/ui/switch";

import { useAuth } from "@/react-app/context/AuthContext";
import { useNegocios } from "@/react-app/hooks/useNegocios";
import { useModulePrefsContext } from "@/react-app/context/ModulePrefsContext";
import { MODULES } from "@/react-app/hooks/useModulePrefs";
import { apiFetch } from "@/react-app/lib/api";
import type { NegocioMember } from "@/shared/types";

const MODULE_ICONS = {
  calendario: Calendar,
  personal: Users,
  sueldos: Banknote,
} as const;

type OwnerStatus = 'loading' | 'owner' | 'pending' | 'none';

export default function Settings() {
  const navigate = useNavigate();
  const { user, currentNegocio, setCurrentNegocio, refreshNegocios } = useAuth();
  const { getNegocioDetail, removeMember, leaveNegocio } = useNegocios();
  const { prefs, toggleModule, negocioRestrictions, isGerente } = useModulePrefsContext();
  const [members, setMembers] = useState<NegocioMember[]>([]);
  const [isCreator, setIsCreator] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [loadingMember, setLoadingMember] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [ownerStatus, setOwnerStatus] = useState<OwnerStatus>('loading');
  const [requestingOwner, setRequestingOwner] = useState(false);

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
  }, [currentNegocio, getNegocioDetail, user?.id]);

  const negocioId = currentNegocio?.id;

  useEffect(() => {
    if (negocioId == null) {
      setOwnerStatus('none');
      return;
    }

    setOwnerStatus('loading');
    apiFetch(`/api/negocios/${negocioId}/my-owner-request`, {}, negocioId)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setOwnerStatus(json.data.status as OwnerStatus);
        else setOwnerStatus('none');
      })
      .catch(() => setOwnerStatus('none'));
  }, [negocioId]);

  const handleRequestOwner = async () => {
    if (negocioId == null) return;
    setRequestingOwner(true);
    try {
      const res = await apiFetch(`/api/negocios/${negocioId}/request-owner`, { method: "POST" }, negocioId);
      const json = await res.json();
      if (json.success) {
        setOwnerStatus(json.data.status as OwnerStatus);
        if (json.data.status === 'approved') await refreshNegocios();
      }
    } catch {
      // silently fail
    } finally {
      setRequestingOwner(false);
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
        <CardContent>
          {user ? (
            <div className="flex items-center gap-4">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-12 h-12 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-semibold text-muted-foreground">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium truncate">{user.name}</p>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Cargando información del perfil…</p>
          )}
        </CardContent>
      </Card>

      {/* Módulos de Gestión */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <LayoutGrid className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-serif">Módulos de Gestión</CardTitle>
              <CardDescription>
                Personaliza las herramientas visibles en el menú lateral
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {MODULES.map((mod) => {
            const Icon = MODULE_ICONS[mod.key];
            const restricted = isGerente && negocioRestrictions[mod.key];
            return (
              <div
                key={mod.key}
                className="flex items-center justify-between gap-4 rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                    {mod.order}
                  </span>
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{mod.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {restricted ? (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Lock className="w-3 h-3" /> Restringido por el owner
                        </span>
                      ) : mod.description}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={prefs[mod.key] !== false}
                  onCheckedChange={() => toggleModule(mod.key)}
                  disabled={restricted}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {currentNegocio && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-lg font-serif">Rol de Owner</CardTitle>
                <CardDescription>
                  Conviértete en dueño de este negocio para acceder al panel de gestión
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ownerStatus === 'loading' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando estado...
              </div>
            )}
            {ownerStatus === 'owner' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
                  <Crown className="w-4 h-4" />
                  Eres Owner de este negocio
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("/owner")}
                  className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                >
                  Panel de control
                </Button>
              </div>
            )}
            {ownerStatus === 'pending' && (
              <p className="text-sm text-muted-foreground">
                Tu solicitud está pendiente de aprobación por un owner existente.
              </p>
            )}
            {ownerStatus === 'none' && (
              <Button
                onClick={handleRequestOwner}
                disabled={requestingOwner}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {requestingOwner ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</>
                ) : (
                  <><Crown className="w-4 h-4 mr-2" />Identifícame como Dueño</>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UsersRound className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-serif">Administradores del negocio</CardTitle>
              <CardDescription>
                Administra los administradores con acceso al negocio actual.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!currentNegocio ? (
            <p className="text-sm text-muted-foreground">Selecciona un negocio para administrar su equipo.</p>
          ) : (
            <>
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Miembros actuales</p>
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

    </div>
  );
}
