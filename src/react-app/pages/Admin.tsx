import { useEffect, useState } from "react";
import { useAdmin } from "@/react-app/hooks/useAdmin";
import { Button } from "@/react-app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Input } from "@/react-app/components/ui/input";
import { useToast } from "@/react-app/components/ui/toast";
import { Shield, Users, Mail, TrendingUp, Calendar, Banknote, UserPlus, Trash2, AlertCircle } from "lucide-react";

export default function Admin() {
  const { isAdmin, loading, stats, emails, fetchStats, fetchEmails, addEmail, deleteEmail } = useAdmin();
  const { showToast } = useToast();
  const [newEmail, setNewEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchEmails();
    }
  }, [isAdmin]);

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setIsSubmitting(true);
    const result = await addEmail(newEmail.trim());
    setIsSubmitting(false);

    if (result.success) {
      showToast("Administrador agregado correctamente", "success");
      setNewEmail("");
    } else {
      showToast(result.error || "Error al agregar administrador", "error");
    }
  };

  const handleDeleteEmail = async (id: number, email: string) => {
    if (!confirm(`¿Eliminar a ${email} como administrador?`)) return;

    const result = await deleteEmail(id);
    if (result.success) {
      showToast("Administrador eliminado", "success");
    } else {
      showToast(result.error || "Error al eliminar administrador", "error");
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-8">
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Acceso Restringido</CardTitle>
            </div>
            <CardDescription className="text-amber-600">
              No tienes permisos de administrador para acceder a esta sección.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const totalActions = stats
    ? stats.usage.employees + stats.usage.salaries + stats.usage.calendar
    : 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-green-600" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Panel de Administración</h1>
          <p className="text-muted-foreground">Estadísticas y gestión del sistema</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Usuarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Correos Registrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{stats?.registeredEmails || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Promedio Empleados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700">{stats?.avgEmployees || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Promedio Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">{stats?.avgEvents || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Uso del Sistema
          </CardTitle>
          <CardDescription>
            Estadísticas de actividad por módulo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                <span className="font-medium">Empleados</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">{stats?.usage.employees || 0}</div>
                <div className="text-xs text-muted-foreground">
                  {totalActions > 0
                    ? `${Math.round(((stats?.usage.employees || 0) / totalActions) * 100)}%`
                    : "0%"}
                </div>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{
                  width: totalActions > 0 ? `${((stats?.usage.employees || 0) / totalActions) * 100}%` : "0%",
                }}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-amber-600" />
                <span className="font-medium">Sueldos</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">{stats?.usage.salaries || 0}</div>
                <div className="text-xs text-muted-foreground">
                  {totalActions > 0
                    ? `${Math.round(((stats?.usage.salaries || 0) / totalActions) * 100)}%`
                    : "0%"}
                </div>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{
                  width: totalActions > 0 ? `${((stats?.usage.salaries || 0) / totalActions) * 100}%` : "0%",
                }}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                <span className="font-medium">Calendario</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">{stats?.usage.calendar || 0}</div>
                <div className="text-xs text-muted-foreground">
                  {totalActions > 0
                    ? `${Math.round(((stats?.usage.calendar || 0) / totalActions) * 100)}%`
                    : "0%"}
                </div>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all"
                style={{
                  width: totalActions > 0 ? `${((stats?.usage.calendar || 0) / totalActions) * 100}%` : "0%",
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Emails Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Administradores
          </CardTitle>
          <CardDescription>
            Gestiona los correos con acceso de administrador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddEmail} className="flex gap-2">
            <Input
              type="email"
              placeholder="correo@ejemplo.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1"
              disabled={isSubmitting}
            />
            <Button type="submit" disabled={isSubmitting || !newEmail.trim()}>
              <UserPlus className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          </form>

          <div className="space-y-2">
            {emails.map((emailItem) => (
              <div
                key={emailItem.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{emailItem.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {emailItem.is_initial ? "Administrador Principal" : `Agregado por ${emailItem.added_by}`}
                    </div>
                  </div>
                </div>
                {!emailItem.is_initial && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteEmail(emailItem.id, emailItem.email)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
