import { criarEstado } from '../domain/consulta/estados.js';
import { ErroNaoEncontrado, ErroProibido, ErroNegocio } from '../utils/erros.js';

/**
 * Command — cada operação crítica é um objecto que sabe descrever-se
 * para efeitos de auditoria. Se a operação não passar pelo Command,
 * não é executada.
 */
export class Command {
  constructor(dependencias = {}) {
    this.deps = dependencias;
  }

  executar() {
    throw new Error('Command.executar() não implementado.');
  }

  descricao() {
    return this.constructor.name;
  }
}

export class CancelarConsultaCommand extends Command {
  constructor(deps) {
    super(deps);
  }

  descricao() {
    return 'Cancelamento de consulta';
  }

  async executar({ utilizador, consultaId, motivo, ip }) {
    const { consultaRepository, pacienteRepository, eventoBus, auditoriaService, configuracao } = this.deps;
    const consulta = consultaRepository.porId(consultaId);
    if (!consulta) throw new ErroNaoEncontrado('Consulta não encontrada.');

    const dono = consulta.paciente_utilizador_id === utilizador.id;
    const medicoDono = consulta.medico_utilizador_id === utilizador.id;
    if (utilizador.perfil === 'paciente' && !dono) throw new ErroProibido();
    if (utilizador.perfil === 'medico' && !medicoDono) throw new ErroProibido();

    const estado = criarEstado(consulta.estado);
    const transicao = estado.cancelar(consulta, {
      agora: new Date(),
      motivo: motivo || null,
      limiteHoras: configuracao.numero('cancelamento_limite_horas')
    });

    consultaRepository.atualizar(consulta.id, {
      estado: transicao.estado,
      motivo_cancelamento: transicao.motivo_cancelamento,
      cancelamento_tardio: transicao.cancelamento_tardio
    });
    consultaRepository.registarHistorico(
      consulta.id, consulta.estado, transicao.estado, transicao.motivo, utilizador.id
    );
    if (transicao.cancelamento_tardio) {
      pacienteRepository.incrementarCancelamentoTardio(consulta.paciente_id);
    }

    const atualizada = consultaRepository.porId(consulta.id);
    await eventoBus.publicar('ConsultaCancelada', { consulta: atualizada, motivo: motivo || null });

    auditoriaService.registar({
      utilizadorId: utilizador.id,
      acao: 'CONSULTA_CANCELADA',
      entidade: 'consulta',
      entidadeId: consulta.id,
      ip,
      detalhes: {
        comando: 'CancelarConsultaCommand',
        motivo: motivo || null,
        tardio: Boolean(transicao.cancelamento_tardio),
        estadoAnterior: consulta.estado,
        descricao: this.descricao()
      }
    });

    return { consulta: atualizada, tardio: Boolean(transicao.cancelamento_tardio) };
  }
}

export class ReagendarConsultaCommand extends Command {
  constructor(deps) {
    super(deps);
  }

  descricao() {
    return 'Reagendamento de consulta';
  }

  async executar({ utilizador, consultaId, novaDataHora, motivo, ip }) {
    const {
      consultaRepository, pacienteRepository, medicoRepository, eventoBus,
      auditoriaService, cadeia, duracaoStrategy, traceRepository
    } = this.deps;

    const consulta = consultaRepository.porId(consultaId);
    if (!consulta) throw new ErroNaoEncontrado('Consulta não encontrada.');
    if (utilizador.perfil === 'paciente' && consulta.paciente_utilizador_id !== utilizador.id) {
      throw new ErroProibido();
    }
    if (utilizador.perfil === 'medico' && consulta.medico_utilizador_id !== utilizador.id) {
      throw new ErroProibido();
    }
    if (['realizada', 'cancelada'].includes(consulta.estado)) {
      throw new ErroNegocio('Uma consulta realizada ou cancelada não pode ser reagendada.', {
        status: 409, codigo: 'TRANSICAO_INVALIDA'
      });
    }

    const dataHora = new Date(novaDataHora);
    if (Number.isNaN(dataHora.getTime())) throw new ErroNegocio('Data/hora inválida.', { status: 400 });

    const medico = medicoRepository.porId(consulta.medico_id);
    const paciente = pacienteRepository.porId(consulta.paciente_id);
    const especialidade = medico.especialidades.find((e) => e.id === consulta.especialidade_id);
    const { duracaoMin } = duracaoStrategy.calcular(especialidade, medico);

    const validacao = cadeia.validar({
      paciente, medico, especialidade, dataHora, duracaoMin,
      agora: new Date(), consultaIdExcluir: consulta.id
    });
    const traceId = traceRepository.criar({
      consultaId: consulta.id,
      resultado: validacao.ok ? 'aprovado' : 'rejeitado',
      detalhes: { passos: validacao.passos, rejeitado: validacao.mensagem || null, tipo: 'reagendamento' }
    });
    if (!validacao.ok) {
      throw Object.assign(
        new ErroNegocio(validacao.mensagem, {
          status: 422, codigo: 'VALIDACAO_FALHOU',
          detalhes: { passos: validacao.passos, traceId }
        })
      );
    }

    consultaRepository.atualizar(consulta.id, {
      data_hora: dataHora.toISOString(),
      duracao_min: duracaoMin,
      estado: 'pendente',
      confirmada_em: null,
      prazo_confirmacao: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    });
    consultaRepository.registarHistorico(
      consulta.id, consulta.estado, 'pendente',
      `Reagendada${motivo ? `: ${motivo}` : ''} — nova confirmação necessária (RN-07)`, utilizador.id
    );

    const atualizada = consultaRepository.porId(consulta.id);
    await eventoBus.publicar('ConsultaReagendada', { consulta: atualizada, motivo: motivo || null });
    auditoriaService.registar({
      utilizadorId: utilizador.id, acao: 'CONSULTA_REAGENDADA', entidade: 'consulta',
      entidadeId: consulta.id, ip,
      detalhes: {
        comando: 'ReagendarConsultaCommand',
        de: consulta.data_hora,
        para: dataHora.toISOString(),
        motivo: motivo || null,
        traceId,
        descricao: this.descricao()
      }
    });

    return { consulta: atualizada, validacao, traceId };
  }
}
