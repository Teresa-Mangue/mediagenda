import { db } from '../db/index.js';

export class EspecialidadeRepository {
  listar({ apenasAtivas = false } = {}) {
    const sql = `SELECT * FROM especialidades ${apenasAtivas ? 'WHERE ativo = 1' : ''} ORDER BY nome`;
    return db.prepare(sql).all();
  }

  porId(id) {
    return db.prepare('SELECT * FROM especialidades WHERE id = ?').get(Number(id)) || null;
  }

  criar({ nome, descricao, duracaoPadraoMin }) {
    const resultado = db.prepare(`
      INSERT INTO especialidades (nome, descricao, duracao_padrao_min) VALUES (?, ?, ?)
    `).run(nome, descricao ?? null, Number(duracaoPadraoMin) || 60);
    return Number(resultado.lastInsertRowid);
  }

  atualizar(id, { nome, descricao, duracaoPadraoMin, ativo }) {
    db.prepare(`
      UPDATE especialidades SET nome = ?, descricao = ?, duracao_padrao_min = ?, ativo = ? WHERE id = ?
    `).run(nome, descricao ?? null, Number(duracaoPadraoMin) || 60, ativo ? 1 : 0, Number(id));
  }
}
