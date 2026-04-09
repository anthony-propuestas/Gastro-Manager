import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Textarea } from "@/react-app/components/ui/textarea";
import { useToast } from "@/react-app/components/ui/toast";
import {
  useFacturacion,
  METODOS_PAGO,
  parsePagosDetalle,
  type Factura,
  type FacturaInput,
  type MetodoPago,
  type PagoDetalle,
  type Turno,
} from "@/react-app/hooks/useFacturacion";

interface FacturaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  factura?: Factura | null;
}

const DEFAULT_METODO: MetodoPago = "efectivo";

function newPagoRow(): PagoDetalle {
  return { metodo_pago: DEFAULT_METODO, monto: 0 };
}

export default function FacturaModal({ isOpen, onClose, onSaved, factura }: FacturaModalProps) {
  const { createFactura, updateFactura } = useFacturacion();
  const { showToast } = useToast();

  const today = new Date().toISOString().split("T")[0];

  const [fecha, setFecha] = useState(today);
  const [turno, setTurno] = useState<Turno | "">("");
  const [paymentRows, setPaymentRows] = useState<PagoDetalle[]>([newPagoRow()]);
  const [concepto, setConcepto] = useState("");
  const [numeroComprobante, setNumeroComprobante] = useState("");
  const [notas, setNotas] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!factura;

  // Computed total from rows
  const computedTotal = paymentRows.reduce((s, r) => s + (r.monto || 0), 0);

  useEffect(() => {
    if (isOpen) {
      if (factura) {
        setFecha(factura.fecha);
        setTurno(factura.turno ?? "");
        setConcepto(factura.concepto || "");
        setNumeroComprobante(factura.numero_comprobante || "");
        setNotas(factura.notas || "");
        const pagos = parsePagosDetalle(factura.pagos_detalle);
        if (pagos.length > 0) {
          setPaymentRows(pagos);
        } else {
          // Single-method legacy record
          setPaymentRows([{
            metodo_pago: (factura.metodo_pago as MetodoPago) || DEFAULT_METODO,
            monto: factura.monto_total,
          }]);
        }
      } else {
        setFecha(today);
        setTurno("");
        setPaymentRows([newPagoRow()]);
        setConcepto("");
        setNumeroComprobante("");
        setNotas("");
      }
      setError(null);
    }
  }, [factura, isOpen, today]);

  // Payment row helpers
  const updateRow = (idx: number, field: keyof PagoDetalle, value: string | number) => {
    setPaymentRows((rows) =>
      rows.map((r, i) =>
        i === idx ? { ...r, [field]: field === "monto" ? Number(value) : value } : r
      )
    );
  };

  const addRow = () => setPaymentRows((rows) => [...rows, newPagoRow()]);

  const removeRow = (idx: number) => {
    if (paymentRows.length === 1) return; // keep at least one row
    setPaymentRows((rows) => rows.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validRows = paymentRows.filter((r) => r.monto > 0);
    if (validRows.length === 0) {
      setError("Debés ingresar al menos un monto mayor a cero");
      return;
    }
    if (!fecha) {
      setError("La fecha es requerida");
      return;
    }

    const total = validRows.reduce((s, r) => s + r.monto, 0);
    const metodo: MetodoPago = validRows.length === 1 ? validRows[0].metodo_pago : "mixto";

    setError(null);
    setIsSubmitting(true);

    try {
      const input: FacturaInput = {
        fecha,
        monto_total: total,
        metodo_pago: metodo,
        turno: turno || null,
        pagos_detalle: validRows.length > 1 ? JSON.stringify(validRows) : null,
        concepto: concepto.trim() || null,
        numero_comprobante: numeroComprobante.trim() || null,
        notas: notas.trim() || null,
      };

      let success: boolean;
      if (isEditing) {
        success = await updateFactura(factura.id, input);
      } else {
        success = await createFactura(input);
      }

      if (success) {
        showToast(isEditing ? "Venta actualizada" : "Venta registrada", "success");
        onSaved();
        onClose();
      } else {
        setError("Error al guardar la venta");
      }
    } catch {
      setError("Error inesperado al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const multipleRows = paymentRows.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card sm:rounded-2xl rounded-t-2xl shadow-xl w-full sm:max-w-lg sm:mx-4 max-h-[90vh] overflow-y-auto">
        {/* Drag handle — solo mobile */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-xl font-serif font-semibold">
            {isEditing ? "Editar Venta" : "Nueva Venta"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Fecha + Turno */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha *</Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="turno">Turno</Label>
              <select
                id="turno"
                value={turno}
                onChange={(e) => setTurno(e.target.value as Turno | "")}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sin turno</option>
                <option value="mañana">Turno mañana</option>
                <option value="tarde">Turno tarde</option>
              </select>
            </div>
          </div>

          {/* Métodos de pago */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Métodos de pago *</Label>
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar método
              </button>
            </div>

            <div className="space-y-2">
              {paymentRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={row.metodo_pago}
                    onChange={(e) => updateRow(idx, "metodo_pago", e.target.value)}
                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {METODOS_PAGO.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.monto === 0 ? "" : row.monto}
                    onChange={(e) => updateRow(idx, "monto", e.target.value)}
                    placeholder="0.00"
                    className="w-28"
                  />
                  {paymentRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Total visual */}
            <div className={`flex justify-between text-sm pt-1 ${multipleRows ? "border-t border-border" : ""}`}>
              {multipleRows && (
                <span className="text-muted-foreground">Total calculado</span>
              )}
              <span className={`font-semibold ml-auto ${computedTotal <= 0 ? "text-muted-foreground" : ""}`}>
                {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(computedTotal)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="concepto">Concepto</Label>
            <Input
              id="concepto"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej: Ventas del turno mañana, Mesa 12..."
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="numero_comprobante">Número de comprobante</Label>
            <Input
              id="numero_comprobante"
              value={numeroComprobante}
              onChange={(e) => setNumeroComprobante(e.target.value)}
              placeholder="Ej: 0001-00012345"
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas adicionales</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones opcionales..."
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 bg-primary hover:bg-primary/90">
              {isSubmitting ? "Guardando..." : isEditing ? "Actualizar" : "Registrar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
