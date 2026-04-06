import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Calendar as CalendarIcon,
  Loader2,
  User,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { useToast } from "@/react-app/components/ui/toast";
import { useEvents, type CalendarEvent, type EventFormData } from "@/react-app/hooks/useEvents";
import { useTopicDeadlines } from "@/react-app/hooks/useTopics";
import { useMyUsage } from "@/react-app/hooks/useMyUsage";
import { UsageBanner } from "@/react-app/components/UsageBanner";
import { EventModal } from "@/react-app/components/EventModal";

const daysOfWeek = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const eventTypeColors: Record<string, string> = {
  meeting: "bg-primary/10 text-primary border-primary/30",
  interview: "bg-accent/10 text-accent border-accent/30",
  training: "bg-chart-3/10 text-chart-3 border-chart-3/30",
  delivery: "bg-chart-4/10 text-chart-4 border-chart-4/30",
  general: "bg-muted text-muted-foreground border-muted-foreground/30",
};

const eventTypeDots: Record<string, string> = {
  meeting: "bg-primary",
  interview: "bg-accent",
  training: "bg-chart-3",
  delivery: "bg-chart-4",
  general: "bg-muted-foreground",
  deadline: "bg-amber-500",
  deadline_overdue: "bg-red-500",
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const toast = useToast();
  const { data: myUsage } = useMyUsage();

  const {
    isLoading,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
  } = useEvents(currentDate.getMonth(), currentDate.getFullYear());

  const {
    getDeadlinesForDate,
  } = useTopicDeadlines(currentDate.getMonth(), currentDate.getFullYear());

  // Check if a deadline is overdue
  const isDeadlineOverdue = (deadline: { is_open: number; due_date: string | null; due_time: string | null }) => {
    if (deadline.is_open !== 1 || !deadline.due_date) return false;
    const now = new Date();
    const dueDateTime = deadline.due_time 
      ? new Date(`${deadline.due_date}T${deadline.due_time}`)
      : new Date(`${deadline.due_date}T23:59:59`);
    return now > dueDateTime;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const days = getDaysInMonth(currentDate);
  const selectedDateEvents = getEventsForDate(selectedDate);
  const selectedDateDeadlines = getDeadlinesForDate(selectedDate).filter(d => d.is_open === 1);
  const hasItems = selectedDateEvents.length > 0 || selectedDateDeadlines.length > 0;

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    return (
      day === selectedDate.getDate() &&
      currentDate.getMonth() === selectedDate.getMonth() &&
      currentDate.getFullYear() === selectedDate.getFullYear()
    );
  };

  const getEventsForDay = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return getEventsForDate(date);
  };

  const getDeadlinesForDay = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return getDeadlinesForDate(date).filter(d => d.is_open === 1);
  };

  // Get combined dots for a day (events + deadlines)
  const getDotsForDay = (day: number) => {
    const events = getEventsForDay(day);
    const deadlinesForDay = getDeadlinesForDay(day);
    
    const dots: { type: string }[] = [];
    events.forEach(e => dots.push({ type: e.event_type }));
    deadlinesForDay.forEach(d => dots.push({ type: isDeadlineOverdue(d) ? "deadline_overdue" : "deadline" }));
    
    return dots.slice(0, 3);
  };

  const handleSaveEvent = async (data: EventFormData): Promise<boolean> => {
    try {
      let success: boolean;
      if (editingEvent) {
        success = await updateEvent(editingEvent.id, data);
        if (success) toast.success("Evento actualizado");
      } else {
        success = await createEvent(data);
        if (success) toast.success("Evento creado");
      }
      if (!success) toast.error("Error al guardar el evento");
      return success;
    } catch {
      toast.error("Error al guardar el evento");
      return false;
    }
  };

  const handleDeleteEvent = async (): Promise<boolean> => {
    if (!editingEvent) return false;
    try {
      const success = await deleteEvent(editingEvent.id);
      if (success) {
        toast.success("Evento eliminado");
      } else {
        toast.error("Error al eliminar el evento");
      }
      return success;
    } catch {
      toast.error("Error al eliminar el evento");
      return false;
    }
  };

  const openNewEventModal = () => {
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const openEditEventModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const formatTime = (time: string | null) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${minutes} ${suffix}`;
  };

  return (
    <div className="space-y-6">
      <UsageBanner label="Eventos" usage={myUsage?.usage["events"]} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-foreground">
            Calendario
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus eventos y reuniones
          </p>
        </div>
        <Button onClick={openNewEventModal} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Evento
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-serif">
                {months[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPreviousMonth}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNextMonth}
                  className="h-8 w-8"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Days of week header */}
            <div className="grid grid-cols-7 mb-2">
              {daysOfWeek.map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => {
                  const dayDots = day ? getDotsForDay(day) : [];
                  return (
                    <button
                      key={index}
                      disabled={day === null}
                      onClick={() =>
                        day &&
                        setSelectedDate(
                          new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
                        )
                      }
                      className={`
                        aspect-square p-1 rounded-lg text-sm font-medium transition-all relative
                        ${day === null ? "invisible" : ""}
                        ${isToday(day!) ? "bg-primary text-primary-foreground" : ""}
                        ${isSelected(day!) && !isToday(day!) ? "bg-accent text-accent-foreground" : ""}
                        ${!isToday(day!) && !isSelected(day!) ? "hover:bg-muted" : ""}
                      `}
                    >
                      <span className="block">{day}</span>
                      {dayDots.length > 0 && (
                        <div className="flex justify-center gap-0.5 mt-0.5">
                          {dayDots.map((dot, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                isToday(day!) ? "bg-primary-foreground" : eventTypeDots[dot.type] || eventTypeDots.general
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Date Events & Deadlines */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {selectedDate.getDate()} de {months[selectedDate.getMonth()]}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Events */}
            {selectedDateEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => openEditEventModal(event)}
                className={`p-4 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${
                  eventTypeColors[event.event_type] || eventTypeColors.general
                }`}
              >
                <h4 className="font-medium mb-1">{event.title}</h4>
                {event.description && (
                  <p className="text-sm opacity-80 mb-3">{event.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-xs opacity-70">
                  {event.start_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(event.start_time)}
                      {event.end_time && ` - ${formatTime(event.end_time)}`}
                    </span>
                  )}
                  {event.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.location}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Topic Deadlines */}
            {selectedDateDeadlines.map((deadline) => {
              const overdue = isDeadlineOverdue(deadline);
              return (
                <div
                  key={`deadline-${deadline.id}`}
                  className={`p-4 rounded-lg border transition-all ${
                    overdue 
                      ? "bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800" 
                      : "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {overdue && <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium mb-1 ${overdue ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                        {deadline.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className={`flex items-center gap-1 ${overdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                          <User className="w-3 h-3" />
                          {deadline.employee_name}
                        </span>
                        {deadline.due_time && (
                          <span className={`flex items-center gap-1 ${overdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                            <Clock className="w-3 h-3" />
                            {formatTime(deadline.due_time)}
                          </span>
                        )}
                      </div>
                      {overdue && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                          Fecha límite vencida
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {!hasItems && (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm mb-4">No hay eventos para este día</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openNewEventModal}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar evento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleSaveEvent}
        onDelete={editingEvent ? handleDeleteEvent : undefined}
        event={editingEvent}
        defaultDate={selectedDate}
      />
    </div>
  );
}
