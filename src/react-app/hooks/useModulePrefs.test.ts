import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useModulePrefs } from "@/react-app/hooks/useModulePrefs";

const mockUseAuth = vi.fn();
const mockApiFetch = vi.fn();

vi.mock("@/react-app/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/react-app/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

function jsonResponse(data: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    })
  );
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

describe("useModulePrefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, currentNegocio: null });
    mockApiFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), {
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps default prefs and skips fetches when there is no user", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useModulePrefs());

    expect(result.current.prefs).toEqual({ calendario: true, personal: true, sueldos: true });
    expect(result.current.negocioRestrictions).toEqual({ calendario: false, personal: false, sueldos: false });
    expect(result.current.isGerente).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("loads prefs and negocio restrictions for authenticated users", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", email: "user@example.com" },
      currentNegocio: { id: 12, name: "Local", my_role: "gerente" },
    });

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/modules/prefs") {
        return jsonResponse({
          success: true,
          data: { calendario: true, personal: false, sueldos: true },
        });
      }

      return jsonResponse({ success: true });
    });

    vi.stubGlobal("fetch", fetchMock);
    mockApiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: { personal: true } }),
        { headers: { "Content-Type": "application/json" } }
      )
    );

    const { result } = renderHook(() => useModulePrefs());

    await waitFor(() => {
      expect(result.current.prefs.personal).toBe(false);
      expect(result.current.negocioRestrictions.personal).toBe(true);
    });

    expect(result.current.isGerente).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/modules/prefs");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/negocios/12/module-restrictions",
      {},
      12
    );
  });

  it("keeps default prefs and logs when the prefs response shape is invalid", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", email: "user@example.com" },
      currentNegocio: null,
    });

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ nope: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useModulePrefs());

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });

    expect(result.current.prefs).toEqual({ calendario: true, personal: true, sueldos: true });
  });

  it("applies optimistic updates and keeps them on successful toggle", async () => {
    const fetchState = deferredResponse();
    const fetchMock = vi.fn().mockReturnValue(fetchState.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useModulePrefs());

    let togglePromise!: Promise<void>;
    await act(async () => {
      togglePromise = result.current.toggleModule("personal");
    });

    expect(result.current.prefs.personal).toBe(false);

    await act(async () => {
      fetchState.resolve(
        new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        })
      );
      await togglePromise;
    });

    expect(result.current.prefs.personal).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("/api/modules/prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module_key: "personal", is_active: false }),
    });
  });

  it("reverts optimistic updates when the toggle request fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false }), {
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useModulePrefs());

    await act(async () => {
      await result.current.toggleModule("personal");
    });

    expect(result.current.prefs.personal).toBe(true);
    expect(consoleError).toHaveBeenCalled();
  });
});