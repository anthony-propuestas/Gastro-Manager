import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Textarea } from "@/react-app/components/ui/textarea";
import { useToast } from "@/react-app/components/ui/toast";
import { useFacturacion, METODOS_PAGO, type Factura, type FacturaInput } from "@/react-app/hooks/useFacturacion";

interface FacturaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  factura?: Factura | null;
}

export default function FacturaModal({ isOpen, onClose, onSaved, factura }: FacturaModalProps) {
  const { createFactura, updateFactura } = useFacturacion();
  const { showToast } = useToast();

  const today = new Date().toISOString().split("T")[0];

  const [fecha, setFecha] = useState(today);
  const [monto, setMonto] = useState("");
  const [metodoPago, setMetodoPago] = useState<FacturaInput["metodo_pago"]>("efectivo");
  const [concepto, setConcepto] = useState("");
  const [numeroComprobante, setNumeroComprobante] = useState("");
  const [notas, setNotas] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!factura;

  useEffect(() => {
    if (factura && isOpen) {
      setFecha(factura.fecha);
      setMonto(String(factura.monto_total));
      setMetodoPago(factura.metodo_pago);
      setConcepto(factura.concepto || "");
      setNumeroComprobante(factura.numero_comprobante || "");
      setNotas(factura.notas || "");
    } else if (isOpen) {
      setFecha(today);
      setMonto("");
      setMetodoPago("efectivo");
      setConcepto("");
      setNumeroComprobante("");
      setNotas("");
    }
    setError(null);
  }, [factura, isOpen, today]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numMonto = parseFloat(monto);
    if (!numMonto || numMonto <= 0) {
      setError("El monto debe ser mayor a cero");
      return;
    }
    if (!fecha) {
      setError("La fecha es requerida");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const input: FacturaInput = {
        fecha,
        monto_total: numMonto,
        metodo_pago: metodoPago,
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
              <Label htmlFor="monto">Monto total *</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="metodo_pago">Método de pago *</Label>
            <select
              id="metodo_pago"
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value as FacturaInput["metodo_pago"])}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {METODOS_PAGO.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
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
