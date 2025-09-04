// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import CandidatoPortal from "./pages/CandidatoPortal";
import AnalistaDashboard from "./pages/AnalistaDashboard";
import ClienteDashboard from "./pages/ClienteDashboard";
import RoleRoute from "./RoleRoute";


import CandidatoBio from "./pages/CandidatoBio";
import CandidatoAcademico from "./pages/CandidatoAcademico";
import CandidatoLaboral from "./pages/CandidatoLaboral";
import CandidatoDocs from "./pages/CandidatoDocs";


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* CANDIDATO (layout + subrutas) */}
        <Route
          path="/candidato"
          element={
            <RoleRoute allow={["CANDIDATO"]}>
              <CandidatoPortal />
            </RoleRoute>
          }
        >
          <Route index element={<Navigate to="bio" replace />} />
          <Route path="bio" element={<CandidatoBio />} />
          <Route path="academico" element={<CandidatoAcademico />} />
          <Route path="laboral" element={<CandidatoLaboral />} />
          <Route path="docs" element={<CandidatoDocs />} />
        </Route>

        {/* ANALISTA */}
        <Route
          path="/analista"
          element={
            <RoleRoute allow={["ANALISTA", "ADMIN"]}>
              <AnalistaDashboard />
            </RoleRoute>
          }
        />

        {/* CLIENTE */}
        <Route
          path="/cliente"
          element={
            <RoleRoute allow={["CLIENTE", "ADMIN"]}>
              <ClienteDashboard />
            </RoleRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
