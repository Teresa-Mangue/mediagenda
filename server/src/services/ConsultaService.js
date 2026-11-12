import { criarEstado } from '../domain/consulta/estados.js';
import { ErroNaoEncontrado, ErroProibido, ErroNegocio } from '../utils/erros.js';
import { adicionarHoras } from '../utils/tempo.js';

export class ConsultaService {
  constructor({ consultaRepository, medicoRepository, eventoBus, auditoriaService }) {
    this.consultaRepository = consultaRepository;
    this.medicoRepository = medicoRepository;
    this.eventoBus = eventoBus;
    this.auditoriaService = auditoriaService;
  }

  obter(id) {
    const consulta = this.consultaRepository.porId(id);
    if (!consulta) throw new ErroNaoEncontrado('Consulta não encontrada.');
    return consulta;
  }

  obterComPermissao(utilizador, id) {
    const consulta = this.obter(id);
    this.#garantirAcesso(utilizador, consulta);
    return consulta;
  }

  listarMinhas(utilizador, filtros = {}) {
    if (utilizador.perfil === 'paciente') {
      return this.consultaRepository.listarPorPaciente(utilizador.pacienteId, filtros);
    }
    if (utilizador.perfil === 'medico') {
      return this.consultaRepository.listarPorMedico(utilizador.medicoId, filtros);
    }
    return this.consultaRepository.listarTodas(filtros);
  }

  historico(utilizador, id) {
    const consulta = this.obterComPermissao(utilizador, id);
    return {
      consulta,
      historico: this.consultaRepository.historico(consulta.id),
      transicoesPermitidas: criarEstado(consulta.estado).transicoes
    };
  }

  async confirmar(utilizador, id) {
    const consulta = this.obterComPermissao(utilizador, id);
    if (utilizador.perfil === 'medico' && consulta.medico_utilizador_id !== utilizador.id) {
      throw new ErroProibido();
    }

    const estado = criarEstado(consulta.estado);
    const transicao = estado.confirmar(consulta, new Date());

    this.consultaRepository.atualizar(consulta.id, {
      estado: transicao.estado,
      confirmada_em: transicao.confirmada_em
    });
    this.consultaRepository.registarHistorico(
      consulta.id, consulta.estado, transicao.estado, transicao.motivo, utilizador.id
    );

    const atualizada = this.consultaRepository.porId(consulta.id);
    await this.eventoBus.publicar('ConsultaConfirmada', { consulta: atualizada });
    this.auditoriaService.registar({
      utilizadorId: utilizador.id, acao: 'CONSULTA_CONFIRMADA', entidade: 'consulta',
      entidadeId: consulta.id, detalhes: { estadoAnterior: consulta.estado }
    });
    return atualizada;
  }

  async realizar(utilizador, id) {
    const consulta = this.obterComPermissao(utilizador, id);
    const estado = criarEstado(consulta.estado);
    const transicao = estado.realizar(consulta, new Date());
    this.consultaRepository.atualizar(consulta.id, { estado: transicao.estado });
    this.consultaRepository.registarHistorico(consulta.id, consulta.estado, transicao.estado, transicao.motivo, utilizador.id);

    const atualizada = this.consultaRepository.porId(consulta.id);
    await this.eventoBus.publicar('ConsultaRealizada', { consulta: atualizada });
    this.auditoriaService.registar({
      utilizadorId: utilizador.id, acao: 'CONSULTA_REALIZADA', entidade: 'consulta', entidadeId: consulta.id
    });
    return atualizada;
  }

  /** RN-07 — liberta vagas cujo prazo de confirmação expirou. */
  async expirarPendentes() {
    const expiradas = this.consultaRepository.pendentesExpiradas();
    const processadas = [];
    for (const consulta of expiradas) {
      this.consultaRepository.atualizar(consulta.id, {
        estado: 'cancelada',
        motivo_cancelamento: 'Confirmação não recebida em 2 horas (RN-07)'
      });
      this.consultaRepository.registarHistorico(
        consulta.id, 'pendente', 'cancelada', 'Expiração automática do prazo de confirmação (RN-07)', null
      );
      const atualizada = this.consultaRepository.porId(consulta.id);
      await this.eventoBus.publicar('ConsultaExpirada', { consulta: atualizada });
      this.auditoriaService.registar({
        utilizadorId: null, acao: 'CONSULTA_EXPIRADA', entidade: 'consulta', entidadeId: consulta.id,
        detalhes: { motivo: 'RN-07', prazo: consulta.prazo_confirmacao }
      });
      processadas.push(atualizada);
    }
    return processadas;
  }

  /** RF-06 — lembretes de 24h e 1h antes. */
  async enviarLembretes() {
    const agora = new Date();
    const janelas = [
      { evento: 'Lembrete24h', inicio: adicionarHoras(agora, 23.5), fim: adicionarHoras(agora, 24.5) },
      { evento: 'Lembrete1h', inicio: adicionarHoras(agora, 0.5), fim: adicionarHoras(agora, 1.5) }
    ];
    const enviados = [];
    for (const janela of janelas) {
      const consultas = this.consultaRepository.proximasParaLembrete(
        janela.inicio.toISOString(), janela.fim.toISOString()
      );
      for (const consulta of consultas) {
        const completo = this.consultaRepository.porId(consulta.id);
        const jaEnviado = this.consultaRepository.lembreteJaEnviado(consulta.id, janela.evento);
        if (jaEnviado) continue;
        await this.eventoBus.publicar(janela.evento, {
          consulta: completo,
          janela: janela.evento
        });
        enviados.push(consulta.id);
      }
    }
    return enviados;
  }

  #garantirAcesso(utilizador, consulta) {
    if (utilizador.perfil === 'paciente' && consulta.paciente_utilizador_id !== utilizador.id) {
      throw new ErroProibido('Só pode aceder às suas próprias consultas.');
    }
    if (utilizador.perfil === 'medico' && consulta.medico_utilizador_id !== utilizador.id) {
      throw new ErroProibido('Só pode aceder às consultas da sua agenda.');
    }
  }
}
