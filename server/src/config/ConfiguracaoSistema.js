import { db } from '../db/index.js';

const PADROES = {
  nome_clinica: 'Clínica MediAgenda',
  horario_inicio: '08:00',
  horario_fim: '20:00',
  dias_funcionamento: '1,2,3,4,5',
  antecedencia_minima_horas: '1',
  cancelamento_limite_horas: '24',
  confirmacao_prazo_horas: '2',
  max_consultas_dia: '10',
  max_consultas_paciente_medico: '3',
  duracao_padrao_min: '60',
  limite_tentativas_login: '5'
};

/**
 * Singleton — a configuração da clínica tem de ser a mesma para todos os serviços.
 * Uma única instância é criada e reutilizada em todo o processo.
 */
export class ConfiguracaoSistema {
  static #instancia = null;
  #cache = new Map();

  static obterInstancia() {
    if (!ConfiguracaoSistema.#instancia) {
      ConfiguracaoSistema.#instancia = new ConfiguracaoSistema();
    }
    return ConfiguracaoSistema.#instancia;
  }

  obter(chave) {
    if (this.#cache.has(chave)) return this.#cache.get(chave);
    const linha = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave);
    const valor = linha ? linha.valor : PADROES[chave];
    this.#cache.set(chave, valor);
    return valor;
  }

  numero(chave) {
    return Number(this.obter(chave));
  }

  lista(chave) {
    return String(this.obter(chave))
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v));
  }

  todas() {
    const linhas = db.prepare('SELECT chave, valor, descricao FROM configuracoes ORDER BY chave').all();
    return linhas.map((l) => ({ ...l, padrao: PADROES[l.chave] ?? null }));
  }

  atualizar(chave, valor) {
    db.prepare(
      `INSERT INTO configuracoes (chave, valor) VALUES (?, ?)
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`
    ).run(chave, String(valor));
    this.#cache.delete(chave);
    return this.obter(chave);
  }

  invalidar() {
    this.#cache.clear();
  }
}

export const configuracao = ConfiguracaoSistema.obterInstancia();
export { PADROES };
