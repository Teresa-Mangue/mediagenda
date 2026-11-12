import { ErroNegocio } from '../../utils/erros.js';
import { diferencaHoras } from '../../utils/tempo.js';

/**
 * Padrão State — cada estado da consulta é uma classe que decide,
 * por si própria, que transições são válidas a partir dali.
 */
export class EstadoConsulta {
  constructor(nome, rotulo) {
    this.nome = nome;
    this.rotulo = rotulo;
  }

  confirmar() {
    throw new ErroNegocio(`Uma consulta ${this.rotulo.toLowerCase()} não pode ser confirmada.`, {
      status: 409, codigo: 'TRANSICAO_INVALIDA'
    });
  }

  cancelar() {
    throw new ErroNegocio(`Uma consulta ${this.rotulo.toLowerCase()} não pode ser cancelada.`, {
      status: 409, codigo: 'TRANSICAO_INVALIDA'
    });
  }

  realizar() {
    throw new ErroNegocio(`Uma consulta ${this.rotulo.toLowerCase()} não pode ser marcada como realizada.`, {
      status: 409, codigo: 'TRANSICAO_INVALIDA'
    });
  }

  get transicoes() {
    return [];
  }
}

export class EstadoPendente extends EstadoConsulta {
  constructor() {
    super('pendente', 'Pendente');
  }

  /**
   * RN-07: a confirmação só é aceite dentro do prazo de 2 horas.
   */
  confirmar(consulta, agora = new Date()) {
    if (new Date(consulta.prazo_confirmacao).getTime() < new Date(agora).getTime()) {
      throw new ErroNegocio(
        'O prazo de 2 horas para confirmar esta consulta expirou. A vaga foi libertada.',
        { status: 409, codigo: 'PRAZO_CONFIRMACAO_EXPIRADO' }
      );
    }
    return {
      estado: 'confirmada',
      confirmada_em: new Date(agora).toISOString(),
      motivo: 'Confirmação dentro do prazo (RN-07)'
    };
  }

  /**
   * RN-02: o cancelamento é sempre possível, mas abaixo de 24h é tardio.
   */
  cancelar(consulta, { agora = new Date(), motivo = null, limiteHoras = 24 } = {}) {
    const antecedencia = diferencaHoras(consulta.data_hora, agora);
    const tardio = antecedencia < Number(limiteHoras);
    return {
      estado: 'cancelada',
      motivo_cancelamento: motivo,
      cancelamento_tardio: tardio ? 1 : 0,
      motivo: tardio
        ? `Cancelamento tardio (${Math.max(0, antecedencia).toFixed(1)}h de antecedência) — RN-02`
        : `Cancelamento com antecedência ≥ ${limiteHoras}h (RN-02)`
    };
  }

  get transicoes() {
    return ['confirmada', 'cancelada'];
  }
}

export class EstadoConfirmada extends EstadoConsulta {
  constructor() {
    super('confirmada', 'Confirmada');
  }

  cancelar(consulta, { agora = new Date(), motivo = null, limiteHoras = 24 } = {}) {
    const antecedencia = diferencaHoras(consulta.data_hora, agora);
    const tardio = antecedencia < Number(limiteHoras);
    return {
      estado: 'cancelada',
      motivo_cancelamento: motivo,
      cancelamento_tardio: tardio ? 1 : 0,
      motivo: tardio
        ? `Cancelamento tardio (${Math.max(0, antecedencia).toFixed(1)}h de antecedência) — RN-02`
        : `Cancelamento gratuito com antecedência ≥ ${limiteHoras}h (RN-02)`
    };
  }

  realizar() {
    return { estado: 'realizada', motivo: 'Consulta marcada como realizada' };
  }

  get transicoes() {
    return ['cancelada', 'realizada'];
  }
}

export class EstadoRealizada extends EstadoConsulta {
  constructor() {
    super('realizada', 'Realizada');
  }

  get transicoes() {
    return [];
  }
}

export class EstadoCancelada extends EstadoConsulta {
  constructor() {
    super('cancelada', 'Cancelada');
  }

  get transicoes() {
    return [];
  }
}

const ESTADOS = {
  pendente: () => new EstadoPendente(),
  confirmada: () => new EstadoConfirmada(),
  realizada: () => new EstadoRealizada(),
  cancelada: () => new EstadoCancelada()
};

export function criarEstado(nome) {
  const fabrica = ESTADOS[nome];
  if (!fabrica) throw new ErroNegocio(`Estado desconhecido: ${nome}`, { status: 500 });
  return fabrica();
}

export const TODOS_OS_ESTADOS = ['pendente', 'confirmada', 'realizada', 'cancelada'];
