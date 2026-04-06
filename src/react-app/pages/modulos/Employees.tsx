import { useState } from "react";
import {
  Plus,
  Search,
  MoreVertical,
  Phone,
  Mail,
  Loader2,
  Pencil,
  Trash2,
  AlertCircle,
  MessageSquare,
  Briefcase,
} from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Card, CardContent } from "@/react-app/components/ui/card";
import { Badge } from "@/react-app/components/ui/badge";
import { useToast } from "@/react-app/components/ui/toast";
import { useEmployees, type Employee, type EmployeeInput } from "@/react-app/hooks/useEmployees";
import { useMyUsage } from "@/react-app/hooks/useMyUsage";
import { UsageBanner } from "@/react-app/components/UsageBanner";
import EmployeeModal from "@/react-app/components/employees/EmployeeModal";
import EmployeeDetailModal from "@/react-app/components/employees/EmployeeDetailModal";
import JobRolesModal from "@/react-app/components/employees/JobRolesModal";

type FilterType = "all" | "active" | "inactive";

export default function Employees() {
  const { employees, isLoading, error, createEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { data: myUsage } = useMyUsage();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [isJobRolesModalOpen, setIsJobRolesModalOpen] = useState(false);

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && emp.is_active === 1) ||
      (filter === "inactive" && emp.is_active === 0);
    
    return matchesSearch && matchesFilter;
  });

  const activeCount = employees.filter((e) => e.is_active === 1).length;
  const inactiveCount = employees.filter((e) => e.is_active === 0).length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Sin fecha";
    return new Date(dateStr).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleSave = async (data: EmployeeInput) => {
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, data);
        toast.success("Empleado actualizado correctamente");
      } else {
        await createEmployee(data);
        toast.success("Empleado agregado correctamente");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar empleado");
      throw err;
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsModalOpen(true);
    setMenuOpenId(null);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteEmployee(id);
      toast.success("Empleado eliminado correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar empleado");
    } finally {
      setDeleteConfirmId(null);
      setMenuOpenId(null);
    }
  };

  const openNewModal = () => {
    setEditingEmployee(null);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UsageBanner label="Empleados" usage={myUsage?.usage["employees"]} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-foreground">
            Personal
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Gestiona a los empleados de tu restaurante
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsJobRolesModalOpen(true)}
            variant="outline"
            className="hidden sm:flex"
          >
            <Briefcase className="w-4 h-4 mr-2" />
            Gestionar Puestos
          </Button>
          <Button onClick={openNewModal} className="bg-primary hover:bg-primary/90 min-h-[44px]">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Empleado
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o puesto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Badge
            variant={filter === "all" ? "secondary" : "outline"}
            className="px-4 py-2.5 cursor-pointer hover:bg-secondary/80 whitespace-nowrap min-h-[36px] flex items-center"
            onClick={() => setFilter("all")}
          >
            Todos ({employees.length})
          </Badge>
          <Badge
            variant={filter === "active" ? "secondary" : "outline"}
            className="px-4 py-2.5 cursor-pointer hover:bg-muted whitespace-nowrap min-h-[36px] flex items-center"
            onClick={() => setFilter("active")}
          >
            Activos ({activeCount})
          </Badge>
          <Badge
            variant={filter === "inactive" ? "secondary" : "outline"}
            className="px-4 py-2.5 cursor-pointer hover:bg-muted whitespace-nowrap min-h-[36px] flex items-center"
            onClick={() => setFilter("inactive")}
          >
            Inactivos ({inactiveCount})
          </Badge>
        </div>
      </div>

      {/* Employee Cards Grid */}
      {filteredEmployees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEmployees.map((employee) => (
            <Card
              key={employee.id}
              className="border-0 shadow-sm hover:shadow-md transition-shadow group relative"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-chart-3 flex items-center justify-center">
                      <span className="text-lg font-semibold text-primary-foreground">
                        {employee.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {employee.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {employee.role}
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === employee.id ? null : employee.id)}
                      className="p-2.5 rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-muted transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                    
                    {menuOpenId === employee.id && (
                      <div className="absolute right-0 top-8 bg-card rounded-lg shadow-lg border border-border py-1 min-w-32 z-10">
                        <button
                          onClick={() => handleEdit(employee)}
                          className="w-full flex items-center gap-2 px-3 py-3 text-sm hover:bg-muted transition-colors min-h-[44px]"
                        >
                          <Pencil className="w-4 h-4" />
                          Editar
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(employee.id)}
                          className="w-full flex items-center gap-2 px-3 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors min-h-[44px]"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {employee.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{employee.phone}</span>
                    </div>
                  )}
                  {employee.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{employee.email}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={employee.is_active === 1 ? "default" : "secondary"}
                      className={
                        employee.is_active === 1
                          ? "bg-success/10 text-success hover:bg-success/20"
                          : ""
                      }
                    >
                      {employee.is_active === 1 ? "Activo" : "Inactivo"}
                    </Badge>
                    <button
                      onClick={() => setDetailEmployee(employee)}
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <MessageSquare className="w-3 h-3" />
                      {(employee.topics_count ?? 0) > 0 ? `${employee.topics_count} temas` : "Notas"}
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Desde {formatDate(employee.hire_date)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Sin empleados registrados
          </h3>
          <p className="text-muted-foreground mb-6">
            Comienza agregando a tu primer empleado
          </p>
          <Button onClick={openNewModal} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Empleado
          </Button>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No se encontraron empleados con "{searchQuery}"
          </p>
        </div>
      )}

      {/* Employee Modal */}
      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEmployee(null);
        }}
        onSave={handleSave}
        employee={editingEmployee}
        onManageRoles={() => {
          setIsModalOpen(false);
          setIsJobRolesModalOpen(true);
        }}
      />

      {/* Job Roles Modal */}
      <JobRolesModal
        isOpen={isJobRolesModalOpen}
        onClose={() => {
          setIsJobRolesModalOpen(false);
          if (editingEmployee) {
            setIsModalOpen(true);
          }
        }}
      />

      {/* Delete Confirmation */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="relative bg-card rounded-2xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-2">¿Eliminar empleado?</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Esta acción eliminará al empleado y todos sus temas y notas asociados. No se puede deshacer.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1"
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Detail Modal (Topics & Notes) */}
      <EmployeeDetailModal
        isOpen={detailEmployee !== null}
        onClose={() => setDetailEmployee(null)}
        employee={detailEmployee}
      />
    </div>
  );
}
