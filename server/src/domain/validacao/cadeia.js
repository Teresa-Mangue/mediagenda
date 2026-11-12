import { diaSemanaLocal, minutosDeHora, horaDeMinutos, adicionarMinutos, diferencaHoras } from '../../utils/tempo.js';

/**
 * Chain of Responsibility — cada regra de negócio é um elo isolado.
 * O pedido percorre a cadeia e para no primeiro elo que o rejeitar.
 */
export class Validador {
  constructor({ nome, codigo, descricao }) {
    this.nome = nome;
    this.codigo = codigo;
    this.descricao = descricao;
    this.proximo = null;
  }

  definirProximo(validador) {
    this.proximo = validador;
    return validador;
  }

  executar(contexto) {
    const inicio = performance.now();
    const resultado = this.verificar(contexto);
    const passo = {
      elo: this.nome,
      codigo: this.codigo,
      descricao: this.descricao,
      aprovado: resultado.ok,
      mensagem: resultado.mensagem,
      detalhe: resultado.detalhe ?? null,
      duracaoMs: Number((performance.now() - inicio).toFixed(3))
    };
    if (!resultado.ok) return { ok: false, falhouEm: this.codigo, mensagem: resultado.mensagem, passos: [passo] };
    if (this.proximo) {
      const seguinte = this.proximo.executar(contexto);
      return { ...seguinte, passos: [passo, ...seguinte.passos] };
    }
    return { ok: true, passos: [passo] };
  }

  verificar() {
    return { ok: true };
  }
}

export class AntecedenciaMinima extends Validador {
  constructor(configuracao) {
    super({
      nome: 'Antecedência mínima',
      codigo: 'RN-01',
      descricao: 'A consulta tem de ser marcada com pelo menos 1 hora de antecedência.'
    });
    this.configuracao = configuracao;
  }

  verificar({ dataHora, agora }) {
    const minimo = this.configuracao.numero('antecedencia_minima_horas');
    const antecedencia = diferencaHoras(dataHora, agora);
    if (antecedencia < minimo) {
      return {
        ok: false,
        mensagem: `É necessário marcar com pelo menos ${minimo}h de antecedência (RN-01).`,
        detalhe: `Antecedência calculada: ${antecedencia.toFixed(2)}h.`
      };
    }
    return { ok: true, mensagem: 'Antecedência suficiente.', detalhe: `${antecedencia.toFixed(2)}h de antecedência.` };
  }
}

export class HorarioFuncionamento extends Validador {
  constructor(configuracao, medicoRepository) {
    super({
      nome: 'Horário de funcionamento e disponibilidade',
      codigo: 'RN-09',
      descricao: 'A marcação tem de estar dentro do horário da clínica e da disponibilidade do médico.'
    });
    this.configuracao = configuracao;
    this.medicoRepository = medicoRepository;
  }

  verificar({ dataHora, duracaoMin, medico }) {
    const dias = this.configuracao.lista('dias_funcionamento');
    const abertura = minutosDeHora(this.configuracao.obter('horario_inicio'));
    const fecho = minutosDeHora(this.configuracao.obter('horario_fim'));
    const dia = diaSemanaLocal(dataHora);
    const inicio = dataHora.getHours() * 60 + dataHora.getMinutes();
    const fim = inicio + Number(duracaoMin);

    if (!dias.includes(dia)) {
      return { ok: false, mensagem: 'A clínica não funciona nesse dia (RN-09).', detalhe: `Dia da semana: ${dia}.` };
    }
    if (inicio < abertura || fim > fecho) {
      return {
        ok: false,
        mensagem: `Horário fora do funcionamento da clínica (${horaDeMinutos(abertura)}–${horaDeMinutos(fecho)}) (RN-09).`,
        detalhe: `Pedido: ${horaDeMinutos(inicio)}–${horaDeMinutos(fim)}.`
      };
    }

    const disponibilidades = this.medicoRepository.disponibilidades(medico.id);
    const dentroDisponibilidade = disponibilidades.some((d) => {
      if (Number(d.dia_semana) !== dia) return false;
      return inicio >= minutosDeHora(d.hora_inicio) && fim <= minutosDeHora(d.hora_fim);
    });
    if (!dentroDisponibilidade) {
      return {
        ok: false,
        mensagem: 'O médico não tem disponibilidade nesse horário (RF-04).',
        detalhe: 'Verifique os horários de atendimento do médico.'
      };
    }

    const bloqueio = this.medicoRepository.temBloqueio(medico.id, dataHora.toISOString(), adicionarMinutos(dataHora, duracaoMin).toISOString());
    if (bloqueio) {
      return {
        ok: false,
        mensagem: 'O médico tem um bloqueio/férias nesse período (RF-04).',
        detalhe: bloqueio.motivo ? `Motivo: ${bloqueio.motivo}` : null
      };
    }

    return { ok: true, mensagem: 'Dentro do horário da clínica e da disponibilidade do médico.' };
  }
}

