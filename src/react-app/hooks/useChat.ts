import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const INACTIVITY_THRESHOLD_MS = 8 * 60 * 60 * 1000;

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function useChat() {
  const { currentNegocio } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const history = messages.slice(-5).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await apiFetch(
        "/api/chat",
        { method: "POST", body: JSON.stringify({ message, history }) },
        currentNegocio?.id
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Error al enviar mensaje");
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.data.reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      console.error("Error sending message:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setError(null);
  };

  const triggerDailyGreeting = async () => {
    const negocioId = currentNegocio?.id;
    const key = `chatLastActivity_${negocioId ?? "default"}`;
    const lastActivity = localStorage.getItem(key);
    const now = Date.now();

    localStorage.setItem(key, String(now));

    const isFirstUse = !lastActivity;
    const isInactive = !!lastActivity && now - Number(lastActivity) > INACTIVITY_THRESHOLD_MS;

    if ((isFirstUse || isInactive) && messages.length === 0 && !isLoading) {
      await sendMessage(
        "Dame un resumen breve de los eventos de hoy y si hay algo pendiente importante"
      );
    }
  };

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    triggerDailyGreeting,
  };
}
