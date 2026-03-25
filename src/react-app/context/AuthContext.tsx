import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isPending: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    fetch("/api/users/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.data ?? null))
      .catch(() => setUser(null))
      .finally(() => setIsPending(false));
  }, []);

  const logout = async () => {
    await fetch("/api/logout");
    setUser(null);
    window.location.assign("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isPending, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
