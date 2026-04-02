import { useState } from "react";
import { useNavigate } from "react-router";
import { ChefHat, Plus, ArrowRight, Loader2, Building2 } from "lucide-react";
import { Button } from "@/react-app/components/ui/button";
import { Input } from "@/react-app/components/ui/input";
import { Label } from "@/react-app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/react-app/components/ui/card";
import { useAuth } from "@/react-app/context/AuthContext";
import { useNegocios } from "@/react-app/hooks/useNegocios";
import type { Negocio } from "@/shared/types";

export default function NegocioSetup() {
  const { negocios, setCurrentNegocio, refreshNegocios, logout } = useAuth();
  const { createNegocio, isLoading, error } = useNegocios();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(negocios.length === 0);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSelect = (negocio: Negocio) => {
    setCurrentNegocio(negocio);
    navigate("/");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("El nombre del negocio es requerido");
      return;
    }

    const negocio = await createNegocio(trimmed);
    if (negocio) {
      await refreshNegocios();
      setCurrentNegocio(negocio);
      navigate("/");
    } else {
      setFormError(error || "No pudimos crear el negocio. Intenta de nuevo.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
          <ChefHat className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Gastro Manager</h1>
        <p className="text-muted-foreground text-center text-sm max-w-xs">
          Selecciona o crea un negocio para continuar
        </p>
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* Existing negocios */}
        {negocios.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tus negocios</CardTitle>
              <CardDescription>Selecciona uno para continuar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {negocios.map((negocio) => (
                <button
                  key={negocio.id}
                  onClick={() => handleSelect(negocio)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{negocio.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {negocio.member_count} {negocio.member_count === 1 ? "miembro" : "miembros"}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Create negocio */}
        {!showForm ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear nuevo negocio
          </Button>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Crear negocio</CardTitle>
              <CardDescription>
                Dale un nombre a tu restaurante o negocio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="negocio-name">Nombre del negocio</Label>
                  <Input
                    id="negocio-name"
                    placeholder="Ej: Restaurante El Buen Sabor"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                    autoFocus
                    maxLength={100}
                  />
                </div>

                {(formError || error) && (
                  <p className="text-sm text-destructive">
                    {formError || error}
                  </p>
                )}

                <div className="flex gap-2">
                  {negocios.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowForm(false)}
                      disabled={isLoading}
                    >
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      "Crear negocio"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Logout link */}
        <p className="text-center text-xs text-muted-foreground">
          ¿Cuenta equivocada?{" "}
          <button
            onClick={logout}
            className="underline hover:text-foreground transition-colors"
          >
            Cerrar sesión
          </button>
        </p>
      </div>
    </div>
  );
}
