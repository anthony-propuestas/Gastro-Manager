import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { Negocio } from "@/shared/types";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isPending: boolean;
  logout: () => Promise<void>;
  negocios: Negocio[];
  currentNegocio: Negocio | null;
  setCurrentNegocio: (n: Negocio | null) => void;
  refreshNegocios: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredNegocio(): Negocio | null {
  try {
    const stored = localStorage.getItem("currentNegocio");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [currentNegocio, setCurrentNegocioState] = useState<Negocio | null>(loadStoredNegocio);

  const setCurrentNegocio = useCallback((n: Negocio | null) => {
    setCurrentNegocioState(n);
    if (n) {
      localStorage.setItem("currentNegocio", JSON.stringify(n));
    } else {
      localStorage.removeItem("currentNegocio");
    }
  }, []);

  const refreshNegocios = useCallback(async () => {
    try {
      const res = await fetch("/api/negocios");
      const data = await res.json();
      if (data.success) {
        const list: Negocio[] = data.data;
        setNegocios(list);
        // If currentNegocio is stale (removed from memberships), clear it
        if (currentNegocio && !list.some(n => n.id === currentNegocio.id)) {
          setCurrentNegocio(null);
        }
      }
    } catch {
      // Network error — keep current state
    }
  }, [currentNegocio, setCurrentNegocio]);

  useEffect(() => {
    fetch("/api/users/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.data ?? null))
      .catch(() => setUser(null))
      .finally(() => setIsPending(false));
  }, []);

  useEffect(() => {
    if (user) {
      refreshNegocios();
    } else {
      setNegocios([]);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = async () => {
    await fetch("/api/logout");
    setUser(null);
    setNegocios([]);
    setCurrentNegocio(null);
    window.location.assign("/login");
  };

  return (
    <AuthContext.Provider
      value={{ user, isPending, logout, negocios, currentNegocio, setCurrentNegocio, refreshNegocios }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
