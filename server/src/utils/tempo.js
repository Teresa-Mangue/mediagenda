export const MINUTO = 60 * 1000;
export const HORA = 60 * MINUTO;

export function paraIso(data) {
  return new Date(data).toISOString();
}

export function deIso(iso) {
  return new Date(iso);
}

export function adicionarMinutos(data, minutos) {
  return new Date(new Date(data).getTime() + minutos * MINUTO);
}

export function adicionarHoras(data, horas) {
  return new Date(new Date(data).getTime() + horas * HORA);
}

export function diferencaHoras(maior, menor) {
  return (new Date(maior).getTime() - new Date(menor).getTime()) / HORA;
}

/** 1 = segunda ... 7 = domingo */
export function diaSemanaLocal(data) {
  const d = new Date(data).getDay();
  return d === 0 ? 7 : d;
}

export function minutosDeHora(hora) {
  const [h, m] = String(hora).split(':').map(Number);
  return h * 60 + m;
}

export function horaDeMinutos(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Combina 'YYYY-MM-DD' + 'HH:MM' como hora local da clínica. */
export function combinarDataHora(dataIso, hora) {
  const [ano, mes, dia] = String(dataIso).split('-').map(Number);
  const [h, m] = String(hora).split(':').map(Number);
  return new Date(ano, mes - 1, dia, h, m, 0, 0);
}

export function chaveData(data) {
  const d = new Date(data);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function inicioDoDia(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fimDoDia(data) {
  const d = new Date(data);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function mesmoDia(a, b) {
  return chaveData(a) === chaveData(b);
}

export function formatarDataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function formatarData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatarHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

export function diaSemanaTexto(dia) {
  return ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][dia] ?? '';
}
