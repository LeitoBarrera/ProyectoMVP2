// src/pages/CandidatoDocs.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

/* ---------- UI base (glass) ---------- */
const Field = ({ label, children, hint, className = "" }) => (
  <label className={`text-sm text-slate-200 ${className}`}>
    {label && <div className="mb-1 font-medium">{label}</div>}
    {children}
    {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
  </label>
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
      {children}
    </select>
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/60">▾</span>
  </div>
);

const Pill = ({ color = "slate", children }) => {
  const map = {
    slate: "bg-white/10 text-slate-200",
    green: "bg-emerald-600/20 text-emerald-300",
    amber: "bg-amber-600/20 text-amber-200",
    red: "bg-rose-600/20 text-rose-200",
    blue: "bg-blue-600/20 text-blue-200",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs ${map[color]}`}>{children}</span>;
};

const fileKind = (name = "", type = "") => {
  if (type?.startsWith("image/")) return "image";
  if (name.toLowerCase().endsWith(".pdf") || type === "application/pdf") return "pdf";
  return "other";
};

const FileThumb = ({ url, name, mime }) => {
  const kind = fileKind(name, mime);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-2">
      {kind === "image" ? (
        <img src={url} alt={name || "archivo"} className="h-16 w-20 rounded object-cover" />
      ) : (
        <div className="grid h-16 w-20 place-items-center rounded bg-white/5 text-xs text-white/70">
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

/* ---------- Tipos de documento ---------- */
const DOC_TYPES = [
  { key: "CC_FRENTE", label: "Cédula – Frente", required: true, unique: true },
  { key: "CC_DORSO", label: "Cédula – Dorso", required: true, unique: true },
  { key: "FOTO", label: "Foto tipo documento", required: false, unique: true },
  { key: "HOJA_VIDA", label: "Hoja de vida", required: false, unique: true },
  { key: "RUT", label: "RUT", required: false, unique: true },
  { key: "RECIBO_SERVICIO", label: "Recibo de servicio (dirección)", required: false, unique: true },
  { key: "ANTECEDENTES_PEN", label: "Certificado antecedentes (PNAL)", required: false, unique: true },
  { key: "PROCURADURIA", label: "Certificado Procuraduría", required: false, unique: true },
  { key: "CONTRALORIA", label: "Certificado Contraloría", required: false, unique: true },
  { key: "OTRO", label: "Otro soporte", required: false, unique: false },
];

const STATUS_COLOR = (s) =>
  s === "VALIDADO" ? "green" : s === "HALLAZGO" ? "red" : s === "EN_VALIDACION" ? "blue" : "slate";

/* ---------- Módulo ---------- */
export default function CandidatoDocs() {
  const [docs, setDocs] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // uploader
  const [tipo, setTipo] = useState(DOC_TYPES[0].key);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const { data } = await api.get("/api/documentos/");
      setDocs(Array.isArray(data) ? data : []);
    } catch {
      setMsg("No se pudieron cargar tus documentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) setFile(e.dataTransfer.files[0]);
  };

  const upload = async (e) => {
    e?.preventDefault?.();
    if (!file) return setMsg("Selecciona un archivo.");
    setUploading(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("tipo", tipo);
      fd.append("archivo", file);
      const { data } = await api.post("/api/documentos/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDocs((prev) => [data, ...prev]);
      setFile(null);
    } catch (err) {
      const d = err.response?.data;
      const detail =
        d?.detail ||
        d?.non_field_errors?.[0] ||
        (typeof d === "string" ? d : JSON.stringify(d || {}));
      setMsg(`No se pudo subir el documento: ${detail}`);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("¿Eliminar este documento?")) return;
    setMsg("");
    try {
      await api.delete(`/api/documentos/${id}/`);
      setDocs((prev) => prev.filter((x) => x.id !== id));
    } catch {
      setMsg("No se pudo eliminar el documento.");
    }
  };

  // faltantes requeridos (según unique=true)
  const presentByType = useMemo(() => {
    const map = {};
    docs.forEach((d) => {
      map[d.tipo] = (map[d.tipo] || 0) + 1;
    });
    return map;
  }, [docs]);

  const missingRequired = DOC_TYPES.filter((t) => t.required && !presentByType[t.key]);

  // agrupación simple por tipo para render
  const grouped = useMemo(() => {
    const map = {};
    docs.forEach((d) => {
      (map[d.tipo] = map[d.tipo] || []).push(d);
    });
    return map;
  }, [docs]);

  return (
    <div className="min-h-screen text-slate-100">
      {/* fondo */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(1200px_700px_at_20%_30%,rgba(255,255,255,0.06),transparent_60%),linear-gradient(180deg,#0b1220_0%,#0a0f1a_100%)]" />

      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Documentos</h1>

        {missingRequired.length > 0 && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-200 backdrop-blur-md">
            <div className="text-sm">
              Faltan documentos obligatorios:{" "}
              <b>{missingRequired.map((t) => t.label).join(", ")}</b>
            </div>
          </div>
        )}

        {msg && (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-200 backdrop-blur-md">
            <span className="text-sm">{msg}</span>
          </div>
        )}

        {/* Subir */}
        <form
          onSubmit={upload}
          className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl space-y-4"
        >
          <h2 className="text-lg font-semibold">Adjuntar documento</h2>

          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Tipo de documento" className="md:col-span-1">
              <Select value={tipo} onChange={setTipo}>
                {DOC_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                    {t.required ? " (obligatorio)" : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Archivo (PDF o imagen)" className="md:col-span-2">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={
                  "flex h-28 w-full items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 px-3 text-sm " +
                  (dragOver ? "ring-2 ring-blue-500/40" : "")
                }
              >
                {file ? (
                  <div className="flex items-center gap-3">
                    <Pill color="blue">Listo para subir</Pill>
                    <span className="truncate max-w-[300px]">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/20"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div className="text-slate-300">
                    Arrastra y suelta aquí o{" "}
                    <label className="cursor-pointer underline">
                      selecciona un archivo
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={onFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </Field>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={!file || uploading}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {uploading ? "Subiendo…" : "Subir documento"}
            </button>
          </div>
        </form>

        {/* Listado */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Mis documentos</h2>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-slate-300">
              Cargando…
            </div>
          ) : docs.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-slate-300">
              Aún no has subido documentos.
            </div>
          ) : (
            DOC_TYPES.map((t) => {
              const items = grouped[t.key] || [];
              if (items.length === 0 && !t.required) return null;
              return (
                <div
                  key={t.key}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md shadow-xl"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-lg font-semibold">
                      {t.label} {t.required && <Pill color="amber">Obligatorio</Pill>}
                    </div>
                    {t.unique && items.length > 1 && (
                      <Pill color="red">Se esperaba un único archivo</Pill>
                    )}
                  </div>

                  {items.length === 0 ? (
                    <div className="text-sm text-slate-300">Sin archivos.</div>
                  ) : (
                    <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {items.map((d) => (
                        <li
                          key={d.id}
                          className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <FileThumb url={d.archivo_url} name={d.nombre} mime={d.mime} />
                            <div className="space-y-2 text-right">
                              <Pill color={STATUS_COLOR(d.estado || "PENDIENTE")}>
                                {d.estado || "PENDIENTE"}
                              </Pill>
                              <button
                                type="button"
                                onClick={() => remove(d.id)}
                                className="rounded-lg bg-rose-600 px-2 py-1 text-xs text-white hover:bg-rose-500"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                          {d.comentario && (
                            <div className="mt-2 text-xs text-slate-300">
                              <b>Obs.:</b> {d.comentario}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
