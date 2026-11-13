import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('server/data/mediagenda.db');
console.log('CONSULTA 6');
console.log(db.prepare('SELECT * FROM consultas WHERE id = 6').get());
console.log('\nHISTÓRICO');
console.log(db.prepare('SELECT * FROM consulta_historico WHERE consulta_id = 6 ORDER BY id').all());
console.log('\nAUDITORIA');
console.log(db.prepare("SELECT id, acao, entidade, entidade_id, detalhes, criado_em FROM auditoria WHERE entidade = 'consulta' AND entidade_id = 6 ORDER BY id").all());
console.log('\nEVENTOS');
console.log(db.prepare("SELECT id, tipo, processado_em, criado_em FROM eventos WHERE payload LIKE '%\"consultaId\":6%' ORDER BY id").all());
