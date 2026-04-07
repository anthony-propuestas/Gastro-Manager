import { useState, useEffect, useMemo } from "react";
import { DollarSign, ShoppingBag, TrendingUp, Plus, History, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { useMyUsage } from "@/react-app/hooks/useMyUsage";
import { UsageBanner } from "@/react-app/components/UsageBanner";
import { useFacturacion, type Factura } from "@/react-app/hooks/useFacturacion";
import FacturaModal from "@/react-app/components/facturacion/FacturaModal";
import FacturasHistoryModal from "@/react-app/components/facturacion/FacturasHistoryModal";
import DayDetailModal from "@/react-app/components/facturacion/DayDetailModal";

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const dayHeaders = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

export default function Facturacion() {
  const { facturas, summary, isLoading, error, fetchFacturas, fetchSummary } = useFacturacion();
  const { data: myUsage } = useMyUsage();

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingFactura, setEditingFactura] = useState<Factura | null>(null);

  const loadData = () => {
    fetchFacturas(currentMonth, currentYear);
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
  const cantidadVentas = summary.reduce((s, d) => s + d.cantidad, 0);
  const promedio = cantidadVentas > 0 ? totalMes / cantidadVentas : 0;

  // Calendar grid calculation
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayOfWeek = (() => {
    const d = new Date(currentYear, currentMonth - 1, 1).getDay();
    return (d + 6) % 7; // Convert Sunday=0 to Monday=0
  })();

  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number; fecha: string } | null> = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
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

  const dayFacturas = selectedDate ? facturas.filter((f) => f.fecha === selectedDate) : [];

  const handleEditFromDay = (factura: Factura) => {
    setShowDayModal(false);
    setEditingFactura(factura);
    setShowFacturaModal(true);
  };

  const today = new Date().toISOString().split("T")[0];

  if (isLoading && facturas.length === 0) {
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
      <UsageBanner label="Facturación" usage={myUsage?.usage["facturacion"]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold">Facturación</h1>
          <p className="text-muted-foreground mt-1">Registro de ventas del negocio</p>
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
          <Button onClick={() => { setEditingFactura(null); setShowFacturaModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Venta
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
              <ShoppingBag className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">Cantidad de Ventas</span>
          </div>
          <div className="text-2xl font-bold">{cantidadVentas}</div>
        </div>
        <div className="bg-card rounded-xl p-6 border border-border">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-sm text-muted-foreground">Promedio por Venta</span>
          </div>
          <div className="text-2xl font-bold">{formatCurrency(promedio)}</div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {monthNames[currentMonth - 1]} {currentYear}
          </h2>
          <p className="text-sm text-muted-foreground">Toca un día para ver el detalle de ventas</p>
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
            const hasVentas = dayData && dayData.cantidad > 0;
            const isToday = cell.fecha === today;

            return (
              <button
                key={cell.fecha}
                onClick={() => handleDayClick(cell.fecha)}
                disabled={!hasVentas}
                className={`min-h-[72px] sm:min-h-[80px] border-b border-r border-border p-1.5 sm:p-2 text-left transition-colors flex flex-col
                  ${hasVentas ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"}
                  ${isToday ? "bg-primary/5" : ""}
                `}
              >
                <span className={`text-xs sm:text-sm font-medium ${isToday ? "text-primary font-bold" : "text-foreground"}`}>
                  {cell.day}
                </span>
                {hasVentas && (
                  <div className="mt-auto">
                    <span className="text-xs sm:text-sm font-semibold text-primary block truncate">
                      {formatCurrency(dayData.total)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {dayData.cantidad} venta{dayData.cantidad !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      <FacturaModal
        isOpen={showFacturaModal}
        onClose={() => { setShowFacturaModal(false); setEditingFactura(null); }}
        onSaved={loadData}
        factura={editingFactura}
      />

      <FacturasHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        facturas={facturas}
        onChanged={loadData}
      />

      {selectedDate && (
        <DayDetailModal
          isOpen={showDayModal}
          onClose={() => { setShowDayModal(false); setSelectedDate(null); }}
          fecha={selectedDate}
          facturas={dayFacturas}
          onEdit={handleEditFromDay}
          onDeleted={loadData}
        />
      )}
    </div>
  );
}
