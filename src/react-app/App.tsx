import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from "@/react-app/context/AuthContext";
import MainLayout from "@/react-app/components/layout/MainLayout";
import ProtectedRoute from "@/react-app/components/auth/ProtectedRoute";
import { ToastProvider } from "@/react-app/components/ui/toast";
import { ErrorBoundary, PageErrorBoundary } from "@/react-app/components/ErrorBoundary";
import { SidebarProvider } from "@/react-app/hooks/useSidebar";
import { ModulePrefsProvider } from "@/react-app/context/ModulePrefsContext";
import { ChatWidget } from "@/react-app/components/ChatWidget";
import Dashboard from "@/react-app/pages/Dashboard";
import Employees from "@/react-app/pages/Employees";
import Salaries from "@/react-app/pages/Salaries";
import CalendarPage from "@/react-app/pages/CalendarPage";
import Settings from "@/react-app/pages/Settings";
import Admin from "@/react-app/pages/Admin";
import OwnerPanel from "@/react-app/pages/OwnerPanel";
import Login from "@/react-app/pages/Login";
import AuthCallback from "@/react-app/pages/AuthCallback";
import NegocioSetup from "@/react-app/pages/NegocioSetup";
import InvitePage from "@/react-app/pages/InvitePage";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <ModulePrefsProvider>
            <SidebarProvider>
            <ChatWidget />
            <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/invite/:token" element={<InvitePage />} />

          {/* Negocio setup (auth required, no negocio required) */}
          <Route
            path="/negocio/setup"
            element={
              <ProtectedRoute>
                <NegocioSetup />
              </ProtectedRoute>
            }
          />

          {/* Protected routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <PageErrorBoundary>
                        <Dashboard />
                      </PageErrorBoundary>
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empleados"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <PageErrorBoundary>
                        <Employees />
                      </PageErrorBoundary>
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sueldos"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <PageErrorBoundary>
                        <Salaries />
                      </PageErrorBoundary>
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendario"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <PageErrorBoundary>
                        <CalendarPage />
                      </PageErrorBoundary>
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracion"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <PageErrorBoundary>
                        <Settings />
                      </PageErrorBoundary>
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <PageErrorBoundary>
                        <Admin />
                      </PageErrorBoundary>
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/owner"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <PageErrorBoundary>
                        <OwnerPanel />
                      </PageErrorBoundary>
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
            </SidebarProvider>
            </ModulePrefsProvider>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
