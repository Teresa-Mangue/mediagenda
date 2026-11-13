import { ErroNaoEncontrado, ErroProibido, ErroNegocio, ErroValidacao } from '../utils/erros.js';
import { tokenAleatorio } from '../utils/security.js';
import { CancelarConsultaCommand, ReagendarConsultaCommand } from '../commands/consultaCommands.js';

/**
 * Façade — o frontend faz uma única chamada para marcar, cancelar ou
 * reagendar. Toda a sequência (validação, persistência, evento e
 * auditoria) fica escondida atrás deste ponto de entrada.
 */
export class AgendamentoFacade {
  constructor({
    consultaRepository, pacienteRepository, medicoRepository, eventoBus,
    auditoriaService, cadeia, duracaoStrategy, traceRepository, configuracao
  }) {
    this.consultaRepository = consultaRepository;
    this.pacienteRepository = pacienteRepository;
    this.medicoRepository = medicoRepository;
    this.eventoBus = eventoBus;
    this.auditoriaService = auditoriaService;
    this.cadeia = cadeia;
    this.duracaoStrategy = duracaoStrategy;
    this.traceRepository = traceRepository;
    this.configuracao = configuracao;
  }

  async marcar({ utilizador, pacienteId, medicoId, especialidadeId, dataHora, ip }) {
    const { paciente, medico, especialidade, data, duracaoMin, estrategia, validacao } =
      this.#preparar({ utilizador, pacienteId, medicoId, especialidadeId, dataHora });

    const traceId = this.traceRepository.criar({
      consultaId: null,
      resultado: validacao.ok ? 'aprovado' : 'rejeitado',
      detalhes: {
        passos: validacao.passos,
        rejeitado: validacao.mensagem || null,
        tipo: 'marcacao',
        pedido: {
          paciente: paciente.nome, medico: medico.nome, especialidade: especialidade.nome,
          dataHora: data.toISOString(), duracaoMin, estrategiaDuracao: estrategia
        }
      }
    });

    if (!validacao.ok) {
      throw new ErroValidacao(validacao.mensagem, {
        passos: validacao.passos,
        traceId,
        rejeitadoEm: validacao.falhouEm
      });
    }

    const prazoConfirmacao = new Date(Date.now() + this.configuracao.numero('confirmacao_prazo_horas') * 60 * 60 * 1000);
    const tokenConfirmacao = tokenAleatorio();
    const consultaId = this.consultaRepository.criar({
      pacienteId: paciente.id,
      medicoId: medico.id,
      especialidadeId: especialidade.id,
      dataHora: data.toISOString(),
      duracaoMin,
      estado: 'pendente',
      prazoConfirmacao: prazoConfirmacao.toISOString(),
      tokenConfirmacao,
      criadaPor: utilizador.id
    });
    this.consultaRepository.registarHistorico(
      consultaId, null, 'pendente',
      'Consulta criada e colocada em espera de confirmação (RN-07)', utilizador.id
    );

    this.traceRepository.criar({
      consultaId,
      resultado: 'aprovado',
      detalhes: {
        passos: validacao.passos,
        tipo: 'marcacao',
        pedido: {
          paciente: paciente.nome, medico: medico.nome, especialidade: especialidade.nome,
          dataHora: data.toISOString(), duracaoMin, estrategiaDuracao: estrategia
        },
        traceOrigem: traceId
      }
    });

    const consulta = this.consultaRepository.porId(consultaId);
    await this.eventoBus.publicar('ConsultaCriada', { consulta });

    this.auditoriaService.registar({
      utilizadorId: utilizador.id,
      acao: 'CONSULTA_CRIADA',
      entidade: 'consulta',
      entidadeId: consultaId,
      ip,
      detalhes: {
        facade: 'AgendamentoFacade.marcar',
        medico: medico.nome,
        especialidade: especialidade.nome,
        dataHora: data.toISOString(),
        validacoes: validacao.passos.map((p) => `${p.codigo}:${p.aprovado ? 'ok' : 'falhou'}`)
      }
    });

    return {
      consulta,
      validacao: { traceId, passos: validacao.passos, aprovado: true },
      prazoConfirmacao: prazoConfirmacao.toISOString()
    };
  }

