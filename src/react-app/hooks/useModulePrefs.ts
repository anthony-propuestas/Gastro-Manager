import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/react-app/context/AuthContext";

export const MODULES = [
  { key: "calendario", label: "Calendario", order: 1, path: "/calendario", description: "Gestión de eventos y agenda" },
  { key: "personal",   label: "Personal",   order: 2, path: "/empleados",  description: "Administración de empleados" },
  { key: "sueldos",    label: "Sueldos",    order: 3, path: "/sueldos",    description: "Pagos y anticipos salariales" },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];

const DEFAULT_PREFS: Record<ModuleKey, boolean> = {
  calendario: true,
  personal: true,
  sueldos: true,
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

export function useModulePrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<ModuleKey, boolean>>(DEFAULT_PREFS);

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

  return { prefs, toggleModule };
}
