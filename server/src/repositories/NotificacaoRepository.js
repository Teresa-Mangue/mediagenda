import { db, nowIso } from '../db/index.js';

export class NotificacaoRepository {
  criar({ utilizadorId, consultaId, canal, evento, assunto, corpo, estado = 'enviada' }) {
    const resultado = db.prepare(`
      INSERT INTO notificacoes
        (utilizador_id, consulta_id, canal, evento, assunto, corpo, estado, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      utilizadorId ?? null, consultaId ?? null, canal, evento,
      assunto, corpo, estado, nowIso()
    );
    return Number(resultado.lastInsertRowid);
  }

  listarPorUtilizador(utilizadorId) {
    return db.prepare(`
      SELECT * FROM notificacoes WHERE utilizador_id = ? ORDER BY id DESC LIMIT 100
    `).all(Number(utilizadorId));
  }

  listarTodas({ limite = 100 } = {}) {
    return db.prepare(`
      SELECT n.*, u.nome AS destinatario_nome, u.perfil AS destinatario_perfil
      FROM notificacoes n LEFT JOIN users u ON u.id = n.utilizador_id
      ORDER BY n.id DESC LIMIT ?
    `).all(Number(limite));
  }

  marcarLida(id, utilizadorId) {
    db.prepare('UPDATE notificacoes SET estado = ?, lida_em = ? WHERE id = ? AND utilizador_id = ?')
      .run('lida', nowIso(), Number(id), Number(utilizadorId));
  }
}
