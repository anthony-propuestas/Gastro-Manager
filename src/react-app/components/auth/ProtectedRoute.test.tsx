import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import ProtectedRoute, { RestrictedModuleRoute } from "@/react-app/components/auth/ProtectedRoute";

const mockUseAuth = vi.fn();
const mockUseModulePrefsContext = vi.fn();

vi.mock("@/react-app/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/react-app/context/ModulePrefsContext", () => ({
  useModulePrefsContext: () => mockUseModulePrefsContext(),
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseModulePrefsContext.mockReturnValue({
      negocioRestrictions: { calendario: false, personal: false, sueldos: false },
      isGerente: false,
    });
  });

  it("renders a loading state while auth is pending", () => {
    mockUseAuth.mockReturnValue({ user: null, isPending: true, currentNegocio: null });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <ProtectedRoute>
          <div>private page</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });

  it("redirects anonymous users to login", () => {
    mockUseAuth.mockReturnValue({ user: null, isPending: false, currentNegocio: null });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>private page</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("redirects unverified users to verify-email", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", email: "user@example.com", email_verified: false },
      isPending: false,
      currentNegocio: null,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>private page</div>
              </ProtectedRoute>
            }
          />
          <Route path="/verify-email" element={<div>verify email page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("verify email page")).toBeInTheDocument();
  });

  it("redirects authenticated users without negocio to setup", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", email: "user@example.com", email_verified: true },
      isPending: false,
      currentNegocio: null,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>private page</div>
              </ProtectedRoute>
            }
          />
          <Route path="/negocio/setup" element={<div>setup page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("setup page")).toBeInTheDocument();
  });

  it("allows the setup route without an active negocio", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", email: "user@example.com", email_verified: true },
      isPending: false,
      currentNegocio: null,
    });

    render(
      <MemoryRouter initialEntries={["/negocio/setup"]}>
        <Routes>
          <Route
            path="/negocio/setup"
            element={
              <ProtectedRoute>
                <div>setup content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("setup content")).toBeInTheDocument();
  });

  it("renders protected content when auth and negocio are available", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", email: "user@example.com", email_verified: true },
      isPending: false,
      currentNegocio: { id: 9, name: "Local", my_role: "owner" },
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>private page</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("private page")).toBeInTheDocument();
  });
});

describe("RestrictedModuleRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "1", email: "user@example.com" },
      isPending: false,
      currentNegocio: { id: 9, name: "Local", my_role: "gerente" },
    });
  });

  it("redirects gerente users when the module is restricted", () => {
    mockUseModulePrefsContext.mockReturnValue({
      negocioRestrictions: { calendario: false, personal: true, sueldos: false },
      isGerente: true,
    });

    render(
      <MemoryRouter initialEntries={["/empleados"]}>
        <Routes>
          <Route
            path="/empleados"
            element={
              <RestrictedModuleRoute moduleKey="personal">
                <div>employees page</div>
              </RestrictedModuleRoute>
            }
          />
          <Route path="/" element={<div>home page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("home page")).toBeInTheDocument();
  });

  it("renders children when the module is available", () => {
    mockUseModulePrefsContext.mockReturnValue({
      negocioRestrictions: { calendario: false, personal: false, sueldos: false },
      isGerente: true,
    });

    render(
      <MemoryRouter initialEntries={["/empleados"]}>
        <Routes>
          <Route
            path="/empleados"
            element={
              <RestrictedModuleRoute moduleKey="personal">
                <div>employees page</div>
              </RestrictedModuleRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("employees page")).toBeInTheDocument();
  });
});