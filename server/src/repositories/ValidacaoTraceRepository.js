import { db, nowIso } from '../db/index.js';

export class ValidacaoTraceRepository {
  criar({ consultaId, resultado, detalhes }) {
    const r = db.prepare(`
      INSERT INTO validacoes_traces (consulta_id, resultado, detalhes, criado_em)
      VALUES (?, ?, ?, ?)
    `).run(consultaId ?? null, resultado, JSON.stringify(detalhes), nowIso());
    return Number(r.lastInsertRowid);
  }

  listar({ limite = 30 } = {}) {
    return db.prepare(`
      SELECT v.*, c.especialidade_id, e.nome AS especialidade_nome, up.nome AS paciente_nome, um.nome AS medico_nome
      FROM validacoes_traces v
      LEFT JOIN consultas c ON c.id = v.consulta_id
      LEFT JOIN especialidades e ON e.id = c.especialidade_id
      LEFT JOIN pacientes p ON p.id = c.paciente_id
      LEFT JOIN users up ON up.id = p.utilizador_id
      LEFT JOIN medicos m ON m.id = c.medico_id
      LEFT JOIN users um ON um.id = m.utilizador_id
      ORDER BY v.id DESC LIMIT ?
    `).all(Number(limite)).map((v) => ({
      ...v,
      detalhes: this.#json(v.detalhes)
    }));
  }

  porId(id) {
    const v = db.prepare('SELECT * FROM validacoes_traces WHERE id = ?').get(Number(id));
    if (!v) return null;
    return { ...v, detalhes: this.#json(v.detalhes) };
  }

  porConsulta(consultaId) {
    return db.prepare(`
      SELECT * FROM validacoes_traces WHERE consulta_id = ? ORDER BY id DESC
    `).all(Number(consultaId)).map((v) => ({ ...v, detalhes: this.#json(v.detalhes) }));
  }

  #json(valor) {
    try { return JSON.parse(valor); } catch { return valor; }
  }
}
