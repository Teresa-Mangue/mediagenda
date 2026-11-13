import { Router } from 'express';
import { assincrono, autenticar } from '../middleware.js';
import { servicos, repositorios } from '../../container.js';
import { ErroValidacao } from '../../utils/erros.js';

export const authRouter = Router();

authRouter.post('/registo', assincrono(async (req, res) => {
  const resultado = await servicos.authService.registar(req.body || {});
  const pendente = resultado.estadoAprovacao === 'pendente';
  res.status(201).json({
    ...resultado,
    mensagem: pendente
      ? `Conta criada. O cadastro de ${resultado.utilizador.perfil} está pendente de aprovação `
        + `(${resultado.utilizador.perfil === 'medico' ? 'secretária' : 'administrador'}). `
        + 'Confirme também o e-mail através do link enviado.'
      : 'Conta criada. Confirme o e-mail para activar todas as funcionalidades.',
    linkConfirmacao: `/confirmar-email?token=${resultado.tokenConfirmacao}`
  });
}));

authRouter.post('/login', assincrono(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new ErroValidacao('E-mail e palavra-passe são obrigatórios.');
  const resultado = servicos.authService.login({
    email, password, ip: req.ip || req.socket.remoteAddress
  });
  res.json(resultado);
}));

authRouter.post('/confirmar-email', assincrono(async (req, res) => {
  const { token } = req.body || {};
  if (!token) throw new ErroValidacao('Token obrigatório.');
  res.json(servicos.authService.confirmarEmail(token));
}));

authRouter.post('/recuperar', assincrono(async (req, res) => {
  const { email } = req.body || {};
  if (!email) throw new ErroValidacao('E-mail obrigatório.');
  res.json(await servicos.authService.recuperarPassword(email));
}));

authRouter.post('/redefinir', assincrono(async (req, res) => {
  const { token, password } = req.body || {};
  res.json(servicos.authService.redefinirPassword(token, password));
}));

authRouter.get('/me', autenticar, (req, res) => {
  const utilizador = repositorios.utilizadores.porId(req.utilizador.id);
  const medico = req.utilizador.perfil === 'medico'
    ? repositorios.medicos.porUtilizador(req.utilizador.id) : null;
  const paciente = req.utilizador.perfil === 'paciente'
    ? repositorios.pacientes.porUtilizador(req.utilizador.id) : null;
  res.json({
    utilizador: { ...utilizador, medicoId: medico?.id ?? null, pacienteId: paciente?.id ?? null },
    medico: medico ? repositorios.medicos.porId(medico.id) : null,
    paciente
  });
});

authRouter.put('/me', autenticar, (req, res) => {
  const { nome, telefone, preferenciaNotificacao } = req.body || {};
  const campos = {};
  if (nome) campos.nome = nome;
  if (telefone !== undefined) campos.telefone = telefone;
  if (preferenciaNotificacao) campos.preferencia_notificacao = preferenciaNotificacao;
  repositorios.utilizadores.atualizar(req.utilizador.id, campos);

  if (req.utilizador.perfil === 'paciente' && (req.body.dataNascimento !== undefined || req.body.endereco !== undefined)) {
    const paciente = repositorios.pacientes.porUtilizador(req.utilizador.id);
    if (paciente) {
      repositorios.pacientes.atualizar(paciente.id, {
        dataNascimento: req.body.dataNascimento ?? paciente.data_nascimento,
        endereco: req.body.endereco ?? paciente.endereco
      });
    }
  }
  res.json({ mensagem: 'Perfil actualizado.', utilizador: repositorios.utilizadores.porId(req.utilizador.id) });
});
