import { formatarDataHora } from '../utils/tempo.js';
import { obterEstrategiaNotificacao } from '../domain/notificacao/estrategias.js';

const TITULOS = {
  ConsultaCriada: 'Consulta marcada',
  ConsultaConfirmada: 'Consulta confirmada',
  ConsultaCancelada: 'Consulta cancelada',
  ConsultaReagendada: 'Consulta reagendada',
  ConsultaLembrete: 'Lembrete de consulta',
  Lembrete24h: 'Lembrete de consulta (24h)',
  Lembrete1h: 'Lembrete de consulta (1h)',
  ConsultaExpirada: 'Confirmação expirada',
  ConsultaRealizada: 'Consulta realizada'
};

function linkConfirmacao(c) {
  if (!c.token_confirmacao) return null;
  const base = (process.env.MEDIAGENDA_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/confirmar-consulta?id=${c.id}&token=${c.token_confirmacao}`;
}

/**
 * Consumidor de eventos responsável pelas notificações.
 * Usa Strategy (canal), Factory Method (classe concreta) e Adapter (fornecedor).
 */
export class NotificacaoService {
  constructor({ notificacaoRepository, factory }) {
    this.notificacaoRepository = notificacaoRepository;
    this.factory = factory;
  }

  async aoEvento(tipo, consulta) {
    if (!consulta) return [];
    const assunto = `${TITULOS[tipo] || 'MediAgenda'} — ${consulta.especialidade_nome}`;
    const corpo = this.#corpo(tipo, consulta);

    const destinatarios = [
      {
        utilizador: {
          id: consulta.paciente_utilizador_id,
          nome: consulta.paciente_nome,
          email: consulta.paciente_email,
          telefone: consulta.paciente_telefone,
          preferencia: consulta.preferencia_notificacao
        },
        papel: 'paciente',
        assunto,
        corpo
      },
      {
        utilizador: {
          id: consulta.medico_utilizador_id,
          nome: consulta.medico_nome,
          email: consulta.medico_email,
          telefone: null,
          preferencia: consulta.medico_preferencia || 'email'
        },
        papel: 'medico',
        assunto: `${assunto} (${consulta.paciente_nome})`,
        corpo
      }
    ];

    const enviadas = [];
    for (const destinatario of destinatarios) {
      enviadas.push(...await this.enviarPara(destinatario.utilizador, {
        consultaId: consulta.id,
        evento: tipo,
        assunto: destinatario.assunto,
        corpo: destinatario.corpo
      }));
    }
    return enviadas;
  }

  async enviarPara(utilizador, { consultaId, evento, assunto, corpo }) {
    if (!utilizador?.id) return [];

    const estrategia = obterEstrategiaNotificacao(utilizador.preferencia);
    let canais = estrategia.canais();
    if (canais.includes('sms') && !utilizador.telefone) {
      canais = canais.filter((c) => c !== 'sms');
    }
    if (canais.includes('whatsapp') && !utilizador.telefone) {
      canais = canais.filter((c) => c !== 'whatsapp');
    }
    if (canais.includes('email') && !utilizador.email) {
      canais = canais.filter((c) => c !== 'email');
    }
    if (!canais.length) canais = ['email'];

    const resultados = [];
    for (const canal of canais) {
      let estado = 'enviada';
      let detalhe = null;
      try {
        const notificacao = this.factory.criar(canal);
        const resultado = await notificacao.enviar({
          para: canal === 'sms' || canal === 'whatsapp' ? utilizador.telefone : utilizador.email,
          assunto,
          corpo
        });
        detalhe = resultado?.provedor
          ? `${resultado.provedor}${resultado.ficheiro ? ` — ${resultado.ficheiro}` : ''}`
          : null;
      } catch (erro) {
        estado = 'erro';
        detalhe = erro.message;
      }
      const id = this.notificacaoRepository.criar({
        utilizadorId: utilizador.id,
        consultaId,
        canal,
        evento,
        assunto,
        corpo,
        estado
      });
      resultados.push({ id, canal, estado, detalhe });
    }
    return resultados;
  }

  #corpo(tipo, c) {
    const quando = formatarDataHora(c.data_hora);
    const medico = `Dr(a). ${c.medico_nome}`;
    const paciente = c.paciente_nome;
    const link = linkConfirmacao(c);
    const confirmar = link ? `\n\nConfirme a consulta neste link:\n${link}` : '';

    switch (tipo) {
      case 'ConsultaCriada':
        return `Olá ${paciente},\n\nA sua consulta de ${c.especialidade_nome} com ${medico} foi registada para ${quando} (${c.duracao_min} min).\n\nEstado: PENDENTE. Confirme a marcação no prazo de 2 horas; caso contrário a vaga é libertada automaticamente (RN-07).${confirmar}\n\nMediAgenda`;
      case 'ConsultaConfirmada':
        return `A consulta de ${paciente} com ${medico} em ${quando} foi confirmada.\n\nEstado: CONFIRMADA.`;
      case 'ConsultaCancelada':
        return `A consulta de ${paciente} com ${medico} marcada para ${quando} foi cancelada.${c.motivo_cancelamento ? `\nMotivo: ${c.motivo_cancelamento}` : ''}${c.cancelamento_tardio ? '\nCancelamento tardio registado no perfil (RN-02).' : ''}`;
      case 'ConsultaReagendada':
        return `A consulta de ${paciente} com ${medico} foi reagendada para ${quando}.\n\nEstado: PENDENTE — é necessário confirmar novamente no prazo de 2 horas (RN-07).${confirmar}`;
      case 'ConsultaLembrete':
      case 'Lembrete24h':
      case 'Lembrete1h':
        return `Lembrete: a sua consulta de ${c.especialidade_nome} com ${medico} é em ${quando} (${c.duracao_min} min).${confirmar}\n\nMediAgenda`;
      case 'ConsultaExpirada':
        return `A confirmação da consulta de ${paciente} com ${medico} para ${quando} não foi feita em 2 horas (RN-07). A vaga foi libertada automaticamente.`;
      case 'ConsultaRealizada':
        return `A consulta de ${paciente} com ${medico} em ${quando} foi realizada.\n\nJá pode avaliar o atendimento na aplicação (1 a 5 estrelas).`;
      default:
        return `Atualização da consulta de ${paciente} com ${medico} em ${quando}.`;
    }
  }
}
