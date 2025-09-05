// src/pages/CandidatoLaboral.jsx
import { useEffect, useState } from "react";
import api from "../api/axios";

/* ======= UI base (glass / dark) ======= */
const Field = ({ label, hint, className = "", children }) => (
  <label className={`text-sm text-slate-200 ${className}`}>
    {label && <div className="mb-1 font-medium">{label}</div>}
    {children}
    {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
  </label>
);

const Input = ({ className = "", ...rest }) => (
  <input
    className={
      "w-full rounded-xl border border-white/10 bg-white/10 p-3 text-white placeholder-white/40 outline-none " +
      "focus:border-white/30 focus:ring-2 focus:ring-blue-500/30 " +
      className
    }
    {...rest}
  />
);

const TextArea = ({ rows = 3, className = "", ...rest }) => (
  <textarea
    rows={rows}
    className={
      "w-full rounded-xl border border-white/10 bg-white/10 p-3 text-white placeholder-white/40 outline-none " +
      "focus:border-white/30 focus:ring-2 focus:ring-blue-500/30 " +
      className
    }
    {...rest}
  />
);

const Select = ({ value, onChange, children, className = "" }) => (
  <div className="relative">
    <select
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      className={
        "w-full appearance-none rounded-xl border border-white/10 bg-white/10 p-3 pr-10 text-white outline-none " +
        "focus:border-white/30 focus:ring-2 focus:ring-blue-500/30 " +
        className
      }
    >
      <option value="">Seleccione…</option>
      {children}
    </select>
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/60">▾</span>
  </div>
);

const Checkbox = ({ checked, onChange, label }) => (
  <label className="inline-flex items-center gap-2 text-sm text-slate-200">
    <input
      type="checkbox"
      className="h-4 w-4 accent-blue-600"
      checked={!!checked}
      onChange={(e) => onChange?.(e.target.checked)}
    />
    {label}
  </label>
);

/* ======= helpers ======= */
// Códigos del backend ↔ etiquetas amigables
const CONTRATO_OPTS = [
  { code: "INDEFINIDO", label: "Término indefinido" },
  { code: "FIJO", label: "Término fijo" },
  { code: "OBRA", label: "Obra o labor" },
  { code: "PRESTACION", label: "Prestacion de Servicios" },
  { code: "APRENDIZAJE", label: "Contrato de Aprendizaje" },  
  { code: "OTRO", label: "Otro" },  
];
const contratoLabel = (code) => CONTRATO_OPTS.find(o => o.code === code)?.label || "—";

const emptyExp = () => ({
  empresa: "",
  telefonos: "",               // UI (backend usa telefono)
  ingreso: "",
  retiro: "",
  motivo_retiro: "",
  direccion: "",
  email_contacto: "",
  verificada_camara_comercio: false, // UI (backend usa verificada_camara)
  volveria_contratar: null,    // true/false/null
  cargo: "",
  tipo_contrato: "",           // guardamos el CODE del backend aquí
  jefe_inmediato: "",
  concepto: "",

  // locales para archivo
  _local_file: null,
  _local_preview: null,
});

const fileKind = (name = "", type = "") => {
  if (type?.startsWith("image/")) return "image";
  if (name.toLowerCase().endsWith(".pdf") || type === "application/pdf") return "pdf";
  return "other";
};

const FilePreview = ({ url, name, mime }) => {
  if (!url) return null;
  const kind = fileKind(name, mime);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-2">
      {kind === "image" ? (
        <img src={url} alt={name || "archivo"} className="h-20 w-28 rounded object-cover" />
      ) : (
        <div className="grid h-20 w-28 place-items-center rounded bg-white/5 text-xs text-white/70">
          {kind === "pdf" ? "PDF" : "Archivo"}
        </div>
      )}
      <div className="text-xs">
        <div className="truncate max-w-[220px]">{name || "archivo"}</div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block rounded bg-blue-600 px-2 py-1 text-white"
        >
          Abrir
        </a>
      </div>
    </div>
  );
};

function pickErr(err) {
  const d = err?.response?.data;
  if (!d) return "Error desconocido.";
  if (typeof d === "string") return d;
  if (d.detail) return d.detail;
  try {
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join(" | ");
  } catch {
    return "No se pudo procesar el error.";
  }
}

