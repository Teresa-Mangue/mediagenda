import { db, nowIso } from '../db/index.js';

export class MedicoRepository {
  listar({ especialidade, nome, localizacao, avaliacaoMin } = {}) {
    let sql = `
      SELECT m.*, u.nome, u.email, u.telefone, u.preferencia_notificacao,
             (SELECT AVG(a.pontuacao) FROM avaliacoes a
                JOIN consultas c ON c.id = a.consulta_id
               WHERE c.medico_id = m.id) AS avaliacao_media,
             (SELECT COUNT(*) FROM avaliacoes a
                JOIN consultas c ON c.id = a.consulta_id
               WHERE c.medico_id = m.id) AS total_avaliacoes
      FROM medicos m
      JOIN users u ON u.id = m.utilizador_id
      WHERE m.ativo = 1
    `;
    const params = [];
    if (nome) { sql += ' AND u.nome LIKE ?'; params.push(`%${nome}%`); }
    if (localizacao) { sql += ' AND m.localizacao LIKE ?'; params.push(`%${localizacao}%`); }
    if (especialidade) {
      sql += ` AND EXISTS (
        SELECT 1 FROM medico_especialidades me
        JOIN especialidades e ON e.id = me.especialidade_id
        WHERE me.medico_id = m.id AND (e.id = ? OR e.nome LIKE ?)
      )`;
      params.push(Number(especialidade) || -1, `%${especialidade}%`);
    }
    sql += ' ORDER BY u.nome ASC';
    const medicos = db.prepare(sql).all(...params);
    return medicos
      .map((m) => ({
        ...m,
        avaliacao_media: m.avaliacao_media ? Number(Number(m.avaliacao_media).toFixed(1)) : null,
        especialidades: this.especialidades(m.id)
      }))
      .filter((m) => !avaliacaoMin || (m.avaliacao_media ?? 0) >= Number(avaliacaoMin));
  }

  porId(id) {
    const medico = db.prepare(`
      SELECT m.*, u.nome, u.email, u.telefone, u.preferencia_notificacao, u.ativo AS utilizador_ativo,
             (SELECT AVG(a.pontuacao) FROM avaliacoes a
                JOIN consultas c ON c.id = a.consulta_id
               WHERE c.medico_id = m.id) AS avaliacao_media,
             (SELECT COUNT(*) FROM avaliacoes a
                JOIN consultas c ON c.id = a.consulta_id
               WHERE c.medico_id = m.id) AS total_avaliacoes
      FROM medicos m
      JOIN users u ON u.id = m.utilizador_id
      WHERE m.id = ?
    `).get(Number(id));
    if (!medico) return null;
    return {
      ...medico,
      avaliacao_media: medico.avaliacao_media ? Number(Number(medico.avaliacao_media).toFixed(1)) : null,
      especialidades: this.especialidades(medico.id),
      disponibilidades: this.disponibilidades(medico.id),
      bloqueios: this.bloqueios(medico.id)
    };
  }

  porUtilizador(utilizadorId) {
    return db.prepare('SELECT * FROM medicos WHERE utilizador_id = ?').get(Number(utilizadorId)) || null;
  }

  especialidades(medicoId) {
    return db.prepare(`
      SELECT e.* FROM especialidades e
      JOIN medico_especialidades me ON me.especialidade_id = e.id
      WHERE me.medico_id = ? AND e.ativo = 1
      ORDER BY e.nome
    `).all(Number(medicoId));
  }

