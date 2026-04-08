import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Mail, XCircle, CheckCircle, Loader2 } from "lucide-react";

const CHANNEL_NAME = "email-verification";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const [status, setStatus] = useState<"verifying" | "error" | "waiting">(
    token ? "verifying" : "waiting"
  );
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Tab B: token presente — verificar via API y navegar al dashboard
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${token}`);

        // El worker redirige en casos de error (token_used, token_expired, invalid_token)
        if (res.redirected) {
          if (!cancelled) window.location.replace(res.url);
          return;
        }

        if (!res.ok) {
          if (!cancelled) {
            setVerifyError("No se pudo verificar el email. Intentá de nuevo.");
            setStatus("error");
          }
          return;
        }

        const data = await res.json() as { success: boolean };

        if (!data.success) {
          if (!cancelled) {
            setVerifyError("No se pudo verificar el email. El enlace puede haber expirado.");
            setStatus("error");
          }
          return;
        }

        // Notificar a la pestaña original (sin token) que la verificación fue exitosa
        try {
          const ch = new BroadcastChannel(CHANNEL_NAME);
          ch.postMessage({ type: "verified" });
          ch.close();
        } catch {
          // BroadcastChannel no soportado — no es fatal
        }

        if (!cancelled) navigate("/", { replace: true });
      } catch {
        if (!cancelled) {
          setVerifyError("Error de red. Revisá tu conexión e intentá de nuevo.");
          setStatus("error");
        }
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [token, navigate]);

  // Tab A: sin token — escuchar BroadcastChannel para detectar verificación en otra pestaña
  useEffect(() => {
    if (token || error) return;

    try {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = ch;
      ch.onmessage = (e) => {
        if (e.data?.type === "verified") {
          navigate("/login?verified=true", { replace: true });
        }
      };
    } catch {
      // BroadcastChannel no soportado — Tab A queda estática
    }

    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [token, error, navigate]);

  const staticErrorMessages: Record<string, string> = {
    token_expired: "El enlace de verificación expiró. Volvé a iniciar sesión para recibir uno nuevo.",
    token_used: "Este enlace ya fue usado. Si ya verificaste tu cuenta, iniciá sesión normalmente.",
    invalid_token: "El enlace de verificación no es válido.",
  };

  const displayError =
    verifyError ?? (error ? (staticErrorMessages[error] ?? "El enlace de verificación no es válido.") : null);

  if (status === "verifying") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
          <p className="text-lg text-foreground font-medium">Verificando tu cuenta...</p>
          <p className="text-muted-foreground">Un momento, estamos activando tu cuenta.</p>
        </div>
      </div>
    );
  }

  if (status === "error" || displayError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <XCircle className="w-12 h-12 mx-auto text-destructive" />
          <p className="text-lg text-foreground font-medium">Error de verificación</p>
          <p className="text-muted-foreground">{displayError}</p>
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  // status === "waiting" — Tab A mostrando "revisá tu correo"
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <p className="text-lg text-foreground font-medium">Revisá tu bandeja de entrada</p>
        <p className="text-muted-foreground">
          Te enviamos un correo con un enlace para activar tu cuenta. El enlace expira en 24 horas.
        </p>
        <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
          <CheckCircle className="w-4 h-4 inline mr-2 text-success" />
          ¿No llegó el correo? Volvé a intentar iniciar sesión y te enviaremos uno nuevo.
        </div>
        <button
          onClick={() => navigate("/login", { replace: true })}
          className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
}
