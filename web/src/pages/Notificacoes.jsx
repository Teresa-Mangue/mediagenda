import { useCallback, useEffect, useMemo, useState } from 'react';
import { http } from '../api.js';
import { Topo } from '../components/Layout.jsx';
import { Carregando, useToast, Vazio } from '../components/ui.jsx';
import { formatarDataHora } from '../utils.js';

const ICONES_EVENTO = {
  ConsultaCriada: '📝',
  ConsultaConfirmada: '✅',
  ConsultaCancelada: '❌',
  ConsultaReagendada: '↻',
  ConsultaExpirada: '⏰',
  ConsultaRealizada: '🩺',
  ConsultaLembrete: '🔔',
  Lembrete24h: '🔔',
  Lembrete1h: '⏰',
  RegistoUtilizador: '👋',
  RecuperacaoPassword: '🔑'
};

export function Notificacoes() {
  const toast = useToast();
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const r = await http.get('/notificacoes');
      setLista(r.notificacoes);
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => (
    filtro === 'nao-lidas' ? lista.filter((n) => !n.lida_em) : lista
  ), [lista, filtro]);

  const marcarLida = async (id) => {
    try {
      await http.patch(`/notificacoes/${id}/lida`);
      setLista((atual) => atual.map((n) => (n.id === id ? { ...n, lida_em: new Date().toISOString() } : n)));
    } catch (falha) {
      toast.erro(falha.message);
    }
  };

  const marcarTodas = async () => {
    const naoLidas = lista.filter((n) => !n.lida_em);
    for (const n of naoLidas) {
      try { await http.patch(`/notificacoes/${n.id}/lida`); } catch { /* continua */ }
    }
    await carregar();
    toast.sucesso('Notificações marcadas como lidas.');
  };

  if (carregando) return <Carregando texto="A carregar notificações…" />;

  const naoLidas = lista.filter((n) => !n.lida_em).length;

  return (
    <>
      <Topo
        titulo="Notificações"
        sub={`${naoLidas} não lida(s) de ${lista.length}. Cada mensagem corresponde a um evento consumido pelo serviço de notificações.`}
        acoes={naoLidas > 0 ? <button className="btn sm" onClick={marcarTodas}>Marcar todas como lidas</button> : null}
      />

      <div className="tabs">
        <button className={`tab ${filtro === 'todas' ? 'active' : ''}`} onClick={() => setFiltro('todas')}>
          Todas <span className="badge neutral" style={{ marginLeft: 6 }}>{lista.length}</span>
        </button>
        <button className={`tab ${filtro === 'nao-lidas' ? 'active' : ''}`} onClick={() => setFiltro('nao-lidas')}>
          Não lidas <span className="badge neutral" style={{ marginLeft: 6 }}>{naoLidas}</span>
        </button>
      </div>

      {filtradas.length === 0 ? (
        <Vazio icone="🔔" titulo="Sem notificações" texto="As notificações aparecem aqui quando há eventos de consulta." />
      ) : (
        <div className="list">
          {filtradas.map((n) => (
            <article key={n.id} className={`list-item ${n.lida_em ? '' : 'notif-unread'}`} style={{ alignItems: 'flex-start' }}>
              <div className="avatar" style={{ borderRadius: 12 }}>
                {ICONES_EVENTO[n.evento] || '📨'}
              </div>
              <div className="grow">
                <div className="row wrap between">
                  <b style={{ fontSize: '.92rem' }}>{n.assunto}</b>
                  <span className="row" style={{ gap: 6 }}>
                    <span className={`badge ${n.canal === 'sms' ? 'info' : 'neutral'}`}>{n.canal}</span>
                    <span className={`badge ${n.estado === 'lida' ? 'neutral' : 'pendente'}`}>{n.estado}</span>
                  </span>
                </div>
                <div className="tiny muted" style={{ margin: '2px 0 6px' }}>
                  {formatarDataHora(n.criado_em)} · evento <code>{n.evento}</code>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '.85rem', lineHeight: 1.5, color: 'var(--text)' }}>
                  {n.corpo}
                </div>
                <div className="row between mt-sm">
                  <span className="tiny muted">
                    {n.consulta_id ? `Consulta #${n.consulta_id}` : 'Sem consulta associada'}
                  </span>
                  {!n.lida_em && (
                    <button className="btn sm ghost" onClick={() => marcarLida(n.id)}>Marcar como lida</button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
