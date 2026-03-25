import { useState } from "react";
import {
  X,
  Plus,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  CheckCircle,
  Circle,
  Trash2,
  Loader2,
  Send,
  Calendar,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Textarea } from "@/react-app/components/ui/textarea";
import { Badge } from "@/react-app/components/ui/badge";
import { useToast } from "@/react-app/components/ui/toast";
import { useTopics, useNotes, type Topic } from "@/react-app/hooks/useTopics";
import type { Employee } from "@/react-app/hooks/useEmployees";

interface EmployeeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

export default function EmployeeDetailModal({
  isOpen,
  onClose,
  employee,
}: EmployeeDetailModalProps) {
  const toast = useToast();
  const { topics, isLoading, createTopic, updateTopic, deleteTopic } = useTopics(
    employee?.id ?? null
  );
  const [expandedTopicId, setExpandedTopicId] = useState<number | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicDueDate, setNewTopicDueDate] = useState("");
  const [newTopicDueTime, setNewTopicDueTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);

  if (!isOpen || !employee) return null;

  const handleCreateTopic = async () => {
    if (!newTopicTitle.trim()) return;
    
    try {
      setIsAddingTopic(true);
      await createTopic(
        newTopicTitle.trim(),
        newTopicDueDate || undefined,
        newTopicDueTime || undefined
      );
      setNewTopicTitle("");
      setNewTopicDueDate("");
      setNewTopicDueTime("");
      setShowDatePicker(false);
      toast.success("Tema creado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear tema");
    } finally {
      setIsAddingTopic(false);
    }
  };

  const handleToggleStatus = async (topic: Topic) => {
    try {
      await updateTopic(topic.id, { is_open: topic.is_open !== 1 });
      toast.success(topic.is_open === 1 ? "Tema cerrado" : "Tema reabierto");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar tema");
    }
  };

  const handleDeleteTopic = async (topicId: number) => {
    try {
      await deleteTopic(topicId);
      if (expandedTopicId === topicId) setExpandedTopicId(null);
      toast.success("Tema eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar tema");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-chart-3 flex items-center justify-center">
              <span className="text-xl font-semibold text-primary-foreground">
                {employee.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-serif font-semibold">{employee.name}</h2>
              <p className="text-sm text-muted-foreground">{employee.role}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground">Temas de seguimiento</h3>
            <Badge variant="outline">{topics.length} temas</Badge>
          </div>

          {/* Add new topic */}
          <div className="mb-6 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Nuevo tema (ej: Capacitación, Evaluación...)"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !showDatePicker && handleCreateTopic()}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={showDatePicker ? "bg-accent" : ""}
                title="Agregar fecha límite"
              >
                <Calendar className="w-4 h-4" />
              </Button>
              <Button onClick={handleCreateTopic} disabled={isAddingTopic || !newTopicTitle.trim()}>
                {isAddingTopic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
            {showDatePicker && (
              <div className="flex gap-2 items-center bg-muted/50 p-3 rounded-lg">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={newTopicDueDate}
                  onChange={(e) => setNewTopicDueDate(e.target.value)}
                  className="flex-1"
                />
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={newTopicDueTime}
                  onChange={(e) => setNewTopicDueTime(e.target.value)}
                  className="w-32"
                />
              </div>
            )}
          </div>

          {/* Topics list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No hay temas de seguimiento</p>
              <p className="text-sm mt-1">Crea uno para empezar a tomar notas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  isExpanded={expandedTopicId === topic.id}
                  onToggleExpand={() =>
                    setExpandedTopicId(expandedTopicId === topic.id ? null : topic.id)
                  }
                  onToggleStatus={() => handleToggleStatus(topic)}
                  onDelete={() => handleDeleteTopic(topic.id)}
                  onUpdateTopic={updateTopic}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopicCard({
  topic,
  isExpanded,
  onToggleExpand,
  onToggleStatus,
  onDelete,
  onUpdateTopic,
  formatDate,
}: {
  topic: Topic;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  onUpdateTopic: (id: number, updates: { due_date?: string | null; due_time?: string | null }) => Promise<Topic | null>;
  formatDate: (d: string) => string;
}) {
  const toast = useToast();
  const { notes, isLoading, createNote, deleteNote } = useNotes(isExpanded ? topic.id : null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [dueDate, setDueDate] = useState(topic.due_date || "");
  const [dueTime, setDueTime] = useState(topic.due_time || "");

  // Check if topic is overdue
  const isOverdue = () => {
    if (!topic.due_date || topic.is_open !== 1) return false;
    const now = new Date();
    const dueDateTime = topic.due_time 
      ? new Date(`${topic.due_date}T${topic.due_time}`)
      : new Date(`${topic.due_date}T23:59:59`);
    return now > dueDateTime;
  };

  const overdue = isOverdue();

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;
    
    try {
      setIsAddingNote(true);
      await createNote(newNoteContent.trim());
      setNewNoteContent("");
      toast.success("Nota agregada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al agregar nota");
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    try {
      await deleteNote(noteId);
      toast.success("Nota eliminada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar nota");
    }
  };

  const handleSaveDeadline = async () => {
    try {
      await onUpdateTopic(topic.id, {
        due_date: dueDate || null,
        due_time: dueTime || null,
      });
      setEditingDeadline(false);
      toast.success("Fecha actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar fecha");
    }
  };

  const formatDueDate = (date: string, time: string | null) => {
    const d = new Date(date + "T00:00:00");
    let str = d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
    if (time) {
      const [h, m] = time.split(":");
      const hour = parseInt(h);
      const suffix = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      str += ` ${displayHour}:${m} ${suffix}`;
    }
    return str;
  };

  const borderColor = overdue 
    ? "border-red-500 bg-red-50 dark:bg-red-950/20" 
    : topic.is_open === 1 
      ? "border-border bg-card" 
      : "border-muted bg-muted/30";

  return (
    <div className={`rounded-xl border ${borderColor}`}>
      {/* Topic header */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={onToggleExpand}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        <button onClick={onToggleStatus} className="flex-shrink-0" title={topic.is_open === 1 ? "Marcar como resuelto" : "Reabrir tema"}>
          {topic.is_open === 1 ? (
            <Circle className={`w-5 h-5 ${overdue ? "text-red-500" : "text-primary"}`} />
          ) : (
            <CheckCircle className="w-5 h-5 text-success" />
          )}
        </button>

        <div className="flex-1 min-w-0" onClick={onToggleExpand}>
          <div className="flex items-center gap-2">
            <p className={`font-medium cursor-pointer ${topic.is_open !== 1 ? "line-through text-muted-foreground" : overdue ? "text-red-700 dark:text-red-400" : ""}`}>
              {topic.title}
            </p>
            {overdue && topic.is_open === 1 && (
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {topic.notes_count || 0} notas
            </p>
            {topic.due_date && (
              <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                overdue && topic.is_open === 1
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" 
                  : topic.is_open !== 1
                    ? "bg-success/10 text-success"
                    : "bg-accent/10 text-accent-foreground"
              }`}>
                <Calendar className="w-3 h-3" />
                {formatDueDate(topic.due_date, topic.due_time)}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setEditingDeadline(!editingDeadline)}
          className={`p-2 hover:bg-muted rounded-lg transition-colors ${topic.due_date ? "text-accent" : "text-muted-foreground"}`}
          title="Editar fecha límite"
        >
          <Calendar className="w-4 h-4" />
        </button>

        <button
          onClick={onDelete}
          className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Deadline editor */}
      {editingDeadline && (
        <div className="border-t border-border px-4 py-3 bg-muted/30">
          <p className="text-sm font-medium mb-2">Fecha límite</p>
          <div className="flex gap-2 items-center flex-wrap">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 min-w-[140px]"
            />
            <Input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-28"
            />
            <Button size="sm" onClick={handleSaveDeadline}>
              Guardar
            </Button>
            {topic.due_date && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => {
                  setDueDate("");
                  setDueTime("");
                }}
                className="text-muted-foreground"
              >
                Quitar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Notes section */}
      {isExpanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {/* Add note input */}
          <div className="flex gap-2 mb-4">
            <Textarea
              placeholder="Escribe una nota..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              className="min-h-[60px] text-sm"
            />
            <Button
              onClick={handleAddNote}
              disabled={isAddingNote || !newNoteContent.trim()}
              size="icon"
              className="flex-shrink-0 h-auto"
            >
              {isAddingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>

          {/* Notes list */}
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              Sin notas todavía
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="group relative bg-muted/50 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap pr-8">{note.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDate(note.created_at)}
                  </p>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded transition-all text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
