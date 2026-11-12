import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { http } from '../api.js';
import { Campo, useToast } from '../components/ui.jsx';

const ESPECIALIDADES = [
  'Cardiologia', 'Pediatria', 'Ortopedia', 'Dermatologia', 'Clínica Geral', 'Fisioterapia'
];

export function Registo() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({
    nome: '', email: '', telefone: '', password: '', perfil: 'paciente',
    dataNascimento: '', endereco: '', numeroRegisto: '', localizacao: 'Clínica MediAgenda — Tete',
    especialidades: []
  });
  const [erro, setErro] = useState('');
  const [aSubmeter, setASubmeter] = useState(false);
  const [criado, setCriado] = useState(null);
  const [confirmado, setConfirmado] = useState(false);

  const atualizar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const alternarEspecialidade = (nome) => setForm((f) => ({
    ...f,
    especialidades: f.especialidades.includes(nome)
      ? f.especialidades.filter((x) => x !== nome)
      : [...f.especialidades, nome]
  }));

  const submeter = async (e) => {
    e.preventDefault();
    setErro('');
    setASubmeter(true);
    try {
      const corpo = {
        nome: form.nome,
        email: form.email,
        password: form.password,
        perfil: form.perfil,
        telefone: form.telefone || undefined
      };
      if (form.perfil === 'paciente') {
        corpo.dataNascimento = form.dataNascimento || undefined;
        corpo.endereco = form.endereco || undefined;
      }
      if (form.perfil === 'medico') {
        corpo.numeroRegisto = form.numeroRegisto;
        corpo.localizacao = form.localizacao;
        corpo.especialidades = form.especialidades;
      }
      const r = await http.post('/auth/registo', corpo);
      setCriado(r);
      toast.sucesso('Conta criada com sucesso.');
    } catch (falha) {
      setErro(falha.message);
    } finally {
      setASubmeter(false);
    }
  };

  const confirmar = async () => {
    try {
      await http.post('/auth/confirmar-email', { token: criado.tokenConfirmacao });
      setConfirmado(true);
      toast.sucesso('E-mail confirmado. Já pode entrar.');
    } catch (falha) {
      setErro(falha.message);
    }
  };

  if (criado) {
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
            <h1 style={{ marginTop: 40 }}>Conta criada.</h1>
            <p>Falta apenas confirmar o e-mail para activar todas as funcionalidades da conta.</p>
          </div>
          <p style={{ fontSize: '.78rem', opacity: .7 }}>Protótipo académico — dados de demonstração.</p>
        </section>
        <section className="auth-panel">
          <div className="auth-form">
            <div className="alert success">
              <b>Bem-vindo, {criado.utilizador?.nome}.</b>
              <p style={{ margin: '6px 0 0' }}>
                O token de confirmação foi enviado para a outbox simulada.
              </p>
            </div>
            <div className="card mt" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
              <div className="tiny muted">Token de confirmação (demonstração)</div>
              <code style={{ wordBreak: 'break-all' }}>{criado.tokenConfirmacao}</code>
            </div>
            {erro && <div className="alert error mt">{erro}</div>}
            {confirmado ? (
              <div className="stack mt">
                <div className="alert success">E-mail confirmado com sucesso.</div>
                <Link className="btn primary block" to="/login">Ir para o login</Link>
              </div>
            ) : (
              <div className="row mt">
                <button className="btn primary grow" onClick={confirmar}>Confirmar e-mail</button>
                <Link className="btn ghost" to="/login">Entrar sem confirmar</Link>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

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
          <h1 style={{ marginTop: 40 }}>Crie a sua conta.</h1>
          <p>Pacientes marcam consultas em segundos. Médicos gerem a agenda. A secretaria apoia o atendimento.</p>
        </div>
        <div className="auth-features">
          <div className="auth-feature">
            <div className="dot">🩺</div>
            <div><b>Perfil de paciente</b>Acompanhe consultas, confirme, reagende e avalie o atendimento.</div>
          </div>
          <div className="auth-feature">
            <div className="dot">📅</div>
            <div><b>Perfil de médico</b>Defina disponibilidade semanal, bloqueios e veja a agenda do dia.</div>
          </div>
          <div className="auth-feature">
            <div className="dot">🗂️</div>
            <div><b>Perfil de secretaria</b>Registe pacientes e apoie marcações presenciais.</div>
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
          <h1>Criar conta</h1>
          <p>Preencha os dados abaixo. Os campos variam conforme o perfil.</p>

          {erro && <div className="alert error" style={{ marginBottom: 14 }}>{erro}</div>}

          <form className="stack" onSubmit={submeter}>
            <Campo label="Nome completo">
              <input value={form.nome} onChange={atualizar('nome')} required placeholder="Ex.: Maria Silva" />
            </Campo>
            <div className="grid c2">
              <Campo label="E-mail">
                <input type="email" value={form.email} onChange={atualizar('email')} required placeholder="nome@exemplo.com" />
              </Campo>
              <Campo label="Telefone">
                <input value={form.telefone} onChange={atualizar('telefone')} placeholder="+258 84 000 0000" />
              </Campo>
            </div>
            <Campo label="Palavra-passe" hint="Mínimo de 6 caracteres.">
              <input type="password" value={form.password} onChange={atualizar('password')} required minLength={6} />
            </Campo>
            <Campo label="Perfil">
              <select value={form.perfil} onChange={atualizar('perfil')}>
                <option value="paciente">Paciente</option>
                <option value="medico">Médico</option>
                <option value="secretario">Secretaria</option>
              </select>
            </Campo>

            {form.perfil === 'paciente' && (
              <div className="grid c2">
                <Campo label="Data de nascimento">
                  <input type="date" value={form.dataNascimento} onChange={atualizar('dataNascimento')} />
                </Campo>
                <Campo label="Endereço">
                  <input value={form.endereco} onChange={atualizar('endereco')} placeholder="Bairro, cidade" />
                </Campo>
              </div>
            )}

            {form.perfil === 'medico' && (
              <div className="stack sm">
                <div className="grid c2">
                  <Campo label="Número de registo (Ordem dos Médicos)">
                    <input value={form.numeroRegisto} onChange={atualizar('numeroRegisto')} placeholder="OM-0000" required />
                  </Campo>
                  <Campo label="Localização">
                    <input value={form.localizacao} onChange={atualizar('localizacao')} />
                  </Campo>
                </div>
                <Campo label="Especialidades" hint="Seleccione uma ou mais.">
                  <div className="row wrap">
                    {ESPECIALIDADES.map((nome) => (
                      <label key={nome} className="check badge neutral" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.especialidades.includes(nome)}
                          onChange={() => alternarEspecialidade(nome)} />
                        {nome}
                      </label>
                    ))}
                  </div>
                </Campo>
              </div>
            )}

            <button className="btn primary block" disabled={aSubmeter}>
              {aSubmeter ? 'A criar conta…' : 'Criar conta'}
            </button>
          </form>

          <p className="mt" style={{ fontSize: '.85rem' }}>
            Já tem conta? <Link to="/login">Entrar</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
