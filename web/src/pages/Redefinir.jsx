import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { http } from '../api.js';
import { Campo, useToast } from '../components/ui.jsx';

export function Redefinir() {
  const navigate = useNavigate();
  const toast = useToast();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [aSubmeter, setASubmeter] = useState(false);

  const submeter = async (e) => {
    e.preventDefault();
    setErro('');
    if (password !== confirmar) {
      setErro('As palavras-passe não coincidem.');
      return;
    }
    setASubmeter(true);
    try {
      await http.post('/auth/redefinir', { token, password });
      toast.sucesso('Palavra-passe redefinida. Já pode entrar.');
      navigate('/login');
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setASubmeter(false);
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
          <h1 style={{ marginTop: 40 }}>Redefinir palavra-passe.</h1>
          <p>Use o token recebido por e-mail para definir uma nova palavra-passe de acesso.</p>
        </div>
        <p style={{ fontSize: '.78rem', opacity: .7 }}>Protótipo académico — dados de demonstração.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-form">
          <div className="brand logo-mobile" style={{ padding: 0, marginBottom: 20 }}>
            <div className="brand-mark">+</div>
            <div className="brand-name">MediAgenda</div>
          </div>
          <h1>Nova palavra-passe</h1>
          <p>Cole o token de recuperação e escolha a nova palavra-passe.</p>

          {erro && <div className="alert error" style={{ marginBottom: 14 }}>{erro}</div>}

          <form className="stack" onSubmit={submeter}>
            <Campo label="Token de recuperação">
              <input value={token} onChange={(e) => setToken(e.target.value)} required className="mono" />
            </Campo>
            <Campo label="Nova palavra-passe">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </Campo>
            <Campo label="Confirmar palavra-passe">
              <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required minLength={6} />
            </Campo>
            <button className="btn primary block" disabled={aSubmeter}>
              {aSubmeter ? 'A guardar…' : 'Redefinir palavra-passe'}
            </button>
          </form>

          <p className="mt" style={{ fontSize: '.85rem' }}>
            <Link to="/login">Voltar ao login</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
