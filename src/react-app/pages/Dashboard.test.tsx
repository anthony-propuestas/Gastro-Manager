import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import AgenteIA from "./Dashboard";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/react-app/context/ChatContext");
import { useChatContext } from "@/react-app/context/ChatContext";
const mockUseChatContext = vi.mocked(useChatContext);

vi.mock("@/react-app/hooks/useMyUsage", () => ({
  useMyUsage: vi.fn(() => ({ data: null, isLoading: false })),
}));

// UsageBanner reads from myUsage, keep it simple
vi.mock("@/react-app/components/UsageBanner", () => ({
  UsageBanner: () => null,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string; timestamp: Date };

const BASE_MOCK = {
  messages: [] as Message[],
  isLoading: false,
  error: null as string | null,
  sendMessage: vi.fn(),
  clearMessages: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Sin mensajes ─────────────────────────────────────────────────────────────

describe("AgenteIA — sin mensajes", () => {
  it("muestra el mensaje de bienvenida cuando no hay mensajes", () => {
    mockUseChatContext.mockReturnValue({ ...BASE_MOCK });
    render(<AgenteIA />);
    expect(screen.getByText(/¡Hola! Soy tu agente de IA/i)).toBeInTheDocument();
  });

  it("el botón Limpiar no está visible cuando no hay mensajes", () => {
    mockUseChatContext.mockReturnValue({ ...BASE_MOCK });
    render(<AgenteIA />);
    expect(screen.queryByText("Limpiar")).not.toBeInTheDocument();
  });
});

// ─── Con mensajes ─────────────────────────────────────────────────────────────

describe("AgenteIA — con mensajes", () => {
  const messages: Message[] = [
    { role: "user", content: "Hola bot", timestamp: new Date() },
    { role: "assistant", content: "Hola humano", timestamp: new Date() },
  ];

  it("renderiza el contenido de los mensajes", () => {
    mockUseChatContext.mockReturnValue({ ...BASE_MOCK, messages });
    render(<AgenteIA />);
    expect(screen.getByText("Hola bot")).toBeInTheDocument();
    expect(screen.getByText("Hola humano")).toBeInTheDocument();
  });

  it("muestra el botón Limpiar cuando hay mensajes", () => {
    mockUseChatContext.mockReturnValue({ ...BASE_MOCK, messages });
    render(<AgenteIA />);
    expect(screen.getByText("Limpiar")).toBeInTheDocument();
  });
});

// ─── Carga / Error ────────────────────────────────────────────────────────────

describe("AgenteIA — estados de carga y error", () => {
  it("muestra el indicador de escritura cuando isLoading es true", () => {
    mockUseChatContext.mockReturnValue({ ...BASE_MOCK, isLoading: true });
    const { container } = render(<AgenteIA />);
    expect(container.querySelector(".animate-bounce")).toBeInTheDocument();
  });

  it("muestra el texto de error cuando error tiene valor", () => {
    mockUseChatContext.mockReturnValue({ ...BASE_MOCK, error: "Error de conexión" });
    render(<AgenteIA />);
    expect(screen.getByText("Error de conexión")).toBeInTheDocument();
  });
});

// ─── Acciones ─────────────────────────────────────────────────────────────────

describe("AgenteIA — acciones", () => {
  it("submit del form llama sendMessage con el texto ingresado", async () => {
    const sendMessage = vi.fn(() => Promise.resolve());
    mockUseChatContext.mockReturnValue({ ...BASE_MOCK, sendMessage });
    render(<AgenteIA />);

    fireEvent.change(screen.getByPlaceholderText(/escribe tu pregunta/i), {
      target: { value: "¿Cuántos empleados tengo?" },
    });
    fireEvent.submit(screen.getByPlaceholderText(/escribe tu pregunta/i).closest("form")!);

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith("¿Cuántos empleados tengo?")
    );
  });

  it("no llama sendMessage si el input está vacío", () => {
    const sendMessage = vi.fn();
    mockUseChatContext.mockReturnValue({ ...BASE_MOCK, sendMessage });
    render(<AgenteIA />);

    fireEvent.submit(screen.getByPlaceholderText(/escribe tu pregunta/i).closest("form")!);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("el input está deshabilitado cuando isLoading es true", () => {
    mockUseChatContext.mockReturnValue({ ...BASE_MOCK, isLoading: true });
    render(<AgenteIA />);
    expect(screen.getByPlaceholderText(/escribe tu pregunta/i)).toBeDisabled();
  });
});
