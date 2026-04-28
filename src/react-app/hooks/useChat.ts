import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

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
      const history = messages.slice(-20).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
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

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
