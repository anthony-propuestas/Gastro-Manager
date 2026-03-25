import { useState } from "react";
import { X, Plus, Trash2, Briefcase } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { useToast } from "@/react-app/components/ui/toast";
import { useJobRoles } from "@/react-app/hooks/useJobRoles";

interface JobRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JobRolesModal({ isOpen, onClose }: JobRolesModalProps) {
  const { jobRoles, isLoading, createJobRole, deleteJobRole } = useJobRoles();
  const toast = useToast();
  const [newRoleName, setNewRoleName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newRoleName.trim()) {
      toast.error("El nombre del puesto es requerido");
      return;
    }

    setIsSubmitting(true);
    try {
      await createJobRole({ name: newRoleName.trim() });
      toast.success("Puesto creado correctamente");
      setNewRoleName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear puesto");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este puesto? Los empleados con este puesto mantendrán su valor actual.")) {
      return;
    }

    try {
      await deleteJobRole(id);
      toast.success("Puesto eliminado correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar puesto");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-serif font-semibold">
              Gestionar Puestos
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Create Form */}
          <form onSubmit={handleCreate} className="space-y-3">
            <Label htmlFor="newRole">Nuevo puesto</Label>
            <div className="flex gap-2">
              <Input
                id="newRole"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Ej: Chef, Mesero, Bartender..."
                disabled={isSubmitting}
              />
              <Button
                type="submit"
                disabled={isSubmitting || !newRoleName.trim()}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </form>

          {/* List */}
          <div className="space-y-2">
            <Label>Puestos disponibles</Label>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando...
              </div>
            ) : jobRoles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-2">No hay puestos personalizados</p>
                <p className="text-xs">Crea tu primer puesto arriba</p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobRoles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="font-medium">{role.name}</span>
                    <button
                      onClick={() => handleDelete(role.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          <Button onClick={onClose} variant="outline" className="w-full">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
