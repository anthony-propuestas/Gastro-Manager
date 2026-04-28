import { useState, useEffect } from "react";


interface UserNegocioUsage {
  user_id: string;
  email: string;
  role: string;
  negocio_id: number;
  negocio_name: string;
  usage: Partial<Record<string, number>>;
}

interface AdminUsageData {
  period: string;
  rows: UserNegocioUsage[];
}

type UsageLimits = Record<string, number>;

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

interface AdminStats {
  totalUsers: number;
  usage: {
    employees: number;
    salaries: number;
    calendar: number;
    job_roles: number;
    topics: number;
    notes: number;
    chat: number;
    compras: number;
    facturacion: number;
  };
}

interface AdminEmail {
  id: number;
  email: string;
  added_by: string;
  created_at: string;
  is_initial?: boolean;
}

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [emails, setEmails] = useState<AdminEmail[]>([]);
  const [usageData, setUsageData] = useState<AdminUsageData | null>(null);
  const [limits, setLimits] = useState<UsageLimits>({});
  const [users, setUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch("/api/admin/check");
      const data = await response.json();
      if (data.success) {
        setIsAdmin(data.data.isAdmin);
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/stats");
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchEmails = async () => {
    try {
      const response = await fetch("/api/admin/emails");
      const data = await response.json();
      if (data.success) {
        setEmails(data.data);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
    }
  };

  const addEmail = async (email: string) => {
    try {
      const response = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (data.success) {
        await fetchEmails();
        return { success: true };
      }
      return { success: false, error: data.error?.message };
    } catch (error) {
      console.error("Error adding email:", error);
      return { success: false, error: "Error al agregar administrador" };
    }
  };

  const fetchUsage = async () => {
    try {
      const res = await fetch("/api/admin/usage");
      const data = await res.json();
      if (data.success) setUsageData(data.data);
    } catch { /* silent */ }
  };

  const fetchLimits = async () => {
    try {
      const res = await fetch("/api/admin/usage-limits");
      const data = await res.json();
      if (data.success) setLimits(data.data);
    } catch { /* silent */ }
  };

  const updateLimits = async (newLimits: Partial<UsageLimits>): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/admin/usage-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newLimits),
      });
      const data = await res.json();
      if (data.success) { await fetchLimits(); return { success: true }; }
      return { success: false, error: data.error?.message };
    } catch {
      return { success: false, error: "Error al actualizar límites" };
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch { /* silent */ }
  };

  const promoteUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/promote`, { method: "POST" });
      const data = await res.json();
      if (data.success) { await fetchUsers(); return { success: true }; }
      return { success: false, error: data.error?.message };
    } catch {
      return { success: false, error: "Error al promover usuario" };
    }
  };

  const demoteUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/demote`, { method: "POST" });
      const data = await res.json();
      if (data.success) { await fetchUsers(); return { success: true }; }
      return { success: false, error: data.error?.message };
    } catch {
      return { success: false, error: "Error al regresar usuario a Básico" };
    }
  };

  const deleteEmail = async (id: number) => {
    try {
      const response = await fetch(`/api/admin/emails/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        await fetchEmails();
        return { success: true };
      }
      return { success: false, error: data.error?.message };
    } catch (error) {
      console.error("Error deleting email:", error);
      return { success: false, error: "Error al eliminar administrador" };
    }
  };

  return {
    isAdmin,
    loading,
    stats,
    emails,
    fetchStats,
    fetchEmails,
    addEmail,
    deleteEmail,
    usageData,
    limits,
    fetchUsage,
    fetchLimits,
    updateLimits,
    users,
    fetchUsers,
    promoteUser,
    demoteUser,
  };
}
