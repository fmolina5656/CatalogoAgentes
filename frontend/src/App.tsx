import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { AgentePublico, Marca } from "./lib/types";
import { api } from "./lib/api";
import { aplicarPaleta, MarcaContext } from "./lib/marca";
import { PublicLayout } from "./components/Layout";
import { Home } from "./pages/Home";
import { AgentPage, NotFound } from "./pages/Agent";
import { Present } from "./pages/Present";

const AdminApp = lazy(() => import("./pages/admin/AdminApp"));

export function App() {
  const [marca, setMarca] = useState<Marca | null>(null);
  const [agentes, setAgentes] = useState<AgentePublico[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.config().then((m) => { aplicarPaleta(m); setMarca(m); }).catch(() => setError(true));
    api.agentes().then(setAgentes).catch(() => setError(true));
  }, []);

  if (error) return <p className="boot-error">No pudimos cargar el catálogo. Revisa tu conexión e intenta de nuevo.</p>;
  if (!marca) return <div className="boot" aria-busy="true" />;

  return (
    <MarcaContext.Provider value={marca}>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home agentes={agentes} />} />
            <Route path="agentes/:slug" element={<AgentPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="presentar" element={<Present agentes={agentes} />} />
          <Route path="admin/*" element={<Suspense fallback={<div className="boot" />}><AdminApp /></Suspense>} />
        </Routes>
      </BrowserRouter>
    </MarcaContext.Provider>
  );
}
