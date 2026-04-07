import { NavLink, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/react-app/context/AuthContext";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  ChefHat,
  LogOut,
  Loader2,
  X,
  PanelLeftClose,
  PanelLeft,
  Banknote,
  ShoppingCart,
  Receipt,
  Shield,
  Crown,
  Building2,
  ChevronDown,
  Plus,
} from "lucide-react";
import { cn } from "@/react-app/lib/utils";
import { useState, useEffect } from "react";
import { useSidebar } from "@/react-app/hooks/useSidebar";
import { useModulePrefsContext } from "@/react-app/context/ModulePrefsContext";
import type { Negocio } from "@/shared/types";

const navItems = [
  { path: "/",              label: "Dashboard",    icon: LayoutDashboard },
  { path: "/calendario",    label: "Calendario",   icon: Calendar,      moduleKey: "calendario"  as const },
  { path: "/empleados",     label: "Personal",     icon: Users,         moduleKey: "personal"    as const },
  { path: "/sueldos",       label: "Sueldos",      icon: Banknote,      moduleKey: "sueldos"     as const },
  { path: "/compras",       label: "Compras",      icon: ShoppingCart,  moduleKey: "compras"     as const },
  { path: "/facturacion",   label: "Facturación",  icon: Receipt,       moduleKey: "facturacion" as const },
  { path: "/configuracion", label: "Configuración", icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, negocios, currentNegocio, setCurrentNegocio } = useAuth();
  const isOwner = currentNegocio?.my_role === 'owner';
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showNegocioDropdown, setShowNegocioDropdown] = useState(false);
  const { isCollapsed, setIsOpen, toggleCollapsed } = useSidebar();
  const { prefs, negocioRestrictions, isGerente } = useModulePrefsContext();
  const visibleNavItems = navItems.filter((item) => {
    if (!item.moduleKey) return true;
    if (prefs[item.moduleKey] === false) return false;
    if (isGerente && negocioRestrictions[item.moduleKey as keyof typeof negocioRestrictions]) return false;
    return true;
  });

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/admin/check");
        const data = await response.json();
        if (data.success) {
          setIsAdmin(data.data.isAdmin);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
      }
    };

    if (user) {
      checkAdmin();
    }
  }, [user]);

  // Close mobile menu on navigation
  useEffect(() => {
    setIsOpen(false);
    setShowNegocioDropdown(false);
  }, [location.pathname, setIsOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  const handleNegocioSelect = (negocio: Negocio) => {
    setCurrentNegocio(negocio);
    setShowNegocioDropdown(false);
  };

  const handleCreateNegocio = () => {
    setShowNegocioDropdown(false);
    navigate("/negocio/setup");
  };

  const getUserInitials = () => {
    if (!user) return "GM";
    const name = user.name || user.email;
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getUserName = () => {
    if (!user) return "Gerente";
    return user.name || user.email.split("@")[0];
  };

  const getUserEmail = () => {
    return user?.email || "Restaurante";
  };

  return (
    <>
      {/* Negocio dropdown overlay */}
      {showNegocioDropdown && (
        <div className="fixed inset-0 z-[45]" onClick={() => setShowNegocioDropdown(false)} />
      )}

      {/* Sidebar — solo visible en desktop (lg+) */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col z-50 transition-all duration-300",
          "hidden lg:flex",
          isCollapsed ? "lg:w-20" : "lg:w-64"
        )}
      >
        {/* Logo */}
        <div className="p-4 lg:p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center flex-shrink-0">
              <ChefHat className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <div className={cn("transition-opacity duration-200", isCollapsed && "lg:opacity-0 lg:hidden")}>
              <h1 className="font-serif text-xl font-semibold tracking-tight">Gastro</h1>
              <p className="text-xs text-sidebar-foreground/60 -mt-0.5">Manager</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="ml-auto p-2 rounded-lg hover:bg-sidebar-accent lg:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Negocio selector */}
        {!isCollapsed && currentNegocio && (
          <div className="px-3 lg:px-4 py-3 border-b border-sidebar-border relative z-[60]">
            <button
              onClick={() => setShowNegocioDropdown((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent/60 hover:bg-sidebar-accent transition-colors text-left"
            >
              <Building2 className="w-4 h-4 text-sidebar-primary flex-shrink-0" />
              <span className="text-sm font-medium truncate flex-1">{currentNegocio.name}</span>
              <ChevronDown className={cn("w-4 h-4 text-sidebar-foreground/60 transition-transform flex-shrink-0", showNegocioDropdown && "rotate-180")} />
            </button>

            {/* Dropdown */}
            {showNegocioDropdown && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg overflow-hidden z-[70]">
                {negocios.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNegocioSelect(n)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
                      n.id === currentNegocio.id && "bg-accent text-accent-foreground font-medium"
                    )}
                  >
                    <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{n.name}</span>
                  </button>
                ))}
                <div className="border-t border-border">
                  <button
                    onClick={handleCreateNegocio}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                    Crear nuevo negocio
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 lg:p-4 space-y-1 overflow-y-auto">
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
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                  "hover:bg-sidebar-accent",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70",
                  isCollapsed && "lg:justify-center lg:px-3"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className={cn("font-medium transition-opacity duration-200", isCollapsed && "lg:hidden")}>
                  {item.label}
                </span>
                {isActive && !isCollapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                )}
              </NavLink>
            );
          })}

          {/* Admin link */}
          {isAdmin && (
            <NavLink
              to="/admin"
              title={isCollapsed ? "Admin" : undefined}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                "hover:bg-sidebar-accent border-t border-sidebar-border mt-2 pt-3",
                location.pathname === "/admin"
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70",
                isCollapsed && "lg:justify-center lg:px-3"
              )}
            >
              <Shield className="w-5 h-5 flex-shrink-0" />
              <span className={cn("font-medium transition-opacity duration-200", isCollapsed && "lg:hidden")}>
                Admin
              </span>
              {location.pathname === "/admin" && !isCollapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
              )}
            </NavLink>
          )}

          {/* Owner Panel link */}
          {isOwner && (
            <NavLink
              to="/owner"
              title={isCollapsed ? "Panel Owner" : undefined}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                "hover:bg-sidebar-accent border-t border-sidebar-border mt-2 pt-3",
                location.pathname === "/owner"
                  ? "bg-sidebar-accent text-amber-500"
                  : "text-sidebar-foreground/70",
                isCollapsed && "lg:justify-center lg:px-3"
              )}
            >
              <Crown className="w-5 h-5 flex-shrink-0" />
              <span className={cn("font-medium transition-opacity duration-200", isCollapsed && "lg:hidden")}>
                Panel Owner
              </span>
              {location.pathname === "/owner" && !isCollapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />
              )}
            </NavLink>
          )}

        </nav>

        {/* Desktop collapse toggle */}
        <div className="hidden lg:block p-4 border-t border-sidebar-border">
          <button
            onClick={toggleCollapsed}
            className={cn(
              "flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all",
              "hover:bg-sidebar-accent text-sidebar-foreground/70",
              isCollapsed && "justify-center px-3"
            )}
            title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {isCollapsed ? (
              <PanelLeft className="w-5 h-5" />
            ) : (
              <>
                <PanelLeftClose className="w-5 h-5" />
                <span className="font-medium">Colapsar</span>
              </>
            )}
          </button>
        </div>

        {/* User section */}
        <div className="p-3 lg:p-4 border-t border-sidebar-border">
          <div className={cn(
            "flex items-center gap-3 px-3 lg:px-4 py-3 rounded-lg bg-sidebar-accent/50",
            isCollapsed && "lg:justify-center lg:px-2"
          )}>
            {user?.picture ? (
              <img
                src={user.picture}
                alt={getUserName()}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sidebar-primary to-accent flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-sidebar-primary-foreground">
                  {getUserInitials()}
                </span>
              </div>
            )}
            <div className={cn("flex-1 min-w-0 transition-opacity duration-200", isCollapsed && "lg:hidden")}>
              <p className="text-sm font-medium truncate">{getUserName()}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{getUserEmail()}</p>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={cn(
                "p-1.5 rounded-md hover:bg-sidebar-accent transition-colors text-sidebar-foreground/60 hover:text-sidebar-foreground disabled:opacity-50",
                isCollapsed && "lg:hidden"
              )}
              title="Cerrar sesión"
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
