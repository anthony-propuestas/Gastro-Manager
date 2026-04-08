import { useNavigate, useSearchParams } from "react-router";
import { Mail, XCircle, CheckCircle } from "lucide-react";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    token_expired: "El enlace de verificación expiró. Volvé a iniciar sesión para recibir uno nuevo.",
    token_used: "Este enlace ya fue usado. Si ya verificaste tu cuenta, iniciá sesión normalmente.",
    invalid_token: "El enlace de verificación no es válido.",
  };

  const errorMessage = error ? errorMessages[error] : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md px-6">
        {errorMessage ? (
          <>
            <XCircle className="w-12 h-12 mx-auto text-destructive" />
            <p className="text-lg text-foreground font-medium">Error de verificación</p>
            <p className="text-muted-foreground">{errorMessage}</p>
          </>
        ) : (
          <>
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
          </>
        )}
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
