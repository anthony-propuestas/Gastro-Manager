import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import Settings from "./Settings";

const mockNavigate = vi.fn();
vi.mock("react-router", () => ({ useNavigate: () => mockNavigate }));
vi.mock("@/react-app/context/AuthContext");
vi.mock("@/react-app/context/ModulePrefsContext");
vi.mock("@/react-app/hooks/useNegocios");
vi.mock("@/react-app/lib/api", () => ({
  apiFetch: vi.fn(() => new Promise(() => {})),
}));

import { useAuth } from "@/react-app/context/AuthContext";
import { useModulePrefsContext } from "@/react-app/context/ModulePrefsContext";
import { useNegocios } from "@/react-app/hooks/useNegocios";

const mockUseAuth = vi.mocked(useAuth);
const mockUseModulePrefsContext = vi.mocked(useModulePrefsContext);
const mockUseNegocios = vi.mocked(useNegocios);

const USER = {
  id: "user-1",
  name: "Ana García",
  email: "ana@test.com",
  picture: null as string | null,
  role: "usuario_basico" as string,
};

const BASE_AUTH = {
  user: USER,
  currentNegocio: { id: 1, name: "Mi Negocio" } as any,
  setCurrentNegocio: vi.fn(),
  refreshNegocios: vi.fn(),
};

const BASE_PREFS = {
  prefs: { calendario: true, personal: true, sueldos: true, compras: true, facturacion: true },
  toggleModule: vi.fn(),
  negocioRestrictions: {} as any,
  isGerente: false,
};

const BASE_NEGOCIOS = {
  isLoading: false,
  error: null as string | null,
  getNegocioDetail: vi.fn(() => new Promise(() => {})),
  removeMember: vi.fn(),
  leaveNegocio: vi.fn(),
  createNegocio: vi.fn(),
  generateInvitation: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue(BASE_AUTH as any);
  mockUseModulePrefsContext.mockReturnValue(BASE_PREFS as any);
  mockUseNegocios.mockReturnValue(BASE_NEGOCIOS as any);
});

// ─── Perfil ───────────────────────────────────────────────────────────────────

describe("Settings — perfil", () => {
  it("muestra el nombre del usuario", () => {
    render(<Settings />);
    expect(screen.getByText("Ana García")).toBeInTheDocument();
  });

  it("muestra el email del usuario", () => {
    render(<Settings />);
    expect(screen.getByText("ana@test.com")).toBeInTheDocument();
  });

  it("muestra el inicial del nombre cuando no hay picture", () => {
    render(<Settings />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});

// ─── Módulos ──────────────────────────────────────────────────────────────────

describe("Settings — módulos", () => {
  it("renderiza todos los módulos", () => {
    render(<Settings />);
    expect(screen.getByText("Compras")).toBeInTheDocument();
    expect(screen.getByText("Facturación")).toBeInTheDocument();
    expect(screen.getByText("Sueldos")).toBeInTheDocument();
  });

  it("llama toggleModule al hacer click en un switch", () => {
    const toggleModule = vi.fn();
    mockUseModulePrefsContext.mockReturnValue({ ...BASE_PREFS, toggleModule } as any);
    render(<Settings />);
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);
    expect(toggleModule).toHaveBeenCalledTimes(1);
  });
});
