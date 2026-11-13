import { hashPassword, verificarPassword, criarToken, tokenAleatorio } from '../utils/security.js';
import { ErroAutenticacao, ErroNaoEncontrado, ErroNegocio, ErroProibido, ErroValidacao } from '../utils/erros.js';
import { configuracao } from '../config/ConfiguracaoSistema.js';

/** URL público da aplicação, usado nos links enviados por e-mail. */
function urlAplicacao() {
  return (process.env.MEDIAGENDA_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

/**
 * Autenticação e gestão de contas.
 *
 * Regras de aprovação (pedido do docente):
 *  - médico  → conta pendente até a SECRETÁRIA (ou o admin) aprovar;
 *  - secretária → conta pendente até o ADMINISTRADOR aprovar;
 *  - paciente → conta activa de imediato.
 *
 * A confirmação de e-mail é real: com SMTP configurado a mensagem sai pela
 * rede; sem SMTP fica na outbox (modo demonstração).
 */
export class AuthService {
  constructor({
    utilizadorRepository, pacienteRepository, medicoRepository,
    especialidadeRepository, auditoriaService, notificacaoService
  }) {
    this.utilizadorRepository = utilizadorRepository;
    this.pacienteRepository = pacienteRepository;
    this.medicoRepository = medicoRepository;
    this.especialidadeRepository = especialidadeRepository;
    this.auditoriaService = auditoriaService;
    this.notificacaoService = notificacaoService;
  }

  async registar({
    nome, email, password, perfil = 'paciente', telefone, dataNascimento, endereco,
    numeroRegisto, localizacao, especialidades, aprovadoPor = null
  }) {
    if (!nome || !email || !password) {
      throw new ErroValidacao('Nome, e-mail e palavra-passe são obrigatórios.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ErroValidacao('E-mail inválido.');
    }
    if (String(password).length < 6) {
      throw new ErroValidacao('A palavra-passe deve ter pelo menos 6 caracteres.');
    }
    if (!['paciente', 'medico', 'secretario'].includes(perfil)) {
      throw new ErroValidacao('Perfil inválido. Use paciente, medico ou secretario.');
    }
    if (this.utilizadorRepository.porEmail(email)) {
      throw new ErroNegocio('Já existe uma conta com este e-mail.', { status: 409, codigo: 'EMAIL_DUPLICADO' });
    }

    // Quem cria directamente (admin/secretária) já aprova a conta.
    const aprovacaoAutomatica = Boolean(aprovadoPor);
    const estadoAprovacao = perfil === 'paciente' || aprovacaoAutomatica ? 'aprovada' : 'pendente';
    const ativo = estadoAprovacao === 'aprovada';

    const tokenConfirmacao = tokenAleatorio();
    const utilizadorId = this.utilizadorRepository.criar({
      nome,
      email,
      passwordHash: hashPassword(password),
      perfil,
      telefone,
      emailConfirmado: 0,
      tokenConfirmacao,
      estadoAprovacao,
      ativo,
      aprovadoPor: aprovacaoAutomatica ? aprovadoPor.id ?? null : null,
      aprovadoEm: aprovacaoAutomatica ? new Date().toISOString() : null
    });

    if (perfil === 'paciente') {
      this.pacienteRepository.criar({
        utilizadorId,
        dataNascimento: dataNascimento ?? null,
        endereco: endereco ?? null
      });
    } else if (perfil === 'medico') {
      if (!numeroRegisto) {
        throw new ErroValidacao('O número de registo é obrigatório para médicos.');
      }
      this.medicoRepository.criar({
        utilizadorId,
        numeroRegisto,
        localizacao: localizacao ?? 'Clínica MediAgenda — Maputo',
        especialidades: this.#resolverEspecialidades(especialidades),
        ativo: ativo ? 1 : 0
      });
    }

    const link = `${urlAplicacao()}/confirmar-email?token=${tokenConfirmacao}`;
    await this.notificacaoService.enviarPara(
      { id: utilizadorId, nome, email, telefone, preferencia: 'email' },
      {
        consultaId: null,
        evento: 'RegistoUtilizador',
        assunto: 'Bem-vindo ao MediAgenda — confirme o seu e-mail',
        corpo: `Olá ${nome},\n\nA sua conta foi criada com o perfil "${perfil}".\n`
          + `Confirme o e-mail através deste link:\n${link}\n\n`
          + (estadoAprovacao === 'pendente'
            ? `O cadastro está PENDENTE de aprovação. Receberá uma mensagem quando for autorizado.\n\n`
            : '')
          + 'MediAgenda'
      }
    );

    if (estadoAprovacao === 'pendente') {
      await this.#notificarAprovadores(perfil, nome, email);
    }

    this.auditoriaService.registar({
      utilizadorId: aprovadoPor?.id ?? utilizadorId,
      acao: 'REGISTO',
      entidade: 'utilizador',
      entidadeId: utilizadorId,
      detalhes: { perfil, email, estadoAprovacao, criadoPor: aprovadoPor?.email ?? null }
    });

    return {
      utilizador: this.utilizadorRepository.porId(utilizadorId),
      tokenConfirmacao,
      estadoAprovacao,
      linkConfirmacao: `/confirmar-email?token=${tokenConfirmacao}`
    };
  }

  login({ email, password, ip }) {
    const utilizador = this.utilizadorRepository.porEmail(email);
    if (!utilizador) throw new ErroAutenticacao('E-mail ou palavra-passe incorretos.');

    if (utilizador.bloqueado_ate && new Date(utilizador.bloqueado_ate) > new Date()) {
      throw new ErroNegocio('Conta temporariamente bloqueada por tentativas falhadas. Tente mais tarde.', {
        status: 423, codigo: 'CONTA_BLOQUEADA'
      });
    }
    if (!verificarPassword(password, utilizador.password_hash)) {
      const tentativas = Number(utilizador.tentativas_falhadas) + 1;
      const limite = configuracao.numero('limite_tentativas_login');
      const campos = { tentativas_falhadas: tentativas };
      if (tentativas >= limite) {
        campos.bloqueado_ate = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        campos.tentativas_falhadas = 0;
      }
      this.utilizadorRepository.atualizar(utilizador.id, campos);
      this.auditoriaService.registar({
        utilizadorId: utilizador.id, acao: 'LOGIN_FALHADO', entidade: 'utilizador',
        entidadeId: utilizador.id, detalhes: { tentativas }, ip
      });
      throw new ErroAutenticacao('E-mail ou palavra-passe incorretos.');
    }

    // A palavra-passe está correcta: só agora se revela o estado da conta.
    if (utilizador.estado_aprovacao === 'pendente') {
      throw new ErroNegocio(
        utilizador.perfil === 'medico'
          ? 'Cadastro pendente. A secretária ainda não confirmou o seu registo.'
          : 'Cadastro pendente. O administrador ainda não autorizou a sua conta.',
        { status: 403, codigo: 'APROVACAO_PENDENTE' }
      );
    }
    if (utilizador.estado_aprovacao === 'recusada') {
      throw new ErroNegocio('O seu cadastro foi recusado. Contacte a administração.', {
        status: 403, codigo: 'APROVACAO_RECUSADA'
      });
    }
    if (!utilizador.ativo) {
      throw new ErroNegocio('Conta desactivada. Contacte o administrador.', { status: 403, codigo: 'CONTA_INATIVA' });
    }

    this.utilizadorRepository.atualizar(utilizador.id, { tentativas_falhadas: 0, bloqueado_ate: null });

    let medicoId = null;
    let pacienteId = null;
    if (utilizador.perfil === 'medico') medicoId = this.medicoRepository.porUtilizador(utilizador.id)?.id ?? null;
    if (utilizador.perfil === 'paciente') pacienteId = this.pacienteRepository.porUtilizador(utilizador.id)?.id ?? null;

    const token = criarToken({ sub: utilizador.id, nome: utilizador.nome, perfil: utilizador.perfil, medicoId, pacienteId });
    this.auditoriaService.registar({
      utilizadorId: utilizador.id, acao: 'LOGIN', entidade: 'utilizador',
      entidadeId: utilizador.id, ip
    });

    return {
      token,
      utilizador: {
        ...this.utilizadorRepository.porId(utilizador.id),
        medicoId,
        pacienteId
      }
    };
  }

  confirmarEmail(token) {
    const utilizador = this.utilizadorRepository.porTokenConfirmacao(token);
    if (!utilizador) throw new ErroNegocio('Token de confirmação inválido.', { status: 400, codigo: 'TOKEN_INVALIDO' });
    this.utilizadorRepository.atualizar(utilizador.id, {
      email_confirmado: 1,
      token_confirmacao: null
    });
    this.auditoriaService.registar({
      utilizadorId: utilizador.id, acao: 'EMAIL_CONFIRMADO', entidade: 'utilizador', entidadeId: utilizador.id
    });
    return { mensagem: 'E-mail confirmado com sucesso.', utilizador: this.utilizadorRepository.porId(utilizador.id) };
  }

  /** Contas que aguardam decisão. A secretária só vê médicos; o admin vê todos. */
  listarPendentes(aprovador) {
    if (!aprovador) throw new ErroProibido();
    if (aprovador.perfil === 'admin') {
      return [
        ...this.#enriquecerMedicos(this.utilizadorRepository.listar({ perfil: 'medico', estadoAprovacao: 'pendente' })),
        ...this.utilizadorRepository.listar({ perfil: 'secretario', estadoAprovacao: 'pendente' })
      ];
    }
    if (aprovador.perfil === 'secretario') {
      return this.#enriquecerMedicos(this.utilizadorRepository.listar({ perfil: 'medico', estadoAprovacao: 'pendente' }));
    }
    throw new ErroProibido('Sem permissão para consultar aprovações.');
  }

  async aprovar(utilizadorId, aprovador) {
    const alvo = this.utilizadorRepository.porIdCompleto(utilizadorId);
    if (!alvo) throw new ErroNaoEncontrado('Conta não encontrada.');
    this.#garantirPoderDeAprovacao(alvo, aprovador);
    if (alvo.estado_aprovacao === 'aprovada') {
      return { mensagem: 'Esta conta já estava aprovada.', utilizador: this.utilizadorRepository.porId(alvo.id) };
    }

    this.utilizadorRepository.atualizar(alvo.id, {
      estado_aprovacao: 'aprovada',
      ativo: 1,
      aprovado_em: new Date().toISOString(),
      aprovado_por: aprovador.id ?? null
    });
    if (alvo.perfil === 'medico') {
      const medico = this.medicoRepository.porUtilizador(alvo.id);
      if (medico) this.medicoRepository.definirAtivo(medico.id, 1);
    }

    await this.notificacaoService.enviarPara(
      this.#destinatario(alvo),
      {
        consultaId: null,
        evento: 'ContaAprovada',
        assunto: 'MediAgenda — o seu cadastro foi aprovado',
        corpo: `Olá ${alvo.nome},\n\nO seu cadastro de ${alvo.perfil} foi APROVADO por ${aprovador.nome}.`
          + `\nJá pode iniciar sessão em ${urlAplicacao()}/login com o seu e-mail e palavra-passe.\n\nMediAgenda`
      }
    );

    this.auditoriaService.registar({
      utilizadorId: aprovador.id ?? null,
      acao: 'CONTA_APROVADA',
      entidade: 'utilizador',
      entidadeId: alvo.id,
      detalhes: { perfil: alvo.perfil, email: alvo.email, aprovador: aprovador.email }
    });

    return { mensagem: `Cadastro de ${alvo.nome} aprovado.`, utilizador: this.utilizadorRepository.porId(alvo.id) };
  }

  async recusar(utilizadorId, aprovador, motivo = null) {
    const alvo = this.utilizadorRepository.porIdCompleto(utilizadorId);
    if (!alvo) throw new ErroNaoEncontrado('Conta não encontrada.');
    this.#garantirPoderDeAprovacao(alvo, aprovador);

    this.utilizadorRepository.atualizar(alvo.id, {
      estado_aprovacao: 'recusada',
      ativo: 0,
      aprovado_em: new Date().toISOString(),
      aprovado_por: aprovador.id ?? null
    });
    if (alvo.perfil === 'medico') {
      const medico = this.medicoRepository.porUtilizador(alvo.id);
      if (medico) this.medicoRepository.definirAtivo(medico.id, 0);
    }

    await this.notificacaoService.enviarPara(
      this.#destinatario(alvo),
      {
        consultaId: null,
        evento: 'ContaRecusada',
        assunto: 'MediAgenda — o seu cadastro não foi aprovado',
        corpo: `Olá ${alvo.nome},\n\nO seu cadastro de ${alvo.perfil} não foi aprovado.`
          + (motivo ? `\nMotivo: ${motivo}` : '')
          + '\n\nMediAgenda'
      }
    );

    this.auditoriaService.registar({
      utilizadorId: aprovador.id ?? null,
      acao: 'CONTA_RECUSADA',
      entidade: 'utilizador',
      entidadeId: alvo.id,
      detalhes: { perfil: alvo.perfil, email: alvo.email, motivo, aprovador: aprovador.email }
    });

    return { mensagem: `Cadastro de ${alvo.nome} recusado.`, utilizador: this.utilizadorRepository.porId(alvo.id) };
  }

  async recuperarPassword(email) {
    const utilizador = this.utilizadorRepository.porEmail(email);
    if (!utilizador) return { mensagem: 'Se o e-mail existir, receberá instruções.' };
    const token = tokenAleatorio();
    this.utilizadorRepository.atualizar(utilizador.id, { token_recuperacao: token });
    await this.notificacaoService.enviarPara(
      { id: utilizador.id, nome: utilizador.nome, email: utilizador.email, telefone: utilizador.telefone, preferencia: 'email' },
      {
        consultaId: null,
        evento: 'RecuperacaoPassword',
        assunto: 'Recuperação de palavra-passe — MediAgenda',
        corpo: `Olá ${utilizador.nome},\n\nUse este link para redefinir a palavra-passe:\n`
          + `${urlAplicacao()}/redefinir?token=${token}\n\nToken: ${token}\n\n`
          + 'Se não pediu esta alteração, ignore este e-mail.'
      }
    );
    return { mensagem: 'Se o e-mail existir, receberá instruções.' };
  }

  redefinirPassword(token, novaPassword) {
    if (!novaPassword || String(novaPassword).length < 6) {
      throw new ErroValidacao('A nova palavra-passe deve ter pelo menos 6 caracteres.');
    }
    const utilizador = this.utilizadorRepository.porTokenRecuperacao(token);
    if (!utilizador) throw new ErroNegocio('Token de recuperação inválido ou já utilizado.', { status: 400, codigo: 'TOKEN_INVALIDO' });
    this.utilizadorRepository.atualizar(utilizador.id, {
      password_hash: hashPassword(novaPassword),
      token_recuperacao: null,
      tentativas_falhadas: 0,
      bloqueado_ate: null
    });
    this.auditoriaService.registar({
      utilizadorId: utilizador.id, acao: 'PASSWORD_REDEFINIDA', entidade: 'utilizador', entidadeId: utilizador.id
    });
    return { mensagem: 'Palavra-passe redefinida com sucesso.' };
  }

  // ------------------------------------------------------------------ interno

  /** Aceita ids ou nomes de especialidades (o formulário público envia nomes). */
  #resolverEspecialidades(lista = []) {
    if (!lista?.length) return [];
    const porNome = new Map(
      (this.especialidadeRepository?.listar() ?? []).map((e) => [String(e.nome).toLowerCase(), e.id])
    );
    return lista
      .map((item) => (Number.isInteger(Number(item)) && Number(item) > 0
        ? Number(item)
        : porNome.get(String(item).toLowerCase())))
      .filter(Boolean);
  }

  #garantirPoderDeAprovacao(alvo, aprovador) {
    if (!aprovador) throw new ErroProibido();
    if (alvo.perfil === 'medico' && ['secretario', 'admin'].includes(aprovador.perfil)) return;
    if (alvo.perfil === 'secretario' && aprovador.perfil === 'admin') return;
    if (aprovador.perfil === 'admin') return;
    throw new ErroProibido(
      alvo.perfil === 'medico'
        ? 'Só a secretária ou o administrador podem aprovar médicos.'
        : 'Só o administrador pode autorizar secretárias.'
    );
  }

  #destinatario(utilizador) {
    return {
      id: utilizador.id,
      nome: utilizador.nome,
      email: utilizador.email,
      telefone: utilizador.telefone,
      preferencia: utilizador.preferencia_notificacao || 'email'
    };
  }

  #enriquecerMedicos(lista) {
    return lista.map((u) => {
      const medico = this.medicoRepository.porUtilizador(u.id);
      return medico
        ? {
          ...u,
          medico_id: medico.id,
          numero_registo: medico.numero_registo,
          localizacao: medico.localizacao
        }
        : u;
    });
  }

  /** Avisa quem tem poder para aprovar o novo cadastro. */
  async #notificarAprovadores(perfil, nome, email) {
    const perfis = perfil === 'medico' ? ['secretario', 'admin'] : ['admin'];
    const destinatarios = perfis.flatMap((p) => this.utilizadorRepository.listar({ perfil: p }));
    for (const destinatario of destinatarios) {
      await this.notificacaoService.enviarPara(
        this.#destinatario(destinatario),
        {
          consultaId: null,
          evento: 'AprovacaoPendente',
          assunto: `MediAgenda — novo cadastro de ${perfil} por aprovar`,
          corpo: `Olá ${destinatario.nome},\n\nO cadastro de ${nome} (${email}) como ${perfil} `
            + `aguarda a sua aprovação.\n\nAbra o painel MediAgenda para autorizar ou recusar.\n\nMediAgenda`
        }
      );
    }
  }
}
