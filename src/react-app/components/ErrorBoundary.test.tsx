import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ErrorBoundary, PageErrorBoundary } from "@/react-app/components/ErrorBoundary";

// Componente auxiliar que lanza un error según la prop
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("boom");
  return <div>contenido seguro</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React llama a console.error internamente al capturar errores en un boundary
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>contenido ok</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("contenido ok")).toBeInTheDocument();
  });

  it("shows default error UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
  });

  it("uses the fallback prop instead of the default UI", () => {
    render(
      <ErrorBoundary fallback={<div>error personalizado</div>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("error personalizado")).toBeInTheDocument();
    expect(screen.queryByText("Algo salió mal")).not.toBeInTheDocument();
  });

  it("restores children after clicking Intentar de nuevo", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function ControlledBomb() {
      if (shouldThrow) throw new Error("boom");
      return <div>contenido seguro</div>;
    }

    render(
      <ErrorBoundary>
        <ControlledBomb />
      </ErrorBoundary>
    );

    expect(screen.getByText("Algo salió mal")).toBeInTheDocument();

    // Desactivar el error antes de hacer click para que el re-render no vuelva a lanzar
    shouldThrow = false;
    await user.click(screen.getByRole("button", { name: /Intentar de nuevo/i }));

    expect(screen.getByText("contenido seguro")).toBeInTheDocument();
  });
});

describe("PageErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows its own fallback when a child throws", () => {
    render(
      <PageErrorBoundary>
        <Bomb shouldThrow={true} />
      </PageErrorBoundary>
    );

    expect(screen.getByText("Error al cargar esta sección")).toBeInTheDocument();
  });
});
