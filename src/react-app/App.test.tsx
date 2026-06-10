import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, useNavigate } from "react-router";
import { DeepLinkHandler } from "./App";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockIsNativePlatform = vi.fn(() => false);
vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  return { ...actual, Capacitor: { isNativePlatform: () => mockIsNativePlatform() } };
});

const mockAddListener = vi.fn();
vi.mock("@capacitor/app", () => ({
  App: { addListener: (...args: unknown[]) => mockAddListener(...args) },
}));

const mockNavigate = vi.fn();
vi.mock("react-router", async (importActual) => {
  const actual = await importActual<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderComponent() {
  return render(
    <MemoryRouter>
      <DeepLinkHandler />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAddListener.mockReturnValue(Promise.resolve({ remove: vi.fn() }));
});

// ─── Plataforma web ───────────────────────────────────────────────────────────

describe("DeepLinkHandler — plataforma web", () => {
  it("no registra listener cuando no está en plataforma nativa", () => {
    mockIsNativePlatform.mockReturnValue(false);
    renderComponent();
    expect(mockAddListener).not.toHaveBeenCalled();
  });
});

// ─── Plataforma nativa ────────────────────────────────────────────────────────

describe("DeepLinkHandler — plataforma nativa", () => {
  beforeEach(() => {
    mockIsNativePlatform.mockReturnValue(true);
  });

  it("registra listener 'appUrlOpen' al montar", () => {
    renderComponent();
    expect(mockAddListener).toHaveBeenCalledWith("appUrlOpen", expect.any(Function));
  });

  it("navega a la ruta cuando recibe URL con protocolo org.lahoja.app:", async () => {
    let capturedCallback: ((event: { url: string }) => void) | null = null;
    mockAddListener.mockImplementation((_event: string, cb: (e: { url: string }) => void) => {
      capturedCallback = cb;
      return Promise.resolve({ remove: vi.fn() });
    });

    renderComponent();

    await waitFor(() => expect(capturedCallback).not.toBeNull());

    capturedCallback!({ url: "org.lahoja.app://auth/callback?code=abc" });

    // URL parsing: host="auth", pathname="/callback" — actual extracted path
    expect(mockNavigate).toHaveBeenCalledWith("/callback?code=abc", { replace: true });
  });

  it("no navega cuando la URL tiene un protocolo distinto", async () => {
    let capturedCallback: ((event: { url: string }) => void) | null = null;
    mockAddListener.mockImplementation((_event: string, cb: (e: { url: string }) => void) => {
      capturedCallback = cb;
      return Promise.resolve({ remove: vi.fn() });
    });

    renderComponent();

    await waitFor(() => expect(capturedCallback).not.toBeNull());

    capturedCallback!({ url: "https://example.com/auth/callback" });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ─── Deep link /session ───────────────────────────────────────────────────────

describe("DeepLinkHandler — deep link /session", () => {
  beforeEach(() => {
    mockIsNativePlatform.mockReturnValue(true);
  });

  it("guarda bearer_token en localStorage y navega a /agente-ia al recibir /session?token=...", async () => {
    let capturedCallback: ((event: { url: string }) => void) | null = null;
    mockAddListener.mockImplementation((_event: string, cb: (e: { url: string }) => void) => {
      capturedCallback = cb;
      return Promise.resolve({ remove: vi.fn() });
    });

    renderComponent();
    await waitFor(() => expect(capturedCallback).not.toBeNull());

    capturedCallback!({ url: "org.lahoja.app://session?token=my-jwt-token" });

    expect(localStorage.getItem("bearer_token")).toBe("my-jwt-token");
    expect(mockNavigate).toHaveBeenCalledWith("/agente-ia", { replace: true });
  });

  it("no navega si el token está ausente en /session", async () => {
    let capturedCallback: ((event: { url: string }) => void) | null = null;
    mockAddListener.mockImplementation((_event: string, cb: (e: { url: string }) => void) => {
      capturedCallback = cb;
      return Promise.resolve({ remove: vi.fn() });
    });

    renderComponent();
    await waitFor(() => expect(capturedCallback).not.toBeNull());

    capturedCallback!({ url: "org.lahoja.app://session" });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
