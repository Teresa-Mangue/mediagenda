import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api.js';
import { useAuth, iniciais } from '../auth.jsx';
import { Topo } from '../components/Layout.jsx';
import { AcoesConsulta } from '../components/AcoesConsulta.jsx';
import { Carregando, Campo, Estrelas, Modal, useToast, Vazio } from '../components/ui.jsx';
import { diaMes, duracaoTexto, formatarData, formatarDataHora, formatarHora } from '../utils.js';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function inicioHoje() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
}
function fimHoje() {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString();
}

export function PainelMedico() {
  const { utilizador } = useAuth();
  const toast = useToast();
  const [aba, setAba] = useState('agenda');
  const [agendaHoje, setAgendaHoje] = useState([]);
  const [proximas, setProximas] = useState([]);
  const [disp, setDisp] = useState(null);
  const [pacientes, setPacientes] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [relatorio, setRelatorio] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [janelas, setJanelas] = useState([]);
  const [aGuardar, setAGuardar] = useState(false);
  const [novoBloqueio, setNovoBloqueio] = useState({ inicio: '', fim: '', motivo: '' });
  const [modalBloqueio, setModalBloqueio] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [hoje, todas, disponibilidade, listaPacientes, listaAvaliacoes, rel] = await Promise.all([
        http.get(`/medico/agenda?desde=${encodeURIComponent(inicioHoje())}&ate=${encodeURIComponent(fimHoje())}`),
        http.get('/medico/agenda'),
        http.get('/medico/disponibilidade'),
        http.get('/medico/pacientes'),
        http.get('/medico/avaliacoes'),
        http.get('/medico/relatorio')
      ]);
      setAgendaHoje(hoje);
      const agora = Date.now();
      setProximas(todas
        .filter((c) => ['pendente', 'confirmada'].includes(c.estado) && new Date(c.data_hora).getTime() >= agora)
        .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora))
        .slice(0, 8));
      setDisp(disponibilidade);
      setJanelas(disponibilidade.disponibilidades.map((d) => ({
        diaSemana: Number(d.dia_semana), horaInicio: d.hora_inicio, horaFim: d.hora_fim, id: d.id
      })));
      setPacientes(listaPacientes);
      setAvaliacoes(listaAvaliacoes);
      setRelatorio(rel);
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const media = useMemo(() => {
    if (!avaliacoes.length) return null;
    return (avaliacoes.reduce((s, a) => s + Number(a.pontuacao), 0) / avaliacoes.length).toFixed(1);
  }, [avaliacoes]);

  const adicionarJanela = () => setJanelas((j) => [...j, { diaSemana: 1, horaInicio: '08:00', horaFim: '12:00' }]);
  const removerJanela = (indice) => setJanelas((j) => j.filter((_, i) => i !== indice));
  const alterarJanela = (indice, campo, valor) => setJanelas((j) => j.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item)));

  const guardarDisponibilidade = async () => {
    setAGuardar(true);
    try {
      const r = await http.put('/medico/disponibilidade', {
        lista: janelas.map(({ diaSemana, horaInicio, horaFim }) => ({
          diaSemana: Number(diaSemana), horaInicio, horaFim
        }))
      });
      toast.sucesso('Disponibilidade actualizada.');
      setJanelas(r.disponibilidades.map((d) => ({
        diaSemana: Number(d.dia_semana), horaInicio: d.hora_inicio, horaFim: d.hora_fim, id: d.id
      })));
      const atualizado = await http.get('/medico/disponibilidade');
      setDisp(atualizado);
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setAGuardar(false);
    }
  };

  const criarBloqueio = async () => {
    try {
      await http.post('/medico/bloqueios', {
        inicio: new Date(novoBloqueio.inicio).toISOString(),
        fim: new Date(novoBloqueio.fim).toISOString(),
        motivo: novoBloqueio.motivo
      });
      toast.sucesso('Bloqueio criado.');
      setModalBloqueio(false);
      setNovoBloqueio({ inicio: '', fim: '', motivo: '' });
      const atualizado = await http.get('/medico/disponibilidade');
      setDisp(atualizado);
    } catch (falha) {
      toast.erro(falha.message);
    }
  };

  const removerBloqueio = async (id) => {
    try {
      await http.del(`/medico/bloqueios/${id}`);
      toast.sucesso('Bloqueio removido.');
      const atualizado = await http.get('/medico/disponibilidade');
      setDisp(atualizado);
    } catch (falha) {
      toast.erro(falha.message);
    }
  };

  if (carregando) return <Carregando texto="A carregar o painel médico…" />;

  const pendentes = agendaHoje.filter((c) => c.estado === 'pendente').length;
  const confirmadas = agendaHoje.filter((c) => c.estado === 'confirmada').length;

  return (
    <>
      <Topo
        titulo="Painel médico"
        sub={`${utilizador.nome} · ${utilizador.medico?.especialidades?.map((e) => e.nome).join(' · ') || ''}`}
        acoes={<Link className="btn ghost" to="/consultas">Agenda completa</Link>}
      />

      <div className="grid c4">
        <div className="card pad-sm">
          <div className="kpi">
            <span className="label">Consultas hoje</span>
            <span className="value">{agendaHoje.length}</span>
            <span className="hint">{pendentes} pendente(s) · {confirmadas} confirmada(s)</span>
          </div>
        </div>
        <div className="card pad-sm">
          <div className="kpi">
            <span className="label">Próximas</span>
            <span className="value">{proximas.length}</span>
            <span className="hint">marcações activas</span>
          </div>
        </div>
        <div className="card pad-sm">
          <div className="kpi">
            <span className="label">Pacientes</span>
            <span className="value">{pacientes.length}</span>
            <span className="hint">atendidos pelo médico</span>
          </div>
        </div>
        <div className="card pad-sm">
          <div className="kpi">
            <span className="label">Avaliação</span>
            <span className="value">{media || '—'}<small> /5</small></span>
            <span className="hint">{avaliacoes.length} avaliação(ões)</span>
          </div>
        </div>
      </div>

      <div className="tabs mt">
        {[
          { id: 'agenda', label: "Agenda de hoje" },
          { id: 'proximas', label: 'Próximas consultas' },
          { id: 'disponibilidade', label: 'Disponibilidade' },
          { id: 'bloqueios', label: 'Bloqueios' },
          { id: 'pacientes', label: 'Pacientes' },
          { id: 'avaliacoes', label: 'Avaliações' }
        ].map((a) => (
          <button key={a.id} className={`tab ${aba === a.id ? 'active' : ''}`} onClick={() => setAba(a.id)}>
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'agenda' && (
        agendaHoje.length === 0 ? (
          <Vazio icone="🌤️" titulo="Sem consultas hoje" texto="A sua agenda de hoje está livre." />
        ) : (
          <div className="stack">
            {agendaHoje.map((c) => (
              <article key={c.id} className="card pad-sm">
                <div className="row wrap between">
                  <div className="row" style={{ gap: 14 }}>
                    <div className="avatar" style={{ borderRadius: 12, flexDirection: 'column', width: 52, height: 52 }}>
                      <b style={{ fontSize: '.8rem' }}>{formatarHora(c.data_hora)}</b>
                    </div>
                    <div>
                      <div className="row wrap" style={{ gap: 8 }}>
                        <h3 style={{ margin: 0 }}>{c.paciente_nome}</h3>
                        <span className={`badge ${c.estado}`}>{c.estado}</span>
                      </div>
                      <div className="tiny muted">{c.especialidade_nome} · {duracaoTexto(c.duracao_min)} · {c.paciente_telefone}</div>
                      <div className="tiny muted">{formatarDataHora(c.data_hora)}</div>
                    </div>
                  </div>
                  <Link className="btn sm ghost" to={`/consultas/${c.id}`}>Detalhes →</Link>
                </div>
                <div className="mt-sm">
                  <AcoesConsulta consulta={c} onAtualizar={carregar} />
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {aba === 'proximas' && (
        proximas.length === 0 ? (
          <Vazio icone="📅" titulo="Sem próximas consultas" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Data</th><th>Paciente</th><th>Especialidade</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {proximas.map((c) => (
                  <tr key={c.id}>
                    <td>{formatarDataHora(c.data_hora)}</td>
                    <td>{c.paciente_nome}</td>
                    <td>{c.especialidade_nome}</td>
                    <td><span className={`badge ${c.estado}`}>{c.estado}</span></td>
                    <td className="right"><Link className="btn sm ghost" to={`/consultas/${c.id}`}>Abrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {aba === 'disponibilidade' && (
        <div className="split">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Horário semanal</h2>
                <p>Estas janelas geram os horários disponíveis para marcação.</p>
              </div>
              <button className="btn sm" onClick={adicionarJanela}>+ Janela</button>
            </div>
            <div className="stack sm">
              {janelas.length === 0 && <p className="tiny">Sem janelas definidas.</p>}
              {janelas.map((janela, i) => (
                <div key={i} className="row wrap" style={{ gap: 8 }}>
                  <select value={janela.diaSemana} onChange={(e) => alterarJanela(i, 'diaSemana', e.target.value)}
                    style={{ maxWidth: 150 }}>
                    {DIAS.map((d, indice) => <option key={d} value={indice}>{d}</option>)}
                  </select>
                  <input type="time" value={janela.horaInicio} onChange={(e) => alterarJanela(i, 'horaInicio', e.target.value)}
                    style={{ maxWidth: 120 }} />
                  <span className="muted">→</span>
                  <input type="time" value={janela.horaFim} onChange={(e) => alterarJanela(i, 'horaFim', e.target.value)}
                    style={{ maxWidth: 120 }} />
                  <button className="btn sm danger" onClick={() => removerJanela(i)}>Remover</button>
                </div>
              ))}
            </div>
            <button className="btn primary mt" onClick={guardarDisponibilidade} disabled={aGuardar}>
              {aGuardar ? 'A guardar…' : 'Guardar disponibilidade'}
            </button>
          </section>

          <aside className="stack">
            <section className="card">
              <h3>Próximos 14 dias</h3>
              <div className="stack sm mt-sm">
                {(disp?.proximosDias || []).map((d) => (
                  <div key={d.data} className="row between" style={{ fontSize: '.82rem' }}>
                    <span className="muted">{diaMes(d.data)}</span>
                    <span className="badge neutral">{d.disponiveis} livres</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="card">
              <h3>Duração e limites</h3>
              <dl className="kv mt-sm">
                <dt>Duração padrão</dt><dd>{duracaoTexto(utilizador.medico?.duracao_consulta_min || 60)}</dd>
                <dt>Máx. por dia</dt><dd>{utilizador.medico?.max_consultas_dia || 10}</dd>
                <dt>Consulta</dt><dd>RN-03 · RN-09</dd>
              </dl>
              <p className="tiny mt-sm">O limite diário do médico é revalidado a cada marcação.</p>
            </section>
          </aside>
        </div>
      )}

      {aba === 'bloqueios' && (
        <div className="split">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Bloqueios e ausências</h2>
                <p>Períodos em que não há atendimento (férias, formação, reuniões).</p>
              </div>
              <button className="btn sm primary" onClick={() => setModalBloqueio(true)}>+ Bloqueio</button>
            </div>
            {(disp?.bloqueios || []).length === 0 ? (
              <p className="tiny">Nenhum bloqueio registado.</p>
            ) : (
              <div className="stack sm">
                {disp.bloqueios.map((b) => (
                  <div key={b.id} className="list-item">
                    <span className="badge warn" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>⛔</span>
                    <div className="grow tiny">
                      <b>{b.motivo || 'Indisponível'}</b>
                      <div className="muted">{formatarDataHora(b.inicio)} → {formatarDataHora(b.fim)}</div>
                    </div>
                    <button className="btn sm danger" onClick={() => removerBloqueio(b.id)}>Remover</button>
                  </div>
                ))}
              </div>
            )}
          </section>
          <aside className="card">
            <h3>Como funciona</h3>
            <p className="tiny">
              A cadeia de validação consulta os bloqueios antes de aceitar uma marcação (RF-04).
              Os horários bloqueados deixam de aparecer como disponíveis.
            </p>
          </aside>
        </div>
      )}

      {aba === 'pacientes' && (
        pacientes.length === 0 ? (
          <Vazio icone="👥" titulo="Ainda sem pacientes" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Paciente</th><th>Contacto</th><th>Nascimento</th><th>Consultas</th><th>Última</th></tr>
              </thead>
              <tbody>
                {pacientes.map((p) => (
                  <tr key={p.id}>
                    <td><div className="row"><span className="avatar" style={{ width: 30, height: 30, fontSize: '.7rem' }}>{iniciais(p.nome)}</span>{p.nome}</div></td>
                    <td className="tiny">{p.telefone || p.email}</td>
                    <td className="tiny">{p.data_nascimento ? formatarData(p.data_nascimento) : '—'}</td>
                    <td>{p.total_consultas}</td>
                    <td className="tiny">{formatarDataHora(p.ultima_consulta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {aba === 'avaliacoes' && (
        <div className="split">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Avaliações dos pacientes</h2>
                <p>Feedback recolhido após consultas realizadas.</p>
              </div>
              <Estrelas valor={media} total={avaliacoes.length} />
            </div>
            {avaliacoes.length === 0 ? (
              <p className="tiny">Sem avaliações.</p>
            ) : (
              <div className="stack sm">
                {avaliacoes.map((a) => (
                  <div key={a.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <div className="avatar" style={{ borderRadius: 12 }}>{iniciais(a.paciente_nome)}</div>
                    <div className="grow">
                      <div className="row between wrap">
                        <b style={{ fontSize: '.88rem' }}>{a.paciente_nome}</b>
                        <span className="stars">{'★'.repeat(a.pontuacao)}{'☆'.repeat(5 - a.pontuacao)}</span>
                      </div>
                      <div className="tiny muted">{formatarDataHora(a.data_hora)}</div>
                      {a.comentario && <p className="tiny" style={{ margin: '6px 0 0', color: 'var(--text)' }}>{a.comentario}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <aside className="card">
            <h3>Resumo por estado</h3>
            <div className="stack sm mt-sm">
              {(relatorio?.porEstado || []).map((e) => (
                <div key={e.estado} className="row between">
                  <span className={`badge ${e.estado}`}>{e.estado}</span>
                  <b>{e.total}</b>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {modalBloqueio && (
        <Modal titulo="Novo bloqueio" subtitulo="O período deixa de estar disponível para marcações."
          onFechar={() => setModalBloqueio(false)}>
          <div className="grid c2">
            <Campo label="Início">
              <input type="datetime-local" value={novoBloqueio.inicio}
                onChange={(e) => setNovoBloqueio({ ...novoBloqueio, inicio: e.target.value })} />
            </Campo>
            <Campo label="Fim">
              <input type="datetime-local" value={novoBloqueio.fim}
                onChange={(e) => setNovoBloqueio({ ...novoBloqueio, fim: e.target.value })} />
            </Campo>
          </div>
          <Campo label="Motivo">
            <input value={novoBloqueio.motivo} onChange={(e) => setNovoBloqueio({ ...novoBloqueio, motivo: e.target.value })}
              placeholder="Ex.: formação externa" />
          </Campo>
          <div className="row between mt">
            <button className="btn ghost" onClick={() => setModalBloqueio(false)}>Cancelar</button>
            <button className="btn primary" onClick={criarBloqueio} disabled={!novoBloqueio.inicio || !novoBloqueio.fim}>
              Criar bloqueio
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
