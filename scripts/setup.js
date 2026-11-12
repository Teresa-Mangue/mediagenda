import { seed } from '../server/src/db/seed.js';

const resultado = seed({ reset: process.argv.includes('--reset') });
console.log('');
console.log('MediAgenda — preparação concluída.');
console.log(JSON.stringify(resultado, null, 2));
console.log('');
console.log('Execute:  npm run dev');
console.log('Abra:     http://localhost:5173');
