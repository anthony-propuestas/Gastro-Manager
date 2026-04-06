import { useState } from "react";
import { X, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { useToast } from "@/react-app/components/ui/toast";
import { useCompras, COMPRAS_CATEGORIAS, type Compra } from "@/react-app/hooks/useCompras";
import CompraModal from "./CompraModal";

interface ComprasHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  compras: Compra[];
  onChanged: () => void;
}

export default function ComprasHistoryModal({ isOpen, onClose, compras, onChanged }: ComprasHistoryModalProps) {
  const { deleteCompra } = useCompras();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("");
  const [editingCompra, setEditingCompra] = useState<Compra | null>(null);

  const filtered = compras.filter((c) => {
    const matchesSearch = !search || c.item.toLowerCase().includes(search.toLowerCase());
    const matchesCategoria = !filterCategoria || c.categoria === filterCategoria;
    return matchesSearch && matchesCategoria;
  });

  const handleDelete = async (compra: Compra) => {
    if (!confirm(`¿Eliminar la compra "${compra.item}"?`)) return;
    const ok = await deleteCompra(compra.id);
    if (ok) {
      showToast("Compra eliminada", "success");
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
            <h2 className="text-xl font-serif font-semibold">Historial de Compras</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-3 p-4 border-b border-border">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por item..."
                className="pl-9"
              />
            </div>
            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todas</option>
              {COMPRAS_CATEGORIAS.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No hay compras para mostrar
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium text-sm">Fecha</th>
                    <th className="text-left p-3 font-medium text-sm">Item</th>
                    <th className="text-right p-3 font-medium text-sm">Monto</th>
                    <th className="text-left p-3 font-medium text-sm hidden sm:table-cell">Categoria</th>
                    <th className="text-left p-3 font-medium text-sm hidden md:table-cell">Comprador</th>
                    <th className="text-center p-3 font-medium text-sm">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-sm">{formatDate(c.fecha)}</td>
                      <td className="p-3">
                        <div className="font-medium text-sm">{c.item}</div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          c.tipo === "producto" ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                        }`}>
                          {c.tipo === "producto" ? "Producto" : "Servicio"}
                        </span>
                      </td>
                      <td className="p-3 text-right font-semibold text-sm">{formatCurrency(c.monto)}</td>
                      <td className="p-3 text-sm text-muted-foreground hidden sm:table-cell capitalize">{c.categoria}</td>
                      <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">{c.comprador_name || "—"}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => setEditingCompra(c)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(c)} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer total */}
          <div className="p-4 border-t border-border flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{filtered.length} compra{filtered.length !== 1 ? "s" : ""}</span>
            <span className="font-semibold">
              Total: {formatCurrency(filtered.reduce((sum, c) => sum + c.monto, 0))}
            </span>
          </div>
        </div>
      </div>

      {editingCompra && (
        <CompraModal
          isOpen={!!editingCompra}
          onClose={() => setEditingCompra(null)}
          onSaved={() => {
            setEditingCompra(null);
            onChanged();
          }}
          compra={editingCompra}
        />
      )}
    </>
  );
}
