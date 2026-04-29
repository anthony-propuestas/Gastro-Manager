import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/react-app/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";

export default function SuscripcionEstadoPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const status = params.get("collection_status") ?? params.get("status");
  const approved = status === "approved";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      {approved ? (
        <>
          <CheckCircle className="w-16 h-16 text-green-500" />
          <h1 className="text-2xl font-bold">¡Suscripción activada!</h1>
          <p className="text-muted-foreground max-w-sm">
            Tu pago fue procesado correctamente. Ya podés disfrutar del Plan Inteligente.
          </p>
        </>
      ) : (
        <>
          <XCircle className="w-16 h-16 text-red-500" />
          <h1 className="text-2xl font-bold">El pago no se completó</h1>
          <p className="text-muted-foreground max-w-sm">
            Podés intentarlo nuevamente cuando quieras. Tu cuenta no fue afectada.
          </p>
        </>
      )}
      <div className="flex gap-3">
        <Button onClick={() => navigate("/suscripcion")} variant={approved ? "outline" : "default"}>
          Ver mi suscripción
        </Button>
        <Button onClick={() => navigate("/")} variant={approved ? "default" : "outline"}>
          Volver a la app
        </Button>
      </div>
    </div>
  );
}
