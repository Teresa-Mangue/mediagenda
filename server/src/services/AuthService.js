import { hashPassword, verificarPassword, criarToken, tokenAleatorio } from '../utils/security.js';
import { ErroAutenticacao, ErroNegocio, ErroValidacao } from '../utils/erros.js';
import { configuracao } from '../config/ConfiguracaoSistema.js';

export class AuthService {
  constructor({ utilizadorRepository, pacienteRepository, medicoRepository, auditoriaService, notificacaoService }) {
    this.utilizadorRepository = utilizadorRepository;
    this.pacienteRepository = pacienteRepository;
    this.medicoRepository = medicoRepository;
    this.auditoriaService = auditoriaService;
    this.notificacaoService = notificacaoService;
  }

  async registar({ nome, email, password, perfil = 'paciente', telefone, dataNascimento, endereco, numeroRegisto, localizacao, especialidades }) {
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

    const tokenConfirmacao = tokenAleatorio();
    const utilizadorId = this.utilizadorRepository.criar({
      nome,
      email,
      passwordHash: hashPassword(password),
      perfil,
      telefone,
      emailConfirmado: 0,
      tokenConfirmacao
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
        localizacao: localizacao ?? 'Clínica MediAgenda',
        especialidades: especialidades || []
      });
    }

    await this.notificacaoService.enviarPara(
      { id: utilizadorId, nome, email, telefone, preferencia: 'email' },
      {
        consultaId: null,
        evento: 'RegistoUtilizador',
        assunto: 'Bem-vindo ao MediAgenda — confirme o seu e-mail',
        corpo: `Olá ${nome},\n\nA sua conta foi criada com o perfil "${perfil}".\nConfirme o e-mail através do token: ${tokenConfirmacao}\n\nMediAgenda`
      }
    );

    this.auditoriaService.registar({
      utilizadorId,
      acao: 'REGISTO',
      entidade: 'utilizador',
      entidadeId: utilizadorId,
      detalhes: { perfil, email }
    });

    return {
      utilizador: this.utilizadorRepository.porId(utilizadorId),
      tokenConfirmacao
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
    if (!utilizador.ativo) {
      throw new ErroNegocio('Conta desactivada. Contacte o administrador.', { status: 403, codigo: 'CONTA_INATIVA' });
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
    return { mensagem: 'E-mail confirmado com sucesso.' };
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
        corpo: `Olá ${utilizador.nome},\n\nUse este token para redefinir a palavra-passe: ${token}\n\nSe não pediu esta alteração, ignore este e-mail.`
      }
    );
    return { mensagem: 'Se o e-mail existir, receberá instruções.', token };
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
}
