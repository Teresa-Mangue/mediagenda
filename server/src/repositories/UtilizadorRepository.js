import { db, nowIso } from '../db/index.js';

export class UtilizadorRepository {
  porEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim()) || null;
  }

  porId(id) {
    return db.prepare(`
      SELECT id, nome, email, perfil, telefone, ativo, email_confirmado,
             preferencia_notificacao, criado_em
      FROM users WHERE id = ?
    `).get(Number(id)) || null;
  }

  criar({ nome, email, passwordHash, perfil, telefone, emailConfirmado = 0, tokenConfirmacao = null, preferenciaNotificacao = 'email' }) {
    const resultado = db.prepare(`
      INSERT INTO users
        (nome, email, password_hash, perfil, telefone, email_confirmado,
         token_confirmacao, preferencia_notificacao, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nome, String(email).toLowerCase().trim(), passwordHash, perfil, telefone ?? null,
      emailConfirmado ? 1 : 0, tokenConfirmacao, preferenciaNotificacao, nowIso()
    );
    return Number(resultado.lastInsertRowid);
  }

  atualizar(id, campos) {
    const permitidos = [
      'nome', 'telefone', 'ativo', 'email_confirmado', 'token_confirmacao',
      'token_recuperacao', 'preferencia_notificacao', 'password_hash',
      'tentativas_falhadas', 'bloqueado_ate'
    ];
    const set = [];
    const params = [];
    for (const [chave, valor] of Object.entries(campos)) {
      if (!permitidos.includes(chave)) continue;
      set.push(`${chave} = ?`);
      params.push(valor);
    }
    if (!set.length) return;
    params.push(Number(id));
    db.prepare(`UPDATE users SET ${set.join(', ')} WHERE id = ?`).run(...params);
  }

  porTokenConfirmacao(token) {
    return db.prepare('SELECT * FROM users WHERE token_confirmacao = ?').get(token) || null;
  }

  porTokenRecuperacao(token) {
    return db.prepare('SELECT * FROM users WHERE token_recuperacao = ?').get(token) || null;
  }

  listar({ perfil } = {}) {
    let sql = `SELECT id, nome, email, perfil, telefone, ativo, email_confirmado, preferencia_notificacao, criado_em
               FROM users`;
    const params = [];
    if (perfil) { sql += ' WHERE perfil = ?'; params.push(perfil); }
    sql += ' ORDER BY nome';
    return db.prepare(sql).all(...params);
  }
}
