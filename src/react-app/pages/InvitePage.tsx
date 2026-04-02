import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ChefHat, Loader2, CheckCircle, XCircle, Users } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { useAuth } from "@/react-app/context/AuthContext";
import type { InvitationPreview } from "@/shared/types";

type PageState = "loading" | "preview" | "error" | "redeeming" | "success";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user, setCurrentNegocio, refreshNegocios } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<PageState>("loading");
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("Enlace de invitación inválido.");
      return;
    }

    fetch(`/api/invitations/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setPreview(data.data);
          setState("preview");
        } else {
          setErrorMsg(data.error?.message || "Esta invitación no existe, ya fue usada o expiró.");
          setState("error");
        }
      })
      .catch(() => {
        setErrorMsg("Sin conexión. Revisa tu internet e intenta de nuevo.");
        setState("error");
      });
  }, [token]);

  const handleRedeem = async () => {
    if (!token) return;
    setState("redeeming");
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/invitations/${token}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (data.success) {
        const { negocio_id, negocio_name } = data.data;
        // Refresh negocios list and set the new one as current
        await refreshNegocios();
        setCurrentNegocio({ id: negocio_id, name: negocio_name, created_by: "", created_at: "", updated_at: "" });
        setState("success");
      } else {
        setErrorMsg(data.error?.message || "No pudimos procesar la invitación. Intenta de nuevo.");
        setState("preview");
      }
    } catch {
      setErrorMsg("Sin conexión. Revisa tu internet e intenta de nuevo.");
      setState("preview");
    }
  };

  const handleLoginRedirect = () => {
    // Preserve the invite URL so after login they come back here
    navigate(`/login?next=/invite/${token}`);
  };

  const formatExpiry = (expiresAt: string) => {
    const d = new Date(expiresAt);
    return d.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
          <ChefHat className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Gastro Manager</h1>
      </div>

      <div className="w-full max-w-sm">
        {/* Loading */}
        {state === "loading" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted-foreground text-sm">Verificando invitación...</p>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {state === "error" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <XCircle className="w-12 h-12 text-destructive" />
              <div className="text-center space-y-1">
                <p className="font-medium">Invitación no disponible</p>
                <p className="text-sm text-muted-foreground">{errorMsg}</p>
              </div>
              <Button variant="outline" onClick={() => navigate("/")}>
                Ir al inicio
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        {(state === "preview" || state === "redeeming") && preview && (
          <Card>
            <CardHeader className="text-center pb-3">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
              <CardTitle>{preview.negocio_name}</CardTitle>
              <CardDescription>
                <span className="font-medium">{preview.invited_by_name}</span> te invita a unirte a este negocio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground text-center">
                Esta invitación expira el {formatExpiry(preview.expires_at)}
              </p>

              {errorMsg && (
                <p className="text-sm text-destructive text-center">{errorMsg}</p>
              )}

              {user ? (
                <Button
                  className="w-full"
                  onClick={handleRedeem}
                  disabled={state === "redeeming"}
                >
                  {state === "redeeming" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uniéndote...
                    </>
                  ) : (
                    `Unirme a ${preview.negocio_name}`
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    Necesitas iniciar sesión para unirte
                  </p>
                  <Button className="w-full" onClick={handleLoginRedirect}>
                    Iniciar sesión para unirme
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Success */}
        {state === "success" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <div className="text-center space-y-1">
                <p className="font-medium">Te uniste al negocio</p>
                <p className="text-sm text-muted-foreground">
                  Ya puedes acceder a {preview?.negocio_name}
                </p>
              </div>
              <Button onClick={() => navigate("/")}>Ir al dashboard</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
