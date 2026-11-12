import { db, nowIso } from '../db/index.js';

export class AuditoriaRepository {
  registar({ utilizadorId, acao, entidade, entidadeId, detalhes, ip }) {
    const resultado = db.prepare(`
      INSERT INTO auditoria (utilizador_id, acao, entidade, entidade_id, detalhes, ip, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      utilizadorId ?? null, acao, entidade, entidadeId ?? null,
      detalhes ? JSON.stringify(detalhes) : null, ip ?? null, nowIso()
    );
    return Number(resultado.lastInsertRowid);
  }

  listar({ limite = 200, acao } = {}) {
    let sql = `
      SELECT a.*, u.nome AS utilizador_nome, u.perfil AS utilizador_perfil
      FROM auditoria a LEFT JOIN users u ON u.id = a.utilizador_id
    `;
    const params = [];
    if (acao) { sql += ' WHERE a.acao = ?'; params.push(acao); }
    sql += ' ORDER BY a.id DESC LIMIT ?';
    params.push(Number(limite));
    return db.prepare(sql).all(...params).map((l) => ({
      ...l,
      detalhes: l.detalhes ? this.#json(l.detalhes) : null
    }));
  }

  #json(valor) {
    try { return JSON.parse(valor); } catch { return valor; }
  }
}
