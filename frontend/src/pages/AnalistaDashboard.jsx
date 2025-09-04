// src/pages/AnalistaDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import ProgressBar from "../components/ProgressBar";
import NotificacionesBell from "../components/NotificacionesBell";

const Badge = ({ color = "slate", children }) => {
  const map = {
    gray: "bg-white/10 text-white ring-white/15",
    blue: "bg-blue-500/15 text-blue-200 ring-blue-400/25",
    green: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25",
    amber: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
    slate: "bg-slate-500/15 text-slate-200 ring-slate-400/25",
    red: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
    violet: "bg-violet-500/15 text-violet-200 ring-violet-400/25",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${map[color] || map.gray}`}>
      {children}
    </span>
  );
};

const estadoColor = (estado) => {
  switch ((estado || "").toUpperCase()) {
    case "VALIDADO":
      return "green";
    case "HALLAZGO":
      return "amber";
    case "EN_VALIDACION":
      return "blue";
    case "CERRADO":
      return "slate";
    case "PENDIENTE":
      return "violet";
    default:
      return "gray";
  }
};

export default function AnalistaDashboard() {
  const [estudios, setEstudios] = useState([]);
  const [f, setF] = useState({ estado: "", desde: "", hasta: "", cedula: "" });
  const [sel, setSel] = useState(null);
  const [puntaje, setPuntaje] = useState({});
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(false);

  const inputClass =
    "rounded-xl border border-white/10 bg-white/10 text-white placeholder-white/40 " +
    "p-2 text-sm outline-none focus:border-white/30 focus:ring-0";

  const buttonPrimary =
    "rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white px-3 py-2 text-sm transition";
  const buttonGhost =
    "rounded-xl border border-white/10 hover:bg-white/5 px-3 py-2 text-sm";

  const openFromQuery = (lista) => {
    const sp = new URLSearchParams(window.location.search);
    const openSolicitud = sp.get("open");
    if (openSolicitud) {
      const found = lista.find((e) => String(e.solicitud_id) === String(openSolicitud));
      if (found) return found.id;
    }
    return lista[0]?.id;
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.estado) params.set("estado", f.estado);
      if (f.desde) params.set("desde", f.desde);
      if (f.hasta) params.set("hasta", f.hasta);
      if (f.cedula) params.set("cedula", f.cedula);
      const { data } = await api.get(`/api/estudios/?${params.toString()}`);
      setEstudios(data);
      if (Array.isArray(data) && data.length) {
        const idToOpen = openFromQuery(data);
        if (idToOpen) openEstudio(idToOpen);
      } else {
        setSel(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const openEstudio = async (id) => {
    const { data } = await api.get(`/api/estudios/${id}/`);
    setSel(data);
    setChecked({});
    setPuntaje({});
  };

  const validarUno = async (itemId) => {
    const v = parseFloat(puntaje[itemId] || 0);
    await api.post(`/api/items/${itemId}/validar/`, { puntaje: v });
    await openEstudio(sel.id);
  };

  const marcarHallazgo = async (itemId) => {
    const comentario = prompt("Describe el hallazgo:");
    if (comentario === null) return;
    const v = parseFloat(puntaje[itemId] || 0);
    await api.post(`/api/items/${itemId}/marcar_hallazgo/`, { comentario, puntaje: v });
    await openEstudio(sel.id);
  };

  const validarMasivo = async () => {
    if (!sel) return;
    const items = Object.entries(checked)
      .filter(([_, on]) => on)
      .map(([id]) => ({
        id: Number(id),
        puntaje: parseFloat(puntaje[id] || 0),
        estado: "VALIDADO",
      }));
    if (!items.length) return;
    await api.post(`/api/estudios/${sel.id}/validar_masivo/`, { items });
    await openEstudio(sel.id);
  };

  const invitarCandidato = async () => {
    if (!sel?.solicitud_id) return;
    try {
      await api.post(`/api/solicitudes/${sel.solicitud_id}/invitar_candidato/`);
      alert("Invitación enviada al candidato.");
    } catch (e) {
      const d = e.response?.data;
      const msg =
        d?.detail || d?.non_field_errors?.[0] || d?.candidato?.email?.[0] || JSON.stringify(d || {});
      alert("No se pudo enviar la invitación: " + msg);
      console.error(d || e);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked]
  );

  const clearFilters = () => setF({ estado: "", desde: "", hasta: "", cedula: "" });

  return (
    <div className="relative min-h-screen">
      {/* Fondo tipo login */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(1200px_700px_at_20%_20%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(900px_500px_at_80%_80%,rgba(59,130,246,0.10),transparent_60%),linear-gradient(180deg,#0b1220_0%,#0a0f1a_100%)]" />

      <div className="max-w-7xl mx-auto p-6 space-y-6 text-white">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Panel del analista</h1>
          <NotificacionesBell />
        </div>

        {/* Filtros */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-md">
          <div className="grid md:grid-cols-5 gap-3">
            <input
              className={inputClass}
              placeholder="Desde (YYYY-MM-DD)"
              value={f.desde}
              onChange={(e) => setF((s) => ({ ...s, desde: e.target.value }))}
            />
            <input
              className={inputClass}
              placeholder="Hasta (YYYY-MM-DD)"
              value={f.hasta}
              onChange={(e) => setF((s) => ({ ...s, hasta: e.target.value }))}
            />
            <select
              className={inputClass}
              value={f.estado}
              onChange={(e) => setF((s) => ({ ...s, estado: e.target.value }))}
            >
              <option value="">Estado (todos)</option>
              <option>PENDIENTE</option>
              <option>EN_VALIDACION</option>
              <option>VALIDADO</option>
              <option>HALLAZGO</option>
              <option>CERRADO</option>
            </select>
            <input
              className={inputClass}
              placeholder="Cédula"
              value={f.cedula}
              onChange={(e) => setF((s) => ({ ...s, cedula: e.target.value }))}
            />
            <div className="flex gap-2">
              <button className={`flex-1 ${buttonPrimary}`} onClick={load}>
                Aplicar
              </button>
              <button className={`flex-1 ${buttonGhost}`} onClick={clearFilters}>
                Limpiar
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Lista de estudios */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Estudios</h2>
            <div className="rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md overflow-hidden">
              {loading && (
                <div className="p-4 text-sm text-white/70">Cargando…</div>
              )}
              {!loading &&
                estudios.map((es) => (
                  <button
                    key={es.id}
                    onClick={() => openEstudio(es.id)}
                    className={`w-full text-left p-4 border-b border-white/10 last:border-b-0 transition ${
                      sel?.id === es.id ? "bg-white/5" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">#{es.id}</span>
                        {!!es.nivel_cualitativo && (
                          <Badge color={estadoColor(es.nivel_cualitativo)}>
                            {es.nivel_cualitativo}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-white/60">
                        {Math.round(es.progreso || 0)}%
                      </span>
                    </div>
                    <div className="mt-2">
                      {/* El ProgressBar ya te funciona; se ve bien sobre este fondo */}
                      <ProgressBar value={es.progreso || 0} />
                    </div>
                  </button>
                ))}
              {!loading && !estudios.length && (
                <div className="p-4 text-sm text-white/70">Sin resultados.</div>
              )}
            </div>
          </div>

          {/* Detalle */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Detalle</h2>
            {!sel ? (
              <div className="p-4 rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md">
                Selecciona un estudio
              </div>
            ) : (
              <div className="p-4 rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-md space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="font-semibold">Estudio #{sel.id}</div>
                    <Badge color={estadoColor(sel?.estado)}>{sel?.estado || "—"}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={invitarCandidato}
                      className="px-3 py-1.5 rounded-full bg-indigo-600/90 hover:bg-indigo-600 text-white text-sm"
                    >
                      Invitar candidato
                    </button>
                    <div className="text-sm text-white/70">
                      Progreso: {sel.progreso}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={validarMasivo}
                    className={`px-3 py-1.5 rounded-full text-sm text-white transition ${
                      selectedCount
                        ? "bg-emerald-600/90 hover:bg-emerald-600"
                        : "bg-emerald-500/40 cursor-not-allowed"
                    }`}
                    disabled={!selectedCount}
                  >
                    Validar seleccionados {selectedCount ? `(${selectedCount})` : ""}
                  </button>
                </div>

                <ul className="space-y-4">
                  {(sel.items || []).map((it) => (
                    <li key={it.id} className="border border-white/10 rounded-2xl p-3 bg-white/5">
                      <div className="flex items-start justify-between gap-4">
                        {/* Izquierda */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-blue-600"
                              checked={!!checked[it.id]}
                              onChange={(e) =>
                                setChecked((s) => ({ ...s, [it.id]: e.target.checked }))
                              }
                            />
                            <div className="font-medium">{it.tipo}</div>
                            <Badge color={estadoColor(it.estado)}>{it.estado}</Badge>
                          </div>

                          {/* Documentos */}
                          <div className="mt-2 text-sm">
                            <div className="font-medium">Documentos</div>
                            <ul className="list-disc pl-5">
                              {(it.documentos || []).map((doc) => (
                                <li key={doc.id}>
                                  <a
                                    className="text-blue-300 underline hover:text-blue-200"
                                    href={doc.archivo}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {doc.nombre} {doc.tipo ? `(${doc.tipo})` : ""}
                                  </a>
                                </li>
                              ))}
                              {!it.documentos?.length && (
                                <li className="text-white/60">Sin documentos</li>
                              )}
                            </ul>
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="w-48 shrink-0">
                          <label className="text-xs text-white/60">Puntaje</label>
                          <input
                            className="mt-1 w-full rounded-lg border border-white/10 bg-white/10 p-2 text-sm text-white placeholder-white/40 outline-none focus:border-white/30"
                            type="number"
                            step="0.1"
                            placeholder="puntaje"
                            value={puntaje[it.id] ?? ""}
                            onChange={(e) => setPuntaje((s) => ({ ...s, [it.id]: e.target.value }))}
                          />
                          <button
                            onClick={() => validarUno(it.id)}
                            className="mt-2 w-full px-2 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white text-sm transition"
                          >
                            Validar
                          </button>
                          <button
                            onClick={() => marcarHallazgo(it.id)}
                            className="mt-2 w-full px-2 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-600 text-white text-sm transition"
                          >
                            Marcar hallazgo
                          </button>
                        </div>
                      </div>

                      {it.comentario && (
                        <div className="mt-2 text-xs text-white/80">
                          <b>Comentario:</b> {it.comentario}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
