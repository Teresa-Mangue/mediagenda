import { db, nowIso } from '../db/index.js';

export class EventoRepository {
  criar(tipo, payload) {
    const resultado = db.prepare(
      'INSERT INTO eventos (tipo, payload, criado_em) VALUES (?, ?, ?)'
    ).run(tipo, JSON.stringify(payload ?? {}), nowIso());
    return Number(resultado.lastInsertRowid);
  }

  marcarProcessado(id) {
    db.prepare('UPDATE eventos SET processado_em = ? WHERE id = ?').run(nowIso(), Number(id));
  }

  registarConsumo(eventoId, consumidor, estado, detalhe) {
    db.prepare(`
      INSERT INTO evento_consumos (evento_id, consumidor, estado, detalhe, criado_em)
      VALUES (?, ?, ?, ?, ?)
    `).run(Number(eventoId), consumidor, estado, detalhe ?? null, nowIso());
  }

  listar({ limite = 100 } = {}) {
    const eventos = db.prepare('SELECT * FROM eventos ORDER BY id DESC LIMIT ?').all(Number(limite));
    return eventos.map((e) => ({
      ...e,
      payload: this.#json(e.payload),
      consumos: db.prepare('SELECT * FROM evento_consumos WHERE evento_id = ? ORDER BY id')
        .all(e.id)
    }));
  }

  porId(id) {
    const evento = db.prepare('SELECT * FROM eventos WHERE id = ?').get(Number(id));
    if (!evento) return null;
    return {
      ...evento,
      payload: this.#json(evento.payload),
      consumos: db.prepare('SELECT * FROM evento_consumos WHERE evento_id = ? ORDER BY id').all(evento.id)
    };
  }

  resumo() {
    const total = db.prepare('SELECT COUNT(*) AS total FROM eventos').get().total;
    const porTipo = db.prepare('SELECT tipo, COUNT(*) AS total FROM eventos GROUP BY tipo ORDER BY total DESC').all();
    const consumidores = db.prepare(`
      SELECT consumidor, estado, COUNT(*) AS total FROM evento_consumos
      GROUP BY consumidor, estado ORDER BY consumidor
    `).all();
    return { total, porTipo, consumidores };
  }

  #json(valor) {
    try { return JSON.parse(valor); } catch { return valor; }
  }
}
