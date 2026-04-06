import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { useSidebar } from "@/react-app/hooks/useSidebar";
import { ChefHat } from "lucide-react";
import { cn } from "@/react-app/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Mobile header — solo muestra logo/nombre, sin hamburger */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-sidebar text-sidebar-foreground flex items-center px-4 z-30 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-serif text-lg font-semibold">Gastro Manager</span>
        </div>
      </header>

      {/* Main content */}
      <main
        className={cn(
          "min-h-screen transition-all duration-300",
          // Mobile: padding top para header, padding bottom para bottom nav
          "pt-14 pb-16 lg:pb-0 lg:pt-0",
          // Desktop: margin para sidebar
          isCollapsed ? "lg:ml-20" : "lg:ml-64"
        )}
      >
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>

      {/* Bottom navigation — solo en mobile */}
      <BottomNav />
    </div>
  );
}
