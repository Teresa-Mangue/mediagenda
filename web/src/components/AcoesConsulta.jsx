import { useState } from 'react';
import { http } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Campo, Modal, useToast } from './ui.jsx';
import { formatarDataHora } from '../utils.js';

function paraInputLocal(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AcoesConsulta({ consulta, onAtualizar, detalhado = false }) {
  const { utilizador } = useAuth();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [novaData, setNovaData] = useState(paraInputLocal(consulta.data_hora));
  const [pontuacao, setPontuacao] = useState(5);
  const [comentario, setComentario] = useState('');
  const [aProcessar, setAProcessar] = useState(false);

  const perfil = utilizador?.perfil;
  const tardio = new Date(consulta.data_hora).getTime() - Date.now() < 24 * 3600 * 1000;

  const executar = async (fn, mensagem) => {
    setAProcessar(true);
    try {
      await fn();
      toast.sucesso(mensagem);
      setModal(null);
      setMotivo('');
      await onAtualizar?.();
    } catch (falha) {
      toast.erro(falha.message);
    } finally {
      setAProcessar(false);
    }
  };

  const confirmar = () => executar(() => http.post(`/consultas/${consulta.id}/confirmar`), 'Consulta confirmada.');
  const realizar = () => executar(() => http.post(`/consultas/${consulta.id}/realizar`), 'Consulta marcada como realizada.');
  const cancelar = () => executar(
    () => http.post(`/consultas/${consulta.id}/cancelar`, { motivo }),
    'Consulta cancelada.'
  );
  const reagendar = () => executar(
    () => http.patch(`/consultas/${consulta.id}/reagendar`, {
      dataHora: new Date(novaData).toISOString(),
      motivo: motivo || undefined
    }),
    'Consulta reagendada. Nova confirmação necessária.'
  );
  const avaliar = () => executar(
    () => http.post(`/consultas/${consulta.id}/avaliar`, { pontuacao, comentario }),
    'Avaliação registada. Obrigado!'
  );

  const podeConfirmar = consulta.estado === 'pendente';
  const podeCancelar = ['pendente', 'confirmada'].includes(consulta.estado);
  const podeReagendar = ['pendente', 'confirmada'].includes(consulta.estado);
  const podeRealizar = consulta.estado === 'confirmada' && perfil !== 'paciente';
  const podeAvaliar = consulta.estado === 'realizada' && perfil === 'paciente' && !consulta.avaliacao_pontuacao;

  return (
    <>
      <div className="row wrap" style={{ gap: 8 }}>
        {podeConfirmar && (
          <button className="btn primary sm" onClick={confirmar} disabled={aProcessar}>✓ Confirmar</button>
        )}
        {podeReagendar && (
          <button className="btn sm" onClick={() => setModal('reagendar')}>↻ Reagendar</button>
        )}
        {podeRealizar && (
          <button className="btn sm" onClick={realizar} disabled={aProcessar}>✓ Realizada</button>
        )}
        {podeAvaliar && (
          <button className="btn accent sm" onClick={() => setModal('avaliar')}>★ Avaliar</button>
        )}
        {podeCancelar && (
          <button className="btn danger sm" onClick={() => setModal('cancelar')}>✕ Cancelar</button>
        )}
        {!podeConfirmar && !podeReagendar && !podeRealizar && !podeAvaliar && !podeCancelar && (
          <span className="tiny muted">Sem ações disponíveis neste estado.</span>
        )}
      </div>

      {detalhado && podeCancelar && tardio && (
        <div className="alert warn mt-sm">
          Faltam menos de 24 horas. Se cancelar agora, o cancelamento será registado como tardio (RN-02).
        </div>
      )}

      {modal === 'cancelar' && (
        <Modal titulo="Cancelar consulta" subtitulo={`${consulta.especialidade_nome} · ${formatarDataHora(consulta.data_hora)}`}
          onFechar={() => setModal(null)}>
          {tardio && (
            <div className="alert warn" style={{ marginBottom: 12 }}>
              Este cancelamento tem menos de 24h de antecedência e será marcado como tardio (RN-02).
            </div>
          )}
          <Campo label="Motivo (opcional)">
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: imprevisto pessoal" />
          </Campo>
          <div className="row between mt">
            <button className="btn ghost" onClick={() => setModal(null)}>Voltar</button>
            <button className="btn danger" onClick={cancelar} disabled={aProcessar}>
              {aProcessar ? 'A cancelar…' : 'Confirmar cancelamento'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'reagendar' && (
        <Modal titulo="Reagendar consulta" subtitulo="A consulta volta a pendente e exige nova confirmação (RN-07)."
          onFechar={() => setModal(null)}>
          <Campo label="Nova data e hora">
            <input type="datetime-local" value={novaData} min={paraInputLocal(new Date().toISOString())}
              onChange={(e) => setNovaData(e.target.value)} />
          </Campo>
          <Campo label="Motivo (opcional)">
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Campo>
          <div className="row between mt">
            <button className="btn ghost" onClick={() => setModal(null)}>Voltar</button>
            <button className="btn primary" onClick={reagendar} disabled={aProcessar || !novaData}>
              {aProcessar ? 'A reagendar…' : 'Guardar nova data'}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'avaliar' && (
        <Modal titulo="Avaliar consulta" subtitulo={`${consulta.medico_nome} · ${consulta.especialidade_nome}`}
          onFechar={() => setModal(null)}>
          <Campo label="Pontuação">
            <div className="row" style={{ gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className="btn ghost" style={{ fontSize: '1.5rem', padding: '2px 6px' }}
                  onClick={() => setPontuacao(n)} aria-label={`${n} estrelas`}>
                  {n <= pontuacao ? '★' : '☆'}
                </button>
              ))}
              <span className="muted tiny">{pontuacao}/5</span>
            </div>
          </Campo>
          <Campo label="Comentário (opcional)">
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)}
              placeholder="Como foi o atendimento?" />
          </Campo>
          <div className="row between mt">
            <button className="btn ghost" onClick={() => setModal(null)}>Voltar</button>
            <button className="btn primary" onClick={avaliar} disabled={aProcessar}>Enviar avaliação</button>
          </div>
        </Modal>
      )}
    </>
  );
}
