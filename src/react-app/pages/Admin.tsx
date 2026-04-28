import { useEffect, useState } from "react";
import { useAdmin } from "@/react-app/hooks/useAdmin";
import { Button } from "@/react-app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { Input } from "@/react-app/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/react-app/components/ui/table";
import { Badge } from "@/react-app/components/ui/badge";
import { useToast } from "@/react-app/components/ui/toast";
import { Shield, Users, Mail, TrendingUp, UserPlus, Trash2, AlertCircle, Settings2, Crown, UserMinus, Search, X, RefreshCw } from "lucide-react";

const TOOL_LABELS = [
  { key: "employees",       label: "Empleados",  color: "bg-green-500" },
  { key: "job_roles",       label: "Roles",      color: "bg-teal-500" },
  { key: "topics",          label: "Temas",      color: "bg-blue-500" },
  { key: "notes",           label: "Notas",      color: "bg-sky-500" },
  { key: "advances",        label: "Anticipos",  color: "bg-amber-500" },
  { key: "salary_payments", label: "Pagos",      color: "bg-orange-500" },
  { key: "events",          label: "Eventos",    color: "bg-purple-500" },
  { key: "chat",            label: "Chat IA",    color: "bg-pink-500" },
  { key: "compras",         label: "Gastos",     color: "bg-red-500" },
  { key: "facturacion",     label: "Facturación", color: "bg-indigo-500" },
] as const;


