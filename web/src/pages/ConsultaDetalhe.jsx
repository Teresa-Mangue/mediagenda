import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { http } from '../api.js';
import { Topo } from '../components/Layout.jsx';
import { AcoesConsulta } from '../components/AcoesConsulta.jsx';
import { Carregando, EstadoBadge, useToast } from '../components/ui.jsx';
import { duracaoTexto, formatarDataHora, NOMES_ESTADO } from '../utils.js';

const ABAS = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'historico', label: 'Histórico (State)' },
  { id: 'xray', label: 'X-Ray' }
];

export function ConsultaDetalhe() {
  const { id } = useParams();
  const toast = useToast();
  const [dados, setDados] = useState(null);
  const [xray, setXray] = useState(null);
  const [aba, setAba] = useState('resumo');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const d = await http.get(`/consultas/${id}/historico`);
      setDados(d);
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (aba !== 'xray' || xray) return;
    (async () => {
      try {
        const r = await http.get(`/consultas/${id}/xray`);
        setXray(r);
      } catch (falha) {
        toast.erro(falha.message);
      }
    })();
  }, [aba, id, xray]);

  if (carregando || !dados) return <Carregando texto="A carregar a consulta…" />;

  const { consulta, historico } = dados;

  return (
    <>
      <Topo
        titulo={`Consulta #${consulta.id}`}
        sub={`${consulta.especialidade_nome} · ${formatarDataHora(consulta.data_hora)}`}
        acoes={<Link className="btn ghost" to="/consultas">← Consultas</Link>}
      />

      <div className="card pad-sm" style={{ marginBottom: 16 }}>
        <div className="row wrap between">
          <div className="row wrap" style={{ gap: 10 }}>
            <EstadoBadge estado={consulta.estado} />
            <span className="badge neutral">{duracaoTexto(consulta.duracao_min)}</span>
            {consulta.cancelamento_tardio ? <span className="badge neutral">cancelamento tardio</span> : null}
            {consulta.avaliacao_pontuacao ? <span className="badge neutral">★ {consulta.avaliacao_pontuacao}/5</span> : null}
          </div>
          <AcoesConsulta consulta={consulta} onAtualizar={async () => { await carregar(); setXray(null); }} detalhado />
        </div>
      </div>

      <div className="tabs">
        {ABAS.map((a) => (
          <button key={a.id} className={`tab ${aba === a.id ? 'active' : ''}`} onClick={() => setAba(a.id)}>
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'resumo' && (
        <div className="split">
          <section className="card">
            <h2>Informação da consulta</h2>
            <dl className="kv mt">
              <dt>Paciente</dt><dd>{consulta.paciente_nome}</dd>
              <dt>Contacto</dt><dd>{consulta.paciente_telefone || consulta.paciente_email}</dd>
              <dt>Médico</dt><dd>{consulta.medico_nome}</dd>
              <dt>Nº de registo</dt><dd>{consulta.numero_registo}</dd>
              <dt>Especialidade</dt><dd>{consulta.especialidade_nome}</dd>
              <dt>Data e hora</dt><dd>{formatarDataHora(consulta.data_hora)}</dd>
              <dt>Duração</dt><dd>{duracaoTexto(consulta.duracao_min)}</dd>
              <dt>Local</dt><dd>{consulta.localizacao || 'Clínica MediAgenda'}</dd>
              <dt>Criada em</dt><dd>{formatarDataHora(consulta.criada_em)}</dd>
              <dt>Confirmada em</dt><dd>{formatarDataHora(consulta.confirmada_em)}</dd>
              {consulta.prazo_confirmacao && <><dt>Prazo (RN-07)</dt><dd>{formatarDataHora(consulta.prazo_confirmacao)}</dd></>}
              {consulta.motivo_cancelamento && <><dt>Motivo</dt><dd>{consulta.motivo_cancelamento}</dd></>}
              <dt>Preferência notif.</dt><dd>{consulta.preferencia_notificacao}</dd>
            </dl>
          </section>

          <aside className="stack">
            <section className="card">
              <h3>Próximas transições (State)</h3>
              <p className="tiny">Cada estado decide as transições válidas.</p>
              <div className="row wrap mt-sm">
                {(dados.transicoesPermitidas || []).length === 0
                  ? <span className="badge neutral">estado final</span>
                  : dados.transicoesPermitidas.map((t) => <span key={t} className="badge info">→ {NOMES_ESTADO[t] || t}</span>)}
              </div>
            </section>
            <section className="card">
              <h3>Regras aplicáveis</h3>
              <div className="stack sm mt-sm tiny">
                <div className="row between"><span className="muted">Antecedência</span><span>RN-01</span></div>
                <div className="row between"><span className="muted">Cancelamento tardio</span><span>RN-02</span></div>
                <div className="row between"><span className="muted">Limite do médico</span><span>RN-03</span></div>
                <div className="row between"><span className="muted">Conflito de agenda</span><span>RN-05</span></div>
                <div className="row between"><span className="muted">Expiração</span><span>RN-07</span></div>
              </div>
            </section>
          </aside>
        </div>
      )}

      {aba === 'historico' && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Linha do tempo</h2>
              <p>State pattern + auditoria de transições.</p>
            </div>
            <span className="badge info">{historico.length} eventos</span>
          </div>
          <div className="timeline">
            {historico.map((h, i) => (
              <div key={h.id} className={`tl-item ${h.estado_novo === 'cancelada' ? 'cancel' : i === historico.length - 1 ? 'current' : 'done'}`}>
                <div className="tl-dot">{h.estado_novo === 'cancelada' ? '✕' : '✓'}</div>
                <div className="tl-body">
                  <b>{NOMES_ESTADO[h.estado_novo] || h.estado_novo}</b>
                  <span>
                    {h.estado_anterior ? `${NOMES_ESTADO[h.estado_anterior]} → ` : 'Criação → '}
                    {NOMES_ESTADO[h.estado_novo]}
                  </span>
                  <div className="tiny muted mt-sm">
                    {formatarDataHora(h.criado_em)} · {h.autor_nome || 'sistema'}
                  </div>
                  {h.motivo && <div className="tiny muted">{h.motivo}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {aba === 'xray' && (
        <div className="stack">
          {!xray ? (
            <Carregando texto="A recolher rastos internos…" />
          ) : (
            <>
              <section className="card">
                <div className="card-head">
                  <div>
                    <h2>Validações da cadeia</h2>
                    <p>Chain of Responsibility — cada elo executado e o seu tempo.</p>
                  </div>
                  <span className="badge info">{xray.traces.length} trace(s)</span>
                </div>
                {xray.traces.length === 0 && <p className="tiny">Sem traces associados a esta consulta.</p>}
                {xray.traces.map((trace) => (
                  <div key={trace.id} className="mt">
                    <div className="row between">
                      <b className="tiny">Trace #{trace.id} · {trace.resultado}</b>
                      <span className="tiny muted">{formatarDataHora(trace.criado_em)}</span>
                    </div>
                    <div className="chain mt-sm">
                      {(trace.detalhes?.passos || []).map((p, i) => (
                        <div key={i} className={`chain-step ${p.aprovado ? 'ok' : 'fail'}`}>
                          <div className="num">{p.aprovado ? '✓' : '✕'}</div>
                          <div className="body">
                            <b>{p.codigo} · {p.elo}</b>
                            <p>{p.mensagem}</p>
                          </div>
                          <span className="time">{p.duracaoMs} ms</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>

              <section className="card">
                <div className="card-head">
                  <div>
                    <h2>Eventos publicados</h2>
                    <p>EDA — o barramento publica e cada observador consome.</p>
                  </div>
                  <span className="badge info">{xray.eventos.length}</span>
                </div>
                <div className="stack sm">
                  {xray.eventos.map((e) => (
                    <div key={e.id} className="list-item">
                      <span className="badge info">{e.tipo}</span>
                      <div className="grow tiny">
                        <b>Evento #{e.id}</b>
                        <div className="muted">{formatarDataHora(e.criado_em)}</div>
                        <div className="row wrap mt-sm" style={{ gap: 6 }}>
                          {(e.consumos || []).map((c) => (
                            <span key={c.id} className="badge neutral" title={c.detalhe || ''}>
                              {c.consumidor}: {c.estado}
                            </span>
                          ))}
                          {(!e.consumos || e.consumos.length === 0) && <span className="muted">sem consumos registados</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {xray.eventos.length === 0 && <p className="tiny">Sem eventos para esta consulta.</p>}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </>
  );
}
