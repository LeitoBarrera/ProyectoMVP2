// src/pages/CandidatoPortal.jsx
import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import ProgressBar from "../components/ProgressBar";

export default function CandidatoPortal() {
  const [estudio, setEstudio] = useState(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Toma el primero (puedes filtrar por estado desde el backend si lo deseas)
        const { data } = await api.get("/api/estudios/");
        setEstudio(Array.isArray(data) && data.length ? data[0] : null);
      } catch {
        setMsg("No se pudo cargar tu estudio.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tabs = useMemo(
    () => ([
      { to: "bio",       label: "Biográficos", icon: "👤" },
      { to: "academico", label: "Académico",   icon: "🎓" },
      { to: "laboral",   label: "Laboral",     icon: "💼" },
      { to: "docs",      label: "Documentos",  icon: "📄" },
    ]),
    []
  );

  const navClass = ({ isActive }) =>
    [
      "rounded-xl px-3 py-2 text-sm font-medium transition",
      isActive
        ? "bg-white/10 text-white shadow-inner"
        : "text-white/70 hover:text-white hover:bg-white/5",
    ].join(" ");

  return (
    <div className="relative min-h-screen">
      {/* Fondo a juego con el login */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_700px_at_25%_20%,rgba(255,255,255,0.08),transparent_60%),linear-gradient(180deg,#0b1220_0%,#0a0f1a_100%)]" />

      <div className="mx-auto max-w-5xl p-6">
        {/* Card principal */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl">
          {/* Header */}
          <div className="flex flex-col gap-4 border-b border-white/10 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Portal del candidato
              </h1>
              <p className="mt-1 text-sm text-white/60">
                Completa tu información y consulta el estado de tu estudio.
              </p>
            </div>

            {/* Estado del estudio */}
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/90">
              {loading ? (
                <div className="text-sm text-white/60">Cargando…</div>
              ) : !estudio ? (
                <div className="text-sm text-white/60">
                  No tienes un estudio activo.
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Estudio</span>
                    <span className="rounded-lg bg-white/10 px-2 py-0.5 text-sm font-semibold">
                      #{estudio.id}
                    </span>
                    {estudio.nivel_cualitativo && (
                      <span className="rounded-lg bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                        {estudio.nivel_cualitativo}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    Progreso:
                    <span className="text-white/80">{estudio.progreso ?? 0}%</span>
                  </div>
                  <div className="pt-1">
                    <ProgressBar value={estudio.progreso || 0} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex flex-wrap items-center gap-2 px-4 pt-4">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} className={navClass} end>
                <span className="mr-1">{t.icon}</span>
                {t.label}
              </NavLink>
            ))}
          </nav>

          {/* Mensajes */}
          {msg && (
            <div className="mx-4 mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
              {msg}
            </div>
          )}

          {/* Contenido */}
          <div className="p-4 md:p-6">
            <Outlet context={{ studyId: estudio?.id || null }} />
          </div>
        </div>

        {/* Pie (opcional) */}
        <div className="mt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} eConfia · Seguridad & verificación
        </div>
      </div>
    </div>
  );
}
