import { useState } from 'react';
import { useAuth, iniciais } from '../auth.jsx';
import { Topo } from '../components/Layout.jsx';
import { Campo, useToast } from '../components/ui.jsx';
import { formatarData } from '../utils.js';

export function Perfil() {
  const { utilizador, atualizar } = useAuth();
  const toast = useToast();
  const paciente = utilizador.paciente || {};
  const medico = utilizador.medico || {};

  const [form, setForm] = useState({
    nome: utilizador.nome || '',
    telefone: utilizador.telefone || '',
    preferenciaNotificacao: utilizador.preferencia_notificacao || 'email',
    dataNascimento: paciente.data_nascimento || '',
    endereco: paciente.endereco || ''
  });
  const [aGuardar, setAGuardar] = useState(false);

  const atualizarCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    setAGuardar(true);
    try {
      await atualizar(form);
      toast.sucesso('Perfil actualizado.');
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <>
      <Topo titulo="O meu perfil" sub="Dados pessoais, contacto e preferências de notificação." />

      <div className="split">
        <section className="card">
          <h2>Dados editáveis</h2>
          <form className="stack mt" onSubmit={guardar}>
            <Campo label="Nome completo">
              <input value={form.nome} onChange={atualizarCampo('nome')} required />
            </Campo>
            <Campo label="Telefone">
              <input value={form.telefone} onChange={atualizarCampo('telefone')} placeholder="+258 84 000 0000" />
            </Campo>

            {utilizador.perfil === 'paciente' && (
              <>
                <Campo label="Data de nascimento">
                  <input type="date" value={form.dataNascimento} onChange={atualizarCampo('dataNascimento')} />
                </Campo>
                <Campo label="Endereço">
                  <input value={form.endereco} onChange={atualizarCampo('endereco')} placeholder="Bairro, cidade" />
                </Campo>
              </>
            )}

            <Campo label="Preferência de notificação" hint="Aplicada a confirmações, lembretes e cancelamentos.">
              <select value={form.preferenciaNotificacao} onChange={atualizarCampo('preferenciaNotificacao')}>
                <option value="email">E-mail</option>
                <option value="sms">SMS</option>
                <option value="ambos">E-mail e SMS</option>
              </select>
            </Campo>

            <button className="btn primary" disabled={aGuardar}>
              {aGuardar ? 'A guardar…' : 'Guardar alterações'}
            </button>
          </form>
        </section>

        <aside className="stack">
          <section className="card center">
            <div className="avatar" style={{ width: 76, height: 76, fontSize: '1.5rem', margin: '0 auto 12px' }}>
              {iniciais(utilizador.nome)}
            </div>
            <h2 style={{ marginBottom: 2 }}>{utilizador.nome}</h2>
            <div className="badge info">{utilizador.perfil}</div>
            <p className="tiny mt-sm">{utilizador.email}</p>
            <div className="row center" style={{ justifyContent: 'center' }}>
              <span className={`badge ${utilizador.email_confirmado ? 'confirmada' : 'pendente'}`}>
                {utilizador.email_confirmado ? 'e-mail confirmado' : 'e-mail por confirmar'}
              </span>
            </div>
          </section>

          <section className="card">
            <h3>Detalhes da conta</h3>
            <dl className="kv mt-sm">
              <dt>Perfil</dt><dd style={{ textTransform: 'capitalize' }}>{utilizador.perfil}</dd>
              <dt>Conta criada</dt><dd>{formatarData(utilizador.criado_em)}</dd>
              {utilizador.perfil === 'paciente' && (
                <>
                  <dt>Paciente nº</dt><dd>{paciente.id ?? '—'}</dd>
                  <dt>Cancel. tardios</dt><dd>{paciente.cancelamentos_tardios ?? 0}</dd>
                </>
              )}
              {utilizador.perfil === 'medico' && (
                <>
                  <dt>Nº de registo</dt><dd>{medico.numero_registo || '—'}</dd>
                  <dt>Localização</dt><dd>{medico.localizacao || '—'}</dd>
                  <dt>Especialidades</dt>
                  <dd>{(medico.especialidades || []).map((e) => e.nome).join(', ') || '—'}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="card">
            <h3>Privacidade</h3>
            <p className="tiny">
              As palavras-passe são guardadas com scrypt e as sessões usam tokens assinados com HMAC.
              Todas as operações críticas ficam na auditoria do sistema.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
