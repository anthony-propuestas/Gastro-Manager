import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Crown, Sparkles, X } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import {
  USAGE_LIMIT_EVENT,
  type UsageLimitEventDetail,
} from "@/react-app/lib/usageLimitModal";

interface UsageLimitModalContextValue {
  openUsageLimitModal: (detail: UsageLimitEventDetail) => void;
  closeUsageLimitModal: () => void;
}

const UsageLimitModalContext = createContext<UsageLimitModalContextValue | null>(null);

function UsageLimitUpgradeModal({
  detail,
  onClose,
}: {
  detail: UsageLimitEventDetail;
  onClose: () => void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 sm:p-8">
      <button
        aria-label="Cerrar modal de límite de uso"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={onClose}
        type="button"
      />

      <div
        aria-describedby="usage-limit-modal-description"
        aria-labelledby="usage-limit-modal-title"
        aria-modal="true"
        className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-card shadow-2xl sm:min-h-[50vh] sm:w-[min(50vw,52rem)] sm:grid-cols-[0.92fr_1.08fr] animate-usage-modal-grow"
        role="dialog"
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-primary via-emerald-500 to-amber-400 p-6 text-white sm:p-8">
          <div className="absolute -right-14 top-8 h-36 w-36 rounded-full bg-white/12 blur-2xl" />
          <div className="absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-black/10 blur-3xl" />

          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium backdrop-blur-sm">
              <Sparkles className="h-4 w-4" />
              Plan Inteligente
            </div>

            <div className="space-y-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/18 backdrop-blur-sm">
                <Crown className="h-7 w-7" />
              </div>
              <p className="max-w-xs text-sm leading-6 text-white/85 sm:text-base">
                Da el siguiente paso cuando lo necesites y mantén tu ritmo de trabajo con una experiencia más fluida.
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col bg-card p-6 sm:p-8">
          <button
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mt-8 flex h-full flex-col justify-between gap-8 sm:mt-0">
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary/80">
                  Usuario básico
                </p>
                <h2 id="usage-limit-modal-title" className="max-w-md text-3xl font-serif font-semibold leading-tight text-foreground sm:text-4xl">
                  Tu límite mensual de {detail.moduleLabel} ya se completó
                </h2>
              </div>

              <p id="usage-limit-modal-description" className="max-w-xl text-base leading-7 text-muted-foreground">
                Si quieres seguir usando esta herramienta sin pausas, Usuario Inteligente te da más continuidad para trabajar con tranquilidad.
              </p>

              <div className="rounded-3xl border border-border/80 bg-muted/40 p-4 sm:p-5">
                <p className="text-sm font-medium text-foreground">
                  {detail.limit !== null
                    ? `Tu límite actual en ${detail.moduleLabel} es de ${detail.limit} usos por mes.`
                    : `Tu límite mensual en ${detail.moduleLabel} ya fue alcanzado.`}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Podrás seguir avanzando sin depender de este tope mensual y con una experiencia más cómoda en tu operación diaria.
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground/90">
                  {detail.message}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button onClick={onClose} size="lg" variant="outline" type="button">
                Ahora no
              </Button>
              <Button
                className="bg-gradient-to-r from-primary via-emerald-500 to-emerald-600 text-white hover:opacity-90"
                onClick={() => {
                  // TODO: conectar este CTA con el flujo real de upgrade a Usuario Inteligente.
                  // TODO: cuando exista checkout o contacto comercial, registrar analytics y navegar al siguiente paso.
                }}
                size="lg"
                type="button"
              >
                Subir a inteligente
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UsageLimitModalProvider({ children }: { children: ReactNode }) {
  const [detail, setDetail] = useState<UsageLimitEventDetail | null>(null);

  const closeUsageLimitModal = useCallback(() => {
    setDetail(null);
  }, []);

  const openUsageLimitModal = useCallback((nextDetail: UsageLimitEventDetail) => {
    setDetail({ ...nextDetail });
  }, []);

  useEffect(() => {
    const handleUsageLimitEvent = (event: Event) => {
      const customEvent = event as CustomEvent<UsageLimitEventDetail>;
      if (!customEvent.detail) return;
      openUsageLimitModal(customEvent.detail);
    };

    window.addEventListener(USAGE_LIMIT_EVENT, handleUsageLimitEvent);
    return () => {
      window.removeEventListener(USAGE_LIMIT_EVENT, handleUsageLimitEvent);
    };
  }, [openUsageLimitModal]);

  const value = useMemo(
    () => ({
      openUsageLimitModal,
      closeUsageLimitModal,
    }),
    [closeUsageLimitModal, openUsageLimitModal]
  );

  return (
    <UsageLimitModalContext.Provider value={value}>
      {children}
      {detail ? <UsageLimitUpgradeModal detail={detail} onClose={closeUsageLimitModal} /> : null}
    </UsageLimitModalContext.Provider>
  );
}