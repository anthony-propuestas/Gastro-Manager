import { useState, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { useSalaries, type EmployeeSalary, type Advance } from "@/react-app/hooks/useSalaries";
import { useToast } from "@/react-app/components/ui/toast";

interface EmployeeAdvancesModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeSalary;
  month: number;
  year: number;
  onDeleted: () => void;
}

export default function EmployeeAdvancesModal({
  isOpen,
  onClose,
  employee,
  month,
  year,
  onDeleted,
}: EmployeeAdvancesModalProps) {
  const { fetchAdvances, deleteAdvance } = useSalaries();
  const { showToast } = useToast();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAdvances = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdvances(employee.id, month, year);
      setAdvances(data);
    } catch (error) {
      showToast("Error al cargar adelantos", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAdvances();
    }
  }, [isOpen, employee.id, month, year]);

  const handleDelete = async (advanceId: number) => {
    if (!confirm("¿Eliminar este adelanto?")) return;
    
    try {
      await deleteAdvance(advanceId);
      showToast("Adelanto eliminado", "success");
      loadAdvances();
      onDeleted();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Error al eliminar", "error");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-serif font-semibold">
              Adelantos de {employee.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Período actual: {month}/{year}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando...
            </div>
          ) : advances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay adelantos en este período
            </div>
          ) : (
            <div className="space-y-3">
              {advances.map((advance) => (
                <div
                  key={advance.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-lg">
                        {formatCurrency(advance.amount)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(advance.advance_date)}
                      </span>
                    </div>
                    {advance.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {advance.description}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(advance.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              <div className="mt-6 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total adelantos:</span>
                  <span className="text-amber-500">
                    {formatCurrency(
                      advances.reduce((sum, a) => sum + a.amount, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
