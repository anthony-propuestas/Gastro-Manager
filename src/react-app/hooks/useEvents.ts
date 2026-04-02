import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

export interface CalendarEvent {
  id: number;
  negocio_id: number;
  user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventFormData {
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  event_type?: string;
  location?: string;
}

export function useEvents(month?: number, year?: number) {
  const { currentNegocio } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = "/api/events";
      if (month !== undefined && year !== undefined) {
        url += `?month=${month + 1}&year=${year}`;
      }
      const response = await apiFetch(url, {}, currentNegocio?.id);
      const data = await response.json();

      if (data.success) {
        setEvents(data.data);
      } else {
        setError(data.error?.message || "Error al cargar eventos");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  }, [month, year, currentNegocio?.id]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const createEvent = async (eventData: EventFormData): Promise<boolean> => {
    try {
      const response = await apiFetch(
        "/api/events",
        { method: "POST", body: JSON.stringify(eventData) },
        currentNegocio?.id
      );
      const data = await response.json();

      if (data.success) {
        await fetchEvents();
        return true;
      } else {
        setError(data.error?.message || "Error al crear evento");
        return false;
      }
    } catch {
      setError("Error de conexión");
      return false;
    }
  };

  const updateEvent = async (id: number, eventData: Partial<EventFormData>): Promise<boolean> => {
    try {
      const response = await apiFetch(
        `/api/events/${id}`,
        { method: "PUT", body: JSON.stringify(eventData) },
        currentNegocio?.id
      );
      const data = await response.json();

      if (data.success) {
        await fetchEvents();
        return true;
      } else {
        setError(data.error?.message || "Error al actualizar evento");
        return false;
      }
    } catch {
      setError("Error de conexión");
      return false;
    }
  };

  const deleteEvent = async (id: number): Promise<boolean> => {
    try {
      const response = await apiFetch(
        `/api/events/${id}`,
        { method: "DELETE" },
        currentNegocio?.id
      );
      const data = await response.json();

      if (data.success) {
        await fetchEvents();
        return true;
      } else {
        setError(data.error?.message || "Error al eliminar evento");
        return false;
      }
    } catch {
      setError("Error de conexión");
      return false;
    }
  };

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split("T")[0];
    return events.filter((event) => event.event_date === dateStr);
  };

  return {
    events,
    isLoading,
    error,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
  };
}
