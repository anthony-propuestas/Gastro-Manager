import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import { useSidebar } from "@/react-app/hooks/useSidebar";
import { Menu, ChefHat } from "lucide-react";
import { cn } from "@/react-app/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { isCollapsed, toggleOpen } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Mobile header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-sidebar text-sidebar-foreground flex items-center px-4 z-30 lg:hidden">
        <button
          onClick={toggleOpen}
          className="p-2 rounded-lg hover:bg-sidebar-accent"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2 ml-3">
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
          // Mobile: full width with top padding for header
          "pt-16 lg:pt-0",
          // Desktop: margin for sidebar
          isCollapsed ? "lg:ml-20" : "lg:ml-64"
        )}
      >
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