export default function Admin() {
  const { isAdmin, loading, stats, emails, fetchStats, fetchEmails, addEmail, deleteEmail,
          usageData, limits, fetchUsage, fetchLimits, updateLimits,
          users, fetchUsers, promoteUser, demoteUser } = useAdmin();
  const { showToast } = useToast();
  const [newEmail, setNewEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [limitEdits, setLimitEdits] = useState<Record<string, number>>({});
  const [isSavingLimits, setIsSavingLimits] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [usageSearchEmail, setUsageSearchEmail] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "usuario_basico" | "usuario_inteligente">("all");
  const [filterNegocio, setFilterNegocio] = useState("all");
  const [filterTool, setFilterTool] = useState("all");
  const [usagePage, setUsagePage] = useState(0);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const loadUsage = async () => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      await Promise.all([fetchUsage(), fetchLimits()]);
    } catch {
      setUsageError("No se pudo cargar el uso del sistema.");
    } finally {
      setUsageLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchEmails();
      fetchUsers();
      loadUsage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (Object.keys(limits).length > 0) setLimitEdits(limits);
  }, [limits]);

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

  const basicUserCount = users.filter(u => u.role === "usuario_basico").length || 1;

  const monthlyUsageByTool: Record<string, number> = {};
  if (usageData) {
    for (const row of usageData.rows) {
      for (const [tool, count] of Object.entries(row.usage)) {
        monthlyUsageByTool[tool] = (monthlyUsageByTool[tool] || 0) + (count || 0);
      }
    }
  }

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
      <div className="flex">
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white w-64">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuarios Registrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">{stats?.totalUsers || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Uso del Sistema — sección unificada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Uso del Sistema
          </CardTitle>
          <CardDescription>
            {usageData?.period
              ? `Uso mensual por módulo — ${usageData.period} · ${basicUserCount} usuario${basicUserCount !== 1 ? "s" : ""} básico${basicUserCount !== 1 ? "s" : ""}`
              : "Uso mensual por módulo"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Cargando datos de uso...
            </div>
          ) : usageError ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-destructive">
              <AlertCircle className="h-6 w-6" />
              <p className="text-sm">{usageError}</p>
              <button
                onClick={loadUsage}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-destructive/40 rounded-md hover:bg-destructive/5 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </button>
            </div>
          ) : !usageData ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              Sin datos para este período.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {TOOL_LABELS.map(t => {
                const used = monthlyUsageByTool[t.key] || 0;
                const limitPerUser = limits[t.key] || 0;
                const totalLimit = limitPerUser * basicUserCount;
                const pct = totalLimit > 0 ? Math.round((used / totalLimit) * 100) : 0;
                const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : t.color;
                return (
                  <div key={t.key} className="space-y-1">
                    <div className="flex justify-between items-baseline text-sm">
                      <span className="font-medium truncate">{t.label}</span>
                      <span className="text-xs text-muted-foreground ml-1 shrink-0">{pct}%</span>
                    </div>
                    <div className="text-2xl font-bold">{used}
                      <span className="text-sm font-normal text-muted-foreground"> / {totalLimit}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground">Límite: {limitPerUser}/usuario</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4.1 — Tabla de uso por usuario */}
      {usageData && usageData.rows.length > 0 && (() => {
        const uniqueNegocios = [...new Set(usageData.rows.map(r => r.negocio_name))].sort();
        const filteredRows = usageData.rows.filter(r => {
          if (filterRole !== "all" && r.role !== filterRole) return false;
          if (filterNegocio !== "all" && r.negocio_name !== filterNegocio) return false;
          if (filterTool !== "all" && (r.usage[filterTool] ?? 0) === 0) return false;
          if (usageSearchEmail && !r.email.toLowerCase().includes(usageSearchEmail.toLowerCase())) return false;
          return true;
        });
        const PAGE_SIZE = 50;
        const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
        const pageRows = filteredRows.slice(usagePage * PAGE_SIZE, (usagePage + 1) * PAGE_SIZE);
        const hasFilters = filterRole !== "all" || filterNegocio !== "all" || filterTool !== "all" || usageSearchEmail !== "";
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Uso por Usuario — {usageData.period}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtros */}
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar email..."
                    value={usageSearchEmail}
                    onChange={e => { setUsageSearchEmail(e.target.value); setUsagePage(0); }}
                    className="w-full pl-8 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <select
                  value={filterRole}
                  onChange={e => { setFilterRole(e.target.value as typeof filterRole); setUsagePage(0); }}
                  className="px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">Todos los roles</option>
                  <option value="usuario_basico">Solo Básicos</option>
                  <option value="usuario_inteligente">Solo Inteligentes</option>
                </select>
                <select
                  value={filterNegocio}
                  onChange={e => { setFilterNegocio(e.target.value); setUsagePage(0); }}
                  className="px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">Todos los negocios</option>
                  {uniqueNegocios.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <select
                  value={filterTool}
                  onChange={e => { setFilterTool(e.target.value); setUsagePage(0); }}
                  className="px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">Todas las herramientas</option>
                  {TOOL_LABELS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                {hasFilters && (
                  <button
                    onClick={() => { setUsageSearchEmail(""); setFilterRole("all"); setFilterNegocio("all"); setFilterTool("all"); setUsagePage(0); }}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground border rounded-md hover:bg-accent transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Limpiar
                  </button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {filteredRows.length} de {usageData.rows.length} filas
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-primary/20 border border-primary/40" />
                  Inteligente
                </span>
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-background border" />
                  Básico
                </span>
              </div>
              {/* Tabla */}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Negocio</TableHead>
                      {TOOL_LABELS.map(t => (
                        <TableHead key={t.key} className="text-center">{t.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3 + TOOL_LABELS.length} className="text-center text-muted-foreground py-8">
                          Sin resultados con los filtros actuales
                        </TableCell>
                      </TableRow>
                    ) : pageRows.map(u => {
                      const isInteligente = u.role === "usuario_inteligente";
                      return (
                        <TableRow
                          key={u.user_id + "-" + u.negocio_id}
                          className={isInteligente ? "bg-primary/10 hover:bg-primary/15" : ""}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-medium">{u.email}</div>
                                {isInteligente ? (
                                  <Badge className="mt-0.5 text-xs bg-primary/15 text-primary border border-primary/30 hover:bg-primary/15">
                                    <Crown className="h-3 w-3 mr-1" />
                                    Inteligente
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="mt-0.5 text-xs">Básico</Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{u.negocio_name}</TableCell>
                          {TOOL_LABELS.map(t => (
                            <TableCell key={t.key} className="text-center">
                              <span className={isInteligente ? "text-primary font-medium" : ""}>
                                {u.usage[t.key] ?? 0}
                              </span>
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    Página {usagePage + 1} de {totalPages} · {filteredRows.length} filas
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setUsagePage(p => p - 1)} disabled={usagePage === 0}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setUsagePage(p => p + 1)} disabled={usagePage >= totalPages - 1}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* 4.2 — Configurar límites mensuales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Límites Mensuales
          </CardTitle>
          <CardDescription>
            Cuotas para usuarios Básicos. Los usuarios Inteligentes no tienen límite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TOOL_LABELS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-sm font-medium">{label}</label>
                <Input
                  type="number"
                  min={0}
                  value={limitEdits[key] ?? ""}
                  onChange={e => setLimitEdits(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                  disabled={isSavingLimits}
                />
              </div>
            ))}
          </div>
          <Button
            className="mt-4"
            disabled={isSavingLimits || Object.keys(limitEdits).length === 0}
            onClick={async () => {
              setIsSavingLimits(true);
              const result = await updateLimits(limitEdits);
              setIsSavingLimits(false);
              if (result.success) showToast("Límites actualizados", "success");
              else showToast(result.error || "Error al guardar", "error");
            }}
          >
            Guardar límites
          </Button>
        </CardContent>
      </Card>

      {/* Paso 5 — Gestión de Roles de Usuario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Gestión de Roles de Usuario
          </CardTitle>
          <CardDescription>
            Promueve usuarios a Inteligente (sin límites) o regrésa los a Básico.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search & promote */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Buscar usuario por email</label>
            <Input
              type="text"
              placeholder="correo@ejemplo.com"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
            />
            {(() => {
              const q = userSearch.trim().toLowerCase();
              if (!q) return null;
              const matches = users.filter(u => u.email.toLowerCase().includes(q));
              if (matches.length === 0) {
                return <p className="text-sm text-muted-foreground">Sin resultados.</p>;
              }
              return (
                <div className="space-y-2">
                  {matches.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                      <div>
                        <div className="font-medium">{u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={u.role === "usuario_inteligente" ? "default" : "secondary"}>
                          {u.role === "usuario_inteligente" ? "Inteligente" : "Básico"}
                        </Badge>
                        {u.role === "usuario_basico" ? (
                          <Button
                            size="sm"
                            onClick={async () => {
                              const result = await promoteUser(u.id);
                              if (result.success) showToast(`${u.email} promovido a Inteligente`, "success");
                              else showToast(result.error || "Error al promover", "error");
                            }}
                          >
                            <Crown className="h-3 w-3 mr-1" />
                            Promover
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const result = await demoteUser(u.id);
                              if (result.success) showToast(`${u.email} regresado a Básico`, "success");
                              else showToast(result.error || "Error al cambiar rol", "error");
                            }}
                          >
                            <UserMinus className="h-3 w-3 mr-1" />
                            Regresar a Básico
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Table of usuario_inteligente */}
          {users.filter(u => u.role === "usuario_inteligente").length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Usuarios Inteligentes actuales</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.filter(u => u.role === "usuario_inteligente").map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const result = await demoteUser(u.id);
                            if (result.success) showToast(`${u.email} regresado a Básico`, "success");
                            else showToast(result.error || "Error al cambiar rol", "error");
                          }}
                        >
                          <UserMinus className="h-3 w-3 mr-1" />
                          Regresar a Básico
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
