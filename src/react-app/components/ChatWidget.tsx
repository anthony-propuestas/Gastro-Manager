import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Trash2 } from "lucide-react";
import { useChat } from "@/react-app/hooks/useChat";
import { useMyUsage } from "@/react-app/hooks/useMyUsage";
import { UsageBanner } from "@/react-app/components/UsageBanner";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat();
  const { data: myUsage } = useMyUsage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
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

  const handleClear = () => {
    clearMessages();
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg transition-all hover:scale-110 hover:shadow-xl"
        aria-label="Abrir chat"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[500px] w-[380px] flex-col rounded-lg border border-border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-white rounded-t-lg">
            <div>
              <h3 className="font-semibold">Asistente Virtual</h3>
              <p className="text-xs opacity-90">Pregunta sobre tu cuenta</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="rounded p-1 hover:bg-white/20 transition-colors"
                aria-label="Limpiar chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <UsageBanner label="Chat IA" usage={myUsage?.usage["chat"]} />
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm mt-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="mb-2">¡Hola! Soy tu asistente virtual.</p>
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
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce"></div>
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
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
          <form onSubmit={handleSubmit} className="border-t border-border p-4">
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
      )}
    </>
  );
}
