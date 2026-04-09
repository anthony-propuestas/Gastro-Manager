import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UsageLimitModalProvider } from "@/react-app/context/UsageLimitModalContext";
import {
  USAGE_LIMIT_EVENT,
  type UsageLimitEventDetail,
} from "@/react-app/lib/usageLimitModal";

async function dispatchUsageLimit(detail: UsageLimitEventDetail) {
  await act(async () => {
    window.dispatchEvent(new CustomEvent<UsageLimitEventDetail>(USAGE_LIMIT_EVENT, { detail }));
    await Promise.resolve();
  });
}

function renderProvider() {
  return render(
    <UsageLimitModalProvider>
      <div>app content</div>
    </UsageLimitModalProvider>
  );
}

const baseDetail: UsageLimitEventDetail = {
  endpoint: "/api/chat",
  moduleLabel: "Chat IA",
  message: "Límite mensual alcanzado (20). Actualiza a Usuario Inteligente para continuar.",
  limit: 20,
  occurredAt: Date.now(),
};

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("UsageLimitModalProvider", () => {
  it("opens the modal when USAGE_LIMIT_EVENT is dispatched and renders the dynamic content", () => {
    renderProvider();

    return dispatchUsageLimit(baseDetail).then(async () => {
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      expect(screen.getByText("Tu límite mensual de Chat IA ya se completó")).toBeInTheDocument();
      expect(screen.getByText(/Tu límite actual en Chat IA es de 20 usos por mes/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Subir a inteligente/i })).toBeInTheDocument();
      expect(document.body.style.overflow).toBe("hidden");
    });
  });

  it("closes the modal when Escape is pressed and restores body overflow", async () => {
    const user = userEvent.setup();
    renderProvider();

    await dispatchUsageLimit(baseDetail);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(document.body.style.overflow).toBe("");
  });

  it("closes the modal when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    renderProvider();

    await dispatchUsageLimit({
      ...baseDetail,
      moduleLabel: "Facturación",
      limit: null,
      message: "Límite mensual alcanzado. Actualiza a Usuario Inteligente para continuar.",
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByText("Tu límite mensual de Facturación ya se completó")).toBeInTheDocument();
    expect(screen.getByText(/Tu límite mensual en Facturación ya fue alcanzado/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cerrar modal de límite de uso/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});