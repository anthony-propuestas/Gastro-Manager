import { X, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/react-app/components/ui/toast";
import { useFacturacion, METODOS_PAGO, type Factura } from "@/react-app/hooks/useFacturacion";

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  fecha: string;
  facturas: Factura[];
  onEdit: (factura: Factura) => void;
  onDeleted: () => void;
}

export default function DayDetailModal({ isOpen, onClose, fecha, facturas, onEdit, onDeleted }: DayDetailModalProps) {
  const { deleteFactura } = useFacturacion();
  const { showToast } = useToast();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

  const total = facturas.reduce((sum, f) => sum + f.monto_total, 0);

  const formatFechaLong = (f: string) => {
    const d = new Date(f + "T12:00:00");
    return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  };

  const getMetodoLabel = (value: string) =>
    METODOS_PAGO.find((m) => m.value === value)?.label ?? value;

  const handleDelete = async (factura: Factura) => {
    const label = factura.concepto || formatCurrency(factura.monto_total);
    if (!confirm(`¿Eliminar la venta "${label}"?`)) return;
    const ok = await deleteFactura(factura.id);
    if (ok) {
      showToast("Venta eliminada", "success");
      onDeleted();
    } else {
      showToast("Error al eliminar", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card sm:rounded-2xl rounded-t-2xl shadow-xl w-full sm:max-w-lg sm:mx-4 max-h-[85vh] flex flex-col">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-serif font-semibold capitalize">
              {formatFechaLong(fecha)}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {facturas.length} venta{facturas.length !== 1 ? "s" : ""} — Total:{" "}
              <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items list */}
        <div className="overflow-y-auto flex-1 divide-y divide-border">
          {facturas.map((f) => (
            <div key={f.id} className="p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{getMetodoLabel(f.metodo_pago)}</span>
                    {f.numero_comprobante && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        #{f.numero_comprobante}
                      </span>
                    )}
                  </div>
                  {f.concepto && (
                    <p className="text-sm text-muted-foreground mt-1">{f.concepto}</p>
                  )}
                  {f.notas && (
                    <p className="text-sm text-muted-foreground mt-1 italic">{f.notas}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-semibold text-lg">{formatCurrency(f.monto_total)}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEdit(f)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(f)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
