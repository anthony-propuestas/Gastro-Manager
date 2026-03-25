import { useState, useEffect } from "react";
import { X, Calendar, Clock, MapPin, Tag } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/react-app/components/ui/select";
import type { CalendarEvent, EventFormData } from "@/react-app/hooks/useEvents";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EventFormData) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  event?: CalendarEvent | null;
  defaultDate?: Date;
}

const eventTypes = [
  { value: "meeting", label: "Reunión", color: "bg-primary" },
  { value: "interview", label: "Entrevista", color: "bg-accent" },
  { value: "training", label: "Capacitación", color: "bg-chart-3" },
  { value: "delivery", label: "Entrega", color: "bg-chart-4" },
  { value: "general", label: "General", color: "bg-muted-foreground" },
];

export function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  event,
  defaultDate,
}: EventModalProps) {
  const [formData, setFormData] = useState<EventFormData>({
    title: "",
    description: "",
    event_date: "",
    start_time: "",
    end_time: "",
    event_type: "general",
    location: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || "",
        event_date: event.event_date,
        start_time: event.start_time || "",
        end_time: event.end_time || "",
        event_type: event.event_type || "general",
        location: event.location || "",
      });
    } else if (defaultDate) {
      const dateStr = defaultDate.toISOString().split("T")[0];
      setFormData({
        title: "",
        description: "",
        event_date: dateStr,
        start_time: "",
        end_time: "",
        event_type: "general",
        location: "",
      });
    }
  }, [event, defaultDate, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.event_date) return;

    if (formData.title.length > 200) {
      setError("El título es muy largo (máximo 200 caracteres)");
      return;
    }

    if (formData.description && formData.description.length > 1000) {
      setError("La descripción es muy larga (máximo 1000 caracteres)");
      return;
    }

    if (formData.location && formData.location.length > 200) {
      setError("La ubicación es muy larga (máximo 200 caracteres)");
      return;
    }

    const eventDate = new Date(formData.event_date);
    const now = new Date();
    const hundredYearsAgo = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate());
    const tenYearsAhead = new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
    
    if (eventDate < hundredYearsAgo || eventDate > tenYearsAhead) {
      setError("Fecha fuera de rango razonable");
      return;
    }

    setError(null);
    setIsSaving(true);
    const success = await onSave(formData);
    setIsSaving(false);

    if (success) {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    const success = await onDelete();
    setIsDeleting(false);
    if (success) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-serif font-semibold">
            {event ? "Editar Evento" : "Nuevo Evento"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ej: Reunión con proveedores"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalles del evento..."
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event_date" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fecha *
              </Label>
              <Input
                id="event_date"
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_type" className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Tipo
              </Label>
              <Select
                value={formData.event_type}
                onValueChange={(value) => setFormData({ ...formData, event_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${type.color}`} />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Hora inicio
              </Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">Hora fin</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Ubicación
            </Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ej: Sala de reuniones, Cocina principal"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            {event && onDelete ? (
              showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-destructive">¿Eliminar?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "..." : "Sí"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Eliminar
                </Button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || !formData.title}>
                {isSaving ? "Guardando..." : event ? "Guardar Cambios" : "Crear Evento"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
