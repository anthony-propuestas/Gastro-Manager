import { useState, useEffect } from "react";
import { X, Briefcase } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import type { Employee, EmployeeInput } from "@/react-app/hooks/useEmployees";
import { useJobRoles } from "@/react-app/hooks/useJobRoles";

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EmployeeInput) => Promise<void>;
  employee?: Employee | null;
  onManageRoles?: () => void;
}

const defaultRoles = [
  "Chef Principal",
  "Sous Chef",
  "Cocinero",
  "Mesero/a",
  "Bartender",
  "Hostess",
  "Gerente",
  "Ayudante de cocina",
  "Lavaplatos",
];

export default function EmployeeModal({
  isOpen,
  onClose,
  onSave,
  employee,
  onManageRoles,
}: EmployeeModalProps) {
  const { jobRoles } = useJobRoles();
  const [formData, setFormData] = useState<EmployeeInput>({
    name: "",
    role: "",
    phone: "",
    email: "",
    hire_date: "",
    is_active: true,
    monthly_salary: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Combine default and custom roles
  const allRoles = [...defaultRoles, ...jobRoles.map(r => r.name)].sort();

  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name,
        role: employee.role,
        phone: employee.phone || "",
        email: employee.email || "",
        hire_date: employee.hire_date || "",
        is_active: employee.is_active === 1,
        monthly_salary: employee.monthly_salary || 0,
      });
    } else {
      setFormData({
        name: "",
        role: "",
        phone: "",
        email: "",
        hire_date: "",
        is_active: true,
        monthly_salary: 0,
      });
    }
    setError(null);
  }, [employee, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.role.trim()) {
      setError("Nombre y puesto son requeridos");
      return;
    }

    if (formData.name.length > 100) {
      setError("El nombre es muy largo (máximo 100 caracteres)");
      return;
    }

    if (formData.role.length > 50) {
      setError("El puesto es muy largo (máximo 50 caracteres)");
      return;
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError("Email inválido");
        return;
      }
      if (formData.email.length > 100) {
        setError("El email es muy largo (máximo 100 caracteres)");
        return;
      }
    }

    if (formData.phone && formData.phone.length > 20) {
      setError("El teléfono es muy largo (máximo 20 caracteres)");
      return;
    }

    if (formData.monthly_salary !== undefined && (formData.monthly_salary < 0 || formData.monthly_salary > 1000000)) {
      setError("Salario debe estar entre 0 y 1,000,000");
      return;
    }

    if (formData.hire_date) {
      const hireDate = new Date(formData.hire_date);
      const now = new Date();
      const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
      const tenYearsAhead = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
      
      if (hireDate < hundredYearsAgo || hireDate > tenYearsAhead) {
        setError("Fecha de contratación fuera de rango razonable");
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card sm:rounded-2xl rounded-t-2xl shadow-xl w-full sm:max-w-md sm:mx-4 max-h-[92vh] overflow-y-auto">
        {/* Drag handle — solo mobile */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border">
          <h2 className="text-xl font-serif font-semibold">
            {employee ? "Editar Empleado" : "Nuevo Empleado"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Ej: María García"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="role">Puesto *</Label>
              {onManageRoles && (
                <button
                  type="button"
                  onClick={onManageRoles}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Briefcase className="w-3 h-3" />
                  Gestionar puestos
                </button>
              )}
            </div>
            <select
              id="role"
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Seleccionar puesto</option>
              {allRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="+52 555 123 4567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hire_date">Fecha de ingreso</Label>
            <Input
              id="hire_date"
              type="date"
              value={formData.hire_date}
              onChange={(e) =>
                setFormData({ ...formData, hire_date: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthly_salary">Sueldo mensual</Label>
            <Input
              id="monthly_salary"
              type="number"
              step="0.01"
              min="0"
              value={formData.monthly_salary}
              onChange={(e) =>
                setFormData({ ...formData, monthly_salary: parseFloat(e.target.value) || 0 })
              }
              placeholder="0.00"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Empleado activo
            </Label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? "Guardando..." : employee ? "Guardar" : "Agregar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
