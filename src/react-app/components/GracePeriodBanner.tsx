import { useNavigate } from "react-router";
import { useAuth } from "@/react-app/context/AuthContext";
import { Button } from "@/react-app/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GracePeriodBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user?.graceDaysLeft) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-amber-800 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>
          Tu suscripción está en período de gracia —{" "}
          <strong>{user.graceDaysLeft} día{user.graceDaysLeft !== 1 ? "s" : ""} restante{user.graceDaysLeft !== 1 ? "s" : ""}</strong>{" "}
          para regularizar el pago.
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-400 text-amber-800 hover:bg-amber-100 flex-shrink-0"
        onClick={() => navigate("/suscripcion")}
      >
        Actualizar pago
      </Button>
    </div>
  );
}
