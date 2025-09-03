import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import CandidatoPortal from "./pages/CandidatoPortal";
import AnalistaDashboard from "./pages/AnalistaDashboard";
import ClienteDashboard from "./pages/ClienteDashboard";
import RoleRoute from "./RoleRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/candidato"
          element={
            <RoleRoute allow={["CANDIDATO"]}>
              <CandidatoPortal />
            </RoleRoute>
          }
        />
        <Route
          path="/analista"
          element={
            <RoleRoute allow={["ANALISTA","ADMIN"]}>
              <AnalistaDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/cliente"
          element={
            <RoleRoute allow={["CLIENTE","ADMIN"]}>
              <ClienteDashboard />
            </RoleRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
