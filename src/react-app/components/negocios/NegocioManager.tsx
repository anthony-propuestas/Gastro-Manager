import { useEffect, useState } from "react";
import { Copy, Check, Loader2, UserMinus, LogOut, Users } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/react-app/components/ui/dialog";
import { useAuth } from "@/react-app/context/AuthContext";
import { useNegocios } from "@/react-app/hooks/useNegocios";
import type { NegocioMember } from "@/shared/types";

interface NegocioManagerProps {
  open: boolean;
  onClose: () => void;
}

export default function NegocioManager({ open, onClose }: NegocioManagerProps) {
  const { user, currentNegocio, setCurrentNegocio, refreshNegocios } = useAuth();
  const { getNegocioDetail, generateInvitation, removeMember, leaveNegocio, isLoading, error } = useNegocios();

  const [members, setMembers] = useState<NegocioMember[]>([]);
  const [isCreator, setIsCreator] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingMember, setLoadingMember] = useState<string | null>(null);

  useEffect(() => {
    if (open && currentNegocio) {
      loadDetail();
    }
  }, [open, currentNegocio?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDetail = async () => {
    if (!currentNegocio) return;
    const detail = await getNegocioDetail(currentNegocio.id);
    if (detail) {
      setMembers(detail.members);
      setIsCreator(detail.created_by === user?.id);
    }
  };

  const handleCopyInvite = async () => {
    if (!currentNegocio) return;
    setActionError(null);
    const inv = await generateInvitation(currentNegocio.id);
    if (inv) {
      await navigator.clipboard.writeText(inv.invite_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } else {
      setActionError(error || "No se pudo generar el link.");
    }
  };

  const handleRemove = async (targetUserId: string) => {
    if (!currentNegocio) return;
    setActionError(null);
    setLoadingMember(targetUserId);
    const ok = await removeMember(currentNegocio.id, targetUserId);
    if (ok) {
      await loadDetail();
    } else {
      setActionError(error || "Error al remover miembro");
    }
    setLoadingMember(null);
  };

  const handleLeave = async () => {
    if (!currentNegocio) return;
    setActionError(null);
    const ok = await leaveNegocio(currentNegocio.id);
    if (ok) {
      setCurrentNegocio(null);
      await refreshNegocios();
      onClose();
    } else {
      setActionError(error || "No se pudo salir del negocio");
    }
  };

  if (!currentNegocio) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {currentNegocio.name}
          </DialogTitle>
          <DialogDescription>
            Gestiona los miembros de tu equipo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invite button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleCopyInvite}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : copied ? (
              <Check className="w-4 h-4 mr-2 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            {copied ? "¡Link copiado!" : "Copiar link de invitación"}
          </Button>

          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}

          {/* Members list */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Miembros ({members.length})
            </p>
            {members.map((member) => {
              const isCurrentUser = member.user_id === user?.id;
              const isMemberLoading = loadingMember === member.user_id;

              return (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-2.5 rounded-lg border"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-primary">
                        {member.user_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.user_name}
                        {isCurrentUser && (
                          <span className="ml-1.5 text-xs text-muted-foreground font-normal">(tú)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{member.user_email}</p>
                    </div>
                  </div>

                  {/* Remove button — only creator sees it, and only for others */}
                  {isCreator && !isCurrentUser && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleRemove(member.user_id)}
                      disabled={isMemberLoading}
                    >
                      {isMemberLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserMinus className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Leave button */}
          <div className="pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full"
              onClick={handleLeave}
              disabled={isLoading}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Salir del negocio
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
