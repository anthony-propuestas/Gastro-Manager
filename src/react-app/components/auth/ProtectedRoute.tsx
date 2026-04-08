import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/react-app/context/AuthContext";
import { useModulePrefsContext } from "@/react-app/context/ModulePrefsContext";
import type { ModuleKey } from "@/react-app/hooks/useModulePrefs";
import { Loader2, ChefHat } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isPending, currentNegocio } = useAuth();
  const location = useLocation();

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

  if (!user.email_verified) {
    return <Navigate to="/verify-email" replace />;
  }

  // User is authenticated but has no active negocio — send to setup
  // (Allow /negocio/setup and /invite/* to pass through without this check)
  const isSetupRoute = location.pathname === "/negocio/setup";
  const isInviteRoute = location.pathname.startsWith("/invite/");

  if (!currentNegocio && !isSetupRoute && !isInviteRoute) {
    return <Navigate to="/negocio/setup" replace />;
  }

  return <>{children}</>;
}

interface RestrictedModuleRouteProps {
  moduleKey: ModuleKey;
  children: ReactNode;
}

export function RestrictedModuleRoute({ moduleKey, children }: RestrictedModuleRouteProps) {
  const { negocioRestrictions, isGerente } = useModulePrefsContext();

  if (isGerente && negocioRestrictions[moduleKey]) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
