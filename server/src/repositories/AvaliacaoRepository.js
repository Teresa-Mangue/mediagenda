import { db, nowIso } from '../db/index.js';

export class AvaliacaoRepository {
  porConsulta(consultaId) {
    return db.prepare('SELECT * FROM avaliacoes WHERE consulta_id = ?').get(Number(consultaId)) || null;
  }

  criar({ consultaId, pontuacao, comentario }) {
    const r = db.prepare(`
      INSERT INTO avaliacoes (consulta_id, pontuacao, comentario, criado_em) VALUES (?, ?, ?, ?)
    `).run(Number(consultaId), Number(pontuacao), comentario ?? null, nowIso());
    return Number(r.lastInsertRowid);
  }

  listarPorMedico(medicoId) {
    return db.prepare(`
      SELECT a.*, up.nome AS paciente_nome, c.data_hora
      FROM avaliacoes a
      JOIN consultas c ON c.id = a.consulta_id
      JOIN pacientes p ON p.id = c.paciente_id
      JOIN users up ON up.id = p.utilizador_id
      WHERE c.medico_id = ?
      ORDER BY a.id DESC
    `).all(Number(medicoId));
  }
}
