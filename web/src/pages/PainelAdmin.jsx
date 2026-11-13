import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { descarregar, http } from '../api.js';
import { Topo } from '../components/Layout.jsx';
import { Campo, Modal, useToast, Vazio } from '../components/ui.jsx';
import { formatarDataHora } from '../utils.js';

const ESTADOS = ['', 'pendente', 'confirmada', 'realizada', 'cancelada'];

export function PainelAdmin() {
  const toast = useToast();
  const [aba, setAba] = useState('visao');
  const [resumo, setResumo] = useState(null);
  const [relatorio, setRelatorio] = useState({ consultas: [] });
  const [utilizadores, setUtilizadores] = useState([]);
  const [medicos, setMedicos] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [configuracoes, setConfiguracoes] = useState([]);
  const [aprovacoes, setAprovacoes] = useState([]);
  const [filtros, setFiltros] = useState({ desde: '', ate: '', estado: '' });
  const [carregando, setCarregando] = useState(true);
  const [modalMedico, setModalMedico] = useState(false);
  const [modalEspecialidade, setModalEspecialidade] = useState(false);
  const [novoMedico, setNovoMedico] = useState({ nome: '', email: '', password: '', telefone: '', numeroRegisto: '', localizacao: 'Clínica MediAgenda — Tete', especialidades: [] });
  const [novaEspecialidade, setNovaEspecialidade] = useState({ nome: '', descricao: '', duracaoPadraoMin: 60 });
  const [aGuardar, setAGuardar] = useState(false);

  const carregarBase = useCallback(async () => {
    try {
      const [r, us, meds, esps, confs, pendentes] = await Promise.all([
        http.get('/admin/resumo'),
        http.get('/admin/utilizadores'),
        http.get('/medicos'),
        http.get('/especialidades'),
        http.get('/admin/configuracoes'),
        http.get('/admin/aprovacoes')
      ]);
      setResumo(r);
      setUtilizadores(us);
      setMedicos(meds);
      setEspecialidades(esps);
      setConfiguracoes(confs);
      setAprovacoes(pendentes);
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarRelatorio = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (filtros.desde) q.set('desde', new Date(filtros.desde).toISOString());
      if (filtros.ate) q.set('ate', new Date(`${filtros.ate}T23:59:59`).toISOString());
      if (filtros.estado) q.set('estado', filtros.estado);
      const r = await http.get(`/admin/relatorios${q.toString() ? `?${q}` : ''}`);
      setRelatorio(r);
    } catch (falha) {
      toast.erro(falha.message);
    }
  }, [filtros]);

  useEffect(() => { carregarBase(); }, [carregarBase]);
  useEffect(() => { if (aba === 'relatorios') carregarRelatorio(); }, [aba, carregarRelatorio]);

  const exportar = async () => {
    const q = new URLSearchParams();
    if (filtros.desde) q.set('desde', new Date(filtros.desde).toISOString());
    if (filtros.ate) q.set('ate', new Date(`${filtros.ate}T23:59:59`).toISOString());
    if (filtros.estado) q.set('estado', filtros.estado);
    try {
      await descarregar(`/admin/relatorios/export.csv${q.toString() ? `?${q}` : ''}`, 'mediagenda-relatorio.csv');
      toast.sucesso('CSV exportado (abre directamente no Excel).');
    } catch (falha) {
      toast.erro(falha.message);
    }
  };

  const imprimirPdf = () => window.print();

  const executarScheduler = async () => {
    try {
      const r = await http.post('/demo/tick');
      toast.sucesso(`Scheduler executado: ${r.expiradas.length} expirada(s), ${r.lembretes.length} lembrete(s).`);
      await carregarBase();
      if (aba === 'relatorios') await carregarRelatorio();
    } catch (falha) {
      toast.erro(falha.message);
    }
  };

  const criarMedico = async () => {
    setAGuardar(true);
    try {
      const r = await http.post('/admin/medicos', {
        ...novoMedico,
        password: novoMedico.password || undefined,
        especialidades: especialidades
          .filter((e) => novoMedico.especialidades.includes(e.nome))
          .map((e) => e.id)
      });
      toast.sucesso(r.mensagem || 'Médico registado.');
      setModalMedico(false);
      setNovoMedico({ nome: '', email: '', password: '', telefone: '', numeroRegisto: '', localizacao: 'Clínica MediAgenda — Tete', especialidades: [] });
      await carregarBase();
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setAGuardar(false);
    }
  };

  const desactivarMedico = async (medico) => {
    if (!window.confirm(`Desactivar ${medico.nome}? As consultas futuras serão canceladas (RN-08).`)) return;
    try {
      const r = await http.patch(`/admin/medicos/${medico.id}/desativar`);
      toast.sucesso(`${r.consultasCanceladas} consulta(s) cancelada(s).`);
      await carregarBase();
    } catch (falha) {
      toast.erro(falha.message);
    }
  };

  const decidirAprovacao = async (utilizador, accao) => {
    const verbo = accao === 'aprovar' ? 'aprovar' : 'recusar';
    if (!window.confirm(`Confirma que pretende ${verbo} o cadastro de ${utilizador.nome} (${utilizador.perfil})?`)) return;
    try {
      const r = await http.post(`/admin/utilizadores/${utilizador.id}/${accao}`);
      toast.sucesso(r.mensagem);
      await carregarBase();
    } catch (falha) {
      toast.erro(falha.message);
    }
  };

  const criarEspecialidade = async () => {
    try {
      await http.post('/admin/especialidades', novaEspecialidade);
      toast.sucesso('Especialidade criada.');
      setModalEspecialidade(false);
      setNovaEspecialidade({ nome: '', descricao: '', duracaoPadraoMin: 60 });
      await carregarBase();
    } catch (falha) {
      toast.erro(falha.message);
    }
  };

  const guardarConfiguracoes = async () => {
    setAGuardar(true);
    try {
      const corpo = Object.fromEntries(configuracoes.map((c) => [c.chave, c.valor]));
      const r = await http.put('/admin/configuracoes', corpo);
      setConfiguracoes(r.configuracoes);
      toast.sucesso('Configuração actualizada.');
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setAGuardar(false);
    }
  };

  const maxMes = useMemo(() => Math.max(1, ...(resumo?.porMes || []).map((m) => Number(m.total))), [resumo]);

  if (carregando || !resumo) return <div className="spinner" />;

  return (
    <>
      <Topo
        titulo="Painel de administração"
        sub="Indicadores, relatórios, utilizadores e configuração da clínica."
        acoes={
          <>
            <button className="btn ghost" onClick={executarScheduler}>▶ Executar scheduler</button>
            <Link className="btn primary" to="/arquitetura">Architecture Lab</Link>
          </>
        }
      />

      <div className="grid c4">
        {[
          { label: 'Total consultas', value: resumo.total, hint: `${resumo.proximas} próximas` },
          { label: 'Taxa de realização', value: `${resumo.taxaRealizacao}%`, hint: `${resumo.realizadas} realizadas` },
          { label: 'Taxa de cancelamento', value: `${resumo.taxaCancelamento}%`, hint: `${resumo.canceladas} canceladas` },
          { label: 'Ocupação média', value: `${resumo.ocupacaoMedia}%`, hint: `${resumo.medicosAtivos} médicos activos` }
        ].map((k) => (
          <div key={k.label} className="card pad-sm">
            <div className="kpi">
              <span className="label">{k.label}</span>
              <span className="value">{k.value}</span>
              <span className="hint">{k.hint}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="tabs mt">
        {[
          { id: 'visao', label: 'Visão geral' },
          { id: 'relatorios', label: 'Relatórios' },
          { id: 'aprovacoes', label: `Aprovações${aprovacoes.length ? ` (${aprovacoes.length})` : ''}` },
          { id: 'utilizadores', label: 'Utilizadores' },
          { id: 'config', label: 'Configuração' }
        ].map((a) => (
          <button key={a.id} className={`tab ${aba === a.id ? 'active' : ''}`} onClick={() => setAba(a.id)}>{a.label}</button>
        ))}
      </div>

      {aba === 'visao' && (
        <div className="split">
          <div className="stack">
            <section className="card">
              <div className="card-head">
                <div><h2>Consultas por mês</h2><p>Últimos 6 meses registados.</p></div>
                <span className="badge info">{resumo.total} no total</span>
              </div>
              <div className="chart">
                {(resumo.porMes || []).map((m) => (
                  <div key={m.mes} className="bar">
                    <span className="bar-value">{m.total}</span>
                    <div className="bar-fill" style={{ height: `${Math.max(6, (Number(m.total) / maxMes) * 100)}%` }} />
                    <span className="bar-label">{m.mes?.slice(5)}/{m.mes?.slice(2, 4)}</span>
                  </div>
                ))}
                {(resumo.porMes || []).length === 0 && <p className="tiny">Sem dados.</p>}
              </div>
            </section>

            <section className="card">
              <h2>Consultas por especialidade</h2>
              <div className="table-wrap mt-sm">
                <table>
                  <thead><tr><th>Especialidade</th><th>Total</th><th>Realizadas</th><th>Canceladas</th><th style={{ width: '30%' }}>Peso</th></tr></thead>
                  <tbody>
                    {resumo.porEspecialidade.map((e) => (
                      <tr key={e.especialidade}>
                        <td>{e.especialidade}</td>
                        <td>{e.total}</td>
                        <td>{e.realizadas}</td>
                        <td>{e.canceladas}</td>
                        <td>
                          <div className="progress">
                            <span style={{ width: `${resumo.total ? (Number(e.total) / resumo.total) * 100 : 0}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="stack">
            <section className="card">
              <h3>Satisfação por médico</h3>
              <div className="stack sm mt-sm">
                {(resumo.satisfacaoPorMedico || []).length === 0 && <p className="tiny">Sem avaliações.</p>}
                {(resumo.satisfacaoPorMedico || []).map((m) => (
                  <div key={m.medico_id} className="list-item">
                    <div className="grow">
                      <b style={{ fontSize: '.86rem' }}>{m.medico}</b>
                      <div className="tiny muted">{m.avaliacoes} avaliação(ões)</div>
                    </div>
                    <span className="stars">★ {Number(m.media).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <h3>Indicadores rápidos</h3>
              <dl className="kv mt-sm">
                <dt>Pendentes</dt><dd>{resumo.pendentes}</dd>
                <dt>Confirmadas</dt><dd>{resumo.confirmadas}</dd>
                <dt>Realizadas</dt><dd>{resumo.realizadas}</dd>
                <dt>Canceladas</dt><dd>{resumo.canceladas}</dd>
                <dt>Cancel. tardios</dt><dd>{resumo.cancelamentosTardios}</dd>
                <dt>Pacientes</dt><dd>{resumo.pacientesRegistados}</dd>
                <dt>Versão cache</dt><dd>v{resumo.versaoCache}</dd>
              </dl>
            </section>

            <section className="card">
              <h3>Especialidades</h3>
              <div className="row wrap mt-sm">
                {especialidades.map((e) => <span key={e.id} className="badge neutral">{e.nome}</span>)}
              </div>
              <button className="btn sm mt" onClick={() => setModalEspecialidade(true)}>+ Nova especialidade</button>
            </section>
          </aside>
        </div>
      )}

      {aba === 'relatorios' && (
        <div className="print-area">
          <header className="so-imprimir print-head">
            <h1>MediAgenda — Relatório de consultas</h1>
            <p>
              Gerado em {new Date().toLocaleString('pt-PT')}
              {filtros.desde ? ` · desde ${filtros.desde}` : ''}
              {filtros.ate ? ` · até ${filtros.ate}` : ''}
              {filtros.estado ? ` · estado: ${filtros.estado}` : ''}
            </p>
          </header>

          <section className="card">
            <div className="card-head nao-imprimir">
              <div><h2>Relatório de consultas</h2><p>Filtre, consulte e exporte para Excel (CSV) ou PDF (impressão).</p></div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={imprimirPdf}>🖨 PDF (Imprimir)</button>
                <button className="btn primary" onClick={exportar}>↓ Excel (CSV)</button>
              </div>
            </div>
            <div className="grid c4 nao-imprimir">
              <Campo label="Desde"><input type="date" value={filtros.desde} onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })} /></Campo>
              <Campo label="Até"><input type="date" value={filtros.ate} onChange={(e) => setFiltros({ ...filtros, ate: e.target.value })} /></Campo>
              <Campo label="Estado">
                <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
                  {ESTADOS.map((e) => <option key={e} value={e}>{e || 'Todos'}</option>)}
                </select>
              </Campo>
              <div className="field">
                <label>&nbsp;</label>
                <button className="btn" onClick={carregarRelatorio}>Aplicar filtros</button>
              </div>
            </div>
          </section>

          <section className="card mt">
            <div className="row between">
              <h3>Linhas ({relatorio.consultas.length})</h3>
              <small className="muted nao-imprimir">Cache de relatórios v{relatorio.resumo?.versaoCache}</small>
            </div>
            {relatorio.consultas.length === 0 ? (
              <Vazio icone="📄" titulo="Sem resultados" texto="Ajuste os filtros." />
            ) : (
              <div className="table-wrap mt-sm">
                <table>
                  <thead><tr><th>#</th><th>Data</th><th>Paciente</th><th>Médico</th><th>Especialidade</th><th>Duração</th><th>Estado</th></tr></thead>
                  <tbody>
                    {relatorio.consultas.map((c) => (
                      <tr key={c.id}>
                        <td>{c.id}</td>
                        <td className="tiny">{formatarDataHora(c.data_hora)}</td>
                        <td>{c.paciente}</td>
                        <td>{c.medico}</td>
                        <td>{c.especialidade}</td>
                        <td>{c.duracao_min} min</td>
                        <td><span className={`badge ${c.estado}`}>{c.estado}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {aba === 'aprovacoes' && (
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Aprovação de contas</h2>
                <p>
                  Médicos aguardam confirmação da secretária; secretárias aguardam autorização do
                  administrador. Enquanto estiverem pendentes, as credenciais não funcionam.
                </p>
              </div>
              <span className="badge pendente">{aprovacoes.length} pendente(s)</span>
            </div>
            {aprovacoes.length === 0 ? (
              <Vazio icone="✅" titulo="Sem contas pendentes" texto="Todos os cadastros foram avaliados." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Nome</th><th>Perfil</th><th>E-mail</th><th>Registo / Localização</th><th>Criado</th><th></th></tr></thead>
                  <tbody>
                    {aprovacoes.map((u) => (
                      <tr key={u.id}>
                        <td><b style={{ fontSize: '.86rem' }}>{u.nome}</b></td>
                        <td><span className="badge neutral">{u.perfil}</span></td>
                        <td className="tiny">{u.email}</td>
                        <td className="tiny">
                          {u.perfil === 'medico'
                            ? `${u.numero_registo || '—'} · ${u.localizacao || '—'}`
                            : '—'}
                        </td>
                        <td className="tiny">{formatarDataHora(u.criado_em)}</td>
                        <td className="right">
                          <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn sm primary" onClick={() => decidirAprovacao(u, 'aprovar')}>Aprovar</button>
                            <button className="btn sm danger" onClick={() => decidirAprovacao(u, 'recusar')}>Recusar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h3>Regra de negócio aplicada</h3>
            <div className="grid c2 mt-sm">
              <div className="alert info">
                <b>Médico → Secretária</b>
                <p className="tiny" style={{ margin: '6px 0 0' }}>
                  O cadastro público fica com <code>estado_aprovacao = 'pendente'</code> e
                  <code> ativo = 0</code>. A secretária aprova e só então o login é aceite.
                </p>
              </div>
              <div className="alert warn">
                <b>Secretária → Administrador</b>
                <p className="tiny" style={{ margin: '6px 0 0' }}>
                  A autorização é exclusiva do administrador. A secretária não pode aprovar
                  outras secretárias (verificado no servidor, não só na interface).
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {aba === 'utilizadores' && (
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div><h2>Médicos</h2><p>Contas activas; desactivar cancela consultas futuras (RN-08).</p></div>
              <button className="btn primary" onClick={() => setModalMedico(true)}>+ Novo médico</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Médico</th><th>Registo</th><th>Localização</th><th>Especialidades</th><th></th></tr></thead>
                <tbody>
                  {medicos.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <b style={{ fontSize: '.86rem' }}>{m.nome}</b>
                        <div className="tiny muted">{m.email}</div>
                      </td>
                      <td className="mono tiny">{m.numero_registo}</td>
                      <td className="tiny">{m.localizacao}</td>
                      <td className="tiny">{m.especialidades.map((e) => e.nome).join(', ')}</td>
                      <td className="right">
                        <button className="btn sm danger" onClick={() => desactivarMedico(m)}>Desactivar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2>Utilizadores ({utilizadores.length})</h2>
            <div className="table-wrap mt-sm">
              <table>
                <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Aprovação</th><th>Estado</th><th>Criado</th></tr></thead>
                <tbody>
                  {utilizadores.map((u) => (
                    <tr key={u.id}>
                      <td>{u.nome}</td>
                      <td className="tiny">{u.email}</td>
                      <td><span className="badge neutral">{u.perfil}</span></td>
                      <td>
                        <span className={`badge ${u.estado_aprovacao === 'aprovada' ? 'confirmada' : u.estado_aprovacao === 'pendente' ? 'pendente' : 'cancelada'}`}>
                          {u.estado_aprovacao || 'aprovada'}
                        </span>
                      </td>
                      <td><span className={`badge ${u.ativo ? 'confirmada' : 'cancelada'}`}>{u.ativo ? 'activo' : 'inactivo'}</span></td>
                      <td className="tiny">{formatarDataHora(u.criado_em)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {aba === 'config' && (
        <section className="card">
          <div className="card-head">
            <div><h2>Configuração do sistema</h2><p>Alterações aplicam-se imediatamente (Singleton + cache invalidada).</p></div>
            <button className="btn primary" onClick={guardarConfiguracoes} disabled={aGuardar}>
              {aGuardar ? 'A guardar…' : 'Guardar configuração'}
            </button>
          </div>
          <div className="grid c2">
            {configuracoes.map((c) => (
              <Campo key={c.chave} label={c.chave} hint={c.descricao || `Padrão: ${c.padrao ?? '—'}`}>
                <input value={c.valor} onChange={(e) => setConfiguracoes((lista) => lista.map((item) => (
                  item.chave === c.chave ? { ...item, valor: e.target.value } : item
                )))} />
              </Campo>
            ))}
          </div>
          <div className="alert info mt">
            <b>RN-01</b> antecedência mínima · <b>RN-02</b> limite de cancelamento · <b>RN-03</b> limite diário ·
            {' '}<b>RN-06</b> limite por paciente/médico · <b>RN-07</b> prazo de confirmação.
          </div>
        </section>
      )}

      {modalMedico && (
        <Modal wide titulo="Novo médico" subtitulo="Cria a conta e o perfil profissional." onFechar={() => setModalMedico(false)}>
          <div className="grid c2">
            <Campo label="Nome completo"><input value={novoMedico.nome} onChange={(e) => setNovoMedico({ ...novoMedico, nome: e.target.value })} /></Campo>
            <Campo label="E-mail"><input type="email" value={novoMedico.email} onChange={(e) => setNovoMedico({ ...novoMedico, email: e.target.value })} /></Campo>
            <Campo label="Nº de registo"><input value={novoMedico.numeroRegisto} onChange={(e) => setNovoMedico({ ...novoMedico, numeroRegisto: e.target.value })} /></Campo>
            <Campo label="Telefone"><input value={novoMedico.telefone} onChange={(e) => setNovoMedico({ ...novoMedico, telefone: e.target.value })} /></Campo>
            <Campo label="Localização"><input value={novoMedico.localizacao} onChange={(e) => setNovoMedico({ ...novoMedico, localizacao: e.target.value })} /></Campo>
            <Campo label="Palavra-passe inicial" hint="Padrão: MediAgenda123"><input value={novoMedico.password} onChange={(e) => setNovoMedico({ ...novoMedico, password: e.target.value })} /></Campo>
          </div>
          <Campo label="Especialidades">
            <div className="row wrap">
              {especialidades.map((e) => (
                <label key={e.id} className="check badge neutral" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={novoMedico.especialidades.includes(e.nome)}
                    onChange={() => setNovoMedico((m) => ({
                      ...m,
                      especialidades: m.especialidades.includes(e.nome)
                        ? m.especialidades.filter((x) => x !== e.nome)
                        : [...m.especialidades, e.nome]
                    }))} />
                  {e.nome}
                </label>
              ))}
            </div>
          </Campo>
          <div className="row between mt">
            <button className="btn ghost" onClick={() => setModalMedico(false)}>Cancelar</button>
            <button className="btn primary" onClick={criarMedico} disabled={aGuardar || !novoMedico.nome || !novoMedico.email || !novoMedico.numeroRegisto}>
              {aGuardar ? 'A criar…' : 'Criar médico'}
            </button>
          </div>
        </Modal>
      )}

      {modalEspecialidade && (
        <Modal titulo="Nova especialidade" onFechar={() => setModalEspecialidade(false)}>
          <Campo label="Nome"><input value={novaEspecialidade.nome} onChange={(e) => setNovaEspecialidade({ ...novaEspecialidade, nome: e.target.value })} /></Campo>
          <Campo label="Descrição"><textarea value={novaEspecialidade.descricao} onChange={(e) => setNovaEspecialidade({ ...novaEspecialidade, descricao: e.target.value })} /></Campo>
          <Campo label="Duração padrão (min)">
            <input type="number" min="15" step="15" value={novaEspecialidade.duracaoPadraoMin}
              onChange={(e) => setNovaEspecialidade({ ...novaEspecialidade, duracaoPadraoMin: Number(e.target.value) })} />
          </Campo>
          <div className="row between mt">
            <button className="btn ghost" onClick={() => setModalEspecialidade(false)}>Cancelar</button>
            <button className="btn primary" onClick={criarEspecialidade} disabled={!novaEspecialidade.nome}>Criar</button>
          </div>
        </Modal>
      )}
    </>
  );
}
