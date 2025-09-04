// src/pages/ClienteDashboard.jsx
import { useEffect, useState } from "react";
import api from "../api/axios";
import ProgressBar from "../components/ProgressBar";

export default function ClienteDashboard(){
  const [me, setMe] = useState(null);
  const [hasEmpresa, setHasEmpresa] = useState(false);
  const [loadingMe, setLoadingMe] = useState(true);

  const [estudios, setEstudios] = useState([]);
  const [sel, setSel] = useState(null);  // resumen
  const [msg,setMsg] = useState("");
  const [form, setForm] = useState({
    nombre: "", apellido: "", cedula: "", email: "", celular: "", ciudad_residencia: ""
  });

  const load = async () => {
    const { data } = await api.get("/api/estudios/");
    setEstudios(data);
    if(Array.isArray(data) && data.length){
      await openResumen(data[0].id);
    } else {
      setSel(null);
    }
  };

  const openResumen = async (id) => {
    const { data } = await api.get(`/api/estudios/${id}/resumen/`);
    setSel(data);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/api/auth/me/");
        setMe(data);

        const _hasEmpresa = Boolean(
          (data && data.empresa_id != null) ? data.empresa_id : data?.empresa
        );
        setHasEmpresa(_hasEmpresa);

        if (data.rol !== "CLIENTE") {
          setMsg("Debes ingresar como CLIENTE para crear solicitudes.");
          return;
        }
        if (!_hasEmpresa) {
          setMsg("Tu usuario CLIENTE no tiene empresa asociada. Pide al admin asignarte una empresa.");
          return;
        }

        setMsg("");
        await load();
      } catch (e) {
        console.error(e);
        setMsg("No autenticado. Inicia sesión nuevamente.");
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  const crearSolicitud = async (e) => {
    e.preventDefault();
    setMsg("");

    if (!me || me.rol !== "CLIENTE") {
      setMsg("Debes ingresar como CLIENTE para crear solicitudes.");
      return;
    }
    if (!hasEmpresa) {
      setMsg("Tu usuario CLIENTE no tiene empresa asociada. Pide al admin asignarte una empresa.");
      return;
    }

    const payload = {
      candidato: {
        nombre: (form.nombre || "").trim(),
        apellido: (form.apellido || "").trim(),
        cedula: (form.cedula || "").trim(),
        email: (form.email || "").trim(),
        celular: (form.celular || "").trim(),
        ciudad_residencia: (form.ciudad_residencia || "").trim(),
      },
    };

    if (!payload.candidato.nombre) return setMsg("Falta el nombre del candidato.");
    if (!payload.candidato.apellido) return setMsg("Faltan los apellidos del candidato.");
    if (!payload.candidato.cedula) return setMsg("Falta la cédula del candidato.");
    if (!payload.candidato.email) return setMsg("Falta el correo del candidato.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.candidato.email))
      return setMsg("El correo del candidato no es válido.");

    try {
      await api.post("/api/solicitudes/", payload);
      setMsg("Solicitud creada. Se envió correo al candidato y al analista.");
      setForm({ nombre:"", apellido:"", cedula:"", email:"", celular:"", ciudad_residencia:"" });
      await load();
    } catch (err) {
      const d = err.response?.data;
      let candDetails = null;
      if (d?.candidato && typeof d.candidato === "object") {
        candDetails = Object.entries(d.candidato)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join(" | ");
      }
      const detail =
        d?.detail ||
        d?.non_field_errors?.[0] ||
        d?.empresa?.[0] ||
        candDetails ||
        JSON.stringify(d || {});
      console.error("Error crear solicitud:", d);
      setMsg(`No se pudo crear la solicitud: ${detail}`);
    }
  };

  const descargarPDF = async (id) => {
    const res = await api.get(`/api/estudios/${id}/resumen_pdf/`, { responseType: "blob" });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumen_estudio_${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const disabledCreate = loadingMe || !me || me.rol !== "CLIENTE" || !hasEmpresa;

  return (
    <div className="min-h-screen text-slate-100">
      {/* fondo gradiente */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(1200px_700px_at_20%_30%,rgba(255,255,255,0.06),transparent_60%),linear-gradient(180deg,#0b1220_0%,#0a0f1a_100%)]" />

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Cabecera */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Portal del cliente</h1>
          {me && (
            <div className="text-xs text-slate-300">
              Usuario: <b>{me.username}</b> · Rol: <b>{me.rol}</b> · Empresa: <b>{me.empresa_nombre || me.empresa || "—"}</b>
            </div>
          )}
        </div>

        {/* Mensaje global (si existe) */}
        {msg && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-200 backdrop-blur-md">
            <span className="text-sm">{msg}</span>
          </div>
        )}

        {/* NUEVA SOLICITUD */}
        <form
          onSubmit={crearSolicitud}
          autoComplete="off"
          className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl space-y-4"
        >
          <h2 className="text-lg font-semibold">Nueva solicitud</h2>

          <div className="grid md:grid-cols-3 gap-3">
            <input
              className="rounded-xl border border-white/10 bg-white/10 p-3 text-sm text-white placeholder-white/40 outline-none focus:border-white/30"
              placeholder="Nombres"
              value={form.nombre}
              onChange={e=>setForm(s=>({...s,nombre:e.target.value}))}
            />
            <input
              className="rounded-xl border border-white/10 bg-white/10 p-3 text-sm text-white placeholder-white/40 outline-none focus:border-white/30"
              placeholder="Apellidos"
              value={form.apellido}
              onChange={e=>setForm(s=>({...s,apellido:e.target.value}))}
            />
            <input
              className="rounded-xl border border-white/10 bg-white/10 p-3 text-sm text-white placeholder-white/40 outline-none focus:border-white/30"
              placeholder="Cédula"
              value={form.cedula}
              onChange={e=>setForm(s=>({...s,cedula:e.target.value}))}
            />
            <input
              className="rounded-xl border border-white/10 bg-white/10 p-3 text-sm text-white placeholder-white/40 outline-none focus:border-white/30"
              placeholder="Correo"
              value={form.email}
              onChange={e=>setForm(s=>({...s,email:e.target.value}))}
            />
            <input
              className="rounded-xl border border-white/10 bg-white/10 p-3 text-sm text-white placeholder-white/40 outline-none focus:border-white/30"
              placeholder="Celular"
              value={form.celular}
              onChange={e=>setForm(s=>({...s,celular:e.target.value}))}
            />
            <input
              className="rounded-xl border border-white/10 bg-white/10 p-3 text-sm text-white placeholder-white/40 outline-none focus:border-white/30"
              placeholder="Ciudad de residencia"
              value={form.ciudad_residencia}
              onChange={e=>setForm(s=>({...s,ciudad_residencia:e.target.value}))}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={disabledCreate}
              className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition ${
                disabledCreate ? "cursor-not-allowed bg-slate-600" : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              Crear solicitud
            </button>
          </div>
        </form>

        {/* LISTA + RESUMEN */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Lista de estudios */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Estudios</h2>
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-xl divide-y divide-white/5">
              {estudios.map(es => (
                <button
                  key={es.id}
                  onClick={()=>openResumen(es.id)}
                  className="w-full text-left transition hover:bg-white/5"
                >
                  <div className="flex items-center justify-between p-3">
                    <span className="font-medium">Estudio #{es.id}</span>
                    <span className="text-xs text-slate-300">{es.nivel_cualitativo}</span>
                  </div>
                  <div className="px-3 pb-3"><ProgressBar value={es.progreso || 0} /></div>
                </button>
              ))}
              {!estudios.length && <div className="p-4 text-sm text-slate-300">Sin estudios.</div>}
            </div>
          </div>

          {/* Resumen */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Resumen</h2>
            {!sel ? (
              <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-xl">
                Selecciona un estudio
              </div>
            ) : (
              <div className="p-4 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>Estudio #{sel.estudio_id}</div>
                  <div className="text-sm text-slate-300">Progreso: {sel.progreso}%</div>
                </div>
                <div className="text-sm">
                  <div>Items: {sel.totales.items}</div>
                  <div>Validados: {sel.totales.validados}</div>
                  <div>Hallazgos: {sel.totales.hallazgos}</div>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Secciones</h3>
                  <ul className="text-sm space-y-1">
                    {Object.entries(sel.secciones || {}).map(([sec, info]) => (
                      <li key={sec} className="border border-white/10 bg-white/5 rounded p-2 flex items-center justify-between">
                        <span className="capitalize">{sec.replaceAll("_"," ").toLowerCase()}</span>
                        <span className="text-slate-300">✓ {info.validados} · ⚠️ {info.hallazgos}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>descargarPDF(sel.estudio_id)} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-500">
                    Descargar PDF
                  </button>
                  <span className="text-sm text-slate-300">
                    Autorización: <b className={sel.autorizacion.firmada ? "text-emerald-300" : "text-amber-300"}>
                      {sel.autorizacion.firmada ? "Firmada" : "Pendiente"}
                    </b>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
