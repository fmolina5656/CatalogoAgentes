import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { admin, erroresDe, type Sesion } from "../../lib/api";
import { useMarca } from "../../lib/marca";
import { prepararValidador } from "../../lib/validate";
import { Aurora, Header } from "../../components/Layout";
import { Glitch } from "../../components/Glitch";
import { ListPage } from "./List";
import { EditPage } from "./Edit";

function Login({ s, onOk }: { s: Sesion; onOk: () => void }) {
  const m = useMarca();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="login card">
      <Glitch size="96px" />
      <h1>Back del catálogo</h1>
      <p className="muted">Solo para el equipo de {m.organizacion}.</p>
      {s.modo === "entra" && s.rechazado ? (
        <>
          <p className="banner error" role="alert">
            Entraste como <b>{s.rechazado}</b>, pero esa cuenta no tiene acceso al back. Pide que la agreguen
            en <code>ADMIN_ALLOWED_DOMAINS</code> o <code>ADMIN_ALLOWED_EMAILS</code>.
          </p>
          <a className="btn" href={s.logout_url ?? "/.auth/logout"}>Salir y entrar con otra cuenta</a>
        </>
      ) : s.modo === "entra" ? (
        <a className="btn primary big" href={s.login_url ?? "/.auth/login/aad"}>Entrar con mi cuenta de Microsoft</a>
      ) : !s.pin_configurado ? (
        <p className="banner warn">Para entrar en local define la variable <code>ADMIN_PIN</code> y reinicia el servidor.</p>
      ) : (
        <form onSubmit={async (e) => {
          e.preventDefault(); setError("");
          try { await admin.login(pin); onOk(); } catch (err) { setError(erroresDe(err)[0].msg); }
        }}>
          <label htmlFor="pin">PIN de administración</label>
          <input id="pin" type="password" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn primary">Entrar</button>
          <p className="hint">Modo local (AUTH_MODE=pin). En Azure se entra con Microsoft Entra ID.</p>
        </form>
      )}
    </div>
  );
}

export default function AdminApp() {
  const [s, setS] = useState<Sesion | null>(null);
  const [listo, setListo] = useState(false);
  const cargar = () => admin.sesion().then(setS);
  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    if (s?.autenticado) admin.schema().then((sc) => { prepararValidador(sc); setListo(true); });
  }, [s?.autenticado]);

  return (
    <>
      <a href="#contenido" className="skip">Saltar al contenido</a>
      <Aurora />
      <Header admin />
      {s?.autenticado && (
        <div className="session-bar wrap">
          <span className="muted">Sesión: <b>{s.usuario?.nombre}</b> {s.usuario?.usuario !== s.usuario?.nombre && <span className="mono">({s.usuario?.usuario})</span>}</span>
          {s.modo === "entra"
            ? <a className="btn ghost small" href={s.logout_url ?? "/.auth/logout"}>Salir</a>
            : <button type="button" className="btn ghost small" onClick={() => admin.logout().then(cargar)}>Salir</button>}
        </div>
      )}
      <main id="contenido" tabIndex={-1} className="admin-main">
        {!s ? null : !s.autenticado ? <Login s={s} onOk={cargar} /> : !listo ? <div className="wrap loading">Cargando…</div> : (
          <Routes>
            <Route index element={<ListPage />} />
            <Route path="agentes/:id" element={<EditPage />} />
          </Routes>
        )}
      </main>
    </>
  );
}
