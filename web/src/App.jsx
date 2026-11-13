import { Navigate, Route, Routes } from 'react-router-dom';
import { RotaProtegida } from './components/Layout.jsx';
import { Login } from './pages/Login.jsx';
import { Registo } from './pages/Registo.jsx';
import { Redefinir } from './pages/Redefinir.jsx';
import { ConfirmarEmail } from './pages/ConfirmarEmail.jsx';
import { ConfirmarConsulta } from './pages/ConfirmarConsulta.jsx';
import { Inicio } from './pages/Inicio.jsx';
import { MedicoDetalhe } from './pages/MedicoDetalhe.jsx';
import { MinhasConsultas } from './pages/MinhasConsultas.jsx';
import { ConsultaDetalhe } from './pages/ConsultaDetalhe.jsx';
import { Perfil } from './pages/Perfil.jsx';
import { Notificacoes } from './pages/Notificacoes.jsx';
import { PainelMedico } from './pages/PainelMedico.jsx';
import { PainelSecretario } from './pages/PainelSecretario.jsx';
import { PainelAdmin } from './pages/PainelAdmin.jsx';
import { Arquitetura } from './pages/Arquitetura.jsx';
import { Auditoria } from './pages/Auditoria.jsx';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registo" element={<Registo />} />
      <Route path="/redefinir" element={<Redefinir />} />
      <Route path="/confirmar-email" element={<ConfirmarEmail />} />
      <Route path="/confirmar-consulta" element={<ConfirmarConsulta />} />

      <Route path="/" element={<RotaProtegida><Inicio /></RotaProtegida>} />
      <Route path="/medicos/:id" element={<RotaProtegida><MedicoDetalhe /></RotaProtegida>} />
      <Route path="/consultas" element={<RotaProtegida><MinhasConsultas /></RotaProtegida>} />
      <Route path="/consultas/:id" element={<RotaProtegida><ConsultaDetalhe /></RotaProtegida>} />
      <Route path="/notificacoes" element={<RotaProtegida><Notificacoes /></RotaProtegida>} />
      <Route path="/perfil" element={<RotaProtegida><Perfil /></RotaProtegida>} />

      <Route path="/medico" element={<RotaProtegida perfis={['medico']}><PainelMedico /></RotaProtegida>} />
      <Route path="/secretaria" element={<RotaProtegida perfis={['secretario']}><PainelSecretario /></RotaProtegida>} />
      <Route path="/admin" element={<RotaProtegida perfis={['admin']}><PainelAdmin /></RotaProtegida>} />
      <Route path="/arquitetura" element={<RotaProtegida perfis={['admin']}><Arquitetura /></RotaProtegida>} />
      <Route path="/auditoria" element={<RotaProtegida perfis={['admin']}><Auditoria /></RotaProtegida>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
