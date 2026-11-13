import { db, nowIso } from '../db/index.js';

const BASE = `
  SELECT c.*,
         up.id AS paciente_utilizador_id, up.nome AS paciente_nome, up.email AS paciente_email,
         up.telefone AS paciente_telefone, up.preferencia_notificacao,
         um.id AS medico_utilizador_id, um.nome AS medico_nome, um.email AS medico_email,
         um.preferencia_notificacao AS medico_preferencia,
         m.numero_registo, m.localizacao, m.duracao_consulta_min,
         e.nome AS especialidade_nome,
         av.pontuacao AS avaliacao_pontuacao, av.comentario AS avaliacao_comentario
  FROM consultas c
  JOIN pacientes p ON p.id = c.paciente_id
  JOIN users up ON up.id = p.utilizador_id
  JOIN medicos m ON m.id = c.medico_id
  JOIN users um ON um.id = m.utilizador_id
  JOIN especialidades e ON e.id = c.especialidade_id
  LEFT JOIN avaliacoes av ON av.consulta_id = c.id
`;

export class ConsultaRepository {
  criar(dados) {
    const agora = nowIso();
    const resultado = db.prepare(`
      INSERT INTO consultas
        (paciente_id, medico_id, especialidade_id, data_hora, duracao_min, estado,
         prazo_confirmacao, token_confirmacao, criada_em, atualizada_em, criada_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      dados.pacienteId, dados.medicoId, dados.especialidadeId, dados.dataHora,
      dados.duracaoMin, dados.estado || 'pendente', dados.prazoConfirmacao,
      dados.tokenConfirmacao ?? null, agora, agora, dados.criadaPor ?? null
    );
    return Number(resultado.lastInsertRowid);
  }

  porId(id) {
    return db.prepare(`${BASE} WHERE c.id = ?`).get(Number(id));
  }

  /** Confirmação por link de e-mail — o token tem de coincidir com a consulta. */
  porIdEToken(id, token) {
    return db.prepare(`${BASE} WHERE c.id = ? AND c.token_confirmacao = ?`).get(Number(id), String(token)) || null;
  }

  listarPorPaciente(pacienteId, { estado, desde, ate } = {}) {
    let sql = `${BASE} WHERE c.paciente_id = ?`;
    const params = [Number(pacienteId)];
    if (estado) { sql += ' AND c.estado = ?'; params.push(estado); }
    if (desde) { sql += ' AND c.data_hora >= ?'; params.push(desde); }
    if (ate) { sql += ' AND c.data_hora <= ?'; params.push(ate); }
    sql += ' ORDER BY c.data_hora DESC';
    return db.prepare(sql).all(...params);
  }

  listarPorMedico(medicoId, { estado, desde, ate } = {}) {
    let sql = `${BASE} WHERE c.medico_id = ?`;
    const params = [Number(medicoId)];
    if (estado) { sql += ' AND c.estado = ?'; params.push(estado); }
    if (desde) { sql += ' AND c.data_hora >= ?'; params.push(desde); }
    if (ate) { sql += ' AND c.data_hora <= ?'; params.push(ate); }
    sql += ' ORDER BY c.data_hora ASC';
    return db.prepare(sql).all(...params);
  }

  listarTodas({ estado, desde, ate, limite = 200 } = {}) {
    let sql = `${BASE} WHERE 1 = 1`;
    const params = [];
    if (estado) { sql += ' AND c.estado = ?'; params.push(estado); }
    if (desde) { sql += ' AND c.data_hora >= ?'; params.push(desde); }
    if (ate) { sql += ' AND c.data_hora <= ?'; params.push(ate); }
    sql += ' ORDER BY c.data_hora DESC LIMIT ?';
    params.push(Number(limite));
    return db.prepare(sql).all(...params);
  }

  conflito(medicoId, inicioIso, fimIso, excluirId = 0) {
    return db.prepare(`
      SELECT c.id, c.data_hora, c.duracao_min, up.nome AS paciente_nome
      FROM consultas c
      JOIN pacientes p ON p.id = c.paciente_id
      JOIN users up ON up.id = p.utilizador_id
      WHERE c.medico_id = ?
        AND c.id <> ?
        AND c.estado IN ('pendente', 'confirmada')
        AND julianday(c.data_hora) < julianday(?)
        AND julianday(c.data_hora, '+' || c.duracao_min || ' minutes') > julianday(?)
      LIMIT 1
    `).get(Number(medicoId), Number(excluirId), fimIso, inicioIso);
  }

  contarNoDia(medicoId, inicioDiaIso, fimDiaIso, excluirId = 0) {
    const linha = db.prepare(`
      SELECT COUNT(*) AS total FROM consultas
      WHERE medico_id = ? AND id <> ? AND estado IN ('pendente', 'confirmada', 'realizada')
        AND data_hora >= ? AND data_hora <= ?
    `).get(Number(medicoId), Number(excluirId), inicioDiaIso, fimDiaIso);
    return Number(linha.total);
  }

  futurasAtivas(pacienteId, medicoId) {
    return db.prepare(`
      SELECT * FROM consultas
      WHERE paciente_id = ? AND medico_id = ?
        AND estado IN ('pendente', 'confirmada')
        AND data_hora > ?
      ORDER BY data_hora ASC
    `).all(Number(pacienteId), Number(medicoId), nowIso());
  }

  atualizar(id, campos) {
    const permitidos = [
      'data_hora', 'duracao_min', 'estado', 'motivo_cancelamento', 'cancelamento_tardio',
      'confirmada_em', 'prazo_confirmacao', 'token_confirmacao', 'especialidade_id', 'medico_id'
    ];
    const set = [];
    const params = [];
    for (const [chave, valor] of Object.entries(campos)) {
      if (!permitidos.includes(chave)) continue;
      set.push(`${chave} = ?`);
      params.push(valor);
    }
    if (!set.length) return;
    set.push('atualizada_em = ?');
    params.push(nowIso());
    params.push(Number(id));
    db.prepare(`UPDATE consultas SET ${set.join(', ')} WHERE id = ?`).run(...params);
  }

  registarHistorico(consultaId, estadoAnterior, estadoNovo, motivo, autorId, criadoEm) {
    db.prepare(`
      INSERT INTO consulta_historico (consulta_id, estado_anterior, estado_novo, motivo, autor_id, criado_em)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(Number(consultaId), estadoAnterior ?? null, estadoNovo, motivo ?? null, autorId ?? null, criadoEm || nowIso());
  }

  historico(consultaId) {
    return db.prepare(`
      SELECT h.*, u.nome AS autor_nome
      FROM consulta_historico h
      LEFT JOIN users u ON u.id = h.autor_id
      WHERE h.consulta_id = ?
      ORDER BY h.id ASC
    `).all(Number(consultaId));
  }

  pendentesExpiradas(agora = nowIso()) {
    return db.prepare(`
      SELECT * FROM consultas
      WHERE estado = 'pendente' AND prazo_confirmacao <= ?
      ORDER BY prazo_confirmacao ASC
    `).all(agora);
  }

  proximasParaLembrete(entreInicio, entreFim) {
    return db.prepare(`
      SELECT * FROM consultas
      WHERE estado = 'confirmada' AND data_hora BETWEEN ? AND ?
    `).all(entreInicio, entreFim);
  }

  lembreteJaEnviado(consultaId, janela) {
    return db.prepare(`
      SELECT id FROM notificacoes
      WHERE consulta_id = ? AND evento = ?
      LIMIT 1
    `).get(Number(consultaId), janela);
  }

  confirmadasFuturas(medicoId, agora = nowIso()) {
    return db.prepare(`
      SELECT * FROM consultas
      WHERE medico_id = ? AND estado IN ('pendente', 'confirmada') AND data_hora > ?
    `).all(Number(medicoId), agora);
  }
}
