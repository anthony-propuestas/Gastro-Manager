import { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/react-app/context/AuthContext";
import { Loader2, ChefHat } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isPending } = useAuth();

  if (isPending) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
          <ChefHat className="w-8 h-8 text-primary-foreground" />
        </div>
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
