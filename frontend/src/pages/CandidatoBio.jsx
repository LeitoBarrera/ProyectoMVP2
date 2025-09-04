// src/pages/CandidatoBio.jsx
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import api from "../api/axios";
import { getDepartamentos, getMunicipios } from "../api/geo";
import ConsentWizard from "../components/ConsentWizard";

/* ======= PRIMITIVAS UI (glass / dark) ======= */
const Field = ({ label, hint, className = "", children }) => (
  <label className={`text-sm text-slate-200 ${className}`}>
    <div className="mb-1 font-medium">{label}</div>
    {children}
    {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
  </label>
);

// Input glass
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

// TextArea glass
const TextArea = ({ className = "", rows = 4, ...rest }) => (
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

// Select glass (onChange te entrega el value directamente)
const Select = ({ label, value, onChange, children, className = "" }) => (
  <Field label={label}>
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
  </Field>
);

export default function CandidatoBio(){
  const { studyId } = useOutletContext(); // id del estudio desde CandidatoPortal
  const [showConsent, setShowConsent] = useState(false);
  const [autorizado, setAutorizado] = useState(false);

  const [me, setMe] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [deps, setDeps] = useState([]);
  const [munis, setMunis] = useState([]);
  const [qDep, setQDep] = useState("");
  const [qMuni, setQMuni] = useState("");

  // ---------------- Consentimientos ----------------
  const loadConsent = async (sid) => {
    if (!sid) { setAutorizado(false); setShowConsent(false); return; }
    try {
      const { data } = await api.get(`/api/estudios/${sid}/resumen/`);
      const paso1 = !!data?.autorizacion?.firmada;

      const ls = JSON.parse(localStorage.getItem(`consents:${sid}`) || "{}");
      const paso2 = !!ls.habeas; // (mientras no existan en BD)
      const paso3 = !!ls.tc;

      const ok = paso1 && paso2 && paso3;
      setAutorizado(ok);
      setShowConsent(!ok);
    } catch {
      setAutorizado(false);
      setShowConsent(true);
    }
  };

  // ---------------- Datos candidato ----------------
  const loadMe = async () => {
    const { data } = await api.get("/api/candidatos/me/");
    setMe(data);
    const dps = await getDepartamentos();
    setDeps(dps);
    if (data?.departamento_id) {
      const ms = await getMunicipios(data.departamento_id);
      setMunis(ms);
    }
  };

  useEffect(() => { loadMe().catch(()=>setMsg("No se pudo cargar tu ficha.")); }, []);
  useEffect(() => { loadConsent(studyId); }, [studyId]);

  // edad calculada
  const edad = useMemo(()=>{
    if(!me?.fecha_nacimiento) return "";
    const birth = new Date(me.fecha_nacimiento);
    const now = new Date();
    let e = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) e--;
    return e;
  }, [me?.fecha_nacimiento]);

  // autosave por campo
  const saveField = async (patch) => {
    setSaving(true);
    setMsg("");
    try{
      const { data } = await api.patch("/api/candidatos/me/", patch);
      setMe(data);
    }catch{
      setMsg("No se pudo guardar. Revisa los datos.");
    }finally{
      setSaving(false);
    }
  };

  const onDepChange = async (depId) => {
    const dep = deps.find(d=>String(d.id) === String(depId));
    await saveField({
      departamento_id: depId || null,
      departamento_nombre: dep?.nombre || null,
      municipio_id: null,
      municipio_nombre: null
    });
    if (depId) {
      const ms = await getMunicipios(depId);
      setMunis(ms);
    } else {
      setMunis([]);
    }
  };

  const onMuniChange = async (munId) => {
    const m = munis.find(x=>String(x.id) === String(munId));
    await saveField({
      municipio_id: munId || null,
      municipio_nombre: m?.nombre || null
    });
  };

  const tiposDoc = [["CC","Cédula"],["TI","Tarjeta de identidad"],["CE","Cédula de extranjería"],["PA","Pasaporte"]];
  const sexos = [["M","Masculino"],["F","Femenino"],["X","Otro/No binario"]];
  const grupos = ["O-","O+","A-","A+","B-","B+","AB-","AB+"];
  const estratos = ["1","2","3","4","5","6"];
  const tipoZona = [["URBANO","Urbano"],["RURAL","Rural"]];

  const filDeps = useMemo(()=>{
    const q = qDep.trim().toLowerCase();
    return q ? deps.filter(d => (d.nombre||"").toLowerCase().includes(q)) : deps;
  }, [qDep, deps]);

  const filMunis = useMemo(()=>{
    const q = qMuni.trim().toLowerCase();
    return q ? munis.filter(m => (m.nombre||"").toLowerCase().includes(q)) : munis;
  }, [qMuni, munis]);

  if (!me) {
    return (
      <div className="min-h-screen text-slate-100">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(1200px_700px_at_20%_30%,rgba(255,255,255,0.06),transparent_60%),linear-gradient(180deg,#0b1220_0%,#0a0f1a_100%)]" />
        <div className="max-w-5xl mx-auto p-6">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-100">
      {/* Fondo sutil como en login */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(1200px_700px_at_20%_30%,rgba(255,255,255,0.06),transparent_60%),linear-gradient(180deg,#0b1220_0%,#0a0f1a_100%)]" />

      {/* Wizard de consentimientos */}
      {showConsent && studyId && (
        <ConsentWizard
          show
          studyId={studyId}
          onDone={async () => { await loadConsent(studyId); }}
          onCancel={() => setShowConsent(false)}
        />
      )}

      <div className="max-w-5xl mx-auto p-6 space-y-6 relative">
        <h1 className="text-3xl font-bold">Datos biográficos</h1>

        {!autorizado && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
            Debes completar los consentimientos para poder editar tu información.
          </div>
        )}
        {msg && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
            {msg}
          </div>
        )}
        {saving && <div className="text-xs text-slate-400">Guardando…</div>}

        {/* Deshabilita todo si no está autorizado */}
        <fieldset
          disabled={!autorizado}
          className={!autorizado ? "opacity-60 pointer-events-none select-none" : ""}
        >
          <div className="grid md:grid-cols-3 gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl">
            <Field label="Nombres">
              <Input
                placeholder="Tu(s) nombre(s)"
                value={me.nombre || ""}
                onChange={e=>setMe(s=>({...s,nombre:e.target.value}))}
                onBlur={e=>saveField({nombre:e.target.value})}
              />
            </Field>

            <Field label="Apellidos">
              <Input
                placeholder="Tu(s) apellido(s)"
                value={me.apellido || ""}
                onChange={e=>setMe(s=>({...s,apellido:e.target.value}))}
                onBlur={e=>saveField({apellido:e.target.value})}
              />
            </Field>

            <Select
              label="Tipo de documento"
              value={me.tipo_documento || ""}
              onChange={(v)=>saveField({tipo_documento: v || null})}
            >
              {tiposDoc.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </Select>

            <Field label="Número de cédula">
              <Input
                placeholder="Ej: 12345678"
                value={me.cedula || ""}
                onChange={e=>setMe(s=>({...s,cedula:e.target.value}))}
                onBlur={e=>saveField({cedula:e.target.value})}
              />
            </Field>

            <Field label="Fecha de nacimiento" hint="YYYY-MM-DD">
              <Input
                type="date"
                value={me.fecha_nacimiento || ""}
                onChange={e=>setMe(s=>({...s,fecha_nacimiento:e.target.value}))}
                onBlur={e=>saveField({fecha_nacimiento:e.target.value || null})}
              />
            </Field>

            <Field label="Edad actual">
              <Input value={edad} readOnly />
            </Field>

            <Field label="Estatura (cm)">
              <Input
                type="number"
                placeholder="Ej: 175"
                value={me.estatura_cm ?? ""}
                onChange={e=>setMe(s=>({...s,estatura_cm:e.target.value}))}
                onBlur={e=>saveField({estatura_cm:e.target.value ? Number(e.target.value): null})}
              />
            </Field>

            <Select
              label="Grupo sanguíneo"
              value={me.grupo_sanguineo || ""}
              onChange={(v)=>saveField({grupo_sanguineo: v || null})}
            >
              {grupos.map(g => <option key={g} value={g}>{g}</option>)}
            </Select>

            <Select
              label="Sexo"
              value={me.sexo || ""}
              onChange={(v)=>saveField({sexo: v || null})}
            >
              {sexos.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </Select>

            <Field label="Fecha expedición cédula">
              <Input
                type="date"
                value={me.fecha_expedicion || ""}
                onChange={e=>setMe(s=>({...s,fecha_expedicion:e.target.value}))}
                onBlur={e=>saveField({fecha_expedicion:e.target.value || null})}
              />
            </Field>

            <Field label="Dirección de residencia">
              <Input
                placeholder="Calle 1 # 2-3"
                value={me.direccion || ""}
                onChange={e=>setMe(s=>({...s,direccion:e.target.value}))}
                onBlur={e=>saveField({direccion:e.target.value})}
              />
            </Field>

            <Field label="Barrio">
              <Input
                value={me.barrio || ""}
                onChange={e=>setMe(s=>({...s,barrio:e.target.value}))}
                onBlur={e=>saveField({barrio:e.target.value})}
              />
            </Field>

            {/* Departamento con lupa */}
            <Field label="Departamento" className="md:col-span-1">
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar…"
                  value={qDep}
                  onChange={(e)=>setQDep(e.target.value)}
                  className="flex-1"
                />
                <span className="grid place-items-center rounded-xl border border-white/10 bg-white/10 px-3 text-white/70">
                  🔎
                </span>
              </div>
              <div className="mt-2">
                <Select
                  label=""
                  value={me.departamento_id || ""}
                  onChange={(v)=>onDepChange(v)}
                >
                  {filDeps.map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}
                </Select>
              </div>
            </Field>

            {/* Municipio con lupa */}
            <Field label="Municipio" className="md:col-span-1">
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar…"
                  value={qMuni}
                  onChange={(e)=>setQMuni(e.target.value)}
                  className="flex-1"
                />
                <span className="grid place-items-center rounded-xl border border-white/10 bg-white/10 px-3 text-white/70">
                  🔎
                </span>
              </div>
              <div className="mt-2">
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border border-white/10 bg-white/10 p-3 pr-10 text-white outline-none focus:border-white/30 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                    value={me.municipio_id || ""}
                    onChange={(e)=>onMuniChange(e.target.value)}
                    disabled={!me.departamento_id}
                  >
                    <option value="">{me.departamento_id ? "Seleccione…" : "Seleccione primero el departamento"}</option>
                    {filMunis.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/60">▾</span>
                </div>
              </div>
            </Field>

            <Field label="Comuna">
              <Input
                value={me.comuna || ""}
                onChange={e=>setMe(s=>({...s,comuna:e.target.value}))}
                onBlur={e=>saveField({comuna:e.target.value})}
              />
            </Field>

            <Select
              label="Estrato"
              value={me.estrato || ""}
              onChange={(v)=>saveField({estrato: v || null})}
            >
              {estratos.map(e => <option key={e} value={e}>{e}</option>)}
            </Select>

            <Select
              label="Tipo de zona"
              value={me.tipo_zona || ""}
              onChange={(v)=>saveField({tipo_zona: v || null})}
            >
              {tipoZona.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </Select>

            <Field label="Teléfono">
              <Input
                placeholder="+57 ..."
                value={me.telefono || ""}
                onChange={e=>setMe(s=>({...s,telefono:e.target.value}))}
                onBlur={e=>saveField({telefono:e.target.value})}
              />
            </Field>

            <Field label="EPS">
              <Input
                value={me.eps || ""}
                onChange={e=>setMe(s=>({...s,eps:e.target.value}))}
                onBlur={e=>saveField({eps:e.target.value})}
              />
            </Field>

            <Field label="Caja de compensación">
              <Input
                value={me.caja_compensacion || ""}
                onChange={e=>setMe(s=>({...s,caja_compensacion:e.target.value}))}
                onBlur={e=>saveField({caja_compensacion:e.target.value})}
              />
            </Field>

            <Field label="Fondo pensión">
              <Input
                value={me.pension_fondo || ""}
                onChange={e=>setMe(s=>({...s,pension_fondo:e.target.value}))}
                onBlur={e=>saveField({pension_fondo:e.target.value})}
              />
            </Field>

            <Field label="Fondo cesantías">
              <Input
                value={me.cesantias_fondo || ""}
                onChange={e=>setMe(s=>({...s,cesantias_fondo:e.target.value}))}
                onBlur={e=>saveField({cesantias_fondo:e.target.value})}
              />
            </Field>

            <Field label="Sisbén">
              <Input
                value={me.sisben || ""}
                onChange={e=>setMe(s=>({...s,sisben:e.target.value}))}
                onBlur={e=>saveField({sisben:e.target.value})}
              />
            </Field>

            <Field label="Perfil del aspirante" className="md:col-span-3">
              <TextArea
                placeholder="Cuéntanos brevemente sobre ti…"
                value={me.perfil_aspirante || ""}
                onChange={e=>setMe(s=>({...s,perfil_aspirante:e.target.value}))}
                onBlur={e=>saveField({perfil_aspirante:e.target.value})}
              />
            </Field>

            <Select
              label="¿Estudia actualmente?"
              value={me.estudia_actualmente ? "SI" : (me.estudia_actualmente===false ? "NO" : "")}
              onChange={(v)=>saveField({estudia_actualmente: v==="SI"})}
            >
              <option value="SI">Sí</option>
              <option value="NO">No</option>
            </Select>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
