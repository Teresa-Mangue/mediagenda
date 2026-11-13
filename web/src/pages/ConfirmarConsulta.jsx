import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { http } from '../api.js';
import { formatarDataHora } from '../utils.js';

/**
 * Página pública de confirmação de consulta (link do e-mail).
 * Mostra os dados essenciais e confirma sem exigir login.
 */
export function ConfirmarConsulta() {
  const [params] = useSearchParams();
  const id = params.get('id') || '';
  const token = params.get('token') || '';
  const [consulta, setConsulta] = useState(null);
  const [estado, setEstado] = useState({ fase: 'a-carregar', mensagem: '' });
  const [aConfirmar, setAConfirmar] = useState(false);

  useEffect(() => {
    let activo = true;
    if (!id || !token) {
      setEstado({ fase: 'erro', mensagem: 'O link está incompleto (falta o id ou o token).' });
      return undefined;
    }
    (async () => {
      try {
        const r = await http.get(`/confirmar-consulta?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`);
        if (!activo) return;
        setConsulta(r);
        setEstado({
          fase: r.estado === 'pendente' ? 'pronto' : 'info',
          mensagem: r.estado === 'pendente'
            ? 'Confirme a sua presença para garantir a vaga.'
            : `Esta consulta já está ${r.estado}.`
        });
      } catch (falha) {
        if (activo) setEstado({ fase: 'erro', mensagem: falha.message });
      }
    })();
    return () => { activo = false; };
  }, [id, token]);

  const confirmar = async () => {
    setAConfirmar(true);
    try {
      const r = await http.post('/confirmar-consulta', { id, token });
      setConsulta(r.consulta);
      setEstado({ fase: 'sucesso', mensagem: r.mensagem });
    } catch (falha) {
      setEstado({ fase: 'erro', mensagem: falha.message });
    } finally {
      setAConfirmar(false);
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
          <h1 style={{ marginTop: 40 }}>Confirme a sua consulta.</h1>
          <p>Um clique confirma a marcação. Se o prazo de 2 horas expirar, a vaga é libertada automaticamente (RN-07).</p>
        </div>
        <p style={{ fontSize: '.78rem', opacity: .7 }}>Link pessoal e de uso único — não partilhe.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-form">
          {estado.fase === 'a-carregar' && <div className="alert info">A validar o link…</div>}

          {consulta && (
            <div className="card" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
              <span className={`badge ${consulta.estado}`}>{consulta.estado}</span>
              <h3 className="mt-sm">{consulta.especialidade_nome}</h3>
              <p className="tiny muted" style={{ margin: '4px 0' }}>{consulta.medico_nome}</p>
              <p style={{ margin: 0 }}>{formatarDataHora(consulta.data_hora)}</p>
              <p className="tiny muted" style={{ margin: '4px 0 0' }}>Paciente: {consulta.paciente_nome}</p>
            </div>
          )}

          {estado.fase === 'sucesso' && (
            <div className="alert success mt"><b>Consulta confirmada!</b><p style={{ margin: '6px 0 0' }}>{estado.mensagem}</p></div>
          )}
          {estado.fase === 'erro' && (
            <div className="alert error mt"><b>Não foi possível confirmar.</b><p style={{ margin: '6px 0 0' }}>{estado.mensagem}</p></div>
          )}
          {estado.fase === 'info' && (
            <div className="alert info mt">{estado.mensagem}</div>
          )}

          {estado.fase === 'pronto' && (
            <button className="btn primary block mt" onClick={confirmar} disabled={aConfirmar}>
              {aConfirmar ? 'A confirmar…' : '✓ Confirmar consulta'}
            </button>
          )}

          <Link className="btn ghost block mt" to="/login">Entrar na aplicação</Link>
        </div>
      </section>
    </div>
  );
}
