import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { http } from '../api.js';
import { Campo, Modal, useToast } from '../components/ui.jsx';

const CONTAS_DEMO = [
  { perfil: 'Administrador', email: 'admin@mediagenda.co.mz', password: 'Admin@123' },
  { perfil: 'Médico', email: 'antonio@mediagenda.co.mz', password: 'Medico@123' },
  { perfil: 'Paciente', email: 'maria@example.com', password: 'Paciente@123' },
  { perfil: 'Secretária', email: 'secretaria@mediagenda.co.mz', password: 'Secretaria@123' }
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [aSubmeter, setASubmeter] = useState(false);
  const [recuperarAberto, setRecuperarAberto] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState('');
  const [resultadoRecuperar, setResultadoRecuperar] = useState(null);

  const submeter = async (e) => {
    e.preventDefault();
    setErro('');
    setASubmeter(true);
    try {
      const utilizador = await login(email, password);
      toast.sucesso(`Bem-vindo, ${utilizador.nome.split(' ')[0]}.`);
      navigate(location.state?.de || '/', { replace: true });
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setASubmeter(false);
    }
  };

  const recuperar = async () => {
    try {
      const r = await http.post('/auth/recuperar', { email: emailRecuperar });
      setResultadoRecuperar(r);
    } catch (falha) {
      setResultadoRecuperar({ erro: falha.message });
    }
  };

  return (
    <div className="auth">
      <section className="auth-art">
        <div>
          <div className="brand" style={{ padding: 0 }}>
            <div className="brand-mark">+</div>
            <div>
              <div className="brand-name">MediAgenda</div>
              <div className="brand-sub">ISPT · Engenharia Informática</div>
            </div>
          </div>
          <h1 style={{ marginTop: 40 }}>A sua saúde, com hora marcada.</h1>
          <p>Marque, confirme, reagende e acompanhe consultas num só lugar — com notificações automáticas e regras de negócio que protegem pacientes e médicos.</p>
        </div>

        <div className="auth-features">
          <div className="auth-feature">
            <div className="dot">⚡</div>
            <div><b>Marcação em poucos cliques</b>Validação automática de antecedência, horário, conflitos e limites (RN-01 a RN-09).</div>
          </div>
          <div className="auth-feature">
            <div className="dot">🔔</div>
            <div><b>Notificações por e-mail e SMS</b>Confirmação em 2 horas e lembretes 24h/1h antes da consulta.</div>
          </div>
          <div className="auth-feature">
            <div className="dot">🛡️</div>
            <div><b>Auditoria e privacidade</b>Cada operação crítica fica registada; o acesso é controlado por perfil.</div>
          </div>
        </div>

        <p style={{ fontSize: '.78rem', opacity: .7 }}>Protótipo académico — dados de demonstração.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-form">
          <div className="brand logo-mobile" style={{ padding: 0, marginBottom: 20 }}>
            <div className="brand-mark">+</div>
            <div className="brand-name">MediAgenda</div>
          </div>

          <h1>Entrar</h1>
          <p>Aceda com a sua conta para gerir as consultas.</p>

          {erro && <div className="alert error" style={{ marginBottom: 14 }}>{erro}</div>}

          <form className="stack" onSubmit={submeter}>
            <Campo label="E-mail" htmlFor="email">
              <input id="email" type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com" required />
            </Campo>
            <Campo label="Palavra-passe" htmlFor="password">
              <input id="password" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </Campo>
            <button className="btn primary block" disabled={aSubmeter}>
              {aSubmeter ? 'A entrar…' : 'Entrar'}
            </button>
          </form>

          <div className="row between mt-sm" style={{ fontSize: '.83rem' }}>
            <button className="btn ghost sm" onClick={() => { setRecuperarAberto(true); setEmailRecuperar(email); }}>
              Esqueci-me da palavra-passe
            </button>
            <Link to="/registo">Criar conta</Link>
          </div>

          <div className="mt">
            <div className="row between">
              <small>Contas de demonstração</small>
              <small>clique para preencher</small>
            </div>
            <div className="demo-accounts">
              {CONTAS_DEMO.map((conta) => (
                <button key={conta.email} type="button" className="demo-account"
                  onClick={() => { setEmail(conta.email); setPassword(conta.password); setErro(''); }}>
                  <b>{conta.perfil}</b>
                  <span className="mono">{conta.email}</span>
                  <span className="badge neutral">{conta.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {recuperarAberto && (
        <Modal titulo="Recuperar palavra-passe" subtitulo="Enviaremos um token de recuperação (simulado na outbox)."
          onFechar={() => { setRecuperarAberto(false); setResultadoRecuperar(null); }}>
          <Campo label="E-mail da conta">
            <input type="email" value={emailRecuperar} onChange={(e) => setEmailRecuperar(e.target.value)} />
          </Campo>
          <div className="row mt">
            <button className="btn primary" onClick={recuperar} disabled={!emailRecuperar}>Enviar token</button>
          </div>
          {resultadoRecuperar && (
            <div className={`alert ${resultadoRecuperar.erro ? 'error' : 'success'} mt`}>
              {resultadoRecuperar.erro || resultadoRecuperar.mensagem}
              {resultadoRecuperar.token && (
                <div className="mt-sm">
                  Token de demonstração: <code>{resultadoRecuperar.token}</code>
                  <div className="tiny mt-sm">Use em <Link to="/redefinir">Redefinir palavra-passe</Link>.</div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
