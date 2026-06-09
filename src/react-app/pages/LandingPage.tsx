import { useState, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router";
import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import {
  ChefHat, Loader2, CheckCircle, Users, CalendarDays, BarChart3,
  ShoppingCart, FileText, DollarSign, AlertTriangle, ArrowRight,
  Smartphone, Zap, Shield, CheckCheck,
} from "lucide-react";
import { useAuth } from "@/react-app/context/AuthContext";

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("is-visible"); }),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function WaveBackground() {
  const W = 1440, H = 900;
  const waves = [
    { yR: 0.10, amp: 30, freq: 820,  op: 0.07, sw: 1.5, dur: 22, delay:   0 },
    { yR: 0.26, amp: 18, freq: 1080, op: 0.05, sw: 1.0, dur: 30, delay: -11 },
    { yR: 0.42, amp: 46, freq: 700,  op: 0.05, sw: 2.0, dur: 36, delay:  -5 },
    { yR: 0.57, amp: 14, freq: 960,  op: 0.06, sw: 1.0, dur: 25, delay: -14 },
    { yR: 0.71, amp: 26, freq: 840,  op: 0.04, sw: 1.5, dur: 42, delay:  -8 },
    { yR: 0.87, amp: 20, freq: 1040, op: 0.05, sw: 1.0, dur: 28, delay: -18 },
  ];
  const strokes = [
    "hsl(170 100% 25%)", "hsl(142 70% 49%)", "hsl(170 100% 25%)",
    "hsl(142 70% 49%)", "hsl(170 60% 45%)", "hsl(170 100% 25%)",
  ];
  const mkPath = (yR: number, amp: number, freq: number) => {
    const cy = yR * H;
    const step = Math.max(4, freq / 90);
    const pts: string[] = [];
    for (let x = -freq; x <= W + freq; x += step) {
      const y = cy + amp * Math.sin((2 * Math.PI * x) / freq);
      pts.push(`${pts.length === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(" ");
  };
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1 }}>
      <svg className="w-full h-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        {waves.map((w, i) => (
          <path
            key={i}
            d={mkPath(w.yR, w.amp, w.freq)}
            fill="none"
            stroke={strokes[i]}
            strokeWidth={w.sw}
            strokeOpacity={w.op}
            style={{
              animation: `wave-scroll ${w.dur}s linear infinite`,
              animationDelay: `${w.delay}s`,
              ["--shift" as string]: `-${w.freq}px`,
            }}
          />
        ))}
      </svg>
    </div>
  );
}

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path fill="currentColor" fillOpacity="0.9" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="currentColor" fillOpacity="0.9" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="currentColor" fillOpacity="0.9" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="currentColor" fillOpacity="0.9" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export default function LandingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [searchParams] = useSearchParams();
  const isVerified = searchParams.get("verified") === "true";
  const { user, isPending } = useAuth();
  useScrollReveal();

  if (!isPending && user) {
    return <Navigate to="/agente-ia" replace />;
  }

  const handleLogin = async () => {
    setIsLoading(true);
    setLoginError("");
    try {
      if (Capacitor.isNativePlatform()) {
        await GoogleAuth.initialize();
        const googleUser = await GoogleAuth.signIn();
        const idToken = googleUser.authentication.idToken;
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const data = await res.json() as { success: boolean; error?: { code?: string; message?: string } };
        if (data.error?.code === "PENDING_VERIFICATION") {
          window.location.assign("/verify-email");
          return;
        }
        if (!res.ok || !data.success) throw new Error(data.error?.message ?? "Error de autenticación");
        window.location.assign("/agente-ia");
      } else {
        const platform = Capacitor.isNativePlatform() ? "android" : "web";
        const res = await fetch(`/api/oauth/google/redirect_url?platform=${platform}`);
        const json = await res.json() as { success: boolean; data: { redirect_url: string } };
        window.location.assign(json.data.redirect_url);
      }
    } catch (error) {
      console.error("Login error:", error);
      setLoginError("No se pudo iniciar sesión. Intentá de nuevo.");
      setIsLoading(false);
    }
  };

  const modules = [
    {
      num: "01", icon: Users, title: "Personal",
      desc: "Registrá empleados, asigná roles y controlá qué puede ver cada uno.",
      benefit: "Sin papeles, sin confusiones de acceso.",
      color: "bg-primary/10 text-primary border-primary/20",
    },
    {
      num: "02", icon: CalendarDays, title: "Calendario de Turnos",
      desc: "Organizá turnos con vista semanal y mensual. Todos saben cuándo trabajan.",
      benefit: "Adiós a los grupos de WhatsApp para los horarios.",
      color: "bg-accent/10 text-accent border-accent/20",
    },
    {
      num: "03", icon: DollarSign, title: "Sueldos",
      desc: "Calculá y registrá los pagos de tu equipo con reglas personalizadas.",
      benefit: "Sin errores de cálculo ni reclamos del equipo.",
      color: "bg-chart-3/10 text-chart-3 border-chart-3/20",
    },
    {
      num: "04", icon: ShoppingCart, title: "Compras",
      desc: "Registrá cada compra, controlá proveedores e historial de gastos.",
      benefit: "Siempre sabés qué compraste y a quién.",
      color: "bg-chart-4/10 text-chart-4 border-chart-4/20",
    },
    {
      num: "05", icon: FileText, title: "Facturación",
      desc: "Emití y gestioná facturas desde el sistema, sin herramientas externas.",
      benefit: "Tu facturación ordenada y a mano.",
      color: "bg-chart-5/10 text-chart-5 border-chart-5/20",
    },
    {
      num: "06", icon: BarChart3, title: "Seguimiento",
      desc: "Visualizá métricas clave: gastos, pagos, stock y más en tiempo real.",
      benefit: "Tomá decisiones con datos, no con intuición.",
      color: "bg-primary/10 text-primary border-primary/20",
    },
  ];

  const painPoints = [
    { icon: DollarSign, text: "Calculás sueldos en planillas y siempre hay errores de centavo" },
    { icon: ShoppingCart, text: "No recordás qué compraste, cuánto pagaste ni a qué proveedor" },
    { icon: CalendarDays, text: "Los turnos se coordinan por WhatsApp y siempre hay malentendidos" },
    { icon: FileText, text: "Las facturas se acumulan en carpetas sin ningún orden" },
    { icon: BarChart3, text: "No tenés idea real de cuánto gastás ni en qué áreas" },
    { icon: Users, text: "Dar acceso parcial a empleados sin que vean todo es imposible" },
  ];

  const steps = [
    { num: "1", icon: GoogleIcon, title: "Creá tu cuenta con Google", desc: "Un clic y ya estás adentro. Sin formularios largos, sin tarjeta de crédito." },
    { num: "2", icon: Zap, title: "Activá los módulos que necesitás", desc: "Seleccioná solo las herramientas relevantes para tu negocio. Podés agregar más cuando quieras." },
    { num: "3", icon: Smartphone, title: "Gestioná desde cualquier lugar", desc: "Accedé desde tu celular, tablet o computadora. Todo sincronizado en tiempo real." },
  ];

  const stats = [
    { value: "6", label: "módulos integrados", sub: "Personal, turnos, sueldos y más" },
    { value: "1", label: "plataforma centralizada", sub: "Todo tu negocio en un solo lugar" },
    { value: "0", label: "instalaciones necesarias", sub: "Funciona 100% en el navegador" },
    { value: "∞", label: "negocios pueden usar", sub: "Escalable a cualquier tamaño" },
  ];

  return (
    <div className="min-h-screen text-foreground">
      {/* Layer 0: solid background */}
      <div className="fixed inset-0 bg-background" style={{ zIndex: 0 }} />
      {/* Layer 1: flowing wave lines */}
      <WaveBackground />
      {/* Layer 2: all page content */}
      <div className="relative" style={{ zIndex: 2 }}>

      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-serif font-semibold">La Hoja</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#problemas" className="hover:text-foreground transition-colors">Problemas</a>
            <a href="#modulos" className="hover:text-foreground transition-colors">Módulos</a>
            <a href="#como-funciona" className="hover:text-foreground transition-colors">¿Cómo funciona?</a>
          </nav>
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Conectando...</span></>
            ) : (
              <><GoogleIcon /><span>Iniciar sesión</span></>
            )}
          </button>
        </div>
      </header>

      {/* Verified banner */}
      {isVerified && (
        <div className="fixed top-16 left-0 right-0 z-40 flex justify-center px-6 pt-3">
          <div className="flex items-center gap-3 bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-sm text-success">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>¡Email verificado! Iniciá sesión para continuar.</span>
          </div>
        </div>
      )}

      {/* Login error banner */}
      {loginError && (
        <div className="fixed top-16 left-0 right-0 z-40 flex justify-center px-6 pt-3">
          <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{loginError}</span>
          </div>
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative pt-40 pb-28 px-6 overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 -left-40 w-[500px] h-[500px] bg-primary/8 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/3 -right-40 w-[400px] h-[400px] bg-accent/12 rounded-full blur-3xl animate-float-slow" style={{ animationDelay: "3s" }} />
          <div className="absolute top-2/3 left-1/3 w-64 h-64 bg-primary/5 rounded-full blur-2xl animate-float" style={{ animationDelay: "1.5s" }} />
        </div>

        <div className="relative max-w-3xl mx-auto text-center space-y-7 animate-fade-in-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Sistema modular para gastronomía
          </div>

          <h1 className="text-5xl sm:text-6xl font-serif font-semibold leading-tight tracking-tight">
            Tu restaurante,<br />
            <span className="text-primary">ordenado y en control</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            <strong className="text-foreground">La Hoja</strong> centraliza todo lo que necesitás gestionar:
            personal, turnos, sueldos, compras y facturación — en una sola plataforma diseñada
            para el rubro gastronómico.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="flex items-center gap-2.5 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-70 shadow-lg shadow-primary/20"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
              Empezá gratis con Google
            </button>
            <a
              href="#modulos"
              className="flex items-center gap-2 px-6 py-3 border border-border rounded-xl font-medium text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
            >
              Ver módulos <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <p className="text-xs text-muted-foreground">Sin tarjeta de crédito · Sin instalaciones · Empezás hoy</p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted-foreground/50 animate-bounce">
          <div className="w-px h-8 bg-current rounded-full" />
        </div>
      </section>

      {/* ── PAIN POINTS ──────────────────────────────────────────── */}
      <section id="problemas" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 space-y-3 reveal">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 px-3 py-1.5 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" />
              ¿Te identificás con alguno de estos?
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-semibold">
              Los problemas que tiene<br />todo restaurante sin un sistema
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {painPoints.map(({ icon: Icon, text }, i) => (
              <div
                key={i}
                className={`reveal reveal-delay-${Math.min(i + 1, 5)} group flex items-start gap-4 p-5 rounded-2xl border border-border/60 bg-card hover:border-destructive/30 hover:bg-destructive/5 transition-all duration-300`}
              >
                <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 group-hover:bg-destructive/20 transition-colors">
                  <Icon className="w-4 h-4 text-destructive" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          {/* Bridge */}
          <div className="mt-14 text-center reveal">
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary font-medium">
              <CheckCheck className="w-5 h-5" />
              La Hoja resuelve todos estos problemas. Los 6.
            </div>
          </div>
        </div>
      </section>

      {/* ── MODULES ──────────────────────────────────────────────── */}
      <section id="modulos" className="py-24 px-6 bg-secondary/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 space-y-3 reveal">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full">
              <ChefHat className="w-3.5 h-3.5" />
              Un sistema, seis herramientas
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-semibold">
              Todo lo que necesita tu negocio,<br />integrado en un solo lugar
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Activá solo los módulos que usás. Cada uno está pensado para la realidad del rubro gastronómico.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map(({ num, icon: Icon, title, desc, benefit, color }, i) => (
              <div
                key={title}
                className={`reveal reveal-delay-${Math.min(i + 1, 5)} group bg-card rounded-2xl border border-border/50 p-6 space-y-4 hover:scale-[1.03] hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-default`}
              >
                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground/50 font-semibold">{num}</span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-base">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
                <div className="flex items-start gap-2 pt-1">
                  <CheckCircle className="w-3.5 h-3.5 text-success mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-success font-medium">{benefit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────── */}
      <section id="como-funciona" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-3 reveal">
            <h2 className="text-3xl sm:text-4xl font-serif font-semibold">¿Cómo funciona?</h2>
            <p className="text-muted-foreground">Tres pasos y ya estás gestionando tu negocio.</p>
          </div>

          <div className="relative flex flex-col md:flex-row items-start gap-8 md:gap-0">
            {/* Connector line (desktop only) */}
            <div className="hidden md:block absolute top-10 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px border-t-2 border-dashed border-primary/30" />

            {steps.map(({ num, title, desc }, i) => (
              <div key={num} className={`reveal reveal-delay-${i + 1} flex-1 flex flex-col items-center text-center px-4 space-y-4`}>
                <div className="relative z-10 w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
                  <span className="text-primary-foreground text-2xl font-serif font-bold">{num}</span>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-base">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[200px] mx-auto">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map(({ value, label, sub }, i) => (
              <div key={label} className={`reveal reveal-delay-${i + 1} text-center space-y-1`}>
                <div className="text-4xl sm:text-5xl font-serif font-bold text-primary">{value}</div>
                <div className="text-sm font-semibold text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto reveal">
          <div className="relative rounded-3xl overflow-hidden bg-primary p-10 sm:p-14 text-center space-y-6">
            {/* Decorative blobs inside CTA card */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-primary-foreground/80 text-xs font-medium">
                <Shield className="w-3 h-3" />
                Seguro, confiable y siempre disponible
              </div>
              <h2 className="text-3xl sm:text-4xl font-serif font-semibold text-primary-foreground leading-tight">
                Empezá a gestionar mejor<br />tu restaurante hoy
              </h2>
              <p className="text-primary-foreground/70 text-base max-w-sm mx-auto">
                Unite a los restaurantes que ya dejaron atrás el caos de las planillas y los grupos de WhatsApp.
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="flex items-center gap-2.5 px-7 py-3.5 bg-white text-primary rounded-xl font-semibold hover:bg-white/90 active:scale-95 transition-all disabled:opacity-70 shadow-lg"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
                Empezá gratis con Google
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <p className="relative z-10 text-primary-foreground/50 text-xs">
              Gratis para empezar · Sin tarjeta de crédito · Sin instalaciones
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <ChefHat className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div>
              <span className="text-sm font-serif font-semibold">La Hoja</span>
              <p className="text-xs text-muted-foreground">Sistema de Gestión Gastronómica</p>
            </div>
          </div>
          <nav className="flex items-center gap-5 text-xs text-muted-foreground">
            <a href="#modulos" className="hover:text-foreground transition-colors">Módulos</a>
            <a href="#como-funciona" className="hover:text-foreground transition-colors">¿Cómo funciona?</a>
          </nav>
          <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} La Hoja. Todos los derechos reservados.</span>
        </div>
      </footer>

      </div>{/* end content z-[2] */}
    </div>
  );
}
