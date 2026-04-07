import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/react-app/context/AuthContext";
import { apiFetch } from "@/react-app/lib/api";
import type { NegocioModuleRestrictions } from "@/shared/types";

export const MODULES = [
  { key: "calendario",  label: "Calendario",  order: 1, path: "/calendario",  description: "Gestión de eventos y agenda" },
  { key: "personal",    label: "Personal",    order: 2, path: "/empleados",   description: "Administración de empleados" },
  { key: "sueldos",     label: "Sueldos",     order: 3, path: "/sueldos",     description: "Pagos y anticipos salariales" },
  { key: "compras",     label: "Compras",     order: 4, path: "/compras",     description: "Registro de compras y gastos" },
  { key: "facturacion", label: "Facturación", order: 5, path: "/facturacion", description: "Registro de ventas del negocio" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

const DEFAULT_PREFS: Record<ModuleKey, boolean> = {
  calendario: true,
  personal: true,
  sueldos: true,
  compras: true,
  facturacion: true,
};

type ModulePrefsResponse = {
  success: boolean;
  data: Record<ModuleKey, boolean>;
};

type ToggleModuleResponse = {
  success: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isModulePrefsResponse(value: unknown): value is ModulePrefsResponse {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return false;
  }

  const { data } = value;
  if (!isRecord(data)) {
    return false;
  }

  return MODULES.every(({ key }) => typeof data[key] === "boolean");
}

function isToggleModuleResponse(value: unknown): value is ToggleModuleResponse {
  return isRecord(value) && typeof value.success === "boolean";
}

const DEFAULT_RESTRICTIONS: NegocioModuleRestrictions = {
  calendario: false,
  personal: false,
  sueldos: false,
  compras: false,
  facturacion: false,
};

export function useModulePrefs() {
  const { user, currentNegocio } = useAuth();
  const [prefs, setPrefs] = useState<Record<ModuleKey, boolean>>(DEFAULT_PREFS);
  const [negocioRestrictions, setNegocioRestrictions] = useState<NegocioModuleRestrictions>(DEFAULT_RESTRICTIONS);
  const isGerente = currentNegocio?.my_role === 'gerente';

  useEffect(() => {
    if (!user) return;

    fetch("/api/modules/prefs")
      .then((r) => r.json())
      .then((json) => {
        if (!isModulePrefsResponse(json)) {
          throw new Error("Invalid module prefs response");
        }

        if (json.success) {
          setPrefs({ ...DEFAULT_PREFS, ...json.data });
        }
      })
      .catch((err) => console.error("Error loading module prefs:", err));
  }, [user]);

  const negocioId = currentNegocio?.id;

  useEffect(() => {
    if (!user || negocioId == null) {
      setNegocioRestrictions(DEFAULT_RESTRICTIONS);
      return;
    }

    apiFetch(`/api/negocios/${negocioId}/module-restrictions`, {}, negocioId)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && typeof json.data === 'object') {
          setNegocioRestrictions({ ...DEFAULT_RESTRICTIONS, ...json.data });
        }
      })
      .catch((err) => console.error("Error loading module restrictions:", err));
  }, [user, negocioId]);

  const toggleModule = useCallback(async (key: ModuleKey) => {
    const newValue = !prefs[key];

    // Optimistic update
    setPrefs((prev) => ({ ...prev, [key]: newValue }));

    try {
      const res = await fetch("/api/modules/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module_key: key, is_active: newValue }),
      });
      const json = await res.json();
      if (!isToggleModuleResponse(json)) {
        throw new Error("Invalid toggle module response");
      }

      if (!json.success) throw new Error("API returned failure");
    } catch (err) {
      // Revert on error
      setPrefs((prev) => ({ ...prev, [key]: !newValue }));
      console.error("Error updating module pref:", err);
    }
  }, [prefs]);

  return { prefs, toggleModule, negocioRestrictions, isGerente };
}
