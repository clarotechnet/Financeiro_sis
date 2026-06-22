import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Comissionamento from "./pages/Comissionamento";
import AppLayout from "@/components/layout/AppLayout";
import NotFound from "./pages/NotFound";
import Perfil from "./pages/Perfil";
import FolhaPagamento from "./pages/FolhaPagamento";
import ResetPassword from "./pages/ResetPassword";
import DREConsolidado from "./pages/DREConsolidado";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />

          <BrowserRouter basename="/">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/redefinir-senha" element={<ResetPassword />} />
              <Route
                path="/pagamentos"
                element={
                  <ProtectedRoute>
                    <Comissionamento />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Navigate to="/comissionamento" replace />} />
                <Route path="/comissionamento" element={<Comissionamento />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route
                  path="/folha-pagamento"
                  element={
                    <ProtectedRoute requireAdmin>
                      <FolhaPagamento />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dre-consolidado"
                  element={
                    <ProtectedRoute requireAdmin>
                      <DREConsolidado />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Admin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/configuracoes"
                  element={
                    <ProtectedRoute requireAdmin>
                      <Admin />
                    </ProtectedRoute>
                  }
                />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