export class ConflitoAgenda extends Validador {
  constructor(consultaRepository) {
    super({
      nome: 'Conflito de agenda',
      codigo: 'RN-05',
      descricao: 'Um médico não pode ter duas consultas simultâneas.'
    });
    this.consultaRepository = consultaRepository;
  }

  verificar({ medico, dataHora, duracaoMin, consultaIdExcluir = 0 }) {
    const fim = adicionarMinutos(dataHora, duracaoMin).toISOString();
    const conflito = this.consultaRepository.conflito(medico.id, dataHora.toISOString(), fim, consultaIdExcluir);
    if (conflito) {
      return {
        ok: false,
        mensagem: 'O médico já tem uma consulta nesse horário (RN-05).',
        detalhe: `Consulta #${conflito.id} com ${conflito.paciente_nome}.`
      };
    }
    return { ok: true, mensagem: 'Horário livre na agenda do médico.' };
  }
}

export class LimiteDiarioMedico extends Validador {
  constructor(configuracao, consultaRepository) {
    super({
      nome: 'Limite diário do médico',
      codigo: 'RN-03',
      descricao: 'Cada médico tem um número máximo de consultas por dia (padrão: 10).'
    });
    this.configuracao = configuracao;
    this.consultaRepository = consultaRepository;
  }

  verificar({ medico, dataHora, consultaIdExcluir = 0 }) {
    const limite = Number(medico.max_consultas_dia) || this.configuracao.numero('max_consultas_dia');
    const inicio = new Date(dataHora); inicio.setHours(0, 0, 0, 0);
    const fim = new Date(dataHora); fim.setHours(23, 59, 59, 999);
    const total = this.consultaRepository.contarNoDia(
      medico.id, inicio.toISOString(), fim.toISOString(), consultaIdExcluir
    );
    if (total >= limite) {
      return {
        ok: false,
        mensagem: `Este médico já atingiu o limite de ${limite} consultas para este dia (RN-03).`,
        detalhe: `Consultas no dia: ${total}/${limite}.`
      };
    }
    return { ok: true, mensagem: 'Limite diário ainda não atingido.', detalhe: `${total}/${limite} consultas no dia.` };
  }
}

export class LimitePaciente extends Validador {
  constructor(configuracao, consultaRepository) {
    super({
      nome: 'Limite de consultas do paciente',
      codigo: 'RN-06',
      descricao: 'Um paciente não pode ter mais de 3 consultas futuras activas com o mesmo médico.'
    });
    this.configuracao = configuracao;
    this.consultaRepository = consultaRepository;
  }

  verificar({ paciente, medico, consultaIdExcluir = 0 }) {
    const limite = this.configuracao.numero('max_consultas_paciente_medico');
    const futuras = this.consultaRepository.futurasAtivas(paciente.id, medico.id)
      .filter((c) => Number(c.id) !== Number(consultaIdExcluir));
    if (futuras.length >= limite) {
      return {
        ok: false,
        mensagem: `Já tem ${limite} consultas futuras activas com este médico (RN-06).`,
        detalhe: 'Cancele ou reagende uma das consultas existentes.'
      };
    }
    return { ok: true, mensagem: 'Dentro do limite de consultas activas.', detalhe: `${futuras.length}/${limite}.` };
  }
}

/** Constrói e executa a cadeia na ordem definida no trabalho. */
export class CadeiaValidacao {
  constructor({ configuracao, medicoRepository, consultaRepository }) {
    this.primeiro = new AntecedenciaMinima(configuracao);
    this.primeiro
      .definirProximo(new HorarioFuncionamento(configuracao, medicoRepository))
      .definirProximo(new ConflitoAgenda(consultaRepository))
      .definirProximo(new LimiteDiarioMedico(configuracao, consultaRepository))
      .definirProximo(new LimitePaciente(configuracao, consultaRepository));
  }

  validar(contexto) {
    return this.primeiro.executar(contexto);
  }
}
