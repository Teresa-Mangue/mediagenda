import { Router } from 'express';
import { assincrono, autenticar, exigirPerfil } from '../middleware.js';
import { servicos, repositorios } from '../../container.js';
import { ErroValidacao } from '../../utils/erros.js';

/**
 * Área da secretaria.
 *
 * A secretária pode:
 *  - criar médicos directamente (a conta fica aprovada e activa);
 *  - aprovar/recusar cadastros de médicos feitos no formulário público;
 *  - consultar a lista de médicos.
 *
 * Não pode aprovar outras secretárias — essa competência é do administrador.
 */
export const secretariaRouter = Router();
secretariaRouter.use(autenticar, exigirPerfil('secretario'));

secretariaRouter.get('/medicos', (req, res) => {
  res.json(repositorios.medicos.listar({
    nome: req.query.nome,
    especialidade: req.query.especialidade,
    localizacao: req.query.localizacao
  }));
});

secretariaRouter.post('/medicos', assincrono(async (req, res) => {
  const { nome, email, password, telefone, numeroRegisto, localizacao, especialidades, biografia } = req.body || {};
  if (!nome || !email || !numeroRegisto) {
    throw new ErroValidacao('Nome, e-mail e número de registo são obrigatórios.');
  }
  const resultado = await servicos.authService.registar({
    nome,
    email,
    password: password || 'Medico@123',
    perfil: 'medico',
    telefone,
    numeroRegisto,
    localizacao,
    especialidades,
    aprovadoPor: req.utilizador
  });
  res.status(201).json({
    ...resultado,
    mensagem: `Médico registado e aprovado pela secretaria. Palavra-passe inicial: ${password || 'Medico@123'}`
  });
}));

secretariaRouter.get('/aprovacoes', (req, res) => {
  res.json(servicos.authService.listarPendentes(req.utilizador));
});

secretariaRouter.post('/aprovacoes/:id/aprovar', assincrono(async (req, res) => {
  res.json(await servicos.authService.aprovar(req.params.id, req.utilizador));
}));

secretariaRouter.post('/aprovacoes/:id/recusar', assincrono(async (req, res) => {
  res.json(await servicos.authService.recusar(req.params.id, req.utilizador, req.body?.motivo ?? null));
}));
