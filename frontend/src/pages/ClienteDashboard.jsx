import { useEffect, useState } from "react";
import api from "../api/axios";
import ProgressBar from "../components/ProgressBar";

export default function ClienteDashboard(){
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
  

const crearSolicitud = async (e) => {
  e.preventDefault();
  setMsg("");

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

  // Depura lo que realmente vas a enviar
  console.log("payload candidato:", payload.candidato);

  // Validaciones mínimas
  if (!payload.candidato.nombre) return setMsg("Falta el nombre del candidato.");
  if (!payload.candidato.apellido) return setMsg("Faltan los apellidos del candidato.");
  if (!payload.candidato.cedula) return setMsg("Falta la cédula del candidato.");
  if (!payload.candidato.email) return setMsg("Falta el correo del candidato.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.candidato.email))
    return setMsg("El correo del candidato no es válido.");

  try {
    await api.post("/api/solicitudes/", payload);
    setMsg("Solicitud creada. Se envió correo al candidato y al analista.");
    setForm({
      nombre: "",
      apellido: "",
      cedula: "",
      email: "",
      celular: "",
      ciudad_residencia: "",
    });
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



  useEffect(()=>{ load(); },[]);

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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* NUEVA SOLICITUD */}
      <form onSubmit={crearSolicitud} className="bg-white border rounded-xl p-4 space-y-3">
        <h1 className="text-lg font-semibold">Nueva solicitud</h1>
        <div className="grid md:grid-cols-3 gap-3">
          <input className="border rounded p-2 text-sm" placeholder="Nombres" value={form.nombre} onChange={e=>setForm(s=>({...s,nombre:e.target.value}))}/>
          <input className="border rounded p-2 text-sm" placeholder="Apellidos" value={form.apellido} onChange={e=>setForm(s=>({...s,apellido:e.target.value}))}/>
          <input className="border rounded p-2 text-sm" placeholder="Cédula" value={form.cedula} onChange={e=>setForm(s=>({...s,cedula:e.target.value}))}/>
          <input className="border rounded p-2 text-sm" placeholder="Correo" value={form.email} onChange={e=>setForm(s=>({...s,email:e.target.value}))}/>
          <input className="border rounded p-2 text-sm" placeholder="Celular" value={form.celular} onChange={e=>setForm(s=>({...s,celular:e.target.value}))}/>
          <input className="border rounded p-2 text-sm" placeholder="Ciudad de residencia" value={form.ciudad_residencia} onChange={e=>setForm(s=>({...s,ciudad_residencia:e.target.value}))}/>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded bg-blue-600 text-white text-sm">Crear solicitud</button>
          {msg && <span className="text-sm text-gray-600">{msg}</span>}
        </div>
      </form>

      {/* LISTA + RESUMEN (igual que antes) */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Estudios</h2>
          <div className="bg-white border rounded-xl divide-y">
            {estudios.map(es => (
              <button key={es.id} onClick={()=>openResumen(es.id)} className="w-full text-left p-3 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Estudio #{es.id}</span>
                  <span className="text-xs text-gray-600">{es.nivel_cualitativo}</span>
                </div>
                <div className="mt-2"><ProgressBar value={es.progreso || 0} /></div>
              </button>
            ))}
            {!estudios.length && <div className="p-3 text-sm text-gray-500">Sin estudios.</div>}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Resumen</h2>
          {!sel ? (
            <div className="p-4 bg-white border rounded-xl">Selecciona un estudio</div>
          ) : (
            <div className="p-4 bg-white border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>Estudio #{sel.estudio_id}</div>
                <div className="text-sm text-gray-600">Progreso: {sel.progreso}%</div>
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
                    <li key={sec} className="border rounded p-2 flex items-center justify-between">
                      <span>{sec.replaceAll("_"," ")}</span>
                      <span className="text-gray-600">✓ {info.validados} · ⚠️ {info.hallazgos}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=>descargarPDF(sel.estudio_id)} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm">
                  Descargar PDF
                </button>
                <span className="text-sm text-gray-600">
                  Autorización: {sel.autorizacion.firmada ? "Firmada" : "Pendiente"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
