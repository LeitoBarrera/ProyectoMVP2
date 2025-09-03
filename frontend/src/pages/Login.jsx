import { useState } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";

export default function Login(){
  const [u,setU] = useState(""); const [p,setP] = useState("");
  const [msg,setMsg] = useState("");
  const nav = useNavigate();

  const login = async (e) => {
    e.preventDefault();
    try{
      const { data } = await api.post("/api/auth/login/", { username: u, password: p });
      localStorage.setItem("token", data.access);
      // pedir rol
      const me = await api.get("/api/auth/me/");
      localStorage.setItem("role", me.data.rol);

      // redirigir según rol
      if(me.data.rol === "CANDIDATO") nav("/candidato");
      else if(me.data.rol === "ANALISTA" || me.data.rol === "ADMIN") nav("/analista");
      else if(me.data.rol === "CLIENTE") nav("/cliente");
      else nav("/");

    }catch(err){
      setMsg("Credenciales inválidas");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={login} className="bg-white p-6 rounded-xl shadow w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4">Ingreso</h1>
        <input className="border rounded w-full mb-2 p-2" placeholder="Usuario" value={u} onChange={e=>setU(e.target.value)} />
        <input className="border rounded w-full mb-4 p-2" placeholder="Contraseña" type="password" value={p} onChange={e=>setP(e.target.value)} />
        <button className="w-full bg-blue-600 text-white rounded p-2">Entrar</button>
        {msg && <div className="text-sm text-red-600 mt-2">{msg}</div>}
      </form>
    </div>
  );
}
