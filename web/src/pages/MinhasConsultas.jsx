import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Topo } from '../components/Layout.jsx';
import { AcoesConsulta } from '../components/AcoesConsulta.jsx';
import { Carregando, EstadoBadge, useToast, Vazio } from '../components/ui.jsx';
import { duracaoTexto, formatarDataHora, tempoRestante } from '../utils.js';

const FILTROS = [
  { id: 'proximas', label: 'Próximas' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'confirmada', label: 'Confirmadas' },
  { id: 'realizada', label: 'Realizadas' },
  { id: 'cancelada', label: 'Canceladas' },
  { id: 'todas', label: 'Todas' }
];

export function MinhasConsultas() {
  const { utilizador } = useAuth();
  const toast = useToast();
  const [consultas, setConsultas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('proximas');

  const carregar = useCallback(async () => {
    try {
      const lista = await http.get('/consultas/minhas');
      setConsultas(lista);
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    const agora = Date.now();
    let lista = consultas;
    if (filtro === 'proximas') {
      lista = consultas
        .filter((c) => ['pendente', 'confirmada'].includes(c.estado) && new Date(c.data_hora).getTime() >= agora)
        .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
    } else if (filtro !== 'todas') {
      lista = consultas
        .filter((c) => c.estado === filtro)
        .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));
    } else {
      lista = [...consultas].sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));
    }
    return lista;
  }, [consultas, filtro]);

  const contagens = useMemo(() => {
    const base = { proximas: 0, pendente: 0, confirmada: 0, realizada: 0, cancelada: 0, todas: consultas.length };
    for (const c of consultas) {
      if (base[c.estado] !== undefined) base[c.estado] += 1;
      if (['pendente', 'confirmada'].includes(c.estado) && new Date(c.data_hora).getTime() >= Date.now()) {
        base.proximas += 1;
      }
    }
    return base;
  }, [consultas]);

  const subtitulo = utilizador.perfil === 'paciente'
    ? 'Confirme, cancele, reagende ou avalie as suas consultas.'
    : 'Agenda completa de consultas, com filtros por estado.';

  if (carregando) return <Carregando texto="A carregar consultas…" />;

  return (
    <>
      <Topo
        titulo={utilizador.perfil === 'paciente' ? 'As minhas consultas' : 'Consultas'}
        sub={subtitulo}
        acoes={<Link className="btn primary" to="/">+ Nova marcação</Link>}
      />

      <div className="tabs">
        {FILTROS.map((f) => (
          <button key={f.id} className={`tab ${filtro === f.id ? 'active' : ''}`} onClick={() => setFiltro(f.id)}>
            {f.label} {contagens[f.id] > 0 && <span className="badge neutral" style={{ marginLeft: 6 }}>{contagens[f.id]}</span>}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <Vazio icone="🗓️" titulo="Sem consultas nesta vista"
          texto="Experimente outro filtro ou marque uma nova consulta.">
          <Link className="btn primary" to="/">Procurar médico</Link>
        </Vazio>
      ) : (
        <div className="stack">
          {filtradas.map((consulta) => {
            const futura = new Date(consulta.data_hora).getTime() >= Date.now();
            return (
              <article key={consulta.id} className="card pad-sm">
                <div className="row wrap between" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
                    <div className="doctor-avatar" style={{ width: 48, height: 48, borderRadius: 14, fontSize: '.95rem' }}>
                      {consulta.especialidade_nome.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="row wrap" style={{ gap: 8 }}>
                        <h3 style={{ margin: 0 }}>{consulta.especialidade_nome}</h3>
                        <EstadoBadge estado={consulta.estado} />
                        {consulta.cancelamento_tardio ? <span className="badge neutral">tardio</span> : null}
                        {consulta.avaliacao_pontuacao ? <span className="badge neutral">★ {consulta.avaliacao_pontuacao}</span> : null}
                      </div>
                      <div className="tiny muted mt-sm">
                        {utilizador.perfil === 'paciente'
                          ? consulta.medico_nome
                          : `${consulta.paciente_nome} · ${consulta.medico_nome}`}
                      </div>
                      <div className="tiny muted">
                        {formatarDataHora(consulta.data_hora)} · {duracaoTexto(consulta.duracao_min)} · {consulta.localizacao || 'Clínica MediAgenda'}
                      </div>
                      {consulta.estado === 'pendente' && consulta.prazo_confirmacao && (
                        <div className="alert warn mt-sm" style={{ padding: '7px 10px', fontSize: '.78rem' }}>
                          Confirme em <b>{tempoRestante(consulta.prazo_confirmacao)}</b> — caso contrário expira (RN-07).
                        </div>
                      )}
                      {consulta.motivo_cancelamento && (
                        <div className="tiny muted mt-sm">Motivo: {consulta.motivo_cancelamento}</div>
                      )}
                    </div>
                  </div>

                  <div className="row wrap" style={{ gap: 8 }}>
                    <Link className="btn sm ghost" to={`/consultas/${consulta.id}`}>Detalhes →</Link>
                  </div>
                </div>

                <div className="row between mt-sm" style={{ alignItems: 'flex-end', gap: 10 }}>
                  <AcoesConsulta consulta={consulta} onAtualizar={carregar} />
                  {futura && <span className="tiny muted">{tempoRestante(consulta.data_hora)} para a consulta</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
