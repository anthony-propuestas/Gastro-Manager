import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Users, Calendar, DollarSign, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/react-app/components/ui/card";
import { useEmployees } from "@/react-app/hooks/useEmployees";
import { useSalaries } from "@/react-app/hooks/useSalaries";

export default function Dashboard() {
  const navigate = useNavigate();
  const { employees, isLoading: loadingEmployees } = useEmployees();
  const { fetchOverview } = useSalaries();
  const [salaryOverview, setSalaryOverview] = useState<any>(null);
  const [eventsToday, setEventsToday] = useState<any[]>([]);
  const [openTopics, setOpenTopics] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoadingData(true);
      
      // Load salary overview
      const now = new Date();
      const overview = await fetchOverview(now.getMonth() + 1, now.getFullYear());
      setSalaryOverview(overview);

      // Load today's events
      try {
        const today = new Date();
        const month = (today.getMonth() + 1).toString();
        const year = today.getFullYear().toString();
        const response = await fetch(`/api/events?month=${month}&year=${year}`);
        const data = await response.json();
        
        if (data.success) {
          const todayStr = today.toISOString().split('T')[0];
          const todayEvents = (data.data || []).filter((e: any) => e.event_date === todayStr);
          setEventsToday(todayEvents);
        }
      } catch (error) {
        console.error("Error loading events:", error);
      }

      // Count open topics across all employees
      try {
        const response = await fetch("/api/topics/deadlines");
        const data = await response.json();
        if (data.success) {
          const open = (data.data || []).filter((t: any) => t.is_open === 1).length;
          setOpenTopics(open);
        }
      } catch (error) {
        console.error("Error loading topics:", error);
      }

      setLoadingData(false);
    };

    if (!loadingEmployees) {
      loadDashboardData();
    }
  }, [loadingEmployees, fetchOverview]);

  const activeEmployees = employees.filter((e) => e.is_active === 1).length;
  const totalSalaries = salaryOverview?.totals?.total_salaries || 0;
  const totalAdvances = salaryOverview?.totals?.total_advances || 0;

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
        <h1 className="text-3xl font-serif font-semibold text-foreground">
          Bienvenido de vuelta
        </h1>
        <p className="text-muted-foreground mt-1">
          Aquí está el resumen de tu restaurante
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="border-0 shadow-sm bg-card cursor-pointer hover:shadow-md transition-shadow"
              onClick={stat.onClick}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-serif font-semibold">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.change}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
    </div>
  );
}
