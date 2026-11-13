import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { http } from '../api.js';
import { useAuth, iniciais } from '../auth.jsx';
import { Topo } from '../components/Layout.jsx';
import { Carregando, Estrelas, useToast, Vazio } from '../components/ui.jsx';
import { diaMes, formatarDataHora, primeiroNome } from '../utils.js';

export function Inicio() {
  const { utilizador } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [medicos, setMedicos] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [clinica, setClinica] = useState(null);
  const [proximas, setProximas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState({ nome: '', especialidade: '', localizacao: '' });

  const carregarMedicos = async (f = filtros) => {
    const params = new URLSearchParams();
    if (f.nome) params.set('nome', f.nome);
    if (f.especialidade) params.set('especialidade', f.especialidade);
    if (f.localizacao) params.set('localizacao', f.localizacao);
    try {
      const lista = await http.get(`/medicos${params.toString() ? `?${params}` : ''}`);
      setMedicos(lista);
    } catch (falha) {
      toast.erro(falha.message);
    }
  };

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [meds, esps, cli] = await Promise.all([
          http.get('/medicos'),
          http.get('/especialidades'),
          http.get('/clinica')
        ]);
        if (!ativo) return;
        setMedicos(meds);
        setEspecialidades(esps);
        setClinica(cli);
        if (utilizador?.perfil === 'paciente') {
          const minhas = await http.get('/consultas/minhas');
          const futuras = minhas
            .filter((c) => ['pendente', 'confirmada'].includes(c.estado) && new Date(c.data_hora) >= new Date())
            .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
          if (ativo) setProximas(futuras.slice(0, 3));
        }
      } catch (falha) {
        toast.erro(falha.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, []);

  const locais = useMemo(() => {
    const set = new Set(medicos.map((m) => m.localizacao).filter(Boolean));
    return [...set];
  }, [medicos]);

  const pesquisar = (e) => {
    e.preventDefault();
    carregarMedicos();
  };

  if (carregando) return <Carregando texto="A preparar o seu painel…" />;

  const primeiro = primeiroNome(utilizador?.nome);

  return (
    <>
      <Topo
        titulo={`Olá, ${primeiro} 👋`}
        sub={`${clinica?.nome || 'Clínica MediAgenda'} · ${utilizador?.perfil === 'paciente' ? 'marque e acompanhe as suas consultas' : 'visão geral do sistema'}`}
        acoes={
          <Link className="btn primary" to="/consultas">
            {utilizador?.perfil === 'paciente' ? 'As minhas consultas' : 'Ver consultas'}
          </Link>
        }
      />

      <section className="hero">
        <span className="pill">● {clinica?.diasFuncionamento?.length || 5} dias por semana · {clinica?.horarioInicio}–{clinica?.horarioFim}</span>
        <h1>Encontre o especialista certo, à hora certa.</h1>
        <p>
          Pesquise por especialidade, médico ou clínica em todo o país. Cada marcação é validada
          automaticamente (RN-01 a RN-09) e recebe notificações por e-mail, SMS ou WhatsApp.
        </p>
        <div className="row wrap">
          <Link className="btn" to="/consultas">
            {utilizador?.perfil === 'paciente' ? 'Ver a minha agenda de consultas' : 'Abrir agenda de consultas'}
          </Link>
          {utilizador?.perfil === 'medico' && <Link className="btn ghost" to="/medico">Painel médico</Link>}
          {utilizador?.perfil === 'secretario' && <Link className="btn ghost" to="/secretaria">Painel secretaria</Link>}
          {utilizador?.perfil === 'admin' && <Link className="btn ghost" to="/arquitetura">Architecture Lab</Link>}
        </div>
      </section>

      <form className="searchbar" onSubmit={pesquisar}>
        <div className="card">
          <label className="tiny muted" htmlFor="pesquisa-nome">Médico</label>
          <input id="pesquisa-nome" value={filtros.nome} placeholder="Nome do médico"
            onChange={(e) => setFiltros({ ...filtros, nome: e.target.value })} />
        </div>
        <div className="card">
          <label className="tiny muted" htmlFor="pesquisa-especialidade">Especialidade</label>
          <select id="pesquisa-especialidade" value={filtros.especialidade}
            onChange={(e) => setFiltros({ ...filtros, especialidade: e.target.value })}>
            <option value="">Todas as especialidades</option>
            {especialidades.map((esp) => <option key={esp.id} value={esp.id}>{esp.nome}</option>)}
          </select>
        </div>
        <div className="card">
          <label className="tiny muted" htmlFor="pesquisa-local">Localização</label>
          <select id="pesquisa-local" value={filtros.localizacao}
            onChange={(e) => setFiltros({ ...filtros, localizacao: e.target.value })}>
            <option value="">Todas as clínicas</option>
            {locais.map((local) => <option key={local} value={local}>{local}</option>)}
          </select>
        </div>
        <button className="btn primary" type="submit" style={{ height: '100%' }}>Pesquisar</button>
      </form>

      {utilizador?.perfil === 'paciente' && proximas.length > 0 && (
        <section className="card mt">
          <div className="card-head">
            <div>
              <h2>Próximas consultas</h2>
              <p>As suas marcações mais próximas.</p>
            </div>
            <Link to="/consultas" className="btn sm ghost">Ver todas</Link>
          </div>
          <div className="grid c3">
            {proximas.map((consulta) => (
              <Link key={consulta.id} to={`/consultas/${consulta.id}`} className="list-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="avatar" style={{ flexDirection: 'column', borderRadius: 12, lineHeight: 1.1 }}>
                  <b>{diaMes(consulta.data_hora).split(' ')[0]}</b>
                  <span style={{ fontSize: '.6rem' }}>{diaMes(consulta.data_hora).split(' ')[1]}</span>
                </div>
                <div className="grow">
                  <b style={{ display: 'block', fontSize: '.9rem' }}>{consulta.especialidade_nome}</b>
                  <span className="tiny muted">{consulta.medico_nome}</span>
                  <div className="tiny muted">{formatarDataHora(consulta.data_hora)}</div>
                </div>
                <span className={`badge ${consulta.estado}`}>{consulta.estado}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {clinica?.sedes?.length > 0 && (
        <section className="mt">
          <div className="row between wrap mt">
            <div>
              <h2>Onde estamos</h2>
              <p>A rede MediAgenda está presente nas principais cidades de Moçambique.</p>
            </div>
            <span className="badge info">{clinica.sedes.length} cidades</span>
          </div>
          <div className="grid auto mt-sm">
            {clinica.sedes.map((sede) => (
              <article key={sede.cidade} className="card pad-sm">
                <div className="badge info">{sede.medicos} médico(s)</div>
                <h3 className="mt-sm" style={{ marginBottom: 2 }}>{sede.cidade}</h3>
                <p className="tiny muted" style={{ margin: 0 }}>Clínica MediAgenda — {sede.cidade}</p>
                <button className="btn ghost sm mt" onClick={() => {
                  setFiltros((f) => ({ ...f, localizacao: sede.localizacao }));
                  carregarMedicos({ ...filtros, localizacao: sede.localizacao });
                }}>
                  Ver médicos
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt">
        <div className="row between mt">
          <div>
            <h2>Médicos disponíveis</h2>
            <p>Seleccione um médico para ver horários e marcar.</p>
          </div>
          <small className="muted">{medicos.length} resultado(s)</small>
        </div>

        {medicos.length === 0 ? (
          <Vazio icone="🔎" titulo="Nenhum médico encontrado" texto="Ajuste os filtros e tente novamente." />
        ) : (
          <div className="grid auto">
            {medicos.map((medico) => (
              <article key={medico.id} className="card doctor-card">
                <div className="doctor-top">
                  <div className="doctor-avatar">{iniciais(medico.nome)}</div>
                  <div className="grow">
                    <h3 style={{ marginBottom: 4 }}>{medico.nome}</h3>
                    <div className="meta">
                      <span>{medico.especialidades.map((e) => e.nome).join(' · ')}</span>
                      <span>{medico.localizacao}</span>
                      <Estrelas valor={medico.avaliacao_media} total={medico.total_avaliacoes} />
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: '.82rem', margin: 0 }}>
                  {medico.biografia || `Consulta de ${medico.duracao_consulta_min} minutos.`}
                </p>
                <div className="foot">
                  <span className="badge info">{medico.duracao_consulta_min} min</span>
                  <button className="btn primary sm" onClick={() => navigate(`/medicos/${medico.id}`)}>
                    Ver horários
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid c3 mt">
        <div className="card">
          <div className="badge info">RN-01 · RN-09</div>
          <h3 className="mt-sm">Validação inteligente</h3>
          <p className="tiny">Antecedência mínima, horário da clínica e disponibilidade do médico são verificados antes de confirmar.</p>
        </div>
        <div className="card">
          <div className="badge pendente">RN-07</div>
          <h3 className="mt-sm">Confirmação em 2 horas</h3>
          <p className="tiny">Consultas pendentes expiram automaticamente e libertam a vaga para outro paciente.</p>
        </div>
        <div className="card">
          <div className="badge confirmada">RN-02 · RN-08</div>
          <h3 className="mt-sm">Agenda protegida</h3>
          <p className="tiny">Cancelamentos tardios ficam registados e médicos desactivados cancelam consultas futuras.</p>
        </div>
      </section>
    </>
  );
}
