import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSuscripcion } from "@/react-app/hooks/useSuscripcion";

function jsonOk(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function jsonError(error: unknown, status: number) {
  return Promise.resolve(
    new Response(JSON.stringify({ error }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

const ESTADO_NULL = { data: null };
const ESTADO_ACTIVA = {
  data: {
    id: 1, user_id: "u1", mp_preapproval_id: "pa1", estado: "autorizada",
    fecha_inicio: null, proximo_cobro: null, ultimo_pago_ok: null,
    grace_deadline: null, grace_days_left: null, monto: 15000,
    moneda: "ARS", payer_email: "test@test.com",
    created_at: "2026-01-01", updated_at: "2026-01-01",
  },
};

describe("useSuscripcion — estado inicial y carga en mount", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("empieza con isLoading true, suscripcion null, pagos vacíos y sin error", () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSuscripcion());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.suscripcion).toBeNull();
    expect(result.current.pagos).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("llama /api/suscripciones/estado al montar y setea suscripcion", async () => {
    fetchMock.mockResolvedValue(jsonOk(ESTADO_ACTIVA));
    const { result } = renderHook(() => useSuscripcion());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith("/api/suscripciones/estado");
    expect(result.current.suscripcion).toMatchObject({ id: 1, estado: "autorizada" });
  });

  it("setea suscripcion como null cuando la API devuelve data: null", async () => {
    fetchMock.mockResolvedValue(jsonOk(ESTADO_NULL));
    const { result } = renderHook(() => useSuscripcion());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.suscripcion).toBeNull();
  });

  it("setea error cuando fetchEstado falla por red", async () => {
    fetchMock.mockRejectedValue(new Error("network fail"));
    const { result } = renderHook(() => useSuscripcion());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Error al cargar el estado de la suscripción");
  });
});

describe("useSuscripcion — crear()", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // primera llamada: fetchEstado en mount
    fetchMock.mockResolvedValueOnce(jsonOk(ESTADO_NULL));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("en éxito retorna init_point y llama fetchEstado", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ success: true, data: { init_point: "https://mp.com/pay" } }, 201))
      .mockResolvedValueOnce(jsonOk(ESTADO_ACTIVA));

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let initPoint: string | null;
    await act(async () => { initPoint = await result.current.crear(); });

    expect(initPoint!).toBe("https://mp.com/pay");
    expect(result.current.suscripcion).toMatchObject({ estado: "autorizada" });
    expect(result.current.error).toBeNull();
  });

  it("en éxito resetea isLoading a false", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ success: true, data: { init_point: "https://mp.com/pay" } }, 201))
      .mockResolvedValueOnce(jsonOk(ESTADO_NULL));

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.crear(); });

    expect(result.current.isLoading).toBe(false);
  });

  it("400 ALREADY_SUBSCRIBED → setea error con message del error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonError({ code: "ALREADY_SUBSCRIBED", message: "Ya tienes una suscripción activa" }, 400)
    );

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ret: string | null;
    await act(async () => { ret = await result.current.crear(); });

    expect(ret!).toBeNull();
    expect(result.current.error).toBe("Ya tienes una suscripción activa");
  });

  it("502 MP_NETWORK_ERROR → mensaje de conexión con código", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonError({ code: "MP_NETWORK_ERROR", message: "...", mp_status: null, mp_detail: null }, 502)
    );

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.crear(); });

    expect(result.current.error).toBe(
      "No se pudo conectar con Mercado Pago. Verificá tu conexión a internet. (MP_NETWORK_ERROR)"
    );
  });

  it("502 MP_AUTH_ERROR → mensaje de credenciales con código", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonError({ code: "MP_AUTH_ERROR", message: "...", mp_status: 401, mp_detail: null }, 502)
    );

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.crear(); });

    expect(result.current.error).toBe(
      "Credenciales de Mercado Pago inválidas. Contactá al soporte. (MP_AUTH_ERROR — 401)"
    );
  });

  it("502 MP_VALIDATION_ERROR con mp_detail → incluye detalle de MP", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonError({ code: "MP_VALIDATION_ERROR", message: "...", mp_status: 400, mp_detail: "Invalid preapproval_plan_id" }, 502)
    );

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.crear(); });

    expect(result.current.error).toBe(
      "Mercado Pago rechazó la solicitud: Invalid preapproval_plan_id (MP_VALIDATION_ERROR — 400)"
    );
  });

  it("502 MP_VALIDATION_ERROR sin mp_detail → mensaje de fallback", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonError({ code: "MP_VALIDATION_ERROR", message: "...", mp_status: 400, mp_detail: null }, 502)
    );

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.crear(); });

    expect(result.current.error).toBe(
      "Solicitud rechazada por Mercado Pago. Revisá la configuración. (MP_VALIDATION_ERROR — 400)"
    );
  });

  it("502 MP_SERVER_ERROR → mensaje de problemas en MP con código", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonError({ code: "MP_SERVER_ERROR", message: "...", mp_status: 503, mp_detail: null }, 502)
    );

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.crear(); });

    expect(result.current.error).toBe(
      "Mercado Pago está experimentando problemas. Intentá más tarde. (MP_SERVER_ERROR — 503)"
    );
  });

  it("502 MP_NO_INIT_POINT → mensaje de enlace no generado", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonError({ code: "MP_NO_INIT_POINT", message: "...", mp_status: 200, mp_detail: null }, 502)
    );

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.crear(); });

    expect(result.current.error).toBe(
      "Mercado Pago no generó el enlace de pago. Intentá de nuevo. (MP_NO_INIT_POINT — 200)"
    );
  });

  it("502 código desconocido con mp_detail → mensaje genérico con detalle", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonError({ code: "MP_UNKNOWN", message: "...", mp_status: 422, mp_detail: "Cuenta suspendida" }, 502)
    );

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.crear(); });

    expect(result.current.error).toBe(
      "Error de Mercado Pago: Cuenta suspendida (MP_UNKNOWN — 422)"
    );
  });

  it("502 código desconocido sin mp_detail → fallback genérico", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonError({ code: "MP_UNKNOWN", message: "...", mp_status: null, mp_detail: null }, 502)
    );

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.crear(); });

    expect(result.current.error).toBe(
      "Mercado Pago no respondió correctamente. Intentá de nuevo. (MP_UNKNOWN)"
    );
  });

  it("error sin código usa ERROR como fallback", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: {} }), { status: 400, headers: { "Content-Type": "application/json" } })
    );

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.crear(); });

    expect(result.current.error).toBe("Error al crear suscripción");
  });

  it("fetch throws → setea 'Error de red al crear suscripción' y retorna null", async () => {
    fetchMock.mockRejectedValueOnce(new Error("timeout"));

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ret: string | null;
    await act(async () => { ret = await result.current.crear(); });

    expect(ret!).toBeNull();
    expect(result.current.error).toBe("Error de red al crear suscripción");
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useSuscripcion — cancelar()", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonOk(ESTADO_ACTIVA));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("en éxito retorna true y llama fetchEstado", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ success: true, data: { cancelled: true } }))
      .mockResolvedValueOnce(jsonOk(ESTADO_NULL));

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ret: boolean;
    await act(async () => { ret = await result.current.cancelar(); });

    expect(ret!).toBe(true);
    expect(result.current.suscripcion).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("en error retorna false y setea el mensaje de error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonError({ code: "NOT_FOUND", message: "No hay suscripción activa" }, 404)
    );

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ret: boolean;
    await act(async () => { ret = await result.current.cancelar(); });

    expect(ret!).toBe(false);
    expect(result.current.error).toBe("No hay suscripción activa");
  });

  it("fetch throws → retorna false y setea error de red", async () => {
    fetchMock.mockRejectedValueOnce(new Error("timeout"));

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ret: boolean;
    await act(async () => { ret = await result.current.cancelar(); });

    expect(ret!).toBe(false);
    expect(result.current.error).toBe("Error de red al cancelar suscripción");
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useSuscripcion — fetchPagos()", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(jsonOk(ESTADO_NULL));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("setea pagos con la lista recibida", async () => {
    const mockPagos = [{ id: 1, estado_pago: "approved", monto: 15000, moneda: "ARS", fecha_pago: "2026-01-01", suscripcion_id: 1, mp_payment_id: "p1", razon_rechazo: null, created_at: "2026-01-01" }];
    fetchMock.mockResolvedValueOnce(jsonOk({ success: true, data: mockPagos }));

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.fetchPagos(); });

    expect(result.current.pagos).toHaveLength(1);
    expect(result.current.pagos[0]).toMatchObject({ id: 1, estado_pago: "approved" });
  });

  it("no modifica estado de error si la respuesta no es ok", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "fail" }), { status: 500, headers: { "Content-Type": "application/json" } })
    );

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.fetchPagos(); });

    expect(result.current.error).toBeNull();
    expect(result.current.pagos).toEqual([]);
  });

  it("no modifica estado de error si fetch lanza excepción", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useSuscripcion());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.fetchPagos(); });

    expect(result.current.error).toBeNull();
  });
});
