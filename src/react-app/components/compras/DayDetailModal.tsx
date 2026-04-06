import { X, Pencil, Trash2, ImageIcon } from "lucide-react";
import { useToast } from "@/react-app/components/ui/toast";
import { useCompras, type Compra } from "@/react-app/hooks/useCompras";
import { useState } from "react";

interface DayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  fecha: string;
  compras: Compra[];
  onEdit: (compra: Compra) => void;
  onDeleted: () => void;
}

export default function DayDetailModal({ isOpen, onClose, fecha, compras, onEdit, onDeleted }: DayDetailModalProps) {
  const { deleteCompra, getComprobanteUrl } = useCompras();
  const { showToast } = useToast();
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

  const total = compras.reduce((sum, c) => sum + c.monto, 0);

  const formatFechaLong = (f: string) => {
    const d = new Date(f + "T12:00:00");
    return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  };

  const handleDelete = async (compra: Compra) => {
    if (!confirm(`¿Eliminar "${compra.item}"?`)) return;
    const ok = await deleteCompra(compra.id);
    if (ok) {
      showToast("Compra eliminada", "success");
      onDeleted();
    } else {
      showToast("Error al eliminar", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <>
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
                {compras.length} compra{compras.length !== 1 ? "s" : ""} — Total: <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Items list */}
          <div className="overflow-y-auto flex-1 divide-y divide-border">
            {compras.map((c) => (
              <div key={c.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{c.item}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        c.tipo === "producto" ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                      }`}>
                        {c.tipo === "producto" ? "Producto" : "Servicio"}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                        {c.categoria}
                      </span>
                    </div>
                    {c.comprador_name && (
                      <p className="text-sm text-muted-foreground mt-1">Comprado por: {c.comprador_name}</p>
                    )}
                    {c.descripcion && (
                      <p className="text-sm text-muted-foreground mt-1">{c.descripcion}</p>
                    )}
                    {c.comprobante_key && (
                      <button
                        onClick={() => setViewingImage(getComprobanteUrl(c.comprobante_key!))}
                        className="flex items-center gap-1 text-sm text-primary hover:underline mt-1"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Ver comprobante
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-semibold text-lg">{formatCurrency(c.monto)}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => onEdit(c)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
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

      {/* Image preview overlay */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
          onClick={() => setViewingImage(null)}
        >
          <button
            onClick={() => setViewingImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={viewingImage}
            alt="Comprobante"
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
          />
        </div>
      )}
    </>
  );
}
