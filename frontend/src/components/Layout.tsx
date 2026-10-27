import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useMarca } from "../lib/marca";

export function Aurora({ color }: { color?: string }) {
  return <div className="aurora" aria-hidden="true" style={color ? ({ "--c": color } as React.CSSProperties) : undefined} />;
}

export function Header({ admin = false }: { admin?: boolean }) {
  const m = useMarca();
  const loc = useLocation();
  return (
    <header className="top">
      <Link to={admin ? "/admin" : "/"} className="brand" aria-label={`${m.organizacion} · ${m.nombre}, inicio`}>
        <img src={m.logo.oscuro} alt={m.logo.alt} height={26} />
        <span className="t">{admin ? <>Back del <b>catálogo</b></> : <b>{m.nombre}</b>}</span>
      </Link>
      <nav className="top-nav" aria-label="Principal">
        {admin ? (
          <NavLink to="/" className="btn ghost">Ver catálogo ↗</NavLink>
        ) : (
          <>
            <NavLink to="/" end className="btn ghost">Catálogo</NavLink>
            <Link to={`/presentar${loc.pathname === "/" ? loc.search : ""}`} className="btn">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 2h12v9H2zM6 14h4M8 11v3" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
              Presentar
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

export function Footer() {
  const m = useMarca();
  return (
    <footer className="foot">
      <span>{m.organizacion} · {m.nombre}</span>
      <a href={m.contacto.url} target="_blank" rel="noreferrer">{m.contacto.url.replace(/^https?:\/\//, "")}</a>
      <a href={`mailto:${m.contacto.email}`}>{m.contacto.email}</a>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <>
      <a href="#contenido" className="skip">Saltar al contenido</a>
      <Aurora />
      <Header />
      <main id="contenido" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
