import { useEffect, useState } from "react";
import api from "../api/axios";
import ProgressBar from "../components/ProgressBar";

export default function AnalistaDashboard() {
  const [estudios, setEstudios] = useState([]);
  const [f, setF] = useState({ estado:"", desde:"", hasta:"", cedula:"" });
  const [sel, setSel] = useState(null);
  const [puntaje, setPuntaje] = useState({}); // {itemId: value}
  const [checked, setChecked] = useState({}); // {itemId: true}

  const load = async () => {
    const params = new URLSearchParams();
    if (f.estado) params.set("estado", f.estado);
    if (f.desde) params.set("desde", f.desde);
    if (f.hasta) params.set("hasta", f.hasta);
    if (f.cedula) params.set("cedula", f.cedula);

    const { data } = await api.get(`/api/estudios/?${params.toString()}`);
    setEstudios(data);
    if (Array.isArray(data) && data.length) {
      openEstudio(data[0].id);
    } else {
      setSel(null);
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
      .map(([id]) => ({ id: Number(id), puntaje: parseFloat(puntaje[id] || 0), estado: "VALIDADO" }));
    if (!items.length) return;
    await api.post(`/api/estudios/${sel.id}/validar_masivo/`, { items });
    await openEstudio(sel.id);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Filtros */}
      <div className="bg-white border rounded-xl p-4 grid md:grid-cols-5 gap-3">
        <input className="border rounded p-2 text-sm" placeholder="Desde (YYYY-MM-DD)" value={f.desde} onChange={e=>setF(s=>({...s,desde:e.target.value}))}/>
        <input className="border rounded p-2 text-sm" placeholder="Hasta (YYYY-MM-DD)" value={f.hasta} onChange={e=>setF(s=>({...s,hasta:e.target.value}))}/>
        <select className="border rounded p-2 text-sm" value={f.estado} onChange={e=>setF(s=>({...s,estado:e.target.value}))}>
          <option value="">Estado (todos)</option>
          <option>PENDIENTE</option>
          <option>EN_VALIDACION</option>
          <option>VALIDADO</option>
          <option>HALLAZGO</option>
          <option>CERRADO</option>
        </select>
        <input className="border rounded p-2 text-sm" placeholder="Cédula" value={f.cedula} onChange={e=>setF(s=>({...s,cedula:e.target.value}))}/>
        <button className="bg-blue-600 text-white rounded p-2 text-sm" onClick={load}>Aplicar</button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lista de estudios */}
        <div className="space-y-3">
          <h1 className="text-xl font-semibold">Estudios</h1>
          <div className="bg-white border rounded-xl divide-y">
            {estudios.map(es => (
              <button key={es.id} onClick={()=>openEstudio(es.id)} className={`w-full text-left p-3 hover:bg-gray-50 ${sel?.id===es.id ? "bg-gray-50":""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">#{es.id}</span>
                  <span className="text-xs text-gray-600">{es.nivel_cualitativo}</span>
                </div>
                <div className="mt-2"><ProgressBar value={es.progreso || 0} /></div>
              </button>
            ))}
            {!estudios.length && <div className="p-3 text-sm text-gray-500">Sin resultados</div>}
          </div>
        </div>

        {/* Detalle */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Detalle</h2>
          {!sel ? (
            <div className="p-4 bg-white border rounded-xl">Selecciona un estudio</div>
          ) : (
            <div className="p-4 bg-white border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Estudio #{sel.id}</div>
                <div className="text-sm text-gray-600">Progreso: {sel.progreso}%</div>
              </div>

              <button onClick={validarMasivo} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm">
                Validar seleccionados
              </button>

              <ul className="space-y-4">
                {(sel.items || []).map(it => (
                  <li key={it.id} className="border rounded p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={!!checked[it.id]} onChange={e=>setChecked(s=>({...s,[it.id]: e.target.checked}))}/>
                          <div className="font-medium">{it.tipo}</div>
                          <div className="text-xs text-gray-600">Estado: {it.estado}</div>
                        </div>

                        {/* Documentos */}
                        <div className="mt-2 text-sm">
                          <div className="font-medium">Documentos:</div>
                          <ul className="list-disc pl-5">
                            {(it.documentos || []).map(doc => (
                              <li key={doc.id}>
                                <a className="text-blue-600 underline" href={doc.archivo} target="_blank" rel="noreferrer">
                                  {doc.nombre} {doc.tipo ? `(${doc.tipo})` : ""}
                                </a>
                              </li>
                            ))}
                            {!it.documentos?.length && <li className="text-gray-500">Sin documentos</li>}
                          </ul>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="w-44">
                        <input className="border rounded p-1 text-sm w-full" type="number" step="0.1" placeholder="puntaje"
                          value={puntaje[it.id] ?? ""} onChange={e=>setPuntaje(s=>({...s,[it.id]:e.target.value}))}/>
                        <button onClick={()=>validarUno(it.id)} className="mt-2 w-full px-2 py-1 rounded bg-emerald-600 text-white text-sm">Validar</button>
                        <button onClick={()=>marcarHallazgo(it.id)} className="mt-2 w-full px-2 py-1 rounded bg-amber-600 text-white text-sm">Marcar hallazgo</button>
                      </div>
                    </div>

                    {/* Comentario visible si existe */}
                    {it.comentario && (
                      <div className="mt-2 text-xs text-gray-700">
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
  );
}
