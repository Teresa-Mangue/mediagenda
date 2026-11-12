import { criarApp } from './api/app.js';
import { seed } from './db/seed.js';
import { consultaService } from './container.js';
import { dbPath } from './db/index.js';

const porta = Number(process.env.PORT) || 4000;

const resultadoSeed = seed();
if (resultadoSeed.criado) {
  console.log('Base de dados inicializada com dados de demonstração.');
  console.log(resultadoSeed.credenciais);
}

const app = criarApp();

app.listen(porta, () => {
  console.log('');
  console.log('  MediAgenda — API');
  console.log(`  http://localhost:${porta}/api/health`);
  console.log(`  Base de dados: ${dbPath}`);
  console.log('');
});

async function executarScheduler() {
  try {
    const expiradas = await consultaService.expirarPendentes();
    const lembretes = await consultaService.enviarLembretes();
    if (expiradas.length || lembretes.length) {
      console.log(`[Scheduler] ${expiradas.length} expiradas, ${lembretes.length} lembretes.`);
    }
  } catch (erro) {
    console.error('[Scheduler]', erro.message);
  }
}

setTimeout(executarScheduler, 3000);
setInterval(executarScheduler, 60_000);

process.on('unhandledRejection', (erro) => {
  console.error('[UnhandledRejection]', erro);
});
