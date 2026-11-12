import crypto from 'node:crypto';

const SEGREDO = process.env.MEDIAGENDA_SECRET || 'mediagenda-ispt-2026-segredo-local';
const VALIDADE_TOKEN_MS = 7 * 24 * 60 * 60 * 1000;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verificarPassword(password, armazenado) {
  if (!armazenado || !armazenado.includes(':')) return false;
  const [salt, hash] = armazenado.split(':');
  const calculado = crypto.scryptSync(String(password), salt, 64);
  const esperado = Buffer.from(hash, 'hex');
  return calculado.length === esperado.length && crypto.timingSafeEqual(calculado, esperado);
}

function assinar(conteudo) {
  return crypto.createHmac('sha256', SEGREDO).update(conteudo).digest('base64url');
}

export function criarToken(payload) {
  const corpo = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + VALIDADE_TOKEN_MS })
  ).toString('base64url');
  return `${corpo}.${assinar(corpo)}`;
}

export function verificarToken(token) {
  if (!token || !String(token).includes('.')) return null;
  const [corpo, assinatura] = String(token).split('.');
  const esperada = assinar(corpo);
  if (assinatura.length !== esperada.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    if (!dados.exp || dados.exp < Date.now()) return null;
    return dados;
  } catch {
    return null;
  }
}

export function tokenAleatorio() {
  return crypto.randomBytes(24).toString('hex');
}
