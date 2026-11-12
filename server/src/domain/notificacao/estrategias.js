/**
 * Strategy — a forma de notificar é escolhida em tempo de execução
 * a partir da preferência do utilizador, sem if/else espalhados.
 */
export class EstrategiaNotificacao {
  constructor(nome, canais) {
    this.nome = nome;
    this._canais = canais;
  }

  canais() {
    return this._canais;
  }
}

export class EstrategiaEmail extends EstrategiaNotificacao {
  constructor() { super('email', ['email']); }
}

export class EstrategiaSMS extends EstrategiaNotificacao {
  constructor() { super('sms', ['sms']); }
}

export class EstrategiaAmbos extends EstrategiaNotificacao {
  constructor() { super('ambos', ['email', 'sms']); }
}

const ESTRATEGIAS = {
  email: new EstrategiaEmail(),
  sms: new EstrategiaSMS(),
  ambos: new EstrategiaAmbos()
};

export function obterEstrategiaNotificacao(preferencia) {
  return ESTRATEGIAS[preferencia] || ESTRATEGIAS.email;
}

/**
 * Strategy — RN-04: duração padrão de 60 min, configurável entre
 * 1 e 2 horas por especialidade.
 */
export class DuracaoPadrao {
  constructor() { this.nome = 'padrao'; }
  calcular({ medico }) {
    return Number(medico?.duracao_consulta_min) || 60;
  }
}

export class DuracaoPorEspecialidade {
  constructor() { this.nome = 'especialidade'; }
  calcular({ especialidade, medico }) {
    const proposta = Number(especialidade?.duracao_padrao_min) || Number(medico?.duracao_consulta_min) || 60;
    return Math.min(120, Math.max(60, proposta));
  }
}

export class EstrategiaDuracaoConsulta {
  constructor() {
    this.padrao = new DuracaoPadrao();
    this.porEspecialidade = new DuracaoPorEspecialidade();
  }

  calcular(especialidade, medico) {
    const estrategia = especialidade?.duracao_padrao_min ? this.porEspecialidade : this.padrao;
    return {
      duracaoMin: estrategia.calcular({ especialidade, medico }),
      estrategia: estrategia.nome
    };
  }
}
