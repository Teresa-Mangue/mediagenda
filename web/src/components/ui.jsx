import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { NOMES_ESTADO } from '../utils.js';

export function EstadoBadge({ estado }) {
  return <span className={`badge ${estado}`}>{NOMES_ESTADO[estado] || estado}</span>;
}

export function Estrelas({ valor = 0, total = 0 }) {
  const cheias = Math.round(Number(valor) || 0);
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className="stars" aria-label={`${valor} de 5`}>{'★'.repeat(cheias)}{'☆'.repeat(Math.max(0, 5 - cheias))}</span>
      <small>{valor ? Number(valor).toFixed(1) : 'Sem avaliações'}{total ? ` (${total})` : ''}</small>
    </span>
  );
}

export function Campo({ label, hint, children, htmlFor }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Modal({ titulo, subtitulo, children, onFechar, wide = false }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar?.(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-head">
          <div>
            <h2 style={{ margin: 0 }}>{titulo}</h2>
            {subtitulo && <p style={{ margin: '4px 0 0', fontSize: '.85rem' }}>{subtitulo}</p>}
          </div>
          <button className="icon-btn" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Carregando({ texto = 'A carregar…' }) {
  return (
    <div className="page-loading">
      <div className="center">
        <div className="spinner" />
        <p className="tiny">{texto}</p>
      </div>
    </div>
  );
}

export function Vazio({ icone = '📭', titulo = 'Sem dados', texto, children }) {
  return (
    <div className="empty">
      <div className="big">{icone}</div>
      <b>{titulo}</b>
      {texto && <p style={{ margin: '4px 0 0' }}>{texto}</p>}
      {children && <div className="mt">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ toasts */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [lista, setLista] = useState([]);

  const push = useCallback((texto, tipo = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setLista((atual) => [...atual, { id, texto, tipo }]);
    window.setTimeout(() => {
      setLista((atual) => atual.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const valor = useMemo(() => ({
    sucesso: (texto) => push(texto, 'success'),
    erro: (texto) => push(texto, 'error'),
    info: (texto) => push(texto, 'info')
  }), [push]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="toast-wrap">
        {lista.map((t) => <div key={t.id} className={`toast ${t.tipo}`}>{t.texto}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) throw new Error('useToast deve ser usado dentro de ToastProvider.');
  return contexto;
}
