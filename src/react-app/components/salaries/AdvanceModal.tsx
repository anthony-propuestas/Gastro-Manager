import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { useSalaries, type EmployeeSalary } from "@/react-app/hooks/useSalaries";
import { useToast } from "@/react-app/components/ui/toast";

interface AdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeSalary;
  month: number;
  year: number;
  onSaved: () => void;
}

export default function AdvanceModal({
  isOpen,
  onClose,
  employee,
  month,
  year,
  onSaved,
}: AdvanceModalProps) {
  const { createAdvance } = useSalaries();
  const { showToast } = useToast();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError("El monto debe ser mayor a cero");
      return;
    }

    if (numAmount < 0.01 || numAmount > 1000000) {
      setError("El monto debe estar entre 0.01 y 1,000,000");
      return;
    }

    if (numAmount > employee.monthly_salary) {
      setError("El adelanto no puede ser mayor al sueldo");
      return;
    }

    if (description && description.length > 500) {
      setError("La descripción es muy larga (máximo 500 caracteres)");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await createAdvance(employee.id, {
        amount: numAmount,
        period_month: month,
        period_year: year,
        description: description || undefined,
      });
      showToast("Adelanto registrado", "success");
      onSaved();
      onClose();
      setAmount("");
      setDescription("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error al crear adelanto");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-serif font-semibold">
            Registrar Adelanto
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-sm text-muted-foreground">Empleado</div>
            <div className="font-medium">{employee.name}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Sueldo mensual: ${employee.monthly_salary?.toLocaleString()}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Monto del adelanto *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Adelanto de quincena"
            />
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
              {isSubmitting ? "Guardando..." : "Registrar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
