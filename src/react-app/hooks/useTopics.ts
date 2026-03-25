import { useState, useEffect, useCallback } from "react";

export interface Topic {
  id: number;
  employee_id: number;
  title: string;
  is_open: number;
  due_date: string | null;
  due_time: string | null;
  notes_count?: number;
  last_note_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TopicWithEmployee extends Topic {
  employee_name: string;
}

export interface Note {
  id: number;
  topic_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export function useTopics(employeeId: number | null) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTopics = useCallback(async () => {
    if (!employeeId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/employees/${employeeId}/topics`);
      const data = await response.json();
      
      if (data.success) {
        setTopics(data.data || []);
      } else {
        setError(data.error?.message || "Error al cargar temas");
      }
    } catch (err) {
      setError("Error de conexión");
      console.error("Error fetching topics:", err);
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (employeeId) {
      fetchTopics();
    } else {
      setTopics([]);
    }
  }, [employeeId, fetchTopics]);

  const createTopic = async (title: string, due_date?: string, due_time?: string): Promise<Topic | null> => {
    if (!employeeId) return null;
    
    const response = await fetch(`/api/employees/${employeeId}/topics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, due_date, due_time }),
    });
    const data = await response.json();
    
    if (data.success) {
      await fetchTopics();
      return data.data;
    }
    throw new Error(data.error?.message || "Error al crear tema");
  };

  const updateTopic = async (id: number, updates: { title?: string; is_open?: boolean; due_date?: string | null; due_time?: string | null }): Promise<Topic | null> => {
    const response = await fetch(`/api/topics/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await response.json();
    
    if (data.success) {
      await fetchTopics();
      return data.data;
    }
    throw new Error(data.error?.message || "Error al actualizar tema");
  };

  const deleteTopic = async (id: number): Promise<boolean> => {
    const response = await fetch(`/api/topics/${id}`, { method: "DELETE" });
    const data = await response.json();
    
    if (data.success) {
      await fetchTopics();
      return true;
    }
    throw new Error(data.error?.message || "Error al eliminar tema");
  };

  return {
    topics,
    isLoading,
    error,
    refetch: fetchTopics,
    createTopic,
    updateTopic,
    deleteTopic,
  };
}

// Hook to get topic deadlines for calendar
export function useTopicDeadlines(month: number, year: number) {
  const [deadlines, setDeadlines] = useState<TopicWithEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDeadlines = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/topics/deadlines?month=${month + 1}&year=${year}`
      );
      const data = await response.json();
      
      if (data.success) {
        setDeadlines(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching deadlines:", err);
    } finally {
      setIsLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchDeadlines();
  }, [fetchDeadlines]);

  const getDeadlinesForDate = useCallback((date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return deadlines.filter(d => d.due_date === dateStr);
  }, [deadlines]);

  return {
    deadlines,
    isLoading,
    refetch: fetchDeadlines,
    getDeadlinesForDate,
  };
}

export function useNotes(topicId: number | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    if (!topicId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/topics/${topicId}/notes`);
      const data = await response.json();
      
      if (data.success) {
        setNotes(data.data || []);
      } else {
        setError(data.error?.message || "Error al cargar notas");
      }
    } catch (err) {
      setError("Error de conexión");
      console.error("Error fetching notes:", err);
    } finally {
      setIsLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    if (topicId) {
      fetchNotes();
    } else {
      setNotes([]);
    }
  }, [topicId, fetchNotes]);

  const createNote = async (content: string): Promise<Note | null> => {
    if (!topicId) return null;
    
    const response = await fetch(`/api/topics/${topicId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await response.json();
    
    if (data.success) {
      await fetchNotes();
      return data.data;
    }
    throw new Error(data.error?.message || "Error al crear nota");
  };

  const updateNote = async (id: number, content: string): Promise<Note | null> => {
    const response = await fetch(`/api/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await response.json();
    
    if (data.success) {
      await fetchNotes();
      return data.data;
    }
    throw new Error(data.error?.message || "Error al actualizar nota");
  };

  const deleteNote = async (id: number): Promise<boolean> => {
    const response = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    const data = await response.json();
    
    if (data.success) {
      await fetchNotes();
      return true;
    }
    throw new Error(data.error?.message || "Error al eliminar nota");
  };

  return {
    notes,
    isLoading,
    error,
    refetch: fetchNotes,
    createNote,
    updateNote,
    deleteNote,
  };
}