  async cancelar({ utilizador, consultaId, motivo, ip }) {
    const comando = new CancelarConsultaCommand({
      consultaRepository: this.consultaRepository,
      pacienteRepository: this.pacienteRepository,
      eventoBus: this.eventoBus,
      auditoriaService: this.auditoriaService,
      configuracao: this.configuracao
    });
    return comando.executar({ utilizador, consultaId, motivo, ip });
  }

  async reagendar({ utilizador, consultaId, novaDataHora, motivo, ip }) {
    const comando = new ReagendarConsultaCommand({
      consultaRepository: this.consultaRepository,
      pacienteRepository: this.pacienteRepository,
      medicoRepository: this.medicoRepository,
      eventoBus: this.eventoBus,
      auditoriaService: this.auditoriaService,
      cadeia: this.cadeia,
      duracaoStrategy: this.duracaoStrategy,
      traceRepository: this.traceRepository
    });
    return comando.executar({ utilizador, consultaId, novaDataHora, motivo, ip });
  }

  /** Simulação para o Architecture Lab / X-Ray — não grava consulta. */
  simular({ utilizador, pacienteId, medicoId, especialidadeId, dataHora }) {
    const { paciente, medico, especialidade, data, duracaoMin, estrategia, validacao } =
      this.#preparar({ utilizador, pacienteId, medicoId, especialidadeId, dataHora });

    const pedido = {
      paciente: paciente.nome, medico: medico.nome, especialidade: especialidade.nome,
      dataHora: data.toISOString(), duracaoMin, estrategiaDuracao: estrategia
    };
    const traceId = this.traceRepository.criar({
      consultaId: null,
      resultado: validacao.ok ? 'aprovado' : 'rejeitado',
      detalhes: {
        passos: validacao.passos,
        rejeitado: validacao.mensagem || null,
        tipo: 'simulacao',
        pedido
      }
    });

    return {
      aprovado: validacao.ok,
      mensagem: validacao.ok ? 'Todas as regras foram aprovadas.' : validacao.mensagem,
      falhouEm: validacao.falhouEm ?? null,
      passos: validacao.passos,
      traceId,
      pedido
    };
  }

  #preparar({ utilizador, pacienteId, medicoId, especialidadeId, dataHora }) {
    const paciente = this.#resolverPaciente(utilizador, pacienteId);
    const medico = this.medicoRepository.porId(medicoId);
    if (!medico || !medico.ativo) throw new ErroNaoEncontrado('Médico não encontrado ou inactivo.');

    if (utilizador.perfil === 'medico' && medico.utilizador_id !== utilizador.id) {
      throw new ErroProibido('Só pode marcar na sua própria agenda.');
    }

    const especialidade = medico.especialidades.find((e) => Number(e.id) === Number(especialidadeId))
      || medico.especialidades[0];
    if (!especialidade) {
      throw new ErroNegocio('O médico não tem especialidades associadas.', { status: 400 });
    }

    const data = new Date(dataHora);
    if (Number.isNaN(data.getTime())) throw new ErroNegocio('Data/hora inválida.', { status: 400 });

    const { duracaoMin, estrategia } = this.duracaoStrategy.calcular(especialidade, medico);
    const validacao = this.cadeia.validar({
      paciente, medico, especialidade, dataHora: data, duracaoMin, agora: new Date()
    });

    return { paciente, medico, especialidade, data, duracaoMin, estrategia, validacao };
  }

  #resolverPaciente(utilizador, pacienteIdPedido) {
    if (utilizador.perfil === 'paciente') {
      const paciente = this.pacienteRepository.porUtilizador(utilizador.id);
      if (!paciente) throw new ErroNaoEncontrado('Perfil de paciente não encontrado.');
      return this.pacienteRepository.porId(paciente.id);
    }
    if (!pacienteIdPedido) throw new ErroNegocio('Indique o paciente para esta marcação.', { status: 400 });
    const paciente = this.pacienteRepository.porId(pacienteIdPedido);
    if (!paciente) throw new ErroNaoEncontrado('Paciente não encontrado.');
    return paciente;
  }
}
