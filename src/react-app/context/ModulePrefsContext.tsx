import { createContext, useContext, type ReactNode } from "react";
import { useModulePrefs } from "@/react-app/hooks/useModulePrefs";

type ModulePrefsContextValue = ReturnType<typeof useModulePrefs>;

const ModulePrefsContext = createContext<ModulePrefsContextValue | null>(null);

export function ModulePrefsProvider({ children }: { children: ReactNode }) {
  const value = useModulePrefs();
  return (
    <ModulePrefsContext.Provider value={value}>
      {children}
    </ModulePrefsContext.Provider>
  );
}

export function useModulePrefsContext(): ModulePrefsContextValue {
  const ctx = useContext(ModulePrefsContext);
  if (!ctx) throw new Error("useModulePrefsContext must be used inside ModulePrefsProvider");
  return ctx;
}
