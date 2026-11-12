import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { http } from '../api.js';
import { Topo } from '../components/Layout.jsx';
import { useToast, Vazio } from '../components/ui.jsx';
import { formatarDataHora } from '../utils.js';

const CORES = {
  LOGIN: 'confirmada',
  LOGOUT: 'neutral',
  LOGIN_FALHADO: 'cancelada',
  CONSULTA_CRIADA: 'info',
  CONSULTA_CONFIRMADA: 'confirmada',
  CONSULTA_CANCELADA: 'cancelada',
  CONSULTA_REAGENDADA: 'pendente',
  CONSULTA_REALIZADA: 'realizada',
  CONSULTA_EXPIRADA: 'pendente',
  CONSULTA_AVALIADA: 'confirmada',
  REGISTO: 'info',
  MEDICO_DESATIVADO: 'cancelada'
};

export function Auditoria() {
  const toast = useToast();
  const [registos, setRegistos] = useState([]);
  const [pesquisa, setPesquisa] = useState('');
  const [acao, setAcao] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const r = await http.get(`/admin/auditoria?limite=300${acao ? `&acao=${encodeURIComponent(acao)}` : ''}`);
      setRegistos(r);
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setCarregando(false);
    }
  }, [acao]);

  useEffect(() => { carregar(); }, [carregar]);

  const acoes = useMemo(() => {
    const set = new Set(registos.map((r) => r.acao));
    return [...set].sort();
  }, [registos]);

  const filtrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();
    if (!termo) return registos;
    return registos.filter((r) =>
      (r.utilizador_nome || '').toLowerCase().includes(termo)
      || r.acao.toLowerCase().includes(termo)
      || (r.entidade || '').toLowerCase().includes(termo)
      || JSON.stringify(r.detalhes || '').toLowerCase().includes(termo)
    );
  }, [registos, pesquisa]);

  const contagem = useMemo(() => {
    const mapa = {};
    for (const r of registos) mapa[r.acao] = (mapa[r.acao] || 0) + 1;
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [registos]);

  if (carregando) return <div className="spinner" />;

  return (
    <>
      <Topo
        titulo="Auditoria"
        sub="Registo imutável de operações críticas — quem, quando, o quê e a partir de onde."
        acoes={<button className="btn ghost" onClick={carregar}>↻ Actualizar</button>}
      />

      <div className="grid c4">
        <div className="card pad-sm">
          <div className="kpi"><span className="label">Registos</span><span className="value">{registos.length}</span><span className="hint">últimos 300</span></div>
        </div>
        {contagem.slice(0, 3).map(([nome, total]) => (
          <div key={nome} className="card pad-sm">
            <div className="kpi">
              <span className="label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nome}</span>
              <span className="value">{total}</span>
              <span className="hint">ocorrências</span>
            </div>
          </div>
        ))}
      </div>

      <section className="card mt">
        <div className="row between wrap">
          <div className="row wrap" style={{ gap: 10 }}>
            <input placeholder="Pesquisar por utilizador, acção ou detalhe…" value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)} style={{ maxWidth: 340 }} />
            <select value={acao} onChange={(e) => setAcao(e.target.value)} style={{ maxWidth: 220 }}>
              <option value="">Todas as acções</option>
              {acoes.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <small className="muted">{filtrados.length} resultado(s)</small>
        </div>

        {filtrados.length === 0 ? (
          <Vazio icone="🛡️" titulo="Sem registos" texto="Ajuste os filtros." />
        ) : (
          <div className="table-wrap mt">
            <table>
              <thead>
                <tr><th>Quando</th><th>Utilizador</th><th>Acção</th><th>Entidade</th><th>IP</th><th></th></tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td className="tiny" style={{ whiteSpace: 'nowrap' }}>{formatarDataHora(r.criado_em)}</td>
                      <td>
                        <div style={{ fontSize: '.84rem' }}>{r.utilizador_nome || 'sistema'}</div>
                        {r.utilizador_perfil && <div className="tiny muted">{r.utilizador_perfil}</div>}
                      </td>
                      <td><span className={`badge ${CORES[r.acao] || 'neutral'}`}>{r.acao}</span></td>
                      <td className="tiny">{r.entidade}{r.entidade_id ? ` #${r.entidade_id}` : ''}</td>
                      <td className="mono tiny">{r.ip || '—'}</td>
                      <td className="right">
                        {r.detalhes && (
                          <button className="btn sm ghost" onClick={() => setAberto(aberto === r.id ? null : r.id)}>
                            {aberto === r.id ? 'Ocultar' : 'Detalhes'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {aberto === r.id && r.detalhes && (
                      <tr>
                        <td colSpan={6}>
                          <div className="code-block">{JSON.stringify(r.detalhes, null, 2)}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
