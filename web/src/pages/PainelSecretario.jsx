import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api.js';
import { Topo } from '../components/Layout.jsx';
import { Campo, Estrelas, Modal, useToast, Vazio } from '../components/ui.jsx';
import { iniciais } from '../auth.jsx';
import { duracaoTexto, formatarData, formatarDataHora } from '../utils.js';

export function PainelSecretario() {
  const toast = useToast();
  const [aba, setAba] = useState('pacientes');
  const [pacientes, setPacientes] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [pesquisa, setPesquisa] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [modalNovo, setModalNovo] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', dataNascimento: '', endereco: '', password: '' });
  const [aGuardar, setAGuardar] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [lista, todas] = await Promise.all([
        http.get('/pacientes'),
        http.get('/consultas/minhas')
      ]);
      setPacientes(lista);
      setConsultas(todas);
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();
    if (!termo) return pacientes;
    return pacientes.filter((p) =>
      p.nome.toLowerCase().includes(termo)
      || p.email.toLowerCase().includes(termo)
      || (p.telefone || '').includes(termo)
    );
  }, [pacientes, pesquisa]);

  const hoje = useMemo(() => {
    const d = new Date();
    return consultas
      .filter((c) => new Date(c.data_hora).toDateString() === d.toDateString())
      .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
  }, [consultas]);

  const pendentes = consultas.filter((c) => c.estado === 'pendente').length;

  const criarPaciente = async () => {
    setAGuardar(true);
    try {
      const r = await http.post('/pacientes', {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        dataNascimento: form.dataNascimento || undefined,
        endereco: form.endereco || undefined,
        password: form.password || undefined
      });
      toast.sucesso(r.mensagem || 'Paciente registado.');
      setModalNovo(false);
      setForm({ nome: '', email: '', telefone: '', dataNascimento: '', endereco: '', password: '' });
      await carregar();
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setAGuardar(false);
    }
  };

  const abrirDetalhe = async (paciente) => {
    try {
      const lista = await http.get(`/pacientes/${paciente.id}/consultas`);
      setDetalhe({ paciente, consultas: lista });
    } catch (falha) {
      toast.erro(falha.message);
    }
  };

  if (carregando) return <div className="spinner" />;

  return (
    <>
      <Topo
        titulo="Painel da secretaria"
        sub="Registo de pacientes e apoio ao atendimento presencial."
        acoes={<Link className="btn primary" to="/">+ Marcar consulta</Link>}
      />

      <div className="grid c4">
        <div className="card pad-sm">
          <div className="kpi">
            <span className="label">Pacientes</span>
            <span className="value">{pacientes.length}</span>
            <span className="hint">registados no sistema</span>
          </div>
        </div>
        <div className="card pad-sm">
          <div className="kpi">
            <span className="label">Consultas hoje</span>
            <span className="value">{hoje.length}</span>
            <span className="hint">em todas as especialidades</span>
          </div>
        </div>
        <div className="card pad-sm">
          <div className="kpi">
            <span className="label">Pendentes</span>
            <span className="value">{pendentes}</span>
            <span className="hint">aguardam confirmação (RN-07)</span>
          </div>
        </div>
        <div className="card pad-sm">
          <div className="kpi">
            <span className="label">Total consultas</span>
            <span className="value">{consultas.length}</span>
            <span className="hint">histórico completo</span>
          </div>
        </div>
      </div>

      <div className="tabs mt">
        {[{ id: 'pacientes', label: 'Pacientes' }, { id: 'dia', label: 'Consultas de hoje' }].map((a) => (
          <button key={a.id} className={`tab ${aba === a.id ? 'active' : ''}`} onClick={() => setAba(a.id)}>{a.label}</button>
        ))}
      </div>

      {aba === 'pacientes' && (
        <>
          <div className="row between wrap" style={{ marginBottom: 14 }}>
            <input placeholder="Pesquisar por nome, e-mail ou telefone…" value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)} style={{ maxWidth: 380 }} />
            <button className="btn primary" onClick={() => setModalNovo(true)}>+ Novo paciente</button>
          </div>

          {filtrados.length === 0 ? (
            <Vazio icone="👥" titulo="Nenhum paciente encontrado" texto="Ajuste a pesquisa ou registe um novo paciente." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Paciente</th><th>Contacto</th><th>Nascimento</th><th>Consultas</th><th></th></tr>
                </thead>
                <tbody>
                  {filtrados.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="row">
                          <span className="avatar" style={{ width: 32, height: 32, fontSize: '.72rem' }}>{iniciais(p.nome)}</span>
                          <div>
                            <b style={{ fontSize: '.86rem' }}>{p.nome}</b>
                            <div className="tiny muted">{p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="tiny">{p.telefone || '—'}</td>
                      <td className="tiny">{p.data_nascimento ? formatarData(p.data_nascimento) : '—'}</td>
                      <td>{p.total_consultas}</td>
                      <td className="right">
                        <button className="btn sm ghost" onClick={() => abrirDetalhe(p)}>Ver consultas</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {aba === 'dia' && (
        hoje.length === 0 ? (
          <Vazio icone="🌤️" titulo="Sem consultas hoje" />
        ) : (
          <div className="stack">
            {hoje.map((c) => (
              <article key={c.id} className="card pad-sm">
                <div className="row wrap between">
                  <div className="row" style={{ gap: 12 }}>
                    <div className="avatar" style={{ borderRadius: 12, width: 50, height: 50, flexDirection: 'column' }}>
                      <b style={{ fontSize: '.76rem' }}>{new Date(c.data_hora).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</b>
                    </div>
                    <div>
                      <div className="row wrap" style={{ gap: 8 }}>
                        <b>{c.paciente_nome}</b>
                        <span className={`badge ${c.estado}`}>{c.estado}</span>
                      </div>
                      <div className="tiny muted">{c.medico_nome} · {c.especialidade_nome} · {duracaoTexto(c.duracao_min)}</div>
                      <div className="tiny muted">{c.paciente_telefone}</div>
                    </div>
                  </div>
                  <Link className="btn sm" to={`/consultas/${c.id}`}>Abrir</Link>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {modalNovo && (
        <Modal titulo="Novo paciente" subtitulo="A conta fica activa com uma palavra-passe inicial." onFechar={() => setModalNovo(false)}>
          <div className="stack">
            <Campo label="Nome completo">
              <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </Campo>
            <div className="grid c2">
              <Campo label="E-mail">
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </Campo>
              <Campo label="Telefone">
                <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </Campo>
            </div>
            <div className="grid c2">
              <Campo label="Data de nascimento">
                <input type="date" value={form.dataNascimento} onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} />
              </Campo>
              <Campo label="Palavra-passe inicial" hint="Padrão: MediAgenda123">
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Campo>
            </div>
            <Campo label="Endereço">
              <input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </Campo>
          </div>
          <div className="row between mt">
            <button className="btn ghost" onClick={() => setModalNovo(false)}>Cancelar</button>
            <button className="btn primary" onClick={criarPaciente} disabled={aGuardar || !form.nome || !form.email}>
              {aGuardar ? 'A registar…' : 'Registar paciente'}
            </button>
          </div>
        </Modal>
      )}

      {detalhe && (
        <Modal wide titulo={detalhe.paciente.nome} subtitulo={`${detalhe.paciente.email} · ${detalhe.paciente.telefone || 'sem telefone'}`}
          onFechar={() => setDetalhe(null)}>
          <dl className="kv">
            <dt>Data de nascimento</dt><dd>{detalhe.paciente.data_nascimento ? formatarData(detalhe.paciente.data_nascimento) : '—'}</dd>
            <dt>Endereço</dt><dd>{detalhe.paciente.endereco || '—'}</dd>
            <dt>Total de consultas</dt><dd>{detalhe.consultas.length}</dd>
            <dt>Cancelamentos tardios</dt><dd>{detalhe.paciente.cancelamentos_tardios ?? 0}</dd>
          </dl>
          <h3 className="mt">Consultas</h3>
          {detalhe.consultas.length === 0 ? (
            <p className="tiny">Sem consultas registadas.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Médico</th><th>Especialidade</th><th>Estado</th></tr></thead>
                <tbody>
                  {detalhe.consultas.map((c) => (
                    <tr key={c.id}>
                      <td className="tiny">{formatarDataHora(c.data_hora)}</td>
                      <td className="tiny">{c.medico_nome}</td>
                      <td className="tiny">{c.especialidade_nome}</td>
                      <td><span className={`badge ${c.estado}`}>{c.estado}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
