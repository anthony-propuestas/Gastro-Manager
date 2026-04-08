import { BrowserRouter as Router, Routes, Route } from "react-router";
import { AuthProvider } from "@/react-app/context/AuthContext";
import MainLayout from "@/react-app/components/layout/MainLayout";
import ProtectedRoute, { RestrictedModuleRoute } from "@/react-app/components/auth/ProtectedRoute";
import { ToastProvider } from "@/react-app/components/ui/toast";
import { ErrorBoundary, PageErrorBoundary } from "@/react-app/components/ErrorBoundary";
import { SidebarProvider } from "@/react-app/hooks/useSidebar";
import { ModulePrefsProvider } from "@/react-app/context/ModulePrefsContext";
import { ChatWidget } from "@/react-app/components/ChatWidget";
import Dashboard from "@/react-app/pages/Dashboard";
import Employees from "@/react-app/pages/modulos/Employees";
import Salaries from "@/react-app/pages/modulos/Salaries";
import CalendarPage from "@/react-app/pages/modulos/CalendarPage";
import Compras from "@/react-app/pages/modulos/Compras";
import Facturacion from "@/react-app/pages/modulos/Facturacion";
import Settings from "@/react-app/pages/Settings";
import Admin from "@/react-app/pages/Admin";
import OwnerPanel from "@/react-app/pages/OwnerPanel";
import Login from "@/react-app/pages/Login";
import AuthCallback from "@/react-app/pages/AuthCallback";
import VerifyEmailPage from "@/react-app/pages/VerifyEmailPage";
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
          <Route path="/verify-email" element={<VerifyEmailPage />} />
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
                        <RestrictedModuleRoute moduleKey="personal">
                          <Employees />
                        </RestrictedModuleRoute>
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
                        <RestrictedModuleRoute moduleKey="sueldos">
                          <Salaries />
                        </RestrictedModuleRoute>
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
                        <RestrictedModuleRoute moduleKey="calendario">
                          <CalendarPage />
                        </RestrictedModuleRoute>
                      </PageErrorBoundary>
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/compras"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <PageErrorBoundary>
                        <RestrictedModuleRoute moduleKey="compras">
                          <Compras />
                        </RestrictedModuleRoute>
                      </PageErrorBoundary>
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/facturacion"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <PageErrorBoundary>
                        <RestrictedModuleRoute moduleKey="facturacion">
                          <Facturacion />
                        </RestrictedModuleRoute>
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
