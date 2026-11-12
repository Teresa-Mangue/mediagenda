import { verificarToken } from '../utils/security.js';
import { ErroAutenticacao, ErroProibido } from '../utils/erros.js';

export function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;
  const dados = verificarToken(token);
  if (!dados) return next(new ErroAutenticacao('Sessão inválida ou expirada.'));
  req.utilizador = {
    id: Number(dados.sub),
    nome: dados.nome,
    perfil: dados.perfil,
    medicoId: dados.medicoId ?? null,
    pacienteId: dados.pacienteId ?? null
  };
  next();
}

export function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!req.utilizador) return next(new ErroAutenticacao());
    if (!perfis.includes(req.utilizador.perfil)) {
      return next(new ErroProibido(`Esta operação exige o perfil: ${perfis.join(' ou ')}.`));
    }
    next();
  };
}

export function assincrono(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function tratarErros(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  if (status >= 500) console.error('[API]', err);
  res.status(status).json({
    erro: err.message || 'Erro interno do servidor.',
    codigo: err.codigo || 'ERRO_INTERNO',
    detalhes: err.detalhes || null
  });
}

/** Rate limiting simples em memória (RNF de segurança). */
export function limitarPedidos({ janelaMs = 60_000, maximo = 120 } = {}) {
  const registos = new Map();
  return (req, res, next) => {
    const chave = req.ip || req.socket.remoteAddress || 'desconhecido';
    const agora = Date.now();
    const lista = (registos.get(chave) || []).filter((t) => agora - t < janelaMs);
    if (lista.length >= maximo) {
      return res.status(429).json({ erro: 'Demasiados pedidos. Tente novamente dentro de instantes.', codigo: 'RATE_LIMIT' });
    }
    lista.push(agora);
    registos.set(chave, lista);
    next();
  };
}
