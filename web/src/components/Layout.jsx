import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, iniciais } from '../auth.jsx';
import { http } from '../api.js';
import { Carregando } from './ui.jsx';

function Ico({ d }) {
  return (
    <svg className="ico" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONES = {
  inicio: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  consultas: 'M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  medico: 'M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-3.5 3.6-6 8-6s8 2.5 8 6',
  secretaria: 'M4 20v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM9 3h6',
  admin: 'M12 3 4 7v5c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V7l-8-4ZM9 12l2 2 4-4',
  arquitetura: 'M4 21V8l8-5 8 5v13M9 21v-7h6v7M4 21h16',
  auditoria: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6M9 12h6M9 16h4',
  notificacoes: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21h4',
  perfil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-3.5 3.6-6 8-6s8 2.5 8 6',
  sair: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'
};

export function Layout({ children }) {
  const { utilizador, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tema, setTema] = useState(() => localStorage.getItem('mediagenda_tema') || 'light');
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    localStorage.setItem('mediagenda_tema', tema);
  }, [tema]);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const r = await http.get('/notificacoes');
        if (ativo) setNaoLidas(r.naoLidas || 0);
      } catch { /* silencioso */ }
    };
    carregar();
    const intervalo = window.setInterval(carregar, 45000);
    return () => { ativo = false; window.clearInterval(intervalo); };
  }, [location.pathname]);

  const perfil = utilizador?.perfil;

  const links = [
    { grupo: 'Principal', itens: [{ para: '/', label: 'Início', icone: 'inicio' }] },
    {
      grupo: 'Consultas',
      itens: [
        {
          para: '/consultas',
          label: perfil === 'paciente' ? 'As minhas consultas' : perfil === 'medico' ? 'Agenda' : 'Consultas',
          icone: 'consultas'
        }
      ]
    }
  ];

  if (perfil === 'medico') {
    links.push({ grupo: 'Médico', itens: [{ para: '/medico', label: 'Painel médico', icone: 'medico' }] });
  }
  if (perfil === 'secretario') {
    links.push({ grupo: 'Secretaria', itens: [{ para: '/secretaria', label: 'Painel secretaria', icone: 'secretaria' }] });
  }
  if (perfil === 'admin') {
    links.push({
      grupo: 'Administração',
      itens: [
        { para: '/admin', label: 'Painel admin', icone: 'admin' },
        { para: '/arquitetura', label: 'Architecture Lab', icone: 'arquitetura' },
        { para: '/auditoria', label: 'Auditoria', icone: 'auditoria' }
      ]
    });
  }

  links.push({
    grupo: 'Conta',
    itens: [
      { para: '/notificacoes', label: 'Notificações', icone: 'notificacoes', count: naoLidas },
      { para: '/perfil', label: 'Perfil', icone: 'perfil' }
    ]
  });

  const terminar = () => { logout(); navigate('/login'); };

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="brand-mark">+</div>
          <div>
            <div className="brand-name">MediAgenda</div>
            <div className="brand-sub">Clínica · ISPT</div>
          </div>
        </Link>

        <nav className="nav">
          {links.map((grupo) => (
            <div key={grupo.grupo}>
              <div className="nav-group">{grupo.grupo}</div>
              {grupo.itens.map((item) => (
                <NavLink key={item.para} to={item.para} end={item.para === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Ico d={ICONES[item.icone]} />
                  <span>{item.label}</span>
                  {item.count > 0 && <span className="count">{item.count}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-link" onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}>
            <span className="ico">{tema === 'dark' ? '☀️' : '🌙'}</span>
            <span>{tema === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>
          </button>
          <div className="user-box">
            <div className="avatar">{iniciais(utilizador?.nome)}</div>
            <div className="who grow">
              <b>{utilizador?.nome}</b>
              <span>{perfil}</span>
            </div>
            <button className="icon-btn" title="Terminar sessão" onClick={terminar}>
              <Ico d={ICONES.sair} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}

export function Topo({ titulo, sub, acoes }) {
  return (
    <div className="topbar">
      <div className="title">
        <h1>{titulo}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {acoes && <div className="topbar-actions">{acoes}</div>}
    </div>
  );
}

export function RotaProtegida({ perfis, children }) {
  const { autenticado, carregando, utilizador } = useAuth();
  const location = useLocation();

  if (carregando) return <Carregando />;
  if (!autenticado) return <Navigate to="/login" replace state={{ de: location.pathname }} />;
  if (perfis && !perfis.includes(utilizador.perfil)) {
    return (
      <Layout>
        <div className="card center" style={{ maxWidth: 560, margin: '40px auto' }}>
          <div style={{ fontSize: '2.2rem' }}>🔒</div>
          <h2>Acesso restrito</h2>
          <p>Esta área é reservada ao perfil: {perfis.join(' ou ')}.</p>
          <Link className="btn primary" to="/">Voltar ao início</Link>
        </div>
      </Layout>
    );
  }
  return <Layout>{children}</Layout>;
}
