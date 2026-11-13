import { ErroNaoEncontrado, ErroNegocio } from '../utils/erros.js';
import { configuracao } from '../config/ConfiguracaoSistema.js';
import {
  adicionarMinutos, chaveData, combinarDataHora, diaSemanaLocal,
  horaDeMinutos, minutosDeHora, inicioDoDia, fimDoDia
} from '../utils/tempo.js';

export class MedicoService {
  constructor({ medicoRepository, consultaRepository, pacienteRepository, utilizadorRepository, agendamentoFacade, configuracao: config = configuracao }) {
    this.medicoRepository = medicoRepository;
    this.consultaRepository = consultaRepository;
    this.pacienteRepository = pacienteRepository;
    this.utilizadorRepository = utilizadorRepository;
    this.agendamentoFacade = agendamentoFacade;
    this.configuracao = config;
  }

  listar(filtros) {
    return this.medicoRepository.listar(filtros);
  }

  detalhe(id) {
    const medico = this.medicoRepository.porId(id);
    if (!medico) throw new ErroNaoEncontrado('Médico não encontrado.');
    return medico;
  }

  /**
   * Gera os horários de um dia a partir da disponibilidade semanal,
   * removendo bloqueios, consultas existentes e horários já passados.
   */
  disponibilidadeDoDia(medicoId, dataIso) {
    const medico = this.detalhe(medicoId);
    const dia = combinarDataHora(dataIso, '00:00');
    if (Number.isNaN(dia.getTime())) throw new ErroNegocio('Data inválida.', { status: 400 });

    const diaSemana = diaSemanaLocal(dia);
    const diasFuncionamento = this.configuracao.lista('dias_funcionamento');
    const abertura = minutosDeHora(this.configuracao.obter('horario_inicio'));
    const fecho = minutosDeHora(this.configuracao.obter('horario_fim'));
    const antecedenciaMs = this.configuracao.numero('antecedencia_minima_horas') * 60 * 60 * 1000;
    const duracao = Number(medico.duracao_consulta_min) || 60;

    if (!diasFuncionamento.includes(diaSemana)) return [];

    const janelas = this.medicoRepository.disponibilidades(medicoId)
      .filter((d) => Number(d.dia_semana) === diaSemana);
    const ocupadas = this.consultaRepository
      .listarPorMedico(medicoId, {
        desde: inicioDoDia(dia).toISOString(),
        ate: fimDoDia(dia).toISOString()
      })
      .filter((c) => ['pendente', 'confirmada', 'realizada'].includes(c.estado));

    const bloqueios = this.medicoRepository.bloqueios(medicoId);
    const slots = [];

    for (const janela of janelas) {
      const inicio = Math.max(minutosDeHora(janela.hora_inicio), abertura);
      const fim = Math.min(minutosDeHora(janela.hora_fim), fecho);
      for (let minuto = inicio; minuto + duracao <= fim; minuto += duracao) {
        const inicioSlot = combinarDataHora(dataIso, horaDeMinutos(minuto));
        const fimSlot = adicionarMinutos(inicioSlot, duracao);
        const isoInicio = inicioSlot.toISOString();
        const isoFim = fimSlot.toISOString();

        let motivo = null;
        if (inicioSlot.getTime() <= Date.now()) motivo = 'passado';
        else if (inicioSlot.getTime() < Date.now() + antecedenciaMs) motivo = 'antecedencia';
        else if (bloqueios.some((b) => b.inicio < isoFim && b.fim > isoInicio)) motivo = 'bloqueio';
        else if (ocupadas.some((c) => {
          const inicioConsulta = new Date(c.data_hora).getTime();
          const fimConsulta = inicioConsulta + c.duracao_min * 60000;
          return inicioConsulta < fimSlot.getTime() && fimConsulta > inicioSlot.getTime();
        })) motivo = 'ocupado';

        slots.push({
          hora: horaDeMinutos(minuto),
          dataHora: isoInicio,
          disponivel: !motivo,
          motivo
        });
      }
    }
    return slots;
  }

  proximosDias(medicoId, quantidade = 7) {
    const dias = [];
    const hoje = new Date();
    for (let i = 0; i < quantidade; i++) {
      const dia = adicionarMinutos(inicioDoDia(hoje), i * 24 * 60);
      const slots = this.disponibilidadeDoDia(medicoId, chaveData(dia));
      dias.push({
        data: chaveData(dia),
        diaSemana: diaSemanaLocal(dia),
        total: slots.length,
        disponiveis: slots.filter((s) => s.disponivel).length
      });
    }
    return dias;
  }

  definirDisponibilidades(medicoId, lista = []) {
    this.detalhe(medicoId);
    for (const d of lista) {
      if (!d.horaInicio || !d.horaFim || !d.diaSemana) {
        throw new ErroNegocio('Cada disponibilidade precisa de diaSemana, horaInicio e horaFim.', { status: 400 });
      }
    }
    const existentes = this.medicoRepository.disponibilidades(medicoId);
    for (const e of existentes) this.medicoRepository.removerDisponibilidade(medicoId, e.id);
    for (const d of lista) {
      this.medicoRepository.criarDisponibilidade(medicoId, d.diaSemana, d.horaInicio, d.horaFim);
    }
    return this.medicoRepository.disponibilidades(medicoId);
  }

  criarBloqueio(medicoId, { inicio, fim, motivo }) {
    this.detalhe(medicoId);
    if (!inicio || !fim) throw new ErroNegocio('Início e fim do bloqueio são obrigatórios.', { status: 400 });
    const id = this.medicoRepository.criarBloqueio(medicoId, new Date(inicio).toISOString(), new Date(fim).toISOString(), motivo);
    return { id, mensagem: 'Bloqueio criado.' };
  }

  removerBloqueio(medicoId, id) {
    this.medicoRepository.removerBloqueio(medicoId, id);
    return { mensagem: 'Bloqueio removido.' };
  }

  agenda(medicoId, { desde, ate } = {}) {
    this.detalhe(medicoId);
    return this.consultaRepository.listarPorMedico(medicoId, { desde, ate });
  }

  pacientes(medicoId) {
    return this.medicoRepository.pacientes(medicoId);
  }

  /** RN-08 — desactivar médico cancela todas as consultas futuras e notifica. */
  async desactivar(medicoId, utilizadorAdmin) {
    const medico = this.detalhe(medicoId);
    const futuras = this.consultaRepository.confirmadasFuturas(medicoId);
    const canceladas = [];
    // O administrador não tem permissão operacional para cancelar consultas;
    // a RN-08 é executada pelo próprio sistema, não por uma pessoa.
    const sistema = { id: null, nome: 'Sistema MediAgenda', perfil: 'sistema' };
    for (const consulta of futuras) {
      const resultado = await this.agendamentoFacade.cancelar({
        utilizador: sistema,
        consultaId: consulta.id,
        motivo: 'Médico desactivado — consultas canceladas automaticamente (RN-08)'
      });
      canceladas.push(resultado.consulta.id);
    }
    this.medicoRepository.definirAtivo(medicoId, 0);
    this.utilizadorRepository.atualizar(medico.utilizador_id, { ativo: 0 });
    this.auditoriaService?.registar?.({
      utilizadorId: utilizadorAdmin?.id ?? null,
      acao: 'MEDICO_DESATIVADO_SISTEMA',
      entidade: 'medico',
      entidadeId: Number(medicoId),
      detalhes: { consultasCanceladas: canceladas.length, origem: 'RN-08' }
    });
    return { medicoId, consultasCanceladas: canceladas.length, ids: canceladas };
  }
}
