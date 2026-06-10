import { render, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); });

function res(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

let authRef: ReturnType<typeof useAuth> | null = null;
function TestChild() {
  authRef = useAuth();
  return null;
}

// ─── /api/users/me con Bearer token ──────────────────────────────────────────

describe("AuthProvider — Bearer token en /api/users/me", () => {
  it("incluye Authorization Bearer cuando bearer_token está en localStorage", async () => {
    localStorage.setItem("bearer_token", "my-jwt");
    mockFetch.mockResolvedValue(res({ data: null }));

    render(
      <AuthProvider>
        <TestChild />
      </AuthProvider>
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts?.headers?.Authorization).toBe("Bearer my-jwt");
  });

  it("NO incluye Authorization cuando bearer_token no está en localStorage", async () => {
    mockFetch.mockResolvedValue(res({ data: null }));

    render(
      <AuthProvider>
        <TestChild />
      </AuthProvider>
    );

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts).toBeUndefined();
  });
});

// ─── logout limpia bearer_token ───────────────────────────────────────────────

describe("AuthProvider — logout", () => {
  it("elimina bearer_token de localStorage al hacer logout", async () => {
    localStorage.setItem("bearer_token", "my-jwt");
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { assign: assignMock },
      configurable: true,
      writable: true,
    });

    mockFetch
      .mockResolvedValueOnce(res({ data: { id: "1", email: "a@b.com", name: "A", picture: "", role: "usuario_basico", email_verified: true, suscripcion: null } }))
      .mockResolvedValueOnce(res({ success: true, data: [] })) // /api/negocios
      .mockResolvedValue(res({})); // /api/logout

    render(
      <AuthProvider>
        <TestChild />
      </AuthProvider>
    );

    await waitFor(() => expect(authRef?.user).not.toBeNull());

    await act(async () => { await authRef!.logout(); });

    expect(localStorage.getItem("bearer_token")).toBeNull();
  });
});
