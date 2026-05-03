import { X, Phone, Mail, Calendar, DollarSign, Pencil, UserCheck, UserX } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Badge } from "@/react-app/components/ui/badge";
import type { Employee } from "@/react-app/hooks/useEmployees";

interface EmployeeViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onEdit: (employee: Employee) => void;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "Sin fecha";
  return new Date(dateStr).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
};

export default function EmployeeViewModal({
  isOpen,
  onClose,
  employee,
  onEdit,
}: EmployeeViewModalProps) {
  if (!isOpen || !employee) return null;

  const initials = employee.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleEdit = () => {
    onEdit(employee);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card sm:rounded-2xl rounded-t-2xl shadow-xl w-full sm:max-w-md sm:mx-4 max-h-[92vh] overflow-y-auto">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 p-5 sm:p-6 border-b border-border sticky top-0 bg-card z-10">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-chart-3 flex items-center justify-center shrink-0">
            <span className="text-lg font-semibold text-primary-foreground">
              {initials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-serif font-semibold truncate">
              {employee.name}
            </h2>
            <p className="text-sm text-muted-foreground">{employee.role}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Estado */}
          <div className="flex items-center gap-2">
            {employee.is_active === 1 ? (
              <UserCheck className="w-4 h-4 text-success" />
            ) : (
              <UserX className="w-4 h-4 text-muted-foreground" />
            )}
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
          </div>

          {/* Contacto */}
          {(employee.phone || employee.email) && (
            <div className="space-y-2 p-4 rounded-xl bg-muted/40">
              {employee.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{employee.phone}</span>
                </div>
              )}
              {employee.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{employee.email}</span>
                </div>
              )}
            </div>
          )}

          {/* Info general */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Fecha de ingreso</span>
              </div>
              <span className="text-sm font-medium">
                {formatDate(employee.hire_date)}
              </span>
            </div>

            {(employee.monthly_salary ?? 0) > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="w-4 h-4" />
                  <span>Sueldo mensual</span>
                </div>
                <span className="text-sm font-semibold text-success">
                  {formatCurrency(employee.monthly_salary ?? 0)}
                </span>
              </div>
            )}
          </div>

          {/* Sección inactivo */}
          {employee.is_active === 0 &&
            (employee.ausencia_desde ||
              employee.informo === 1 ||
              employee.sueldo_pendiente > 0) && (
              <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/10 space-y-2">
                <p className="text-xs font-medium text-destructive uppercase tracking-wide mb-3">
                  Información de baja
                </p>
                {employee.ausencia_desde && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ausente desde</span>
                    <span className="font-medium">
                      {formatDate(employee.ausencia_desde)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Informó su salida</span>
                  <span className="font-medium">
                    {employee.informo === 1
                      ? employee.cuando_informo
                        ? `Sí (${formatDate(employee.cuando_informo)})`
                        : "Sí"
                      : "No"}
                  </span>
                </div>
                {employee.sueldo_pendiente > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sueldo pendiente</span>
                    <span className="font-semibold text-destructive">
                      {formatCurrency(employee.sueldo_pendiente)}
                    </span>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 sm:p-6 pt-0">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cerrar
          </Button>
          <Button onClick={handleEdit} className="flex-1">
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>
    </div>
  );
}
