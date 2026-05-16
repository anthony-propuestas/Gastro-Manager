import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ChatWidget } from "@/react-app/components/ChatWidget";

const mockUseLocation = vi.fn();
const mockUseChatContext = vi.fn();
const mockUseMyUsage = vi.fn();

vi.mock("react-router", () => ({ useLocation: () => mockUseLocation() }));
vi.mock("@/react-app/context/ChatContext", () => ({ useChatContext: () => mockUseChatContext() }));
vi.mock("@/react-app/hooks/useMyUsage", () => ({ useMyUsage: () => mockUseMyUsage() }));

const triggerDailyGreeting = vi.fn();
const sendMessage = vi.fn();
const clearMessages = vi.fn();

const BASE_MOCK = {
  messages: [] as { role: "user" | "assistant"; content: string; timestamp: Date }[],
  isLoading: false,
  error: null as string | null,
  sendMessage,
  clearMessages,
  triggerDailyGreeting,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLocation.mockReturnValue({ pathname: "/dashboard" });
  mockUseChatContext.mockReturnValue({ ...BASE_MOCK });
  mockUseMyUsage.mockReturnValue({ data: null, isLoading: false });
});

// ─── Floating button ──────────────────────────────────────────────────────────

describe("ChatWidget — botón flotante", () => {
  it("no renderiza el botón en /agente-ia", () => {
    mockUseLocation.mockReturnValue({ pathname: "/agente-ia" });
    render(<ChatWidget />);
    expect(screen.queryByLabelText("Abrir chat")).toBeNull();
  });

  it("renderiza el botón en otras rutas", () => {
    render(<ChatWidget />);
    expect(screen.getByLabelText("Abrir chat")).toBeInTheDocument();
  });

  it("abre el panel al hacer clic y llama triggerDailyGreeting", () => {
    render(<ChatWidget />);
    fireEvent.click(screen.getByLabelText("Abrir chat"));
    expect(screen.getByText("Asistente Virtual")).toBeInTheDocument();
    expect(triggerDailyGreeting).toHaveBeenCalledTimes(1);
  });

  it("cierra el panel al hacer clic por segunda vez", () => {
    render(<ChatWidget />);
    fireEvent.click(screen.getByLabelText("Abrir chat"));
    fireEvent.click(screen.getByLabelText("Abrir chat"));
    expect(screen.queryByText("Asistente Virtual")).toBeNull();
  });
});

// ─── Panel ────────────────────────────────────────────────────────────────────

describe("ChatWidget — panel de chat", () => {
  function openPanel() {
    render(<ChatWidget />);
    fireEvent.click(screen.getByLabelText("Abrir chat"));
  }

  it("muestra estado vacío cuando messages es []", () => {
    openPanel();
    expect(screen.getByText(/Hola! Soy tu asistente virtual/i)).toBeInTheDocument();
  });

  it("renderiza mensajes cuando hay contenido", () => {
    mockUseChatContext.mockReturnValue({
      ...BASE_MOCK,
      messages: [
        { role: "user", content: "Hola equipo", timestamp: new Date() },
        { role: "assistant", content: "¡Hola!", timestamp: new Date() },
      ],
    });
    openPanel();
    expect(screen.getByText("Hola equipo")).toBeInTheDocument();
    expect(screen.getByText("¡Hola!")).toBeInTheDocument();
  });

  it("muestra spinner de carga cuando isLoading es true", () => {
    mockUseChatContext.mockReturnValue({ ...BASE_MOCK, isLoading: true });
    openPanel();
    expect(document.querySelector(".animate-bounce")).toBeInTheDocument();
  });

  it("muestra error cuando error tiene valor", () => {
    mockUseChatContext.mockReturnValue({ ...BASE_MOCK, error: "Error de conexión" });
    openPanel();
    expect(screen.getByText("Error de conexión")).toBeInTheDocument();
  });

  it("no muestra botón de limpiar cuando messages es []", () => {
    openPanel();
    expect(screen.queryByLabelText("Limpiar chat")).toBeNull();
  });

  it("muestra botón de limpiar cuando hay mensajes", () => {
    mockUseChatContext.mockReturnValue({
      ...BASE_MOCK,
      messages: [{ role: "user", content: "test", timestamp: new Date() }],
    });
    render(<ChatWidget />);
    fireEvent.click(screen.getByLabelText("Abrir chat"));
    expect(screen.getByLabelText("Limpiar chat")).toBeInTheDocument();
  });
});
