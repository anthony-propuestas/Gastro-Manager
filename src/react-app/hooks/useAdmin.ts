import { useState, useEffect } from "react";

export interface AdminStats {
  totalUsers: number;
  registeredEmails: number;
  avgEmployees: number;
  avgEvents: number;
  usage: {
    employees: number;
    salaries: number;
    calendar: number;
  };
}

export interface AdminEmail {
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
  };
}
