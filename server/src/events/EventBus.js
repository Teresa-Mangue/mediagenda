/**
 * EDA + Observer — o Event Bus é o Subject que notifica todos os
 * observadores subscritos, sem que o produtor os conheça.
 *
 * Funciona também como outbox: o evento é primeiro gravado na tabela
 * `eventos`; só depois é distribuído. Cada consumo é registado em
 * `evento_consumos`, o que alimenta o Event Monitor da interface.
 */
export class EventBus {
  #subscritores = new Map();
  #eventoRepository;

  constructor(eventoRepository) {
    this.#eventoRepository = eventoRepository;
  }

  subscrever(tipo, nome, handler) {
    if (!this.#subscritores.has(tipo)) this.#subscritores.set(tipo, []);
    this.#subscritores.get(tipo).push({ nome, handler });
  }

  subscritoresDe(tipo) {
    return (this.#subscritores.get(tipo) || []).map((s) => s.nome);
  }

  async publicar(tipo, payload) {
    const eventoId = this.#eventoRepository.criar(tipo, payload);
    const handlers = this.#subscritores.get(tipo) || [];

    if (!handlers.length) {
      this.#eventoRepository.registarConsumo(eventoId, 'EventBus', 'sem-subscritores', 'Nenhum consumidor registado.');
    }

    for (const { nome, handler } of handlers) {
      try {
        await handler({ id: eventoId, tipo, payload });
        this.#eventoRepository.registarConsumo(eventoId, nome, 'sucesso', null);
      } catch (erro) {
        this.#eventoRepository.registarConsumo(eventoId, nome, 'erro', erro.message);
        console.error(`[EventBus] Consumidor ${nome} falhou no evento ${tipo}:`, erro.message);
      }
    }

    this.#eventoRepository.marcarProcessado(eventoId);
    return eventoId;
  }
}
