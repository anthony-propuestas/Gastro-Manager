import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChatProvider, useChatContext } from "./ChatContext";

vi.mock("@/react-app/hooks/useChat", () => ({
  useChat: vi.fn(() => ({
    messages: [],
    isLoading: false,
    error: null,
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
  })),
}));

// ─── useChatContext ───────────────────────────────────────────────────────────

describe("useChatContext", () => {
  it("lanza cuando se usa fuera de ChatProvider", () => {
    const BadConsumer = () => {
      useChatContext();
      return null;
    };
    expect(() => render(<BadConsumer />)).toThrow(
      "useChatContext must be used within ChatProvider"
    );
  });

  it("devuelve el valor del contexto cuando está dentro de ChatProvider", () => {
    let captured: ReturnType<typeof useChatContext> | undefined;

    const Consumer = () => {
      captured = useChatContext();
      return <div>ok</div>;
    };

    render(
      <ChatProvider>
        <Consumer />
      </ChatProvider>
    );

    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(captured).toBeDefined();
    expect(Array.isArray(captured!.messages)).toBe(true);
    expect(typeof captured!.sendMessage).toBe("function");
    expect(typeof captured!.clearMessages).toBe("function");
  });
});
