import { useState } from "react";
import { X, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { useToast } from "@/react-app/components/ui/toast";
import {
  useFacturacion,
  METODOS_PAGO,
  parsePagosDetalle,
  type Factura,
} from "@/react-app/hooks/useFacturacion";
import FacturaModal from "./FacturaModal";

interface FacturasHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  facturas: Factura[];
  onChanged: () => void;
}

export default function FacturasHistoryModal({ isOpen, onClose, facturas, onChanged }: FacturasHistoryModalProps) {
  const { deleteFactura } = useFacturacion();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [filterMetodo, setFilterMetodo] = useState("");
  const [filterTurno, setFilterTurno] = useState("");
  const [editingFactura, setEditingFactura] = useState<Factura | null>(null);

  const getMetodoLabel = (value: string) =>
    METODOS_PAGO.find((m) => m.value === value)?.label ?? value;

  const filtered = facturas.filter((f) => {
    const matchesSearch = !search ||
      (f.concepto?.toLowerCase().includes(search.toLowerCase())) ||
      (f.numero_comprobante?.toLowerCase().includes(search.toLowerCase()));
    const matchesMetodo = !filterMetodo || f.metodo_pago === filterMetodo;
    const matchesTurno = !filterTurno ||
      (filterTurno === "sin_turno" ? !f.turno : f.turno === filterTurno);
    return matchesSearch && matchesMetodo && matchesTurno;
  });

  const handleDelete = async (factura: Factura) => {
    const label = factura.concepto || formatCurrency(factura.monto_total);
    if (!confirm(`¿Eliminar la venta "${label}"?`)) return;
    const ok = await deleteFactura(factura.id);
    if (ok) {
      showToast("Venta eliminada", "success");
      onChanged();
    } else {
      showToast("Error al eliminar", "error");
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

  const formatDate = (fecha: string) => {
    const d = new Date(fecha + "T12:00:00");
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  };

  const turnoLabel = (turno: string | null) => {
    if (turno === "mañana") return "☀️ Mañana";
    if (turno === "tarde")  return "🌙 Tarde";
    return "—";
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card sm:rounded-2xl rounded-t-2xl shadow-xl w-full sm:max-w-3xl sm:mx-4 max-h-[90vh] flex flex-col">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          {/* Header */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border">
            <h2 className="text-xl font-serif font-semibold">Historial de Ventas</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 p-4 border-b border-border">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por concepto o comprobante..."
                className="pl-9"
              />
            </div>
            <select
              value={filterMetodo}
              onChange={(e) => setFilterMetodo(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todos los métodos</option>
              {METODOS_PAGO.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
              <option value="mixto">Mixto</option>
            </select>
            <select
              value={filterTurno}
              onChange={(e) => setFilterTurno(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todos los turnos</option>
              <option value="mañana">☀️ Mañana</option>
              <option value="tarde">🌙 Tarde</option>
              <option value="sin_turno">Sin turno</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No hay ventas para mostrar
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium text-sm">Fecha</th>
                    <th className="text-left p-3 font-medium text-sm">Turno</th>
                    <th className="text-left p-3 font-medium text-sm">Método(s)</th>
                    <th className="text-right p-3 font-medium text-sm">Monto</th>
                    <th className="text-left p-3 font-medium text-sm hidden sm:table-cell">Concepto</th>
                    <th className="text-center p-3 font-medium text-sm">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((f) => {
                    const pagos = parsePagosDetalle(f.pagos_detalle);
                    return (
                      <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-sm">{formatDate(f.fecha)}</td>
                        <td className="p-3 text-sm">{turnoLabel(f.turno)}</td>
                        <td className="p-3">
                          {pagos.length > 1 ? (
                            <div className="flex flex-wrap gap-1">
                              {pagos.map((p, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                                >
                                  {getMetodoLabel(p.metodo_pago)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm font-medium">{getMetodoLabel(f.metodo_pago ?? "")}</span>
                          )}
                          {f.numero_comprobante && (
                            <div className="text-xs text-muted-foreground">#{f.numero_comprobante}</div>
                          )}
                        </td>
                        <td className="p-3 text-right font-semibold text-sm">{formatCurrency(f.monto_total)}</td>
                        <td className="p-3 text-sm text-muted-foreground hidden sm:table-cell">
                          {f.concepto || "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => setEditingFactura(f)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(f)} className="text-destructive hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer total */}
          <div className="p-4 border-t border-border flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{filtered.length} venta{filtered.length !== 1 ? "s" : ""}</span>
            <span className="font-semibold">
              Total: {formatCurrency(filtered.reduce((sum, f) => sum + f.monto_total, 0))}
            </span>
          </div>
        </div>
      </div>

      {editingFactura && (
        <FacturaModal
          isOpen={!!editingFactura}
          onClose={() => setEditingFactura(null)}
          onSaved={() => {
            setEditingFactura(null);
            onChanged();
          }}
          factura={editingFactura}
        />
      )}
    </>
  );
}
