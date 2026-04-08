import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = new URLSearchParams(window.location.search).get("code");
        if (!code) throw new Error("No code in URL");

        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });

        const data = await res.json() as { success: boolean; error?: { code?: string; message?: string } };

        if (data.error?.code === "PENDING_VERIFICATION") {
          navigate("/verify-email", { replace: true });
          return;
        }

        if (!res.ok || !data.success) {
          throw new Error(data.error?.message ?? "Error de autenticación");
        }

        setStatus("success");
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 1000);
      } catch (error) {
        console.error("Auth callback error:", error);
        setStatus("error");
        setErrorMessage("No se pudo completar la autenticación. Por favor, intenta de nuevo.");
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
              onClick={() => navigate("/login", { replace: true })}
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
