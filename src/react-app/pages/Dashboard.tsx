import { useState, useRef, useEffect } from "react";
import { Bot, Send, Trash2, MessageCircle } from "lucide-react";
import { useChatContext } from "@/react-app/context/ChatContext";
import { useMyUsage } from "@/react-app/hooks/useMyUsage";
import { UsageBanner } from "@/react-app/components/UsageBanner";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";

export default function AgenteIA() {
  const [inputValue, setInputValue] = useState("");
  const { messages, isLoading, error, sendMessage, clearMessages } = useChatContext();
  const { data: myUsage } = useMyUsage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    const message = inputValue;
    setInputValue("");
    await sendMessage(message);
  };

  return (
    <div className="flex flex-col -m-4 sm:-m-6 lg:-m-8 h-[calc(100dvh-7.5rem)] lg:h-screen">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6" />
          <div>
            <h1 className="text-lg font-semibold">Agente IA</h1>
            <p className="text-xs opacity-90">Pregunta sobre tu negocio</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="flex items-center gap-2 rounded px-3 py-1.5 text-sm hover:bg-white/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Limpiar
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        <UsageBanner label="Chat IA" usage={myUsage?.usage["chat"]} />
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm mt-16">
            <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="mb-2 text-base">¡Hola! Soy tu agente de IA.</p>
            <p className="text-xs">Puedo ayudarte con información sobre:</p>
            <ul className="text-xs mt-2 space-y-1">
              <li>• Tus empleados y sus datos</li>
              <li>• Sueldos y adelantos</li>
              <li>• Eventos del calendario</li>
              <li>• Temas pendientes</li>
            </ul>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === "user"
                  ? "bg-emerald-500 text-white"
                  : "bg-muted text-foreground"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {msg.timestamp.toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2">
              <div className="flex space-x-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" />
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border bg-background p-4 sm:p-6">
        <form onSubmit={handleSubmit}>
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Escribe tu pregunta..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              size="icon"
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
