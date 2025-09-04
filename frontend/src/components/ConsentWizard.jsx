// src/components/ConsentWizard.jsx
import { useEffect, useRef, useState } from "react";
import api from "../api/axios";

/* ---------- Firma simple con canvas ---------- */
function SignatureCanvas({ onChange }) {
  const ref = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");

    // Escala retina
    const ratio = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const cssW = 520;
    const cssH = 180;
    c.width = cssW * ratio;
    c.height = cssH * ratio;
    c.style.width = cssW + "px";
    c.style.height = cssH + "px";
    ctx.scale(ratio, ratio);

    // Estilo de trazo
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";
  }, []);

  const getPos = (e) => {
    const c = ref.current;
    const r = c.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const { x, y } = getPos(e);
    const ctx = ref.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = ref.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
    onChange?.(ref.current.toDataURL("image/png"));
  };

  const end = (e) => {
    e?.preventDefault?.();
    drawing.current = false;
  };

  const clear = () => {
    const c = ref.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    onChange?.(null);
  };

  return (
    <div>
      <div className="rounded-xl border border-white/10 bg-slate-800/70 p-3">
        <canvas
          ref={ref}
          draggable={false}
          className="touch-none select-none rounded-lg bg-slate-900"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800/70 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/70"
      >
        🧽 Borrar firma
      </button>
    </div>
  );
}

/* ---------- Wizard ---------- */
export default function ConsentWizard({ show, studyId, onDone, onCancel }) {
  const [step, setStep] = useState(1);
  const [signData, setSignData] = useState(null);
  const [aceptaHabeas, setAceptaHabeas] = useState(false);
  const [aceptaTC, setAceptaTC] = useState(false);
  const [saving, setSaving] = useState(false);

  const forceFlow = true; // ponlo en false si quieres permitir cerrar

  const key = `consents:${studyId}`;

  // precarga de checks
  useEffect(() => {
    const ls = JSON.parse(localStorage.getItem(key) || "{}");
    setAceptaHabeas(!!ls.habeas);
    setAceptaTC(!!ls.tc);
  }, [key]);

  // bloquear scroll del body
  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [show]);

  // Cerrar con ESC si no es forzado
  useEffect(() => {
    if (!show) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !forceFlow) {
        onCancel?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, forceFlow, onCancel]);

  if (!show) return null;

  const totalSteps = 3;
  const pct = ((step - 1) / (totalSteps - 1)) * 100;

  const next = async () => {
    // Paso 1: firmar autorización
    if (step === 1) {
      if (!signData) return alert("Dibuja la firma para continuar.");
      setSaving(true);
      try {
        await api.post(`/api/estudios/${studyId}/firmar_autorizacion/`, {});
        setStep(2);
      } catch {
        alert("No se pudo firmar la autorización.");
      } finally {
        setSaving(false);
      }
      return;
    }
    // Paso 2: habeas
    if (step === 2) {
      if (!aceptaHabeas) return alert("Debes aceptar el Habeas Data.");
      const ls = JSON.parse(localStorage.getItem(key) || "{}");
      localStorage.setItem(key, JSON.stringify({ ...ls, habeas: true }));
      setStep(3);
      return;
    }
    // Paso 3: TyC
    if (step === 3) {
      if (!aceptaTC) return alert("Debes aceptar los Términos y Condiciones.");
      const ls = JSON.parse(localStorage.getItem(key) || "{}");
      localStorage.setItem(key, JSON.stringify({ ...ls, tc: true }));
      onDone?.();
      return;
    }
  };

  const handleCancel = () => {
    if (forceFlow) return;
    onCancel?.();
  };

  // Cerrar haciendo click fuera (si se permite)
  const onOverlayClick = () => {
    if (!forceFlow) onCancel?.();
  };

  return (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      {/* overlay oscuro */}
      <div className="absolute inset-0 bg-black/70" onClick={onOverlayClick} />

      {/* modal con offset superior y scroll interno */}
      <div className="absolute left-1/2 top-[12vh] -translate-x-1/2 w-[min(92vw,900px)]">
        <div
          className="max-h-[76vh] overflow-auto rounded-2xl border border-white/10 bg-slate-900/95 p-6 text-slate-100 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/20 text-amber-400">🤝</span>
              <h2 id="consent-title" className="text-xl font-semibold">
                Consentimientos
              </h2>
            </div>

            <span className="rounded-lg border border-white/10 bg-slate-800/70 px-3 py-1 text-xs text-slate-300">
              {forceFlow ? "Flujo obligatorio" : "Puedes cerrar"}
            </span>
          </div>

          {/* Subtítulo */}
          <p className="mb-4 text-sm text-slate-300">
            Completa los 3 pasos para continuar con tu estudio.
          </p>

          {/* Progreso */}
          <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
            <span>Paso {step} de 3</span>
            <span className="sr-only">Progreso</span>
          </div>
          <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Contenido por paso */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-200">
                <b>Autorización para validación de antecedentes.</b> Autorizo a la empresa a verificar mi
                información personal, laboral y académica con fines de selección.
              </p>
              <p className="text-sm text-slate-300">Firma dentro del recuadro:</p>
              <SignatureCanvas onChange={setSignData} />
              <p className="text-xs text-slate-400">
                Tu firma se usará únicamente para acreditar tu consentimiento.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-200">
                <b>Habeas Data.</b> Acepto el tratamiento de mis datos personales conforme a la política de
                protección de datos.
              </p>
              <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={aceptaHabeas}
                  onChange={(e) => setAceptaHabeas(e.target.checked)}
                />
                Acepto el Habeas Data
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-200">
                <b>Términos y Condiciones.</b> Declaro haber leído y acepto los términos de uso del
                portal y los compromisos del proceso de selección.
              </p>
              <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={aceptaTC}
                  onChange={(e) => setAceptaTC(e.target.checked)}
                />
                Acepto los Términos y Condiciones
              </label>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              title={forceFlow ? "Debes completar el flujo" : "Cancelar"}
              className={`rounded-lg px-4 py-2 text-sm ${
                forceFlow
                  ? "cursor-not-allowed border border-white/10 bg-slate-800/70 text-slate-400"
                  : "border border-white/10 bg-slate-800/70 text-slate-200 hover:bg-slate-700/70"
              }`}
              disabled={forceFlow}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={next}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {step < 3 ? "Continuar" : "Finalizar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
