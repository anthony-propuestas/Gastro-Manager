import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Capacitor } from "@capacitor/core";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log("[Callback] URL completa:", window.location.href);
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const errorParam = params.get("error");
        console.log("[Callback] code:", code ? "presente" : "AUSENTE", "error param:", errorParam);

        if (errorParam) throw new Error(`Google OAuth error: ${errorParam} — ${params.get("error_description") ?? ""}`);
        if (!code) throw new Error("No hay code en la URL");

        const isNative = Capacitor.isNativePlatform();
        const isAndroidChrome = /Android/i.test(navigator.userAgent) && !isNative;
        console.log("[Callback] userAgent:", navigator.userAgent);
        console.log("[Callback] isNativePlatform:", isNative, "isAndroidChrome:", isAndroidChrome);

        const body: Record<string, string> = { code };
        if (isNative) body.platform = "android";
        else if (isAndroidChrome) body.platform = "android_chrome";
        console.log("[Callback] body enviado a /api/sessions:", body);

        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        console.log("[Callback] res.status:", res.status, "res.ok:", res.ok);
        const data = await res.json() as { success: boolean; token?: string; error?: { code?: string; message?: string } };
        console.log("[Callback] data recibida:", data);

        if (data.error?.code === "PENDING_VERIFICATION") {
          navigate("/verify-email", { replace: true });
          return;
        }

        if (!res.ok || !data.success) {
          throw new Error(data.error?.message ?? "Error de autenticación");
        }

        if (isAndroidChrome && data.token) {
          const deepLink = `org.lahoja.app://session?token=${encodeURIComponent(data.token)}`;
          console.log("[Callback] Intentando deep link:", deepLink);
          window.location.assign(deepLink);
          return;
        }

        setStatus("success");
        setTimeout(() => {
          window.location.assign("/agente-ia");
        }, 1000);
      } catch (error) {
        const err = error as Error;
        console.error("[Callback] error:", { message: err?.message, stack: err?.stack });
        setStatus("error");
        setErrorMessage(`Error: ${err?.message ?? "desconocido"} | URL: ${window.location.href}`);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <p className="text-lg text-muted-foreground">Procesando autenticación...</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto text-success" />
            <p className="text-lg text-foreground font-medium">¡Autenticación exitosa!</p>
            <p className="text-muted-foreground">Redirigiendo al dashboard...</p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 mx-auto text-destructive" />
            <p className="text-lg text-foreground font-medium">Error de autenticación</p>
            <p className="text-muted-foreground">{errorMessage}</p>
            <button
              onClick={() => navigate("/", { replace: true })}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Volver a intentar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
