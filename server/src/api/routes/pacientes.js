import { Router } from 'express';
import { assincrono, autenticar, exigirPerfil } from '../middleware.js';
import { servicos, repositorios } from '../../container.js';
import { ErroValidacao } from '../../utils/erros.js';

export const pacientesRouter = Router();
pacientesRouter.use(autenticar, exigirPerfil('secretario', 'admin'));

pacientesRouter.get('/', (req, res) => {
  res.json(repositorios.pacientes.listar({ nome: req.query.nome }));
});

pacientesRouter.post('/', assincrono(async (req, res) => {
  const { nome, email, telefone, dataNascimento, endereco, password } = req.body || {};
  if (!nome || !email) throw new ErroValidacao('Nome e e-mail são obrigatórios.');
  const resultado = await servicos.authService.registar({
    nome,
    email,
    password: password || 'MediAgenda123',
    perfil: 'paciente',
    telefone,
    dataNascimento,
    endereco
  });
  res.status(201).json({
    ...resultado,
    mensagem: 'Paciente registado. Palavra-passe inicial: ' + (password || 'MediAgenda123')
  });
}));

pacientesRouter.put('/:id', (req, res) => {
  const paciente = repositorios.pacientes.porId(req.params.id);
  if (!paciente) throw new ErroValidacao('Paciente não encontrado.');
  const { nome, telefone, dataNascimento, endereco } = req.body || {};
  repositorios.pacientes.atualizar(paciente.id, {
    dataNascimento: dataNascimento ?? paciente.data_nascimento,
    endereco: endereco ?? paciente.endereco
  });
  repositorios.utilizadores.atualizar(paciente.utilizador_id, { nome, telefone });
  res.json({ mensagem: 'Paciente actualizado.', paciente: repositorios.pacientes.porId(paciente.id) });
});

pacientesRouter.get('/:id/consultas', (req, res) => {
  res.json(repositorios.consultas.listarPorPaciente(req.params.id));
});