/* ======= módulo ======= */
export default function CandidatoLaboral() {
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [estudioId, setEstudioId] = useState(null);

  // crear
  const [newExp, setNewExp] = useState(emptyExp());
  const [savingNew, setSavingNew] = useState(false);

  // editar
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);
  const isEditing = (id) => editId === id;

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      // 1) obtener estudio activo (como en Académico)
      const estRes = await api.get("/api/estudios/");
      const estList = Array.isArray(estRes.data) ? estRes.data : [];
      if (estList.length) setEstudioId(estList[0].id);

      // 2) cargar laborales y normalizar para UI
      const { data } = await api.get("/api/laborales/");
      const rows = (Array.isArray(data) ? data : []).map((x) => ({
        ...x,
        telefonos: x.telefono || "",                         // UI
        verificada_camara_comercio: !!x.verificada_camara,   // UI
        certificado_url: x.certificado || null,              // preview
      }));
      setList(rows);
    } catch {
      setMsg("No se pudo cargar tu historial laboral.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* ------- archivos (crear/editar) -------- */
  const handleNewFile = (e) => {
    const f = e.target.files?.[0] || null;
    if (!f) return setNewExp((s) => ({ ...s, _local_file: null, _local_preview: null }));
    const url = URL.createObjectURL(f);
    setNewExp((s) => ({ ...s, _local_file: f, _local_preview: url }));
  };

  const handleEditFile = (e) => {
    const f = e.target.files?.[0] || null;
    if (!f) return setDraft((s) => ({ ...s, _local_file: null, _local_preview: null }));
    const url = URL.createObjectURL(f);
    setDraft((s) => ({ ...s, _local_file: f, _local_preview: url }));
  };

  /* ------- crear ------- */
  const add = async (e) => {
    e.preventDefault();
    setSavingNew(true);
    setMsg("");
    try {
      if (!estudioId) {
        setMsg("No se encontró un estudio activo para asociar.");
        return;
      }

      // Mapea UI → backend
      const base = {
        estudio: estudioId,
        empresa: newExp.empresa,
        cargo: newExp.cargo,
        telefono: newExp.telefonos || "",
        email_contacto: newExp.email_contacto,
        direccion: newExp.direccion,
        ingreso: newExp.ingreso || null,
        retiro: newExp.retiro || null,
        motivo_retiro: newExp.motivo_retiro,
        tipo_contrato: newExp.tipo_contrato || "", // code (FIJO/INDEFINIDO/OBRA/OTRO)
        jefe_inmediato: newExp.jefe_inmediato,
        verificada_camara: !!newExp.verificada_camara_comercio,
        volveria_contratar: newExp.volveria_contratar,
        concepto: newExp.concepto,
      };

      if (newExp._local_file) {
        const fd = new FormData();
        Object.entries(base).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, String(v));
        });
        fd.append("certificado", newExp._local_file);
        const { data } = await api.post("/api/laborales/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const row = {
          ...data,
          telefonos: data.telefono || "",
          verificada_camara_comercio: !!data.verificada_camara,
          certificado_url: data.certificado || null,
        };
        setList((prev) => [row, ...prev]);
      } else {
        const { data } = await api.post("/api/laborales/", base);
        const row = {
          ...data,
          telefonos: data.telefono || "",
          verificada_camara_comercio: !!data.verificada_camara,
          certificado_url: data.certificado || null,
        };
        setList((prev) => [row, ...prev]);
      }

      if (newExp._local_preview) URL.revokeObjectURL(newExp._local_preview);
      setNewExp(emptyExp());
    } catch (err) {
      setMsg(`No se pudo crear: ${pickErr(err)}`);
    } finally {
      setSavingNew(false);
    }
  };

  /* ------- editar ------- */
  const startEdit = (r) => {
    setEditId(r.id);
    setDraft({ ...r, _local_file: null, _local_preview: null });
  };
  const cancelEdit = () => {
    if (draft?._local_preview) URL.revokeObjectURL(draft._local_preview);
    setEditId(null);
    setDraft(null);
  };
  const saveEdit = async (id) => {
    setMsg("");
    try {
      // Mapea UI → backend
      const base = {
        empresa: draft.empresa,
        cargo: draft.cargo,
        telefono: draft.telefonos || "",
        email_contacto: draft.email_contacto,
        direccion: draft.direccion,
        ingreso: draft.ingreso || null,
        retiro: draft.retiro || null,
        motivo_retiro: draft.motivo_retiro,
        tipo_contrato: draft.tipo_contrato || "",
        jefe_inmediato: draft.jefe_inmediato,
        verificada_camara: !!draft.verificada_camara_comercio,
        volveria_contratar: draft.volveria_contratar,
        concepto: draft.concepto,
      };

      if (draft._local_file) {
        const fd = new FormData();
        Object.entries(base).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, String(v));
        });
        fd.append("certificado", draft._local_file);
        const { data } = await api.patch(`/api/laborales/${id}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const row = {
          ...data,
          telefonos: data.telefono || "",
          verificada_camara_comercio: !!data.verificada_camara,
          certificado_url: data.certificado || null,
        };
        setList((prev) => prev.map((x) => (x.id === id ? row : x)));
      } else {
        const { data } = await api.patch(`/api/laborales/${id}/`, base);
        const row = {
          ...data,
          telefonos: data.telefono || "",
          verificada_camara_comercio: !!data.verificada_camara,
          certificado_url: data.certificado || null,
        };
        setList((prev) => prev.map((x) => (x.id === id ? row : x)));
      }
      cancelEdit();
    } catch (err) {
      setMsg(`No se pudo guardar: ${pickErr(err)}`);
    }
  };

  /* ------- eliminar ------- */
  const remove = async (id) => {
    if (!confirm("¿Eliminar este registro laboral?")) return;
    setMsg("");
    try {
      await api.delete(`/api/laborales/${id}/`);
      setList((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      setMsg(`No se pudo eliminar: ${pickErr(err)}`);
    }
  };

  return (
    <div className="min-h-screen text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(1200px_700px_at_20%_30%,rgba(255,255,255,0.06),transparent_60%),linear-gradient(180deg,#0b1220_0%,#0a0f1a_100%)]" />

      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Información y desempeño laboral</h1>

        {msg && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-200 backdrop-blur-md">
            <span className="text-sm">{msg}</span>
          </div>
        )}

        {/* Crear nueva experiencia */}
        <form
          onSubmit={add}
          className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl space-y-4"
        >
          <h2 className="text-lg font-semibold">Agregar experiencia</h2>

          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Empresa">
              <Input
                placeholder="Nombre de la empresa"
                value={newExp.empresa}
                onChange={(e) => setNewExp((s) => ({ ...s, empresa: e.target.value }))}
              />
            </Field>
            <Field label="Teléfonos">
              <Input
                placeholder="Fijo / Celular"
                value={newExp.telefonos}
                onChange={(e) => setNewExp((s) => ({ ...s, telefonos: e.target.value }))}
              />
            </Field>
            <Field label="Email de contacto">
              <Input
                type="email"
                placeholder="contacto@empresa.com"
                value={newExp.email_contacto}
                onChange={(e) => setNewExp((s) => ({ ...s, email_contacto: e.target.value }))}
              />
            </Field>

            <Field label="Dirección">
              <Input
                value={newExp.direccion}
                onChange={(e) => setNewExp((s) => ({ ...s, direccion: e.target.value }))}
              />
            </Field>
            <Field label="Ingreso" hint="YYYY-MM-DD">
              <Input
                type="date"
                value={newExp.ingreso}
                onChange={(e) => setNewExp((s) => ({ ...s, ingreso: e.target.value }))}
              />
            </Field>
            <Field label="Retiro" hint="YYYY-MM-DD">
              <Input
                type="date"
                value={newExp.retiro}
                onChange={(e) => setNewExp((s) => ({ ...s, retiro: e.target.value }))}
              />
            </Field>

            <Field label="Motivo de retiro" className="md:col-span-3">
              <Input
                placeholder="Opcional"
                value={newExp.motivo_retiro}
                onChange={(e) => setNewExp((s) => ({ ...s, motivo_retiro: e.target.value }))}
              />
            </Field>

            <Field label="Cargo desempeñado">
              <Input
                value={newExp.cargo}
                onChange={(e) => setNewExp((s) => ({ ...s, cargo: e.target.value }))}
              />
            </Field>
            <Field label="Tipo de contrato">
              <Select
                value={newExp.tipo_contrato} // CODE
                onChange={(v) => setNewExp((s) => ({ ...s, tipo_contrato: v }))}
              >
                {CONTRATO_OPTS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Jefe inmediato">
              <Input
                value={newExp.jefe_inmediato}
                onChange={(e) => setNewExp((s) => ({ ...s, jefe_inmediato: e.target.value }))}
              />
            </Field>

            <Field label="Validaciones" className="md:col-span-3">
              <div className="flex flex-wrap items-center gap-4">
                <Checkbox
                  checked={newExp.verificada_camara_comercio}
                  onChange={(v) =>
                    setNewExp((s) => ({ ...s, verificada_camara_comercio: v }))
                  }
                  label="Empresa verificada en Cámara de Comercio"
                />
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-200">¿Volvería a contratar?</span>
                  <button
                    type="button"
                    onClick={() => setNewExp((s) => ({ ...s, volveria_contratar: true }))}
                    className={`rounded-lg px-3 py-1 text-sm ${
                      newExp.volveria_contratar === true
                        ? "bg-emerald-600 text-white"
                        : "border border-white/10 bg-white/10 text-slate-200"
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewExp((s) => ({ ...s, volveria_contratar: false }))}
                    className={`rounded-lg px-3 py-1 text-sm ${
                      newExp.volveria_contratar === false
                        ? "bg-rose-600 text-white"
                        : "border border-white/10 bg-white/10 text-slate-200"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </Field>

            {/* Certificado laboral */}
            <Field label="Cargue su Certificado Laboral" className="md:col-span-3">
              <div className="flex flex-col gap-3">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleNewFile}
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-white/10 file:bg-white/10 file:px-3 file:py-1.5 file:text-white file:hover:bg-white/20"
                />
                {newExp._local_preview && (
                  <FilePreview
                    url={newExp._local_preview}
                    name={newExp._local_file?.name}
                    mime={newExp._local_file?.type}
                  />
                )}
              </div>
            </Field>

            <Field label="Concepto" className="md:col-span-3">
              <TextArea
                placeholder="Observaciones / concepto"
                value={newExp.concepto}
                onChange={(e) => setNewExp((s) => ({ ...s, concepto: e.target.value }))}
              />
            </Field>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={savingNew}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              Agregar
            </button>
          </div>
        </form>

        {/* Listado / Edición */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Mis experiencias</h2>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-slate-300">Cargando…</div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-slate-300">Aún no registras experiencias.</div>
          ) : (
            list.map((r) =>
              isEditing(r.id) ? (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl space-y-4">
                  {/* edición */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <Field label="Empresa"><Input value={draft.empresa} onChange={(e)=>setDraft(s=>({...s,empresa:e.target.value}))}/></Field>
                    <Field label="Teléfonos"><Input value={draft.telefonos} onChange={(e)=>setDraft(s=>({...s,telefonos:e.target.value}))}/></Field>
                    <Field label="Email de contacto"><Input type="email" value={draft.email_contacto} onChange={(e)=>setDraft(s=>({...s,email_contacto:e.target.value}))}/></Field>

                    <Field label="Dirección"><Input value={draft.direccion} onChange={(e)=>setDraft(s=>({...s,direccion:e.target.value}))}/></Field>
                    <Field label="Ingreso"><Input type="date" value={draft.ingreso || ""} onChange={(e)=>setDraft(s=>({...s,ingreso:e.target.value}))}/></Field>
                    <Field label="Retiro"><Input type="date" value={draft.retiro || ""} onChange={(e)=>setDraft(s=>({...s,retiro:e.target.value}))}/></Field>

                    <Field label="Motivo de retiro" className="md:col-span-3">
                      <Input value={draft.motivo_retiro} onChange={(e)=>setDraft(s=>({...s,motivo_retiro:e.target.value}))}/>
                    </Field>

                    <Field label="Cargo desempeñado"><Input value={draft.cargo} onChange={(e)=>setDraft(s=>({...s,cargo:e.target.value}))}/></Field>
                    <Field label="Tipo de contrato">
                      <Select value={draft.tipo_contrato} onChange={(v)=>setDraft(s=>({...s,tipo_contrato:v}))}>
                        {CONTRATO_OPTS.map(c=> <option key={c.code} value={c.code}>{c.label}</option>)}
                      </Select>
                    </Field>
                    <Field label="Jefe inmediato"><Input value={draft.jefe_inmediato} onChange={(e)=>setDraft(s=>({...s,jefe_inmediato:e.target.value}))}/></Field>

                    <Field label="Validaciones" className="md:col-span-3">
                      <div className="flex flex-wrap items-center gap-4">
                        <Checkbox checked={draft.verificada_camara_comercio} onChange={(v)=>setDraft(s=>({...s,verificada_camara_comercio:v}))} label="Empresa verificada en Cámara de Comercio"/>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-200">¿Volvería a contratar?</span>
                          <button type="button" onClick={()=>setDraft(s=>({...s,volveria_contratar:true}))}
                            className={`rounded-lg px-3 py-1 text-sm ${draft.volveria_contratar===true ? "bg-emerald-600 text-white":"border border-white/10 bg-white/10 text-slate-200"}`}>Sí</button>
                          <button type="button" onClick={()=>setDraft(s=>({...s,volveria_contratar:false}))}
                            className={`rounded-lg px-3 py-1 text-sm ${draft.volveria_contratar===false ? "bg-rose-600 text-white":"border border-white/10 bg-white/10 text-slate-200"}`}>No</button>
                        </div>
                      </div>
                    </Field>

                    {/* certificado actual + reemplazo */}
                    <Field label="Certificado laboral" className="md:col-span-3">
                      <div className="flex flex-col gap-3">
                        {(draft._local_preview || draft.certificado_url) && (
                          <FilePreview
                            url={draft._local_preview || draft.certificado_url}
                            name={draft._local_file?.name || draft.certificado_nombre}
                            mime={draft._local_file?.type || draft.certificado_mime}
                          />
                        )}
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={handleEditFile}
                          className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-white/10 file:bg-white/10 file:px-3 file:py-1.5 file:text-white file:hover:bg-white/20"
                        />
                      </div>
                    </Field>

                    <Field label="Concepto" className="md:col-span-3">
                      <TextArea value={draft.concepto} onChange={(e)=>setDraft(s=>({...s,concepto:e.target.value}))}/>
                    </Field>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={cancelEdit} className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/20">Cancelar</button>
                    <button type="button" onClick={()=>saveEdit(r.id)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">Guardar</button>
                  </div>
                </div>
              ) : (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold">{r.empresa || "—"} <span className="text-slate-300">· {r.cargo || "—"}</span></div>
                    <div className="text-sm text-slate-300">
                      {r.ingreso || "—"} — {r.retiro || "Actual"} · {contratoLabel(r.tipo_contrato)}
                    </div>
                  </div>

                  <div className="mt-3 grid md:grid-cols-3 gap-3 text-sm">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-slate-300">Contacto</div>
                      <div>Tel: {r.telefonos || "—"}</div>
                      <div>Email: {r.email_contacto || "—"}</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-slate-300">Dirección / Jefe</div>
                      <div>{r.direccion || "—"}</div>
                      <div>Jefe: {r.jefe_inmediato || "—"}</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-slate-300">Validaciones</div>
                      <div>Cam. Comercio: {r.verificada_camara_comercio ? "Sí" : "No"}</div>
                      <div>¿Recontrataría?: {r.volveria_contratar === true ? "Sí" : r.volveria_contratar === false ? "No" : "—"}</div>
                    </div>
                  </div>

                  {r.certificado_url && (
                    <div className="mt-3">
                      <FilePreview
                        url={r.certificado_url}
                        name={r.certificado_nombre}
                        mime={r.certificado_mime}
                      />
                    </div>
                  )}

                  {r.motivo_retiro && (
                    <div className="mt-3 text-sm">
                      <span className="text-slate-300">Motivo de retiro: </span>{r.motivo_retiro}
                    </div>
                  )}
                  {r.concepto && (
                    <div className="mt-1 text-sm">
                      <span className="text-slate-300">Concepto: </span>{r.concepto}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button type="button" onClick={()=>startEdit(r)} className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/20">Editar</button>
                    <button type="button" onClick={()=>remove(r.id)} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500">Eliminar</button>
                  </div>
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}
