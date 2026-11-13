/**
 * Gera a versão HTML (pronta a imprimir em PDF) do guia de defesa.
 *
 * Uso: node scripts/gerar-documento.js
 * Depois: abrir docs/documento-final.html no Edge/Chrome e Imprimir → Guardar como PDF,
 * ou usar o Edge em modo headless (ver README/GUIA).
 */
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

const raiz = path.resolve(import.meta.dirname, '..');
const origem = path.join(raiz, 'docs', 'GUIA-DEFESA.md');
const destino = path.join(raiz, 'docs', 'documento-final.html');

const md = fs.readFileSync(origem, 'utf8');
// O PDF tem capa própria: remove o H1 e a introdução do Markdown para não duplicar o título.
const mdCorpo = md.replace(/^# .+\n\n(?:>.*\n)+\n*/, '');
const corpo = marked.parse(mdCorpo, { gfm: true, breaks: false });

const secoes = [...md.matchAll(/^##\s+(.+)$/gm)].map((m) =>
  m[1].trim().replace(/^\d+(?:\.\d+)*\.\s*/, '')
);
const indice = secoes
  .map((titulo) => `<li>${titulo.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`)
  .join('\n');

const alunos = [
  ['Ermenegildo dos Santos D. Alberto', '2025EIN122'],
  ['Fernando António Catemene', '2024EIN194'],
  ['Henriques Joaquim Gove', '2024EIN151'],
  ['Hilénio José Jamisse', '2024EIN196'],
  ['Teresa Francisco Mangue', '2024EIN187']
];

const linhasAlunos = alunos
  .map(([nome, numero]) => `<tr><td>${nome}</td><td class="num">${numero}</td></tr>`)
  .join('\n');

const html = `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>MediAgenda — Documentação Técnica e Guia de Defesa</title>
<style>
  :root {
    --azul: #0f3b57;
    --azul-claro: #17638c;
    --teal: #0e8f86;
    --cinza: #5b6b78;
    --linha: #d7e2e9;
    --fundo: #f4f8fa;
  }
  * { box-sizing: border-box; }
  html { font-size: 10.5pt; }
  body {
    margin: 0;
    color: #1d2b36;
    font-family: "Segoe UI", "Calibri", "Arial", sans-serif;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  a { color: var(--azul-claro); text-decoration: none; }
  p { margin: 0 0 .55em; }
  strong { color: #12232f; }
  code {
    font-family: "Cascadia Mono", "Consolas", monospace;
    font-size: .88em;
    background: #eef4f8;
    border: 1px solid #dbe7ee;
    border-radius: 3px;
    padding: .05em .3em;
  }
  pre {
    background: #f4f8fa;
    border: 1px solid var(--linha);
    border-left: 4px solid var(--teal);
    border-radius: 4px;
    padding: 10px 12px;
    margin: .7em 0 1em;
    font-size: 8.3pt;
    line-height: 1.42;
    white-space: pre-wrap;
    word-break: break-word;
    break-inside: avoid;
  }
  pre code { background: none; border: 0; padding: 0; font-size: inherit; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: .6em 0 1em;
    font-size: 8.9pt;
  }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td {
    border: 1px solid var(--linha);
    padding: 5px 7px;
    text-align: left;
    vertical-align: top;
  }
  th { background: #e8f1f6; color: var(--azul); font-weight: 600; }
  tbody tr:nth-child(even) td { background: #fbfdfe; }
  blockquote {
    margin: .7em 0 1em;
    padding: 8px 12px;
    border-left: 4px solid #f0b429;
    background: #fffaf0;
    color: #4a3b17;
    border-radius: 0 4px 4px 0;
    break-inside: avoid;
  }
  blockquote p:last-child { margin-bottom: 0; }
  ul, ol { margin: .3em 0 .8em 1.25em; padding: 0; }
  li { margin: .12em 0; }
  hr { border: 0; border-top: 1px solid var(--linha); margin: 1.2em 0; }

  h1, h2, h3, h4 { color: var(--azul); line-height: 1.25; }
  h1 { font-size: 22pt; margin: 0 0 .4em; }
  h2 {
    font-size: 16pt;
    margin: 0 0 .55em;
    padding-bottom: .28em;
    border-bottom: 2px solid var(--teal);
    break-before: page;
  }
  h3 { font-size: 12.1pt; margin: 1.1em 0 .35em; break-after: avoid; }
  h4 { font-size: 10.8pt; margin: .9em 0 .3em; break-after: avoid; }

  /* Capa */
  .capa {
    height: 247mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    break-after: page;
  }
  .capa-topo { border-top: 7px solid var(--teal); padding-top: 12mm; }
  .instituicao {
    color: var(--cinza);
    font-size: 9.6pt;
    letter-spacing: .09em;
    text-transform: uppercase;
    line-height: 1.7;
    margin-bottom: 34mm;
  }
  .marca { display: flex; align-items: center; gap: 10px; margin-bottom: 8mm; }
  .marca-sinal {
    width: 20mm; height: 20mm;
    background: var(--azul);
    color: #fff;
    border-radius: 6mm;
    display: flex; align-items: center; justify-content: center;
    font-size: 26pt; font-weight: 700;
  }
  .marca-nome { font-size: 38pt; font-weight: 700; color: var(--azul); letter-spacing: -.02em; }
  .subtitulo { font-size: 15pt; color: var(--teal); font-weight: 600; margin: 0 0 3mm; }
  .tipo { font-size: 10.5pt; color: var(--cinza); letter-spacing: .16em; text-transform: uppercase; }
  .capa-rodape { border-top: 1px solid var(--linha); padding-top: 8mm; }
  .alunos { width: 100%; border: 0; margin: 0 0 6mm; font-size: 9.6pt; }
  .alunos td { border: 0; padding: 2px 0; background: none !important; }
  .alunos .num { text-align: right; color: var(--cinza); font-family: "Cascadia Mono", monospace; }
  .docente { font-size: 9.6pt; color: #334; margin: 0 0 2mm; }
  .local { font-size: 9pt; color: var(--cinza); letter-spacing: .1em; text-transform: uppercase; }

  /* Sumário */
  .sumario h1 { font-size: 18pt; border-bottom: 2px solid var(--teal); padding-bottom: .3em; }
  .sumario ol { columns: 2; column-gap: 14mm; margin-top: 8mm; font-size: 9.8pt; }
  .sumario li { margin: 0 0 .55em; break-inside: avoid; color: #263844; }
  .nota {
    margin-top: 10mm;
    padding: 9px 12px;
    background: var(--fundo);
    border: 1px solid var(--linha);
    border-radius: 4px;
    font-size: 8.8pt;
    color: var(--cinza);
  }
  .evitar-quebra { break-inside: avoid; }
  main { break-before: page; }
  main > h2:first-of-type { break-before: auto; }
  @page { size: A4; margin: 19mm 17mm 18mm; }
</style>
</head>
<body>

<section class="capa">
  <div class="capa-topo">
    <div class="instituicao">
      Divisão de Engenharia<br />
      Curso de Engenharia Informática · 3.º Ano · Nocturno
    </div>
    <div class="marca">
      <div class="marca-sinal">+</div>
      <div class="marca-nome">MediAgenda</div>
    </div>
    <p class="subtitulo">Sistema de Marcação e Gestão de Consultas Médicas</p>
    <p class="tipo">Documentação técnica · Arquitectura · Guia de defesa</p>
  </div>

  <div class="capa-rodape">
    <table class="alunos">
      <tbody>
        ${linhasAlunos}
      </tbody>
    </table>
    <p class="docente"><strong>Docente:</strong> MSc. Luís Jorge Nhacanhaca</p>
    <p class="local">Tete · 2026</p>
  </div>
</section>

<section class="sumario">
  <h1>Sumário</h1>
  <ol>
    ${indice}
  </ol>
  <p class="nota">
    Documento gerado a partir de <code>docs/GUIA-DEFESA.md</code> em 13 de Novembro de 2026.
    A aplicação corre localmente em <code>http://localhost:5173</code> (interface) e
    <code>http://localhost:4000</code> (API). As credenciais, o link de demonstração e o
    checklist de arranque estão nas secções 2, 3 e 11.
  </p>
</section>

<main>
${corpo}
</main>

</body>
</html>`;

fs.writeFileSync(destino, html, 'utf8');
console.log(`Documento gerado: ${destino}`);
console.log(`Secções no sumário: ${secoes.length}`);
