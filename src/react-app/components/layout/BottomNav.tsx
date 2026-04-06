import { NavLink, useLocation } from "react-router";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  Banknote,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/react-app/lib/utils";
import { useModulePrefsContext } from "@/react-app/context/ModulePrefsContext";

const navItems = [
  { path: "/",             label: "Inicio",     icon: LayoutDashboard },
  { path: "/calendario",   label: "Calendario", icon: Calendar,  moduleKey: "calendario" as const },
  { path: "/empleados",    label: "Personal",   icon: Users,     moduleKey: "personal"   as const },
  { path: "/sueldos",      label: "Sueldos",    icon: Banknote,      moduleKey: "sueldos"    as const },
  { path: "/compras",      label: "Compras",    icon: ShoppingCart,  moduleKey: "compras"    as const },
  { path: "/configuracion", label: "Config",    icon: Settings },
];

export default function BottomNav() {
  const location = useLocation();
  const { prefs, negocioRestrictions, isGerente } = useModulePrefsContext();

  const visibleNavItems = navItems.filter((item) => {
    if (!item.moduleKey) return true;
    if (prefs[item.moduleKey] === false) return false;
    if (isGerente && negocioRestrictions[item.moduleKey as keyof typeof negocioRestrictions]) return false;
    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-sidebar text-sidebar-foreground border-t border-sidebar-border safe-area-bottom">
      <div className="flex items-stretch">
        {visibleNavItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 px-1 min-h-[56px] transition-colors",
                isActive
                  ? "text-sidebar-primary"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground"
              )}
            >
              <div className={cn(
                "p-1 rounded-lg transition-colors",
                isActive && "bg-sidebar-accent"
              )}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
