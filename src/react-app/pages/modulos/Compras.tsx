import { useState, useEffect, useMemo } from "react";
import { DollarSign, Package, Wrench, Plus, History, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { useMyUsage } from "@/react-app/hooks/useMyUsage";
import { UsageBanner } from "@/react-app/components/UsageBanner";
import { useCompras, type Compra } from "@/react-app/hooks/useCompras";
import CompraModal from "@/react-app/components/compras/CompraModal";
import ComprasHistoryModal from "@/react-app/components/compras/ComprasHistoryModal";
import DayDetailModal from "@/react-app/components/compras/DayDetailModal";

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const dayHeaders = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

export default function Compras() {
  const { compras, summary, isLoading, error, fetchCompras, fetchSummary } = useCompras();
  const { data: myUsage } = useMyUsage();

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showCompraModal, setShowCompraModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingCompra, setEditingCompra] = useState<Compra | null>(null);

  const loadData = () => {
    fetchCompras(currentMonth, currentYear);
    fetchSummary(currentMonth, currentYear);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, currentYear]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

  // Build summary map for the calendar grid
  const summaryMap = useMemo(() => {
    const map: Record<string, { total: number; cantidad: number }> = {};
    for (const s of summary) {
      map[s.fecha] = { total: s.total_dia, cantidad: s.cantidad };
    }
    return map;
  }, [summary]);

  // Monthly totals
  const totalMes = summary.reduce((s, d) => s + d.total_dia, 0);
  const totalProductos = summary.reduce((s, d) => s + d.total_productos, 0);
  const totalServicios = summary.reduce((s, d) => s + d.total_servicios, 0);

  // Calendar grid calculation
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayOfWeek = (() => {
    const d = new Date(currentYear, currentMonth - 1, 1).getDay();
    return (d + 6) % 7; // Convert Sunday=0 to Monday=0
  })();

  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number; fecha: string } | null> = [];
    // Empty cells before the 1st
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const fecha = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, fecha });
    }
    return cells;
  }, [currentYear, currentMonth, daysInMonth, firstDayOfWeek]);

  const handleDayClick = (fecha: string) => {
    const dayData = summaryMap[fecha];
    if (dayData && dayData.cantidad > 0) {
      setSelectedDate(fecha);
      setShowDayModal(true);
    }
  };

  const dayCompras = selectedDate ? compras.filter((c) => c.fecha === selectedDate) : [];

  const handleEditFromDay = (compra: Compra) => {
    setShowDayModal(false);
    setEditingCompra(compra);
    setShowCompraModal(true);
  };

  const today = new Date().toISOString().split("T")[0];

  if (isLoading && compras.length === 0) {
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
      <UsageBanner label="Compras" usage={myUsage?.usage["compras"]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold">Compras</h1>
          <p className="text-muted-foreground mt-1">Registro de compras y gastos del negocio</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={currentMonth}
            onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {monthNames.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>{name}</option>
            ))}
          </select>
          <select
            value={currentYear}
            onChange={(e) => setCurrentYear(parseInt(e.target.value))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {[2024, 2025, 2026, 2027].map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <Button variant="outline" onClick={() => setShowHistoryModal(true)}>
            <History className="w-4 h-4 mr-2" />
            Historial
          </Button>
          <Button onClick={() => { setEditingCompra(null); setShowCompraModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Compra
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Total del Mes</span>
          </div>
          <div className="text-2xl font-bold">{formatCurrency(totalMes)}</div>
        </div>
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Package className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">Total Productos</span>
          </div>
          <div className="text-2xl font-bold">{formatCurrency(totalProductos)}</div>
        </div>
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Wrench className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-sm text-muted-foreground">Total Servicios</span>
          </div>
          <div className="text-2xl font-bold">{formatCurrency(totalServicios)}</div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {monthNames[currentMonth - 1]} {currentYear}
          </h2>
          <p className="text-sm text-muted-foreground">Toca un dia para ver el detalle de compras</p>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {dayHeaders.map((d) => (
            <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarCells.map((cell, idx) => {
            if (!cell) {
              return <div key={`empty-${idx}`} className="min-h-[72px] sm:min-h-[80px] border-b border-r border-border bg-muted/20" />;
            }

            const dayData = summaryMap[cell.fecha];
            const hasCompras = dayData && dayData.cantidad > 0;
            const isToday = cell.fecha === today;

            return (
              <button
                key={cell.fecha}
                onClick={() => handleDayClick(cell.fecha)}
                disabled={!hasCompras}
                className={`min-h-[72px] sm:min-h-[80px] border-b border-r border-border p-1.5 sm:p-2 text-left transition-colors flex flex-col
                  ${hasCompras ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}
                  ${isToday ? "bg-primary/5" : ""}
                `}
              >
                <span className={`text-xs sm:text-sm font-medium ${isToday ? "text-primary font-bold" : "text-foreground"}`}>
                  {cell.day}
                </span>
                {hasCompras && (
                  <div className="mt-auto">
                    <span className="text-xs sm:text-sm font-semibold text-primary block truncate">
                      {formatCurrency(dayData.total)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {dayData.cantidad} item{dayData.cantidad !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <CompraModal
        isOpen={showCompraModal}
        onClose={() => { setShowCompraModal(false); setEditingCompra(null); }}
        onSaved={loadData}
        compra={editingCompra}
      />

      <ComprasHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        compras={compras}
        onChanged={loadData}
      />

      {selectedDate && (
        <DayDetailModal
          isOpen={showDayModal}
          onClose={() => { setShowDayModal(false); setSelectedDate(null); }}
          fecha={selectedDate}
          compras={dayCompras}
          onEdit={handleEditFromDay}
          onDeleted={loadData}
        />
      )}
    </div>
  );
}
