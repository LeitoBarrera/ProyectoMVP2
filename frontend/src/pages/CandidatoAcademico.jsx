// src/pages/CandidatoAcademico.jsx
import { useEffect, useState } from "react";
import api from "../api/axios";

/* ========== UI “glass” ========= */
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

const TextArea = ({ className = "", rows = 3, ...rest }) => (
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

/* ========== Helpers ========= */
const grados = [
  "Bachiller",
  "Técnico",
  "Tecnólogo",
  "Profesional",
  "Especialización",
  "Maestría",
  "Doctorado",
  "Otro",
];

const emptyReg = () => ({
  grado: "",
  titulo: "",
  institucion: "",
  fecha_graduacion: "",
  ciudad: "",
  acta_numero: "",
  folio_numero: "",
  libro_registro: "",
  presenta_original: false,
  rector: "",
  secretario: "",
  concepto: "",

  // local (no viaja al backend)
  _local_file: null,
  _local_preview: null,
});

const fileKind = (name = "", type = "") => {
  if (type.startsWith("image/")) return "image";
  if (name.toLowerCase().endsWith(".pdf") || type === "application/pdf") return "pdf";
  return "other";
};

const FilePreview = ({ url, name, mime }) => {
  const kind = fileKind(name, mime);
  if (!url) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-2">
      {kind === "image" ? (
        <img
          src={url}
          alt={name || "archivo"}
          className="h-20 w-28 rounded object-cover"
        />
      ) : (
        <div className="grid h-20 w-28 place-items-center rounded bg-white/5 text-white/70 text-xs">
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

function extractErr(err) {
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

/* ========= Campos a enviar + helpers de payload ========= */
const ACADEMICO_FIELDS_CREATE = [
  "estudio",
  "titulo",
  "institucion",
  "fecha_graduacion",
  "ciudad",
  "presenta_original",
  "grado",
  "acta_numero",
  "folio_numero",
  "libro_registro",
  "rector",
  "secretario",
  "concepto",
];

const ACADEMICO_FIELDS_UPDATE = [
  "titulo",
  "institucion",
  "fecha_graduacion",
  "ciudad",
  "presenta_original",
  "grado",
  "acta_numero",
  "folio_numero",
  "libro_registro",
  "rector",
  "secretario",
  "concepto",
];

// normaliza fechas vacías a null y conserva strings vacíos para permitir limpiar campos
const normalizeValue = (k, v) => (k === "fecha_graduacion" && v === "" ? null : v);

const buildPayload = (source, fields, extras = {}) => {
  const obj = { ...extras };
  fields.forEach((k) => {
    const v = source[k];
    if (v !== undefined && v !== null) obj[k] = normalizeValue(k, v);
  });
  return obj;
};

/* ========== Módulo ========== */
export default function CandidatoAcademico() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [estudioId, setEstudioId] = useState(null);

  const [newReg, setNewReg] = useState(emptyReg());
  const [savingNew, setSavingNew] = useState(false);

  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);
  const isEditing = (id) => editId === id;

  /* Cargar lista */
  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      // 1) obtener el estudio del candidato (toma el primero)
      const estRes = await api.get("/api/estudios/");
      const estList = Array.isArray(estRes.data) ? estRes.data : [];
      if (estList.length) setEstudioId(estList[0].id);

      // 2) cargar académicos y normalizar para la UI (archivo -> soporte_url)
      const { data } = await api.get("/api/academicos/");
      const rows = (Array.isArray(data) ? data : []).map((x) => ({
        ...x,
        soporte_url: x.archivo || null,
      }));
      setList(rows);
    } catch (e) {
      setMsg("No se pudo cargar tu información académica.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* Handlers de archivo (crear/editar) */
  const handleNewFile = (e) => {
    const f = e.target.files?.[0] || null;
    if (!f) return setNewReg((s) => ({ ...s, _local_file: null, _local_preview: null }));
    const url = URL.createObjectURL(f);
    setNewReg((s) => ({ ...s, _local_file: f, _local_preview: url }));
  };

  const handleEditFile = (e) => {
    const f = e.target.files?.[0] || null;
    if (!f) return setDraft((s) => ({ ...s, _local_file: null, _local_preview: null }));
    const url = URL.createObjectURL(f);
    setDraft((s) => ({ ...s, _local_file: f, _local_preview: url }));
  };

  /* Crear */
  const add = async (e) => {
    e.preventDefault();
    setSavingNew(true);
    setMsg("");
    try {
      if (!estudioId) {
        setMsg("No se encontró un estudio activo para asociar.");
        return;
      }

      // payload con TODOS los campos (incl. nuevos)
      const base = buildPayload(newReg, ACADEMICO_FIELDS_CREATE, { estudio: estudioId });

      if (newReg._local_file) {
        const fd = new FormData();
        Object.entries(base).forEach(([k, v]) => {
          if (v !== null) fd.append(k, String(v));
        });
        fd.append("archivo", newReg._local_file);
        const { data } = await api.post("/api/academicos/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const row = { ...data, soporte_url: data.archivo || null };
        setList((prev) => [row, ...prev]);
      } else {
        const { data } = await api.post("/api/academicos/", base);
        const row = { ...data, soporte_url: data.archivo || null };
        setList((prev) => [row, ...prev]);
      }
      // limpiar
      if (newReg._local_preview) URL.revokeObjectURL(newReg._local_preview);
      setNewReg(emptyReg());
    } catch (err) {
      setMsg(`No se pudo crear: ${extractErr(err)}`);
    } finally {
      setSavingNew(false);
    }
  };

  /* Editar */
  const startEdit = (reg) => {
    setEditId(reg.id);
    setDraft({ ...reg, _local_file: null, _local_preview: null });
  };
  const cancelEdit = () => {
    if (draft?._local_preview) URL.revokeObjectURL(draft._local_preview);
    setEditId(null);
    setDraft(null);
  };
  const saveEdit = async (id) => {
    setMsg("");
    try {
      // payload con TODOS los campos editables (incl. nuevos)
      const base = buildPayload(draft, ACADEMICO_FIELDS_UPDATE);

      if (draft._local_file) {
        const fd = new FormData();
        Object.entries(base).forEach(([k, v]) => {
          if (v !== null) fd.append(k, String(v));
        });
        fd.append("archivo", draft._local_file);
        const { data } = await api.patch(`/api/academicos/${id}/`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const row = { ...data, soporte_url: data.archivo || null };
        setList((prev) => prev.map((r) => (r.id === id ? row : r)));
      } else {
        const { data } = await api.patch(`/api/academicos/${id}/`, base);
        const row = { ...data, soporte_url: data.archivo || null };
        setList((prev) => prev.map((r) => (r.id === id ? row : r)));
      }
      cancelEdit();
    } catch (err) {
      setMsg(`No se pudo guardar: ${extractErr(err)}`);
    }
  };

  /* Eliminar */
  const remove = async (id) => {
    if (!confirm("¿Eliminar este registro académico?")) return;
    setMsg("");
    try {
      await api.delete(`/api/academicos/${id}/`);
      setList((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setMsg(`No se pudo eliminar: ${extractErr(err)}`);
    }
  };

  return (
    <div className="min-h-screen text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(1200px_700px_at_20%_30%,rgba(255,255,255,0.06),transparent_60%),linear-gradient(180deg,#0b1220_0%,#0a0f1a_100%)]" />

      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Información académica</h1>

        {msg && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-200 backdrop-blur-md">
            <span className="text-sm">{msg}</span>
          </div>
        )}

        {/* Crear nuevo */}
        <form
          onSubmit={add}
          className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl space-y-4"
        >
          <h2 className="text-lg font-semibold">Agregar estudio</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Grado / Nivel">
              <Select
                value={newReg.grado}
                onChange={(v) => setNewReg((s) => ({ ...s, grado: v }))}
              >
                {grados.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Título">
              <Input
                placeholder="Ej: Ingeniero de Sistemas"
                value={newReg.titulo}
                onChange={(e) => setNewReg((s) => ({ ...s, titulo: e.target.value }))}
              />
            </Field>
            <Field label="Institución">
              <Input
                placeholder="Universidad..."
                value={newReg.institucion}
                onChange={(e) =>
                  setNewReg((s) => ({ ...s, institucion: e.target.value }))
                }
              />
            </Field>

            <Field label="Fecha de graduación" hint="YYYY-MM-DD">
              <Input
                type="date"
                value={newReg.fecha_graduacion}
                onChange={(e) =>
                  setNewReg((s) => ({ ...s, fecha_graduacion: e.target.value }))
                }
              />
            </Field>
            <Field label="Ciudad">
              <Input
                placeholder="Ciudad"
                value={newReg.ciudad}
                onChange={(e) => setNewReg((s) => ({ ...s, ciudad: e.target.value }))}
              />
            </Field>

            <Field label="Acta No.">
              <Input
                value={newReg.acta_numero}
                onChange={(e) =>
                  setNewReg((s) => ({ ...s, acta_numero: e.target.value }))
                }
              />
            </Field>
            <Field label="Folio No.">
              <Input
                value={newReg.folio_numero}
                onChange={(e) =>
                  setNewReg((s) => ({ ...s, folio_numero: e.target.value }))
                }
              />
            </Field>
            <Field label="Libro / Registro / Consecutivo">
              <Input
                value={newReg.libro_registro}
                onChange={(e) =>
                  setNewReg((s) => ({ ...s, libro_registro: e.target.value }))
                }
              />
            </Field>

            {/* Archivo */}
            <Field label="Soporte (PDF o imagen)" className="md:col-span-3">
              <div className="flex flex-col gap-3">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleNewFile}
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-white/10 file:bg-white/10 file:px-3 file:py-1.5 file:text-white file:hover:bg-white/20"
                />
                {newReg._local_preview && (
                  <FilePreview
                    url={newReg._local_preview}
                    name={newReg._local_file?.name}
                    mime={newReg._local_file?.type}
                  />
                )}
              </div>
            </Field>

            <Field label=" " className="md:col-span-3">
              <div className="flex flex-wrap items-center gap-4">
                <Checkbox
                  checked={newReg.presenta_original}
                  onChange={(v) =>
                    setNewReg((s) => ({ ...s, presenta_original: v }))
                  }
                  label="Presenta original"
                />
                <Field label="Rector(a)">
                  <Input
                    value={newReg.rector}
                    onChange={(e) =>
                      setNewReg((s) => ({ ...s, rector: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Secretario(a) general">
                  <Input
                    value={newReg.secretario}
                    onChange={(e) =>
                      setNewReg((s) => ({ ...s, secretario: e.target.value }))
                    }
                  />
                </Field>
              </div>
            </Field>

            <Field label="Concepto" className="md:col-span-3">
              <TextArea
                rows={3}
                placeholder="Observaciones / concepto"
                value={newReg.concepto}
                onChange={(e) =>
                  setNewReg((s) => ({ ...s, concepto: e.target.value }))
                }
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

        {/* Listado / edición */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Mis estudios</h2>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-slate-300">
              Cargando…
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-slate-300">
              Aún no registras estudios.
            </div>
          ) : (
            list.map((r) =>
              isEditing(r.id) ? (
                <div
                  key={r.id}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl space-y-4"
                >
                  {/* --- edición --- */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <Field label="Grado / Nivel">
                      <Select
                        value={draft.grado}
                        onChange={(v) => setDraft((s) => ({ ...s, grado: v }))}
                      >
                        {grados.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Título">
                      <Input
                        value={draft.titulo}
                        onChange={(e) =>
                          setDraft((s) => ({ ...s, titulo: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Institución">
                      <Input
                        value={draft.institucion}
                        onChange={(e) =>
                          setDraft((s) => ({ ...s, institucion: e.target.value }))
                        }
                      />
                    </Field>

                    <Field label="Fecha de graduación">
                      <Input
                        type="date"
                        value={draft.fecha_graduacion || ""}
                        onChange={(e) =>
                          setDraft((s) => ({ ...s, fecha_graduacion: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Ciudad">
                      <Input
                        value={draft.ciudad}
                        onChange={(e) =>
                          setDraft((s) => ({ ...s, ciudad: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Acta No.">
                      <Input
                        value={draft.acta_numero}
                        onChange={(e) =>
                          setDraft((s) => ({ ...s, acta_numero: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Folio No.">
                      <Input
                        value={draft.folio_numero}
                        onChange={(e) =>
                          setDraft((s) => ({ ...s, folio_numero: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Libro / Registro / Consecutivo">
                      <Input
                        value={draft.libro_registro}
                        onChange={(e) =>
                          setDraft((s) => ({ ...s, libro_registro: e.target.value }))
                        }
                      />
                    </Field>

                    {/* Archivo: actual + reemplazo */}
                    <Field label="Soporte" className="md:col-span-3">
                      <div className="flex flex-col gap-3">
                        {(draft._local_preview ||
                          draft.soporte_url) && (
                          <FilePreview
                            url={draft._local_preview || draft.soporte_url}
                            name={draft._local_file?.name || draft.soporte_nombre}
                            mime={draft._local_file?.type || draft.soporte_mime}
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

                    <Field label=" " className="md:col-span-3">
                      <div className="flex flex-wrap items-center gap-4">
                        <Checkbox
                          checked={draft.presenta_original}
                          onChange={(v) =>
                            setDraft((s) => ({ ...s, presenta_original: v }))
                          }
                          label="Presenta original"
                        />
                        <Field label="Rector(a)">
                          <Input
                            value={draft.rector}
                            onChange={(e) =>
                              setDraft((s) => ({ ...s, rector: e.target.value }))
                            }
                          />
                        </Field>
                        <Field label="Secretario(a) general">
                          <Input
                            value={draft.secretario}
                            onChange={(e) =>
                              setDraft((s) => ({ ...s, secretario: e.target.value }))
                            }
                          />
                        </Field>
                      </div>
                    </Field>

                    <Field label="Concepto" className="md:col-span-3">
                      <TextArea
                        value={draft.concepto}
                        onChange={(e) =>
                          setDraft((s) => ({ ...s, concepto: e.target.value }))
                        }
                      />
                    </Field>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/20"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(r.id)}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={r.id}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold">
                      {r.titulo || "—"}{" "}
                      <span className="text-slate-300">({r.grado || "—"})</span>
                    </div>
                    <div className="text-sm text-slate-300">
                      {r.institucion || "—"} · {r.ciudad || "—"} ·{" "}
                      {r.fecha_graduacion || "—"}
                    </div>
                  </div>

                  <div className="mt-3 grid md:grid-cols-3 gap-3 text-sm">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-slate-300">Acta / Folio / Libro</div>
                      <div>
                        {r.acta_numero || "—"} / {r.folio_numero || "—"} /{" "}
                        {r.libro_registro || "—"}
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-slate-300">Autoridades</div>
                      <div>Rector(a): {r.rector || "—"}</div>
                      <div>Secretario(a): {r.secretario || "—"}</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-slate-300">Original</div>
                      <div>{r.presenta_original ? "Sí" : "No"}</div>
                    </div>
                  </div>

                  {/* Vista previa del soporte si existe */}
                  {r.soporte_url && (
                    <div className="mt-3">
                      <FilePreview
                        url={r.soporte_url}
                        name={r.soporte_nombre}
                        mime={r.soporte_mime}
                      />
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/20"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
                    >
                      Eliminar
                    </button>
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
