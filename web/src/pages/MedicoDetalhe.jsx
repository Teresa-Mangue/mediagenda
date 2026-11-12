import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { http } from '../api.js';
import { useAuth, iniciais } from '../auth.jsx';
import { Topo } from '../components/Layout.jsx';
import { Carregando, Campo, Estrelas, Modal, useToast } from '../components/ui.jsx';
import { chaveData, diaMes, diaSemanaCurto, duracaoTexto, formatarHora } from '../utils.js';

const DIAS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const MOTIVOS = {
  passado: 'horário já passou',
  antecedencia: 'precisa de 1h de antecedência (RN-01)',
  bloqueio: 'médico indisponível',
  ocupado: 'horário ocupado'
};

export function MedicoDetalhe() {
  const { id } = useParams();
  const { utilizador } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();

  const [medico, setMedico] = useState(null);
  const [dias, setDias] = useState([]);
  const [dataSel, setDataSel] = useState(params.get('data') || '');
  const [slots, setSlots] = useState([]);
  const [slotSel, setSlotSel] = useState(null);
  const [especialidadeId, setEspecialidadeId] = useState('');
  const [pacientes, setPacientes] = useState([]);
  const [pacienteId, setPacienteId] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [aMarcar, setAMarcar] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      try {
        const [m, d] = await Promise.all([
          http.get(`/medicos/${id}`),
          http.get(`/medicos/${id}/proximos-dias?quantidade=14`)
        ]);
        if (!ativo) return;
        setMedico(m);
        setDias(d);
        setEspecialidadeId(String(m.especialidades[0]?.id || ''));
        const primeira = dataSel || d.find((x) => x.disponiveis > 0)?.data || d[0]?.data;
        setDataSel(primeira || chaveData(new Date()));

        if (['secretario', 'admin'].includes(utilizador.perfil)) {
          const lista = await http.get('/pacientes');
          if (ativo) setPacientes(lista);
        } else if (utilizador.perfil === 'medico') {
          const lista = await http.get('/medico/pacientes');
          if (ativo) setPacientes(lista);
        }
      } catch (falha) {
        toast.erro(falha.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [id]);

  useEffect(() => {
    if (!dataSel) return;
    let ativo = true;
    (async () => {
      try {
        const r = await http.get(`/medicos/${id}/disponibilidade?data=${dataSel}`);
        if (ativo) { setSlots(r.slots); setSlotSel(null); }
      } catch (falha) {
        toast.erro(falha.message);
      }
    })();
    return () => { ativo = false; };
  }, [id, dataSel]);

  const porPeriodo = useMemo(() => {
    const manha = slots.filter((s) => Number(s.hora.slice(0, 2)) < 13);
    const tarde = slots.filter((s) => Number(s.hora.slice(0, 2)) >= 13);
    return { manha, tarde };
  }, [slots]);

  const disponibilidadeSemanal = useMemo(() => {
    if (!medico) return [];
    const mapa = new Map();
    for (const d of medico.disponibilidades || []) {
      if (!mapa.has(d.dia_semana)) mapa.set(d.dia_semana, []);
      mapa.get(d.dia_semana).push(`${d.hora_inicio}–${d.hora_fim}`);
    }
    return [...mapa.entries()].sort((a, b) => a[0] - b[0]);
  }, [medico]);

  const marcar = async () => {
    if (!slotSel) { toast.erro('Escolha um horário disponível.'); return; }
    if (utilizador.perfil === 'paciente' && !utilizador.pacienteId) {
      toast.erro('Perfil de paciente não encontrado.');
      return;
    }
    if (utilizador.perfil !== 'paciente' && !pacienteId) {
      toast.erro('Seleccione o paciente para esta marcação.');
      return;
    }
    setAMarcar(true);
    setErro('');
    try {
      const r = await http.post('/consultas', {
        medicoId: Number(id),
        especialidadeId: Number(especialidadeId),
        dataHora: slotSel.dataHora,
        pacienteId: pacienteId ? Number(pacienteId) : undefined
      });
      setResultado({ ...r, tipo: 'sucesso' });
      setSlotSel(null);
      const atualizados = await http.get(`/medicos/${id}/disponibilidade?data=${dataSel}`);
      setSlots(atualizados.slots);
      toast.sucesso('Consulta marcada. Confirme dentro do prazo (RN-07).');
    } catch (falha) {
      setErro(falha.message);
      if (falha.detalhes?.passos) {
        setResultado({ tipo: 'erro', mensagem: falha.message, passos: falha.detalhes.passos, codigo: falha.codigo });
      }
    } finally {
      setAMarcar(false);
    }
  };

  if (carregando || !medico) return <Carregando texto="A carregar o médico…" />;

  return (
    <>
      <Topo
        titulo={medico.nome}
        sub={`${medico.especialidades.map((e) => e.nome).join(' · ')} · ${medico.localizacao}`}
        acoes={<Link className="btn ghost" to="/">← Voltar</Link>}
      />

      <div className="split">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Escolha o dia e a hora</h2>
                <p>Horários validados com a disponibilidade real do médico.</p>
              </div>
              <span className="badge info">{duracaoTexto(medico.duracao_consulta_min)} por consulta</span>
            </div>

            <div className="date-strip">
              {dias.map((d) => (
                <button key={d.data} className={`date-chip ${dataSel === d.data ? 'active' : ''}`}
                  onClick={() => setDataSel(d.data)}>
                  <span>{diaSemanaCurto(d.data)}</span>
                  <b>{diaMes(d.data)}</b>
                  <span>{d.disponiveis > 0 ? `${d.disponiveis} livres` : 'fechado'}</span>
                </button>
              ))}
            </div>

            {slots.length === 0 ? (
              <div className="alert warn mt">
                Sem horários para este dia. Escolha outro dia na faixa acima.
              </div>
            ) : (
              <>
                {porPeriodo.manha.length > 0 && (
                  <div className="mt">
                    <div className="tiny muted" style={{ marginBottom: 8 }}>Manhã</div>
                    <div className="slots">
                      {porPeriodo.manha.map((s) => (
                        <button key={s.dataHora}
                          className={`slot ${slotSel?.dataHora === s.dataHora ? 'selected' : ''} ${s.disponivel ? '' : 'off'}`}
                          disabled={!s.disponivel}
                          title={s.motivo ? `Indisponível: ${MOTIVOS[s.motivo] || s.motivo}` : 'Disponível'}
                          onClick={() => setSlotSel(s)}>
                          {s.hora}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {porPeriodo.tarde.length > 0 && (
                  <div className="mt">
                    <div className="tiny muted" style={{ marginBottom: 8 }}>Tarde</div>
                    <div className="slots">
                      {porPeriodo.tarde.map((s) => (
                        <button key={s.dataHora}
                          className={`slot ${slotSel?.dataHora === s.dataHora ? 'selected' : ''} ${s.disponivel ? '' : 'off'}`}
                          disabled={!s.disponivel}
                          title={s.motivo ? `Indisponível: ${MOTIVOS[s.motivo] || s.motivo}` : 'Disponível'}
                          onClick={() => setSlotSel(s)}>
                          {s.hora}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="grid c2 mt">
              <Campo label="Especialidade">
                <select value={especialidadeId} onChange={(e) => setEspecialidadeId(e.target.value)}>
                  {medico.especialidades.map((esp) => (
                    <option key={esp.id} value={esp.id}>
                      {esp.nome} ({duracaoTexto(esp.duracao_padrao_min)})
                    </option>
                  ))}
                </select>
              </Campo>

              {utilizador.perfil !== 'paciente' ? (
                <Campo label="Paciente" hint="Marcação em nome do paciente.">
                  <select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
                    <option value="">Seleccione…</option>
                    {pacientes.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </Campo>
              ) : (
                <Campo label="Paciente">
                  <input value={utilizador.nome} disabled />
                </Campo>
              )}
            </div>

            {erro && <div className="alert error mt">{erro}</div>}

            <div className="row between mt">
              <div className="tiny muted">
                {slotSel ? (
                  <>Seleccionado: <b>{diaMes(slotSel.dataHora)} às {formatarHora(slotSel.dataHora)}</b></>
                ) : 'Nenhum horário seleccionado'}
              </div>
              <button className="btn primary" onClick={marcar} disabled={!slotSel || aMarcar}>
                {aMarcar ? 'A marcar…' : 'Marcar consulta'}
              </button>
            </div>
            <div className="tiny muted mt-sm">
              A consulta fica <b>pendente</b> e deve ser confirmada em 2 horas (RN-07). Cancelamentos
              com menos de 24h são registados como tardios (RN-02).
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h3>Sobre o médico</h3>
                <p>{medico.email} · {medico.telefone || 'sem telefone'}</p>
              </div>
            </div>
            <p>{medico.biografia || 'Sem biografia registada.'}</p>
            <dl className="kv">
              <dt>Nº de registo</dt><dd>{medico.numero_registo}</dd>
              <dt>Localização</dt><dd>{medico.localizacao}</dd>
              <dt>Duração padrão</dt><dd>{duracaoTexto(medico.duracao_consulta_min)}</dd>
              <dt>Limite diário</dt><dd>{medico.max_consultas_dia} consultas</dd>
              <dt>Especialidades</dt><dd>{medico.especialidades.map((e) => e.nome).join(', ')}</dd>
            </dl>
          </section>
        </div>

        <aside className="stack">
          <section className="card">
            <div className="row" style={{ gap: 14 }}>
              <div className="doctor-avatar" style={{ width: 64, height: 64, fontSize: '1.3rem' }}>
                {iniciais(medico.nome)}
              </div>
              <div>
                <h3 style={{ marginBottom: 2 }}>{medico.nome}</h3>
                <Estrelas valor={medico.avaliacao_media} total={medico.total_avaliacoes} />
              </div>
            </div>
            <div className="grid c2 mt">
              <div className="kpi">
                <span className="label">Duração</span>
                <span className="value" style={{ fontSize: '1.3rem' }}>{duracaoTexto(medico.duracao_consulta_min)}</span>
              </div>
              <div className="kpi">
                <span className="label">Dias livres</span>
                <span className="value" style={{ fontSize: '1.3rem' }}>{dias.filter((d) => d.disponiveis > 0).length}/14</span>
              </div>
            </div>
          </section>

          <section className="card">
            <h3>Disponibilidade semanal</h3>
            <div className="stack sm mt-sm">
              {disponibilidadeSemanal.length === 0 && <p className="tiny">Sem disponibilidade definida.</p>}
              {disponibilidadeSemanal.map(([dia, janelas]) => (
                <div key={dia} className="row between" style={{ fontSize: '.84rem' }}>
                  <span className="muted">{DIAS[dia]}</span>
                  <span className="mono">{janelas.join(' · ')}</span>
                </div>
              ))}
            </div>
          </section>

          {(medico.bloqueios || []).length > 0 && (
            <section className="card">
              <h3>Bloqueios / ausências</h3>
              <div className="stack sm mt-sm">
                {medico.bloqueios.map((b) => (
                  <div key={b.id} className="alert warn" style={{ fontSize: '.78rem' }}>
                    <b>{b.motivo || 'Indisponível'}</b>
                    <div>{new Date(b.inicio).toLocaleString('pt-PT')} → {new Date(b.fim).toLocaleString('pt-PT')}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card">
            <h3>Como funciona</h3>
            <div className="chain mt-sm">
              {['Escolhe o horário', 'A cadeia valida 5 regras', 'Consulta fica pendente', 'Confirma em 2 horas (RN-07)'].map((t, i) => (
                <div key={t} className="chain-step">
                  <div className="num">{i + 1}</div>
                  <div className="body"><b>{t}</b></div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {resultado && (
        <Modal
          titulo={resultado.tipo === 'sucesso' ? 'Consulta marcada' : 'Marcação recusada'}
          subtitulo={resultado.tipo === 'sucesso'
            ? 'A validação passou por todas as regras. Confirme dentro do prazo.'
            : resultado.mensagem}
          wide
          onFechar={() => setResultado(null)}
        >
          <div className="chain">
            {(resultado.validacao?.passos || resultado.passos || []).map((passo, i) => (
              <div key={passo.codigo + i} className={`chain-step ${passo.aprovado ? 'ok' : 'fail'}`}>
                <div className="num">{passo.aprovado ? '✓' : '✕'}</div>
                <div className="body">
                  <b>{passo.codigo} · {passo.elo}</b>
                  <p>{passo.mensagem}</p>
                  {passo.detalhe && <p className="tiny muted">{passo.detalhe}</p>}
                </div>
                <span className="time">{passo.duracaoMs} ms</span>
              </div>
            ))}
          </div>

          {resultado.tipo === 'sucesso' ? (
            <div className="alert success mt">
              Prazo de confirmação: <b>{new Date(resultado.prazoConfirmacao).toLocaleString('pt-PT')}</b>
              <div className="mt-sm">
                <Link className="btn primary sm" to={`/consultas/${resultado.consulta.id}`}>Abrir consulta</Link>
              </div>
            </div>
          ) : (
            <div className="alert error mt">
              {resultado.codigo === 'VALIDACAO_FALHOU'
                ? 'A cadeia de validação interrompeu no primeiro elo que falhou.'
                : resultado.mensagem}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
