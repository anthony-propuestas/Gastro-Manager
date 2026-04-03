import { useState, useEffect } from "react";
import { DollarSign, TrendingUp, TrendingDown, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { useSalaries, type EmployeeSalary } from "@/react-app/hooks/useSalaries";
import { useToast } from "@/react-app/components/ui/toast";
import AdvanceModal from "@/react-app/components/salaries/AdvanceModal";
import EmployeeAdvancesModal from "@/react-app/components/salaries/EmployeeAdvancesModal";

type SalaryOverview = {
  totals?: {
    total_salaries: number;
    total_advances: number;
    total_remaining: number;
  };
  employees?: Array<{
    id: number;
    name: string;
    role: string;
    monthly_salary: number;
    advances_total: number;
    remaining: number;
  }>;
};

export default function Salaries() {
  const { fetchOverview, markAsPaid, markAllAsPaid } = useSalaries();
  const { showToast } = useToast();
  
  const [overview, setOverview] = useState<SalaryOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showAdvancesModal, setShowAdvancesModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSalary | null>(null);

  const loadOverview = async () => {
    setIsLoading(true);
    const data = await fetchOverview(currentMonth, currentYear);
    setOverview(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, currentYear]);

  const handleMarkPaid = async (employeeId: number) => {
    try {
      await markAsPaid(employeeId, currentMonth, currentYear);
      showToast("Sueldo marcado como pagado", "success");
      loadOverview();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Error al marcar como pagado", "error");
    }
  };

  const handleMarkAllPaid = async () => {
    if (!confirm("¿Marcar todos los sueldos como pagados?")) return;
    
    try {
      await markAllAsPaid(currentMonth, currentYear);
      showToast("Todos los sueldos marcados como pagados", "success");
      loadOverview();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Error al marcar sueldos", "error");
    }
  };

  const handleAddAdvance = (employee: EmployeeSalary) => {
    setSelectedEmployee(employee);
    setShowAdvanceModal(true);
  };

  const handleViewAdvances = (employee: EmployeeSalary) => {
    setSelectedEmployee(employee);
    setShowAdvancesModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold">Sueldos</h1>
          <p className="text-muted-foreground mt-1">
            Gestión de sueldos y adelantos del personal
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={currentMonth}
            onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {monthNames.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={currentYear}
            onChange={(e) => setCurrentYear(parseInt(e.target.value))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {[2024, 2025, 2026].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Sueldos Totales</span>
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(overview?.totals?.total_salaries || 0)}
          </div>
        </div>

        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <TrendingDown className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm text-muted-foreground">Adelantos Totales</span>
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(overview?.totals?.total_advances || 0)}
          </div>
        </div>

        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-success/10">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <span className="text-sm text-muted-foreground">Total a Pagar</span>
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(overview?.totals?.total_remaining || 0)}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">
          Personal - {monthNames[currentMonth - 1]} {currentYear}
        </h2>
        <Button onClick={handleMarkAllPaid} variant="outline">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Marcar Todos como Pagados
        </Button>
      </div>

      {/* Employee List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left p-4 font-medium">Empleado</th>
                <th className="text-left p-4 font-medium">Puesto</th>
                <th className="text-right p-4 font-medium">Sueldo</th>
                <th className="text-right p-4 font-medium">Adelantos</th>
                <th className="text-right p-4 font-medium">A Pagar</th>
                <th className="text-center p-4 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {overview?.employees?.map((emp: EmployeeSalary) => (
                <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-medium">{emp.name}</td>
                  <td className="p-4 text-muted-foreground">{emp.role}</td>
                  <td className="p-4 text-right">{formatCurrency(emp.monthly_salary || 0)}</td>
                  <td className="p-4 text-right text-amber-500">
                    {emp.advances_total > 0 ? (
                      <button
                        onClick={() => handleViewAdvances(emp)}
                        className="hover:underline"
                      >
                        {formatCurrency(emp.advances_total)}
                      </button>
                    ) : (
                      formatCurrency(0)
                    )}
                  </td>
                  <td className="p-4 text-right font-semibold text-success">
                    {formatCurrency(emp.remaining)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddAdvance(emp)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Adelanto
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleMarkPaid(emp.id)}
                        className="bg-success hover:bg-success/90"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Pagado
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {selectedEmployee && (
        <>
          <AdvanceModal
            isOpen={showAdvanceModal}
            onClose={() => {
              setShowAdvanceModal(false);
              setSelectedEmployee(null);
            }}
            employee={selectedEmployee}
            month={currentMonth}
            year={currentYear}
            onSaved={loadOverview}
          />
          <EmployeeAdvancesModal
            isOpen={showAdvancesModal}
            onClose={() => {
              setShowAdvancesModal(false);
              setSelectedEmployee(null);
            }}
            employee={selectedEmployee}
            month={currentMonth}
            year={currentYear}
            onDeleted={loadOverview}
          />
        </>
      )}
    </div>
  );
}
