import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import AuthCallback from "./AuthCallback";

// ─── Capacitor mock ───────────────────────────────────────────────────────────

const mockIsNativePlatform = vi.fn(() => false);
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mockIsNativePlatform() },
}));

// ─── Mocks ───────────────────────────────────────────────────────────────────

const assignMock = vi.fn();
Object.defineProperty(window, "location", {
  value: { assign: assignMock, search: "?code=test-code" },
  configurable: true,
  writable: true,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/verify-email" element={<div>verify email page</div>} />
        <Route path="/" element={<div>landing page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function mockFetch(body: unknown, ok = true) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
  window.location.search = "?code=test-code";
});

// ─── Estado inicial ───────────────────────────────────────────────────────────

describe("AuthCallback — estado inicial", () => {
  it("muestra spinner y texto de procesamiento mientras espera", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/Procesando autenticación/i)).toBeInTheDocument();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

// ─── Error ────────────────────────────────────────────────────────────────────

describe("AuthCallback — error", () => {
  it("muestra estado de error cuando no hay ?code en la URL", async () => {
    window.location.search = "";
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Error de autenticación/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/No se pudo completar la autenticación/i)).toBeInTheDocument();
  });

  it("muestra estado de error cuando el servidor responde success: false", async () => {
    mockFetch({ success: false, error: { message: "Token inválido" } }, false);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Error de autenticación/i)).toBeInTheDocument();
    });
  });

  it("muestra estado de error cuando fetch lanza excepción de red", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No se pudo completar la autenticación/i)).toBeInTheDocument();
    });
  });
});

// ─── Verificación pendiente ───────────────────────────────────────────────────

describe("AuthCallback — verificación pendiente", () => {
  it("navega a /verify-email cuando el servidor responde PENDING_VERIFICATION", async () => {
    mockFetch({ success: false, error: { code: "PENDING_VERIFICATION" } }, false);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("verify email page")).toBeInTheDocument();
    });
  });
});

// ─── Éxito ────────────────────────────────────────────────────────────────────

describe("AuthCallback — éxito", () => {
  it("muestra estado de éxito tras autenticación correcta", async () => {
    mockFetch({ success: true });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Autenticación exitosa/i)).toBeInTheDocument();
    });
  });

  it("llama a window.location.assign('/agente-ia') después del timeout de éxito", async () => {
    mockFetch({ success: true });
    renderPage();
    await waitFor(
      () => expect(assignMock).toHaveBeenCalledWith("/agente-ia"),
      { timeout: 2000 }
    );
  });
});

// ─── Interacción ──────────────────────────────────────────────────────────────

describe("AuthCallback — interacción", () => {
  it("el botón 'Volver a intentar' navega a / desde el estado de error", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Volver a intentar/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Volver a intentar/i }));
    expect(screen.getByText("landing page")).toBeInTheDocument();
  });
});

// ─── Plataforma ───────────────────────────────────────────────────────────────

describe("AuthCallback — plataforma", () => {
  it("envía platform='android' en el body cuando está en plataforma nativa", async () => {
    mockIsNativePlatform.mockReturnValueOnce(true);
    mockFetch({ success: true });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Autenticación exitosa/i)).toBeInTheDocument()
    );
    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.platform).toBe("android");
  });

  it("no envía platform en el body cuando está en web (browser desktop)", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0",
      configurable: true,
    });
    mockIsNativePlatform.mockReturnValueOnce(false);
    mockFetch({ success: true });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Autenticación exitosa/i)).toBeInTheDocument()
    );
    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.platform).toBeUndefined();
  });
});

// ─── Android Chrome ───────────────────────────────────────────────────────────

describe("AuthCallback — android chrome", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0",
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (linux) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/20.0.0",
      configurable: true,
    });
  });

  it("envía platform='android_chrome' cuando detecta Android en userAgent (no nativo)", async () => {
    mockIsNativePlatform.mockReturnValueOnce(false);
    mockFetch({ success: true, token: "jwt-token-abc" });
    renderPage();
    await waitFor(() => expect(assignMock).toHaveBeenCalled());
    const body = JSON.parse(
      (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
    );
    expect(body.platform).toBe("android_chrome");
  });

  it("redirige a org.lahoja.app://session?token=... cuando el servidor retorna token", async () => {
    mockIsNativePlatform.mockReturnValueOnce(false);
    mockFetch({ success: true, token: "jwt-token-abc" });
    renderPage();
    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        `org.lahoja.app://session?token=${encodeURIComponent("jwt-token-abc")}`
      )
    );
  });

  it("no muestra estado de éxito cuando redirige al scheme de la app", async () => {
    mockIsNativePlatform.mockReturnValueOnce(false);
    mockFetch({ success: true, token: "jwt-token-abc" });
    renderPage();
    await waitFor(() => expect(assignMock).toHaveBeenCalled());
    expect(screen.queryByText(/Autenticación exitosa/i)).not.toBeInTheDocument();
  });
});
