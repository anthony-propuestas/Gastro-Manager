import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import LandingPage from "./LandingPage";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();

vi.mock("@/react-app/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

class MockIntersectionObserver {
  observe    = vi.fn();
  disconnect = vi.fn();
  unobserve  = vi.fn();
  constructor(_cb: IntersectionObserverCallback, _opts?: IntersectionObserverInit) {}
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const assignMock = vi.fn();
Object.defineProperty(window, "location", {
  value: { assign: assignMock },
  configurable: true,
  writable: true,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUTH_ANONYMOUS    = { user: null, isPending: false };
const AUTH_PENDING      = { user: null, isPending: true };
const AUTH_AUTENTICADO  = {
  user: { id: "1", email: "owner@test.com", email_verified: true },
  isPending: false,
};

function renderPage(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<div>dashboard page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue(AUTH_ANONYMOUS);
  global.fetch = vi.fn();
});

// ─── WaveBackground ───────────────────────────────────────────────────────────

describe("WaveBackground", () => {
  it("renderiza un elemento SVG en el DOM", () => {
    const { container } = renderPage();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renderiza exactamente 6 paths de onda en el SVG de fondo", () => {
    const { container } = renderPage();
    // El SVG de olas tiene viewBox "0 0 1440 900", a diferencia de los iconos Lucide
    const waveSvg = container.querySelector('svg[viewBox="0 0 1440 900"]');
    expect(waveSvg).toBeInTheDocument();
    expect(waveSvg?.querySelectorAll("path")).toHaveLength(6);
  });

  it("los paths de onda tienen fill='none' (líneas, no formas)", () => {
    const { container } = renderPage();
    const waveSvg = container.querySelector('svg[viewBox="0 0 1440 900"]');
    waveSvg?.querySelectorAll("path").forEach((path) => {
      expect(path.getAttribute("fill")).toBe("none");
    });
  });

  it("el SVG de olas tiene preserveAspectRatio='xMidYMid slice'", () => {
    const { container } = renderPage();
    const waveSvg = container.querySelector('svg[viewBox="0 0 1440 900"]');
    expect(waveSvg?.getAttribute("preserveAspectRatio")).toBe("xMidYMid slice");
  });
});

// ─── Renderizado general ──────────────────────────────────────────────────────

describe("LandingPage — renderizado", () => {
  it("muestra el nombre de marca 'La Hoja'", () => {
    renderPage();
    // Aparece en navbar y footer
    expect(screen.getAllByText("La Hoja").length).toBeGreaterThanOrEqual(1);
  });

  it("renderiza los links de navegación con sus anclas correctas", () => {
    renderPage();
    // "Problemas" solo aparece en el navbar
    expect(screen.getByRole("link", { name: "Problemas" })).toHaveAttribute("href", "#problemas");
    // "Módulos" y "¿Cómo funciona?" aparecen en navbar y footer; verificamos que al menos uno apunta al ancla correcta
    const modulosLinks = screen.getAllByRole("link", { name: "Módulos" });
    expect(modulosLinks.length).toBeGreaterThanOrEqual(1);
    modulosLinks.forEach((l) => expect(l).toHaveAttribute("href", "#modulos"));
    const comoLinks = screen.getAllByRole("link", { name: "¿Cómo funciona?" });
    expect(comoLinks.length).toBeGreaterThanOrEqual(1);
    comoLinks.forEach((l) => expect(l).toHaveAttribute("href", "#como-funciona"));
  });

  it("renderiza el h1 del hero con el texto correcto", () => {
    renderPage();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(/Tu restaurante/i);
    expect(h1).toHaveTextContent(/ordenado y en control/i);
  });

  it("renderiza el botón de login en la navbar", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("renderiza los botones 'Empezá gratis' (hero + CTA final)", () => {
    renderPage();
    const ctaBtns = screen.getAllByRole("button", { name: /empezá gratis/i });
    expect(ctaBtns.length).toBeGreaterThanOrEqual(2);
  });

  it("renderiza la sección de pain points con su heading", () => {
    renderPage();
    expect(screen.getByText(/Los problemas que tiene/i)).toBeInTheDocument();
  });

  it("renderiza las 6 tarjetas de problemas", () => {
    renderPage();
    // Textos únicos de cada tarjeta de pain point
    const problems = [
      /sueldos en planillas/i,
      /qué compraste/i,
      /turnos se coordinan por WhatsApp/i,  // más específico que solo "WhatsApp"
      /facturas se acumulan/i,
      /cuánto gastás ni en qué áreas/i,
      /acceso parcial/i,
    ];
    // getAllByText porque el texto aparece tanto en el <p> como en su <div> padre
    problems.forEach((pattern) => {
      expect(screen.getAllByText(pattern).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renderiza la sección de módulos con su heading", () => {
    renderPage();
    expect(screen.getByText(/Un sistema, seis herramientas/i)).toBeInTheDocument();
  });

  it("renderiza los 6 títulos de módulo", () => {
    renderPage();
    ["Personal", "Calendario de Turnos", "Sueldos", "Compras", "Facturación", "Seguimiento"].forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });

  it("cada módulo muestra su beneficio en verde", () => {
    renderPage();
    expect(screen.getByText(/Sin papeles, sin confusiones/i)).toBeInTheDocument();
    expect(screen.getByText(/Adiós a los grupos de WhatsApp/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin errores de cálculo/i)).toBeInTheDocument();
  });

  it("renderiza la sección '¿Cómo funciona?' con los 3 pasos", () => {
    renderPage();
    // El h2 es el único heading con ese texto; los links tienen el mismo texto pero son <a>
    expect(screen.getByRole("heading", { name: /¿Cómo funciona\?/i })).toBeInTheDocument();
    expect(screen.getByText(/Creá tu cuenta con Google/i)).toBeInTheDocument();
    expect(screen.getByText(/Activá los módulos que necesitás/i)).toBeInTheDocument();
    expect(screen.getByText(/Gestioná desde cualquier lugar/i)).toBeInTheDocument();
  });

  it("renderiza las 4 estadísticas de confianza", () => {
    renderPage();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("módulos integrados")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("instalaciones necesarias")).toBeInTheDocument();
  });

  it("renderiza el footer con copyright", () => {
    renderPage();
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });
});

// ─── Comportamiento de autenticación ─────────────────────────────────────────

describe("LandingPage — autenticación", () => {
  it("redirige a /dashboard cuando el usuario está autenticado", () => {
    mockUseAuth.mockReturnValue(AUTH_AUTENTICADO);
    renderPage();
    expect(screen.getByText("dashboard page")).toBeInTheDocument();
  });

  it("no redirige mientras isPending es true (aunque user sea null)", () => {
    mockUseAuth.mockReturnValue(AUTH_PENDING);
    renderPage();
    expect(screen.queryByText("dashboard page")).toBeNull();
    expect(screen.getAllByText("La Hoja").length).toBeGreaterThanOrEqual(1);
  });

  it("muestra el banner de email verificado con ?verified=true", () => {
    renderPage("/?verified=true");
    expect(screen.getByText(/Email verificado/i)).toBeInTheDocument();
  });

  it("no muestra el banner de verificación sin el query param", () => {
    renderPage("/");
    expect(screen.queryByText(/Email verificado/i)).toBeNull();
  });
});

// ─── Flujo de login ───────────────────────────────────────────────────────────

describe("LandingPage — login", () => {
  it("al hacer clic en login llama a /api/oauth/google/redirect_url y redirige", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: { redirect_url: "https://accounts.google.com/o/oauth2/auth" },
      }),
    });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/oauth/google/redirect_url");
      expect(assignMock).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/auth");
    });
  });

  it("muestra 'Conectando...' y spinner mientras espera el redirect", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByText("Conectando...")).toBeInTheDocument();
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  it("el botón queda deshabilitado durante la carga", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

    renderPage();
    const btn = screen.getByRole("button", { name: /iniciar sesión/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText("Conectando...").closest("button")).toBeDisabled();
    });
  });

  it("vuelve a habilitar el botón si fetch falla", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /iniciar sesión/i })).not.toBeDisabled();
    });
  });
});