  criar({ utilizadorId, numeroRegisto, localizacao, biografia, duracaoConsultaMin, maxConsultasDia, especialidades = [], ativo = 1 }) {
    const resultado = db.prepare(`
      INSERT INTO medicos
        (utilizador_id, numero_registo, localizacao, biografia, duracao_consulta_min, max_consultas_dia, ativo, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number(utilizadorId), numeroRegisto, localizacao ?? null, biografia ?? null,
      Number(duracaoConsultaMin) || 60, Number(maxConsultasDia) || 10, ativo ? 1 : 0, nowIso()
    );
    const id = Number(resultado.lastInsertRowid);
    for (const especialidadeId of especialidades) {
      this.adicionarEspecialidade(id, especialidadeId);
    }
    return id;
  }

  definirAtivo(medicoId, ativo) {
    db.prepare('UPDATE medicos SET ativo = ? WHERE id = ?').run(ativo ? 1 : 0, Number(medicoId));
  }

  adicionarEspecialidade(medicoId, especialidadeId) {
    db.prepare(`
      INSERT OR IGNORE INTO medico_especialidades (medico_id, especialidade_id) VALUES (?, ?)
    `).run(Number(medicoId), Number(especialidadeId));
  }

  substituirEspecialidades(medicoId, especialidades = []) {
    db.prepare('DELETE FROM medico_especialidades WHERE medico_id = ?').run(Number(medicoId));
    for (const especialidadeId of especialidades) this.adicionarEspecialidade(medicoId, especialidadeId);
  }

  atualizar(id, campos) {
    const permitidos = ['localizacao', 'biografia', 'duracao_consulta_min', 'max_consultas_dia', 'ativo'];
    const set = [];
    const params = [];
    for (const [chave, valor] of Object.entries(campos)) {
      if (!permitidos.includes(chave)) continue;
      set.push(`${chave} = ?`);
      params.push(valor);
    }
    if (!set.length) return;
    params.push(Number(id));
    db.prepare(`UPDATE medicos SET ${set.join(', ')} WHERE id = ?`).run(...params);
  }

  disponibilidades(medicoId) {
    return db.prepare(
      'SELECT * FROM disponibilidades WHERE medico_id = ? ORDER BY dia_semana, hora_inicio'
    ).all(Number(medicoId));
  }

  criarDisponibilidade(medicoId, diaSemana, horaInicio, horaFim) {
    if (horaInicio >= horaFim) {
      throw Object.assign(new Error('A hora de início tem de ser anterior à hora de fim.'), { status: 400 });
    }
    const resultado = db.prepare(`
      INSERT INTO disponibilidades (medico_id, dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?, ?)
    `).run(Number(medicoId), Number(diaSemana), horaInicio, horaFim);
    return Number(resultado.lastInsertRowid);
  }

  removerDisponibilidade(medicoId, id) {
    db.prepare('DELETE FROM disponibilidades WHERE id = ? AND medico_id = ?')
      .run(Number(id), Number(medicoId));
  }

  bloqueios(medicoId) {
    return db.prepare('SELECT * FROM bloqueios WHERE medico_id = ? ORDER BY inicio ASC')
      .all(Number(medicoId));
  }

  criarBloqueio(medicoId, inicio, fim, motivo) {
    if (inicio >= fim) {
      throw Object.assign(new Error('O início do bloqueio tem de ser anterior ao fim.'), { status: 400 });
    }
    const resultado = db.prepare(`
      INSERT INTO bloqueios (medico_id, inicio, fim, motivo, criado_em) VALUES (?, ?, ?, ?, ?)
    `).run(Number(medicoId), inicio, fim, motivo ?? null, nowIso());
    return Number(resultado.lastInsertRowid);
  }

  removerBloqueio(medicoId, id) {
    db.prepare('DELETE FROM bloqueios WHERE id = ? AND medico_id = ?')
      .run(Number(id), Number(medicoId));
  }

  temBloqueio(medicoId, inicioIso, fimIso) {
    return db.prepare(`
      SELECT * FROM bloqueios WHERE medico_id = ? AND inicio < ? AND fim > ? LIMIT 1
    `).get(Number(medicoId), fimIso, inicioIso);
  }

  pacientes(medicoId) {
    return db.prepare(`
      SELECT DISTINCT p.id, u.nome, u.email, u.telefone, p.data_nascimento,
             MAX(c.data_hora) AS ultima_consulta, COUNT(c.id) AS total_consultas
      FROM consultas c
      JOIN pacientes p ON p.id = c.paciente_id
      JOIN users u ON u.id = p.utilizador_id
      WHERE c.medico_id = ?
      GROUP BY p.id
      ORDER BY ultima_consulta DESC
    `).all(Number(medicoId));
  }
}
