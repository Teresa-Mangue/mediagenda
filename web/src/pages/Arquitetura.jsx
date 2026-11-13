import { useCallback, useEffect, useMemo, useState } from 'react';
import { http } from '../api.js';
import { Topo } from '../components/Layout.jsx';
import { Campo, Carregando, Modal, useToast, Vazio } from '../components/ui.jsx';
import { chaveData, formatarDataHora } from '../utils.js';

const ABAS = [
  { id: 'padroes', label: 'Padrões implementados' },
  { id: 'comparacao', label: 'Sem padrões vs. Com padrões' },
  { id: 'simulador', label: 'Simulador da cadeia' },
  { id: 'eventos', label: 'Event Monitor' },
  { id: 'trace', label: 'Trace & Outbox' }
];

function amanhaAs10() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return { data: chaveData(d), hora: '10:00' };
}

function diaUtilFuturo(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(0, 0, 0, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

export function Arquitetura() {
  const toast = useToast();
  const [aba, setAba] = useState('padroes');
  const [arquitetura, setArquitetura] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [resumoEventos, setResumoEventos] = useState(null);
  const [traces, setTraces] = useState([]);
  const [notificacoes, setNotificacoes] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [padraoAberto, setPadraoAberto] = useState(null);

  const [sim, setSim] = useState({ medicoId: '', especialidadeId: '', pacienteId: '', ...amanhaAs10() });
  const [simulando, setSimulando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [traceDetalhe, setTraceDetalhe] = useState(null);
  const diaCheio = useMemo(() => diaUtilFuturo(5), []);

  const carregar = useCallback(async () => {
    try {
      const [arq, ev, tr, nt, pacs, meds] = await Promise.all([
        http.get('/demo/arquitetura'),
        http.get('/admin/eventos?limite=80'),
        http.get('/admin/validacoes?limite=30'),
        http.get('/admin/notificacoes?limite=40'),
        http.get('/pacientes'),
        http.get('/medicos')
      ]);
      setArquitetura(arq);
      setEventos(ev.eventos);
      setResumoEventos(ev.resumo);
      setTraces(tr);
      setNotificacoes(nt);
      setPacientes(pacs);
      setMedicos(meds);
      if (meds.length) {
        const primeiro = meds[1] || meds[0];
        setSim((s) => ({
          ...s,
          medicoId: s.medicoId || String(primeiro.id),
          especialidadeId: s.especialidadeId || String(primeiro.especialidades[0]?.id || ''),
          pacienteId: s.pacienteId || String(pacs[0]?.id || '')
        }));
      }
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const medicoSel = useMemo(
    () => medicos.find((m) => Number(m.id) === Number(sim.medicoId)) || null,
    [medicos, sim.medicoId]
  );

  const prepararCasoRn03 = () => {
    const antonio = medicos.find((m) => m.nome.includes('António'));
    const maria = pacientes.find((p) => p.nome.includes('Maria')) || pacientes[0];
    if (!antonio) return;
    const cardiologia = antonio.especialidades.find((e) => e.nome === 'Cardiologia')
      || antonio.especialidades[0];
    setSim({
      medicoId: String(antonio.id),
      especialidadeId: String(cardiologia.id),
      pacienteId: String(maria?.id ?? ''),
      data: chaveData(diaCheio),
      hora: '18:00'
    });
    setResultado(null);
    toast.info('Caso RN-03 preparado. Execute a cadeia para ver o limite diário a travar a marcação.');
  };

  const simular = async () => {
    setSimulando(true);
    setResultado(null);
    try {
      const dataHora = new Date(`${sim.data}T${sim.hora}`).toISOString();
      const r = await http.post('/demo/simular', {
        pacienteId: Number(sim.pacienteId),
        medicoId: Number(sim.medicoId),
        especialidadeId: Number(sim.especialidadeId),
        dataHora
      });
      setResultado(r);
      const tr = await http.get('/admin/validacoes?limite=30');
      setTraces(tr);
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setSimulando(false);
    }
  };

  const tick = async () => {
    try {
      const r = await http.post('/demo/tick');
      toast.sucesso(`Scheduler: ${r.expiradas.length} expirada(s), ${r.lembretes.length} lembrete(s).`);
      await carregar();
    } catch (falha) {
      toast.erro(falha.message);
    }
  };

  if (carregando || !arquitetura) return <Carregando texto="A inspeccionar a arquitectura…" />;

  return (
    <>
      <Topo
        titulo="Architecture Lab"
        sub="Demonstração viva dos padrões, da cadeia de validação e do barramento de eventos."
        acoes={<button className="btn ghost" onClick={tick}>▶ Tick do scheduler</button>}
      />

      <div className="grid c4">
        <div className="card pad-sm">
          <div className="kpi"><span className="label">Padrões</span><span className="value">{arquitetura.padroes.length}</span><span className="hint">implementados</span></div>
        </div>
        <div className="card pad-sm">
          <div className="kpi"><span className="label">Eventos</span><span className="value">{resumoEventos?.total ?? 0}</span><span className="hint">publicados no barramento</span></div>
        </div>
        <div className="card pad-sm">
          <div className="kpi"><span className="label">Consumidores</span><span className="value">3</span><span className="hint">notificação · relatórios · auditoria</span></div>
        </div>
        <div className="card pad-sm">
          <div className="kpi"><span className="label">Traces</span><span className="value">{traces.length}</span><span className="hint">validações registadas</span></div>
        </div>
      </div>

      <div className="tabs mt">
        {ABAS.map((a) => (
          <button key={a.id} className={`tab ${aba === a.id ? 'active' : ''}`} onClick={() => setAba(a.id)}>{a.label}</button>
        ))}
      </div>

      {aba === 'padroes' && (
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Fluxo de uma marcação</h2>
                <p>O frontend só conhece a Façade; todos os padrões colaboram nos bastidores.</p>
              </div>
              <span className="badge info">monólito modular</span>
            </div>
            <div className="flow">
              {[
                { titulo: 'React', texto: 'UI por perfil', cor: 'blue' },
                { titulo: 'Façade', texto: 'AgendamentoFacade', cor: 'teal' },
                { titulo: 'Chain', texto: 'RN-01 → RN-06', cor: 'amber' },
                { titulo: 'State', texto: 'transições válidas', cor: 'purple' },
                { titulo: 'Event Bus', texto: 'EDA / Observer', cor: 'rose' }
              ].map((etapa, i) => (
                <div key={etapa.titulo} className="flow-step">
                  <div className={`flow-box ${etapa.cor}`}>
                    <b>{etapa.titulo}</b>
                    <span>{etapa.texto}</span>
                  </div>
                  {i < 4 && <div className="flow-arrow">→</div>}
                </div>
              ))}
            </div>
            <div className="row wrap mt">
              <span className="badge neutral">Strategy</span>
              <span className="badge neutral">Factory Method</span>
              <span className="badge neutral">Adapter</span>
              <span className="badge neutral">Command</span>
              <span className="badge neutral">Singleton</span>
              <span className="badge neutral">Repository</span>
              <span className="badge neutral">ISP</span>
            </div>
          </section>

          <div className="grid c2">
            {arquitetura.padroes.map((p) => (
              <article key={p.nome} className="card pattern-card">
                <div className="row between">
                  <h3 style={{ margin: 0 }}>{p.nome}</h3>
                  <button className="btn sm ghost" onClick={() => setPadraoAberto(padraoAberto === p.nome ? null : p.nome)}>
                    {padraoAberto === p.nome ? 'Fechar' : 'Detalhes'}
                  </button>
                </div>
                <span className="file-pill">{p.ficheiro}</span>
                <p style={{ fontSize: '.85rem', margin: 0 }}>{p.descricao}</p>

                {padraoAberto === p.nome && (
                  <div className="mt-sm">
                    {p.tiposDeEvento && (
                      <div className="row wrap">
                        {p.tiposDeEvento.map((t) => <span key={t} className="badge info">{t}</span>)}
                      </div>
                    )}
                    {p.consumidores && (
                      <div className="mt-sm">
                        <div className="tiny muted">Consumidores</div>
                        <div className="row wrap mt-sm">
                          {p.consumidores.map((c) => <span key={c} className="badge neutral">{c}</span>)}
                        </div>
                      </div>
                    )}
                    {p.ordem && (
                      <div className="chain mt-sm">
                        {p.ordem.map((elo, i) => (
                          <div key={elo} className="chain-step">
                            <div className="num">{i + 1}</div>
                            <div className="body"><b>{elo}</b></div>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.transicoes && (
                      <div className="code-block mt-sm">{JSON.stringify(p.transicoes, null, 2)}</div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {aba === 'comparacao' && (
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Sem padrões vs. Com padrões</h2>
                <p>Como seria o MediAgenda se tudo estivesse numa única classe — e como fica com as decisões tomadas.</p>
              </div>
              <span className="badge info">valor técnico das decisões</span>
            </div>
            <div className="grid c2">
              <div className="comp lado-sem">
                <h3>❌ Sem padrões — "DeusAgendaService"</h3>
                <p className="tiny muted">Uma única classe com todas as responsabilidades concentradas.</p>
                <ul className="comp-lista">
                  <li><b>Marcação:</b> uma classe recebe o pedido, valida as 5 regras, grava, envia e-mails, calcula relatórios e escreve auditoria — tudo em <code>marcar()</code>.</li>
                  <li><b>Estados:</b> <code>if (estado === 'pendente')…</code> espalhados; adicionar um estado obriga a caçar todos os <code>if</code>.</li>
                  <li><b>Regras:</b> RN-01…RN-09 em blocos de validação enormes, impossíveis de testar isoladamente.</li>
                  <li><b>Novo canal:</b> suportar WhatsApp exige <b>editar</b> a mesma classe (risco de partir marcação, auditoria e relatórios).</li>
                  <li><b>Testes:</b> para testar uma regra é preciso simular base de dados, e-mail, SMS e relatórios em conjunto.</li>
                  <li><b>Configuração:</b> constantes mágicas repetidas (24h, 2h, 10/dia) em cada ficheiro.</li>
                </ul>
              </div>
              <div className="comp lado-com">
                <h3>✅ Com padrões — MediAgenda actual</h3>
                <p className="tiny muted">Monólito modular; cada padrão resolve uma das dores acima.</p>
                <ul className="comp-lista">
                  <li><b>Marcação:</b> a Façade orquestra; a <b>Chain</b> valida (RN-01→RN-06 com <code>detalhes.passos</code>), o <b>Command</b> grava, o <b>Event Bus</b> distribui — cada passo demonstrável no Trace.</li>
                  <li><b>Estados:</b> padrão <b>State</b> — transições válidas declaradas num sítio só; uma consulta cancelada não pode ser confirmada.</li>
                  <li><b>Regras:</b> cada elo da cadeia é um objecto pequeno, testável isoladamente (38 testes, incl. RN-03 no simulador).</li>
                  <li><b>Novo canal:</b> <b>ISP + Adapter + Factory</b> — o canal <b>WhatsApp foi acrescentado sem alterar nenhum serviço</b> (nova interface + adapter; o <code>ConsultaService</code> continua intocado).</li>
                  <li><b>Testes:</b> notificações, regras e estados testam-se com adapters simulados no outbox temporário.</li>
                  <li><b>Configuração:</b> <b>Singleton</b> lê tudo uma vez (RN-01, RN-03, RN-09, limites de login) e partilha por todos os serviços.</li>
                </ul>
              </div>
            </div>
            <div className="alert info mt">
              Prova concreta: abra o <strong>Event Monitor</strong> e o <strong>Trace &amp; Outbox</strong> — cada marcação
              mostra a cadeia a executar, o evento a circular e os 3 consumidores independentes. O canal WhatsApp
              no seu perfil (Perfil → Notificações) demonstra extensibilidade real.
            </div>
          </section>
        </div>
      )}

      {aba === 'simulador' && (
        <div className="split">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Simular marcação</h2>
                <p>Executa a cadeia real sem gravar consulta. Útil para demonstrar RN-03 num dia cheio.</p>
              </div>
              <span className="badge info">POST /demo/simular</span>
            </div>

            <div className="grid c2">
              <Campo label="Médico">
                <select value={sim.medicoId} onChange={(e) => {
                  const m = medicos.find((x) => Number(x.id) === Number(e.target.value));
                  setSim((s) => ({
                    ...s,
                    medicoId: e.target.value,
                    especialidadeId: String(m?.especialidades[0]?.id || '')
                  }));
                }}>
                  {medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Especialidade">
                <select value={sim.especialidadeId} onChange={(e) => setSim({ ...sim, especialidadeId: e.target.value })}>
                  {(medicoSel?.especialidades || []).map((esp) => <option key={esp.id} value={esp.id}>{esp.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Paciente">
                <select value={sim.pacienteId} onChange={(e) => setSim({ ...sim, pacienteId: e.target.value })}>
                  {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Data">
                <input type="date" value={sim.data} onChange={(e) => setSim({ ...sim, data: e.target.value })} />
              </Campo>
              <Campo label="Hora">
                <input type="time" value={sim.hora} onChange={(e) => setSim({ ...sim, hora: e.target.value })} />
              </Campo>
              <div className="field">
                <label>&nbsp;</label>
                <button className="btn primary" onClick={simular} disabled={simulando || !sim.medicoId || !sim.pacienteId}>
                  {simulando ? 'A validar…' : 'Executar cadeia'}
                </button>
              </div>
            </div>

            <div className="alert info mt">
              <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span>
                  Sugestão: em <strong>{diaCheio.toLocaleDateString('pt-PT')}</strong> o Dr. António Nhampossa
                  tem 8 consultas (o seu limite diário) e o horário das 18:00 ainda está livre. Execute a
                  cadeia nesse horário para ver a RN-03 a recusar a marcação. Os restantes elos aparecem
                  como aprovados.
                </span>
                <button className="btn ghost sm" onClick={prepararCasoRn03}>Preparar caso RN-03</button>
              </div>
            </div>
          </section>

          <aside className="stack">
            {!resultado ? (
              <section className="card">
                <h3>Resultado</h3>
                <p className="tiny">Execute uma simulação para ver os cinco elos da cadeia, as mensagens e o tempo de execução.</p>
              </section>
            ) : (
              <>
                <section className="card">
                  <div className={`alert ${resultado.aprovado ? 'success' : 'error'}`}>
                    <b>{resultado.aprovado ? '✓ Marcação válida' : '✕ Marcação recusada'}</b>
                    <div>{resultado.mensagem}</div>
                  </div>
                  <dl className="kv mt">
                    <dt>Trace</dt><dd>#{resultado.traceId}</dd>
                    <dt>Paciente</dt><dd>{resultado.pedido?.paciente}</dd>
                    <dt>Médico</dt><dd>{resultado.pedido?.medico}</dd>
                    <dt>Data/hora</dt><dd>{formatarDataHora(resultado.pedido?.dataHora)}</dd>
                    <dt>Duração</dt><dd>{resultado.pedido?.duracaoMin} min</dd>
                    <dt>Estratégia</dt><dd>{resultado.pedido?.estrategiaDuracao}</dd>
                  </dl>
                </section>
                <section className="card">
                  <h3>Cadeia de validação</h3>
                  <div className="chain mt-sm">
                    {resultado.passos.map((p, i) => (
                      <div key={p.codigo + i} className={`chain-step ${p.aprovado ? 'ok' : 'fail'}`}>
                        <div className="num">{p.aprovado ? '✓' : '✕'}</div>
                        <div className="body">
                          <b>{p.codigo} · {p.elo}</b>
                          <p>{p.mensagem}</p>
                          {p.detalhe && <p className="tiny muted">{p.detalhe}</p>}
                        </div>
                        <span className="time">{p.duracaoMs} ms</span>
                      </div>
                    ))}
                  </div>
                  {!resultado.aprovado && (
                    <div className="tiny muted mt-sm">
                      A cadeia pára no primeiro elo que falha — é assim que a Chain of Responsibility protege o sistema.
                    </div>
                  )}
                </section>
              </>
            )}
          </aside>
        </div>
      )}

      {aba === 'eventos' && (
        <div className="split">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Event Monitor</h2>
                <p>Cada linha é um evento persistido na outbox e os consumos por observador.</p>
              </div>
              <button className="btn sm" onClick={carregar}>↻ Actualizar</button>
            </div>
            {eventos.length === 0 ? (
              <Vazio icone="📡" titulo="Sem eventos" />
            ) : (
              <div className="stack sm">
                {eventos.map((e) => (
                  <div key={e.id} className="event-row">
                    <div className="event-head">
                      <span className="badge info">{e.tipo}</span>
                      <span className="tiny muted">#{e.id} · {formatarDataHora(e.criado_em)}</span>
                      <span className={`badge ${e.processado_em ? 'confirmada' : 'pendente'}`}>
                        {e.processado_em ? 'processado' : 'pendente'}
                      </span>
                    </div>
                    <div className="tiny muted">
                      Consulta #{e.payload?.consulta?.id ?? '—'}
                      {e.payload?.consulta?.paciente_nome ? ` · ${e.payload.consulta.paciente_nome}` : ''}
                      {e.payload?.consulta?.medico_nome ? ` · ${e.payload.consulta.medico_nome}` : ''}
                    </div>
                    <div className="row wrap mt-sm">
                      {(e.consumos || []).map((c) => (
                        <span key={c.id} className={`badge ${c.estado === 'ok' ? 'confirmada' : 'cancelada'}`} title={c.detalhe || ''}>
                          {c.consumidor}
                        </span>
                      ))}
                      {(!e.consumos || e.consumos.length === 0) && <span className="tiny muted">sem consumos</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="stack">
            <section className="card">
              <h3>Eventos por tipo</h3>
              <div className="stack sm mt-sm">
                {(resumoEventos?.porTipo || []).map((t) => (
                  <div key={t.tipo} className="row between">
                    <span className="tiny">{t.tipo}</span>
                    <b>{t.total}</b>
                  </div>
                ))}
              </div>
            </section>
            <section className="card">
              <h3>Consumos por observador</h3>
              <div className="stack sm mt-sm">
                {(resumoEventos?.consumidores || []).map((c) => (
                  <div key={`${c.consumidor}-${c.estado}`} className="row between">
                    <span className="tiny">{c.consumidor} <span className="muted">({c.estado})</span></span>
                    <b>{c.total}</b>
                  </div>
                ))}
              </div>
            </section>
            <section className="card">
              <h3>Outbox</h3>
              <p className="tiny">
                Os adaptadores SMTP e SMS simulados escrevem em <code>server/outbox/</code>.
                As notificações abaixo mostram o resultado final do consumo.
              </p>
              <div className="row wrap mt-sm">
                {notificacoes.slice(0, 8).map((n) => (
                  <span key={n.id} className={`badge ${n.canal === 'sms' ? 'info' : 'neutral'}`}>
                    {n.canal} · {n.evento}
                  </span>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}

      {aba === 'trace' && (
        <div className="split">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Validações registadas (X-Ray)</h2>
                <p>Persistência da cadeia, com os pedidos aprovados e rejeitados.</p>
              </div>
              <button className="btn sm" onClick={carregar}>↻ Actualizar</button>
            </div>
            {traces.length === 0 ? (
              <Vazio icone="🩻" titulo="Sem traces" />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>#</th><th>Quando</th><th>Tipo</th><th>Resultado</th><th>Paciente / médico</th><th></th></tr></thead>
                  <tbody>
                    {traces.map((t) => (
                      <tr key={t.id}>
                        <td>{t.id}</td>
                        <td className="tiny">{formatarDataHora(t.criado_em)}</td>
                        <td className="tiny">{t.detalhes?.tipo || '—'}</td>
                        <td><span className={`badge ${t.resultado === 'aprovado' ? 'confirmada' : 'cancelada'}`}>{t.resultado}</span></td>
                        <td className="tiny">{t.detalhes?.pedido?.paciente || t.paciente_nome || '—'}</td>
                        <td className="right"><button className="btn sm ghost" onClick={() => setTraceDetalhe(t)}>Ver</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="card">
            <h3>Configuração activa</h3>
            <p className="tiny">Valores lidos do Singleton <code>ConfiguracaoSistema</code>.</p>
            <dl className="kv mt-sm">
              {(arquitetura.configuracoes || []).map((c) => (
                <div key={c.chave} style={{ display: 'contents' }}>
                  <dt>{c.chave}</dt><dd className="mono">{c.valor}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      )}

      {traceDetalhe && (
        <Modal wide titulo={`Trace #${traceDetalhe.id}`} subtitulo={`${traceDetalhe.detalhes?.tipo || ''} · ${traceDetalhe.resultado}`}
          onFechar={() => setTraceDetalhe(null)}>
          <div className="chain">
            {(traceDetalhe.detalhes?.passos || []).map((p, i) => (
              <div key={i} className={`chain-step ${p.aprovado ? 'ok' : 'fail'}`}>
                <div className="num">{p.aprovado ? '✓' : '✕'}</div>
                <div className="body">
                  <b>{p.codigo} · {p.elo}</b>
                  <p>{p.mensagem}</p>
                  {p.detalhe && <p className="tiny muted">{p.detalhe}</p>}
                </div>
                <span className="time">{p.duracaoMs} ms</span>
              </div>
            ))}
          </div>
          {traceDetalhe.detalhes?.pedido && (
            <div className="code-block mt">{JSON.stringify(traceDetalhe.detalhes.pedido, null, 2)}</div>
          )}
        </Modal>
      )}
    </>
  );
}
