    import { useEffect, useState } from "react";
    import api from "../api/axios";
    import ProgressBar from "../components/ProgressBar";
    import { useNavigate } from "react-router-dom";
    import FileUploader from "../components/FileUploader";


    export default function CandidatoPortal() {
    const [estudio, setEstudio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [perfil, setPerfil] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const nav = useNavigate();

    
    const fetchPerfil = async ()=>{
    try{
        const { data } = await api.get("/api/candidatos/me/");
        setPerfil(data);
    }catch{}
    };

    useEffect(()=>{
    fetchEstudios();
    fetchPerfil();
    },[]); // eslint-disable-line

    const guardarPerfil = async ()=>{
    setGuardando(true);
    await api.put("/api/candidatos/me/", perfil);
    setGuardando(false);
    };

    const fetchEstudios = async () => {
        try {
        const { data } = await api.get("/api/estudios/");
        if (Array.isArray(data) && data.length) {
            setEstudio(data[0]);
        } else {
            setEstudio(null);
        }
        } catch (e) {
        // token inválido, redirigir a login
        localStorage.removeItem("token");
        nav("/");
        } finally {
        setLoading(false);
        }
    };

    const firmar = async () => {
        if (!estudio?.id) return;
        await api.post(`/api/estudios/${estudio.id}/firmar_autorizacion/`);
        await fetchEstudios();
    };

    useEffect(() => {
        fetchEstudios();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) return <div className="p-6">Cargando...</div>;
    if (!estudio) return <div className="p-6">No hay estudios asignados.</div>;

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-4">
        <h1 className="text-xl font-semibold">Portal del Candidato</h1>

        <div className="p-4 rounded-xl border bg-white">
            <div className="flex items-center justify-between">
            <span className="font-medium">Progreso del estudio</span>
            <span className="text-sm text-gray-600">
                {estudio.nivel_cualitativo ?? "N/D"}
            </span>
            </div>
            <div className="mt-2">
            <ProgressBar value={estudio.progreso || 0} />
            </div>

            <div className="mt-3 text-sm">
            Autorización: {estudio.autorizacion_firmada ? "Firmada" : "Pendiente"}
            </div>
            {!estudio.autorizacion_firmada && (
            <button
                onClick={firmar}
                className="mt-2 px-3 py-1.5 rounded bg-blue-600 text-white"
            >
                Firmar autorización
            </button>
            )}
        </div>

        <div className="p-4 rounded-xl border bg-white">
        <h2 className="font-medium mb-2">Ítems</h2>
        <ul className="space-y-3">
            {(estudio.items || []).map((it) => (
            <li key={it.id} className="text-sm border rounded p-3">
                <div className="flex items-center justify-between">
                <span className="font-medium">{it.tipo}</span>
                <span className="text-gray-600">{it.estado}</span>
                </div>
                <div className="mt-2">
                <FileUploader itemId={it.id} onUploaded={fetchEstudios} />
                </div>
            </li>
            ))}
        </ul>
        </div>
        <div className="p-4 rounded-xl border bg-white">
            <h2 className="font-medium mb-2">Mi información</h2>
            {!perfil ? <div className="text-sm">Cargando...</div> : (
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <input className="border rounded p-2" placeholder="Nombre" value={perfil.nombre||""} onChange={e=>setPerfil(s=>({...s,nombre:e.target.value}))}/>
                <input className="border rounded p-2" placeholder="Apellido" value={perfil.apellido||""} onChange={e=>setPerfil(s=>({...s,apellido:e.target.value}))}/>
                <input className="border rounded p-2" placeholder="Cédula" value={perfil.cedula||""} disabled />
                <input className="border rounded p-2" placeholder="Email" value={perfil.email||""} disabled />
                <input className="border rounded p-2" placeholder="Celular" value={perfil.celular||""} onChange={e=>setPerfil(s=>({...s,celular:e.target.value}))}/>
                <input className="border rounded p-2" placeholder="Ciudad de residencia" value={perfil.ciudad_residencia||""} onChange={e=>setPerfil(s=>({...s,ciudad_residencia:e.target.value}))}/>
                <div className="sm:col-span-2">
                    <button onClick={guardarPerfil} className="px-3 py-1.5 rounded bg-blue-600 text-white" disabled={guardando}>
                    {guardando ? "Guardando..." : "Guardar"}
                    </button>
                </div>
                </div>
            )}
            </div>
        </div>
    );
    }
