import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { http, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utilizador, setUtilizador] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregarSessao = useCallback(async () => {
    if (!tokenStore.obter()) {
      setCarregando(false);
      return;
    }
    try {
      const dados = await http.get('/auth/me');
      setUtilizador({ ...dados.utilizador, medico: dados.medico, paciente: dados.paciente });
    } catch {
      tokenStore.limpar();
      setUtilizador(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregarSessao(); }, [carregarSessao]);

  useEffect(() => {
    const aoExpirar = () => setUtilizador(null);
    window.addEventListener('mediagenda:sessao-expirada', aoExpirar);
    return () => window.removeEventListener('mediagenda:sessao-expirada', aoExpirar);
  }, []);

  const login = useCallback(async (email, password) => {
    const dados = await http.post('/auth/login', { email, password });
    tokenStore.guardar(dados.token);
    const sessao = await http.get('/auth/me');
    setUtilizador({ ...sessao.utilizador, medico: sessao.medico, paciente: sessao.paciente });
    return sessao.utilizador;
  }, []);

  const logout = useCallback(() => {
    tokenStore.limpar();
    setUtilizador(null);
  }, []);

  const atualizar = useCallback(async (dados) => {
    await http.put('/auth/me', dados);
    await carregarSessao();
  }, [carregarSessao]);

  const valor = useMemo(() => ({
    utilizador,
    carregando,
    autenticado: Boolean(utilizador),
    login,
    logout,
    atualizar,
    recarregar: carregarSessao
  }), [utilizador, carregando, login, logout, atualizar, carregarSessao]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return contexto;
}

export function iniciais(nome = '') {
  return nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}
