import { db, nowIso } from '../db/index.js';

export class PacienteRepository {
  porUtilizador(utilizadorId) {
    return db.prepare('SELECT * FROM pacientes WHERE utilizador_id = ?').get(Number(utilizadorId)) || null;
  }

  porId(id) {
    return db.prepare(`
      SELECT p.*, u.nome, u.email, u.telefone, u.preferencia_notificacao, u.ativo
      FROM pacientes p JOIN users u ON u.id = p.utilizador_id
      WHERE p.id = ?
    `).get(Number(id)) || null;
  }

  criar({ utilizadorId, dataNascimento, endereco }) {
    const resultado = db.prepare(`
      INSERT INTO pacientes (utilizador_id, data_nascimento, endereco, criado_em) VALUES (?, ?, ?, ?)
    `).run(Number(utilizadorId), dataNascimento ?? null, endereco ?? null, nowIso());
    return Number(resultado.lastInsertRowid);
  }

  atualizar(id, { dataNascimento, endereco }) {
    db.prepare('UPDATE pacientes SET data_nascimento = ?, endereco = ? WHERE id = ?')
      .run(dataNascimento ?? null, endereco ?? null, Number(id));
  }

  incrementarCancelamentoTardio(id) {
    db.prepare('UPDATE pacientes SET cancelamentos_tardios = cancelamentos_tardios + 1 WHERE id = ?')
      .run(Number(id));
  }

  listar({ nome } = {}) {
    let sql = `
      SELECT p.*, u.nome, u.email, u.telefone, u.ativo,
             (SELECT COUNT(*) FROM consultas c WHERE c.paciente_id = p.id) AS total_consultas
      FROM pacientes p JOIN users u ON u.id = p.utilizador_id
      WHERE u.perfil = 'paciente'
    `;
    const params = [];
    if (nome) { sql += ' AND u.nome LIKE ?'; params.push(`%${nome}%`); }
    sql += ' ORDER BY u.nome';
    return db.prepare(sql).all(...params);
  }
}
