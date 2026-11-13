import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { http } from '../api.js';

/**
 * Página pública aberta pelo link enviado por e-mail.
 * Confirma a conta sem exigir sessão iniciada.
 */
export function ConfirmarEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [estado, setEstado] = useState({ fase: 'a-carregar', mensagem: '' });

  useEffect(() => {
    let activo = true;
    if (!token) {
      setEstado({ fase: 'erro', mensagem: 'O link não inclui um token de confirmação.' });
      return undefined;
    }
    (async () => {
      try {
        const r = await http.post('/auth/confirmar-email', { token });
        if (activo) {
          setEstado({
            fase: 'sucesso',
            mensagem: r.mensagem || 'E-mail confirmado com sucesso.',
            utilizador: r.utilizador
          });
        }
      } catch (falha) {
        if (activo) setEstado({ fase: 'erro', mensagem: falha.message });
      }
    })();
    return () => { activo = false; };
  }, [token]);

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
          <h1 style={{ marginTop: 40 }}>Confirmação de e-mail.</h1>
          <p>Este link prova que o endereço pertence à pessoa que criou a conta. É a primeira camada de segurança do MediAgenda.</p>
        </div>
        <p style={{ fontSize: '.78rem', opacity: .7 }}>A confirmação não expõe a palavra-passe nem dados clínicos.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-form">
          {estado.fase === 'a-carregar' && (
            <div className="alert info">A confirmar o seu e-mail…</div>
          )}
          {estado.fase === 'sucesso' && (
            <>
              <div className="alert success">
                <b>E-mail confirmado!</b>
                <p style={{ margin: '6px 0 0' }}>{estado.mensagem}</p>
              </div>
              <Link className="btn primary block mt" to="/login">Entrar na conta</Link>
            </>
          )}
          {estado.fase === 'erro' && (
            <>
              <div className="alert error">
                <b>Não foi possível confirmar.</b>
                <p style={{ margin: '6px 0 0' }}>{estado.mensagem}</p>
              </div>
              <p className="tiny muted mt">Se o token expirou, peça um novo link ou contacte a secretaria.</p>
              <Link className="btn ghost block mt" to="/login">Voltar ao login</Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
