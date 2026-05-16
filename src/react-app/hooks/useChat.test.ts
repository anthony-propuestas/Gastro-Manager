import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChat } from "@/react-app/hooks/useChat";

const mockUseAuth = vi.fn();
const mockApiFetch = vi.fn();

vi.mock("@/react-app/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/react-app/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

function ok(reply: string) {
  return new Response(
    JSON.stringify({ success: true, data: { reply } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function fail(message: string) {
  return new Response(
    JSON.stringify({ success: false, error: { code: "ERROR", message } }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

describe("useChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ currentNegocio: { id: 5 } });
    mockApiFetch.mockResolvedValue(ok("Hola, ¿en qué puedo ayudarte?"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with empty state", () => {
    const { result } = renderHook(() => useChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("ignores whitespace-only messages", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("   ");
    });

    expect(mockApiFetch).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it("sends history:[] on the first message", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hola");
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        body: JSON.stringify({ message: "Hola", history: [] }),
      }),
      5
    );
  });

  it("adds user message and assistant reply to messages state", async () => {
    mockApiFetch.mockResolvedValue(ok("Todo bien."));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hola");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({ role: "user", content: "Hola" });
    expect(result.current.messages[1]).toMatchObject({ role: "assistant", content: "Todo bien." });
  });

  it("sends previous exchange as history on the second message", async () => {
    mockApiFetch
      .mockResolvedValueOnce(ok("Primera respuesta."))
      .mockResolvedValueOnce(ok("Segunda respuesta."));

    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.sendMessage("Pregunta 1"); });
    await act(async () => { await result.current.sendMessage("Pregunta 2"); });

    const secondBody = JSON.parse(((mockApiFetch.mock.calls[1]?.[1] as RequestInit).body as string));
    expect(secondBody.message).toBe("Pregunta 2");
    expect(secondBody.history).toEqual([
      { role: "user", content: "Pregunta 1" },
      { role: "assistant", content: "Primera respuesta." },
    ]);
  });

  it("preserves 'assistant' role in history sent to the API", async () => {
    mockApiFetch
      .mockResolvedValueOnce(ok("Respuesta asistente."))
      .mockResolvedValueOnce(ok("OK."));

    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.sendMessage("Hola"); });
    await act(async () => { await result.current.sendMessage("¿Y?"); });

    const secondBody = JSON.parse(((mockApiFetch.mock.calls[1]?.[1] as RequestInit).body as string));
    const assistantEntry = secondBody.history.find((h: { role: string; content: string }) => h.content === "Respuesta asistente.");
    expect(assistantEntry?.role).toBe("assistant");
  });

  it("caps history at 5 messages when the conversation is long", async () => {
    mockApiFetch.mockImplementation(() => Promise.resolve(ok("ok")));
    const { result } = renderHook(() => useChat());

    // 4 exchanges produce 8 messages; the 5th call should send at most 5 in history
    for (let i = 0; i < 4; i++) {
      await act(async () => { await result.current.sendMessage(`Pregunta ${i}`); });
    }
    await act(async () => { await result.current.sendMessage("última"); });

    const lastBody = JSON.parse(((mockApiFetch.mock.calls[4]?.[1] as RequestInit).body as string));
    expect(lastBody.history).toHaveLength(5);
  });

  it("sets error when the API returns a failure response", async () => {
    mockApiFetch.mockResolvedValue(fail("Algo salió mal"));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hola");
    });

    expect(result.current.error).toBe("Algo salió mal");
    expect(result.current.messages).toHaveLength(1); // user message was added before the error
  });

  it("sets error on network failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockApiFetch.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hola");
    });

    expect(result.current.error).toBe("Network error");
    consoleError.mockRestore();
  });

  it("resets isLoading to false after a successful call", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hola");
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("resets isLoading to false after a failed call", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockApiFetch.mockRejectedValue(new Error("fail"));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("Hola");
    });

    expect(result.current.isLoading).toBe(false);
    consoleError.mockRestore();
  });

  it("clears messages and error on clearMessages", async () => {
    mockApiFetch.mockResolvedValue(ok("Hola."));
    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.sendMessage("Hola"); });
    act(() => { result.current.clearMessages(); });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it("passes the negocio id from context to apiFetch", async () => {
    mockUseAuth.mockReturnValue({ currentNegocio: { id: 99 } });
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage("test");
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.any(Object),
      99
    );
  });
});

// ─── triggerDailyGreeting ─────────────────────────────────────────────────────

describe("useChat — triggerDailyGreeting", () => {
  const KEY = "chatLastActivity_5";

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ currentNegocio: { id: 5 } });
    mockApiFetch.mockResolvedValue(ok("ok"));
  });

  it("envía saludo en la primera visita (sin clave previa)", async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.triggerDailyGreeting(); });

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((mockApiFetch.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.message).toBe("Dame un resumen breve de los eventos de hoy y si hay algo pendiente importante");
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it("no envía mensaje cuando la actividad fue hace menos de 8h", async () => {
    localStorage.setItem(KEY, String(Date.now() - 1 * 60 * 60 * 1000)); // 1h atrás
    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.triggerDailyGreeting(); });

    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("envía saludo de bienvenida tras más de 8h de inactividad", async () => {
    localStorage.setItem(KEY, String(Date.now() - 9 * 60 * 60 * 1000)); // 9h atrás
    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.triggerDailyGreeting(); });

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((mockApiFetch.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.message).toBe("Dame un resumen breve de los eventos de hoy y si hay algo pendiente importante");
  });

  it("no envía saludo si ya hay mensajes en el historial", async () => {
    localStorage.setItem(KEY, String(Date.now() - 9 * 60 * 60 * 1000));
    const { result } = renderHook(() => useChat());

    // Agrega un mensaje primero
    await act(async () => { await result.current.sendMessage("Hola"); });
    vi.clearAllMocks();

    await act(async () => { await result.current.triggerDailyGreeting(); });

    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
