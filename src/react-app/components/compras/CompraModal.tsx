import { useState, useEffect, useRef } from "react";
import { X, Upload } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Textarea } from "@/react-app/components/ui/textarea";
import { useToast } from "@/react-app/components/ui/toast";
import { useCompras, COMPRAS_CATEGORIAS, type Compra, type CompraInput } from "@/react-app/hooks/useCompras";
import { useEmployees } from "@/react-app/hooks/useEmployees";

interface CompraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  compra?: Compra | null;
}

export default function CompraModal({ isOpen, onClose, onSaved, compra }: CompraModalProps) {
  const { createCompra, updateCompra, uploadComprobante, getComprobanteUrl } = useCompras();
  const { employees } = useEmployees();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [monto, setMonto] = useState("");
  const [item, setItem] = useState("");
  const [tipo, setTipo] = useState<"producto" | "servicio">("producto");
  const [categoria, setCategoria] = useState("otros");
  const [compradorId, setCompradorId] = useState<string>("");
  const [descripcion, setDescripcion] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!compra;

  useEffect(() => {
    if (compra && isOpen) {
      setFecha(compra.fecha);
      setMonto(String(compra.monto));
      setItem(compra.item);
      setTipo(compra.tipo);
      setCategoria(compra.categoria);
      setCompradorId(compra.comprador_id ? String(compra.comprador_id) : "");
      setDescripcion(compra.descripcion || "");
      setSelectedFile(null);
      setPreviewUrl(compra.comprobante_key ? getComprobanteUrl(compra.comprobante_key) : null);
    } else if (isOpen) {
      setFecha(new Date().toISOString().split("T")[0]);
      setMonto("");
      setItem("");
      setTipo("producto");
      setCategoria("otros");
      setCompradorId("");
      setDescripcion("");
      setSelectedFile(null);
      setPreviewUrl(null);
    }
    setError(null);
  }, [compra, isOpen, getComprobanteUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo es muy grande (máximo 5MB)");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numMonto = parseFloat(monto);
    if (!numMonto || numMonto <= 0) {
      setError("El monto debe ser mayor a cero");
      return;
    }
    if (!item.trim()) {
      setError("El item es requerido");
      return;
    }
    if (!fecha) {
      setError("La fecha es requerida");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      let comprobanteKey = compra?.comprobante_key ?? null;

      if (selectedFile) {
        const key = await uploadComprobante(selectedFile);
        if (!key) {
          setError("Error al subir el comprobante");
          setIsSubmitting(false);
          return;
        }
        comprobanteKey = key;
      }

      const input: CompraInput = {
        fecha,
        monto: numMonto,
        item: item.trim(),
        tipo,
        categoria,
        comprador_id: compradorId ? parseInt(compradorId) : null,
        descripcion: descripcion.trim() || null,
        comprobante_key: comprobanteKey,
      };

      let success: boolean;
      if (isEditing) {
        success = await updateCompra(compra.id, input);
      } else {
        success = await createCompra(input);
      }

      if (success) {
        showToast(isEditing ? "Compra actualizada" : "Compra registrada", "success");
        onSaved();
        onClose();
      } else {
        setError("Error al guardar la compra");
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
            {isEditing ? "Editar Compra" : "Nueva Compra"}
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
              <Label htmlFor="monto">Monto *</Label>
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
            <Label htmlFor="item">Item / Descripcion de compra *</Label>
            <Input
              id="item"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="Ej: 5kg de carne, Factura de gas..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <select
                id="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "producto" | "servicio")}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="producto">Producto</option>
                <option value="servicio">Servicio</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <select
                id="categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {COMPRAS_CATEGORIAS.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comprador">Quien compro</Label>
            <select
              id="comprador"
              value={compradorId}
              onChange={(e) => setCompradorId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">-- Sin asignar --</option>
              {employees.filter(emp => emp.is_active !== 0).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} — {emp.role}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Notas adicionales</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles opcionales..."
              rows={2}
            />
          </div>

          {/* Comprobante upload */}
          <div className="space-y-2">
            <Label>Comprobante / Foto del ticket</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleFileChange}
              className="hidden"
            />
            {previewUrl ? (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Comprobante"
                  className="w-full max-h-40 object-contain rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors text-muted-foreground"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm">Subir imagen (max 5MB)</span>
              </button>
            )}
            {previewUrl && !selectedFile && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-primary hover:underline"
              >
                Cambiar imagen
              </button>
            )}
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
