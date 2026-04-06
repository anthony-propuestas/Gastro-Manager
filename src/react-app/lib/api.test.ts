import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/react-app/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("injects the negocio header when negocioId exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/employees", { method: "GET" }, 12);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/employees",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Negocio-ID": "12",
        }),
      })
    );
  });

  it("does not inject the negocio header when negocioId is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/employees", { method: "POST" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/employees",
      expect.objectContaining({
        method: "POST",
        headers: expect.not.objectContaining({
          "X-Negocio-ID": expect.any(String),
        }),
      })
    );
  });
});