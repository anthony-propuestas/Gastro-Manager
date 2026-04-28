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

    const secondBody = JSON.parse((mockApiFetch.mock.calls[1]?.[1] as any).body);
    expect(secondBody.message).toBe("Pregunta 2");
    expect(secondBody.history).toEqual([
      { role: "user", content: "Pregunta 1" },
      { role: "model", content: "Primera respuesta." },
    ]);
  });

  it("maps 'assistant' role to 'model' in history sent to the API", async () => {
    mockApiFetch
      .mockResolvedValueOnce(ok("Respuesta asistente."))
      .mockResolvedValueOnce(ok("OK."));

    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.sendMessage("Hola"); });
    await act(async () => { await result.current.sendMessage("¿Y?"); });

    const secondBody = JSON.parse((mockApiFetch.mock.calls[1]?.[1] as any).body);
    const assistantEntry = secondBody.history.find((h: any) => h.content === "Respuesta asistente.");
    expect(assistantEntry?.role).toBe("model");
  });

  it("caps history at 20 messages when the conversation is long", async () => {
    mockApiFetch.mockImplementation(() => Promise.resolve(ok("ok")));
    const { result } = renderHook(() => useChat());

    // 11 exchanges produce 22 messages; the 12th call should send at most 20 in history
    for (let i = 0; i < 11; i++) {
      await act(async () => { await result.current.sendMessage(`Pregunta ${i}`); });
    }
    await act(async () => { await result.current.sendMessage("última"); });

    const lastBody = JSON.parse((mockApiFetch.mock.calls[11]?.[1] as any).body);
    expect(lastBody.history).toHaveLength(20);
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
