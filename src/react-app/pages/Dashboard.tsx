import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Users, Calendar, DollarSign, AlertCircle, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/react-app/components/ui/card";
import { Label } from "@/react-app/components/ui/label";
import { Input } from "@/react-app/components/ui/input";
import { useAuth } from "@/react-app/context/AuthContext";
import { useEmployees } from "@/react-app/hooks/useEmployees";
import { useSalaries } from "@/react-app/hooks/useSalaries";
import { apiFetch } from "@/react-app/lib/api";

type InvitationResponse = {
  success: boolean;
  data?: { invite_url: string };
  error?: { message?: string };
};

type SalaryOverview = {
  totals?: {
    total_salaries: number;
    total_advances: number;
  };
};

type CalendarEvent = {
  id: number;
  event_date: string;
  title: string;
  start_time?: string;
  description?: string;
  location?: string;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentNegocio } = useAuth();
  const negocioId = currentNegocio?.id;
  const { employees, isLoading: loadingEmployees } = useEmployees();
  const { fetchOverview } = useSalaries();
  const [invite, setInvite] = useState({ url: "", error: "", loading: false });
  const [salaryOverview, setSalaryOverview] = useState<SalaryOverview | null>(null);
  const [eventsToday, setEventsToday] = useState<CalendarEvent[]>([]);
  const [openTopics, setOpenTopics] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoadingData(true);
      setSalaryOverview(null);
      setEventsToday([]);
      setOpenTopics(0);
      
      // Load salary overview
      const now = new Date();
      const overview = await fetchOverview(now.getMonth() + 1, now.getFullYear());
      setSalaryOverview(overview);

      // Load today's events
      try {
        const today = new Date();
        const month = (today.getMonth() + 1).toString();
        const year = today.getFullYear().toString();
        const response = await apiFetch(`/api/events?month=${month}&year=${year}`, {}, negocioId);
        const data = await response.json();
        
        if (data.success) {
          const todayStr = today.toISOString().split('T')[0];
          const todayEvents = (data.data || []).filter((e: CalendarEvent) => e.event_date === todayStr);
          setEventsToday(todayEvents);
        }
      } catch (error) {
        console.error("Error loading events:", error);
      }

      // Count open topics across all employees
      try {
        const response = await apiFetch("/api/topics/deadlines", {}, negocioId);
        const data = await response.json();
        if (data.success) {
          const open = (data.data || []).filter((t: { is_open: number }) => t.is_open === 1).length;
          setOpenTopics(open);
        }
      } catch (error) {
        console.error("Error loading topics:", error);
      }

      setLoadingData(false);
    };

    if (!negocioId) {
      setSalaryOverview(null);
      setEventsToday([]);
      setOpenTopics(0);
      setLoadingData(false);
      return;
    }

    if (!loadingEmployees) {
      loadDashboardData();
    }
  }, [negocioId, loadingEmployees, fetchOverview]);

  const activeEmployees = employees.filter((e) => e.is_active === 1).length;
  const totalSalaries = salaryOverview?.totals?.total_salaries || 0;
  const totalAdvances = salaryOverview?.totals?.total_advances || 0;

  const handleGenerateInvite = async () => {
    if (!negocioId) {
      setInvite(prev => ({ ...prev, error: "No hay un negocio seleccionado." }));
      return;
    }

    setInvite({ url: "", error: "", loading: true });

    try {
      const response = await apiFetch(`/api/negocios/${negocioId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }, negocioId);

      const data = (await response.json()) as InvitationResponse;

      if (!response.ok || !data.success || !data.data?.invite_url) {
        throw new Error(data.error?.message || "No se pudo generar la invitacion.");
      }

      setInvite({ url: data.data.invite_url, error: "", loading: false });
    } catch (error) {
      setInvite({
        url: "",
        error: error instanceof Error ? error.message : "Error inesperado al generar la invitacion.",
        loading: false,
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const stats = [
    {
      title: "Empleados Activos",
      value: loadingData ? "..." : activeEmployees.toString(),
      change: `${employees.length} total`,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      onClick: () => navigate("/empleados"),
    },
    {
      title: "Eventos Hoy",
      value: loadingData ? "..." : eventsToday.length.toString(),
      change: eventsToday.length === 0 ? "Sin eventos" : "Ver calendario",
      icon: Calendar,
      color: "text-accent",
      bgColor: "bg-accent/10",
      onClick: () => navigate("/calendario"),
    },
    {
      title: "Temas Abiertos",
      value: loadingData ? "..." : openTopics.toString(),
      change: "Seguimiento pendiente",
      icon: AlertCircle,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      onClick: () => navigate("/empleados"),
    },
    {
      title: "Sueldos del Mes",
      value: loadingData ? "..." : formatCurrency(totalSalaries),
      change: `Adelantos: ${formatCurrency(totalAdvances)}`,
      icon: DollarSign,
      color: "text-success",
      bgColor: "bg-success/10",
      onClick: () => navigate("/sueldos"),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-foreground">
          Bienvenido de vuelta
        </h1>
        <p className="text-muted-foreground mt-1">
          Aquí está el resumen de tu restaurante
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="border-0 shadow-sm bg-card cursor-pointer hover:shadow-md transition-shadow"
              onClick={stat.onClick}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 sm:space-y-2 min-w-0 flex-1 mr-2">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                      {stat.title}
                    </p>
                    <p className="text-xl sm:text-3xl font-serif font-semibold truncate">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{stat.change}</p>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-xl flex-shrink-0 ${stat.bgColor}`}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employees Summary */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-serif font-semibold">Personal</h2>
              <button
                onClick={() => navigate("/empleados")}
                className="text-sm text-primary hover:underline"
              >
                Ver todos
              </button>
            </div>
            {loadingEmployees ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay empleados registrados
              </div>
            ) : (
              <div className="space-y-3">
                {employees.slice(0, 5).map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{emp.name}</p>
                      <p className="text-sm text-muted-foreground">{emp.role}</p>
                    </div>
                    <div className="text-right">
                      <div
                        className={`inline-flex px-2 py-1 rounded text-xs ${
                          emp.is_active
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {emp.is_active ? "Activo" : "Inactivo"}
                      </div>
                    </div>
                  </div>
                ))}
                {employees.length > 5 && (
                  <p className="text-sm text-muted-foreground text-center pt-2">
                    Y {employees.length - 5} más...
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Events Summary */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-serif font-semibold">Eventos de Hoy</h2>
              <button
                onClick={() => navigate("/calendario")}
                className="text-sm text-primary hover:underline"
              >
                Ver calendario
              </button>
            </div>
            {loadingData ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : eventsToday.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay eventos programados para hoy
              </div>
            ) : (
              <div className="space-y-3">
                {eventsToday.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium">{event.title}</p>
                      {event.start_time && (
                        <span className="text-sm text-muted-foreground">
                          {event.start_time}
                        </span>
                      )}
                    </div>
                    {event.description && (
                      <p className="text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    )}
                    {event.location && (
                      <p className="text-xs text-muted-foreground mt-1">
                        📍 {event.location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-serif font-semibold mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => navigate("/empleados")}
              className="p-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors text-left"
            >
              <Users className="w-5 h-5 mb-2" />
              Ver Personal
            </button>
            <button
              onClick={() => navigate("/sueldos")}
              className="p-4 rounded-lg bg-success text-white font-medium hover:bg-success/90 transition-colors text-left"
            >
              <DollarSign className="w-5 h-5 mb-2" />
              Gestionar Sueldos
            </button>
            <button
              onClick={() => navigate("/calendario")}
              className="p-4 rounded-lg bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-left"
            >
              <Calendar className="w-5 h-5 mb-2" />
              Ver Calendario
            </button>
            <button
              onClick={() => navigate("/configuracion")}
              className="p-4 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors text-left border border-border"
            >
              <AlertCircle className="w-5 h-5 mb-2" />
              Configuración
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Invite member */}
      {currentNegocio && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <UsersRound className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-serif">Invitar a un miembro</CardTitle>
                <CardDescription>
                  Genera un enlace para invitar a alguien a tu negocio y compartir acceso.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <button
              type="button"
              onClick={handleGenerateInvite}
              disabled={invite.loading}
              className="inline-flex h-10 items-center justify-center rounded-4xl border border-border bg-input/30 px-4 text-sm font-medium hover:bg-input/50 disabled:opacity-50"
            >
              {invite.loading ? "Generando..." : "Generar link de invitacion"}
            </button>
            <div className={invite.url ? "space-y-2" : "hidden"}>
              <Label htmlFor="dashboard-invite-url">Link generado</Label>
              <Input id="dashboard-invite-url" value={invite.url} readOnly />
              <p className="text-xs text-muted-foreground">
                Copia este enlace manualmente y compartelo con quien quieras invitar.
              </p>
            </div>
            <p className={invite.error ? "text-sm text-destructive" : "hidden"}>
              {invite.error}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
