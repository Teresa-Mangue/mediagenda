import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTBOX = process.env.MEDIAGENDA_OUTBOX
  ? path.resolve(process.env.MEDIAGENDA_OUTBOX)
  : path.resolve(__dirname, '..', '..', '..', 'outbox');

/**
 * ISP — interfaces pequenas e focadas. Um canal não é obrigado a
 * implementar métodos de outro canal que não utiliza.
 */
export class IEnviadorEmail {
  async enviarEmail() {
    throw new Error('IEnviadorEmail.enviarEmail() não implementado.');
  }
}

export class IEnviadorSMS {
  async enviarSMS() {
    throw new Error('IEnviadorSMS.enviarSMS() não implementado.');
  }
}

/**
 * Adapter — traduz a interface do sistema (IEnviadorEmail) para SMTP.
 *
 * Com as variáveis SMTP_* definidas, envia e-mail REAL através do
 * nodemailer (Gmail, Outlook, Mailtrap, etc.). Sem configuração, escreve
 * a mensagem na outbox — modo de demonstração offline.
 *
 * Em qualquer dos casos fica sempre uma cópia em `outbox/email`, o que
 * permite auditar o que foi enviado durante a defesa.
 */
export class AdapterSMTP extends IEnviadorEmail {
  constructor({ pasta = path.join(OUTBOX, 'email') } = {}) {
    super();
    this.pasta = pasta;
    this.host = process.env.SMTP_HOST || null;
    this.porta = Number(process.env.SMTP_PORT) || 587;
    this.utilizador = process.env.SMTP_USER || null;
    this.password = process.env.SMTP_PASS || null;
    this.seguro = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || this.porta === 465;
    this.remetente = process.env.SMTP_FROM || 'MediAgenda <nao-responder@mediagenda.co.mz>';
    this.transporte = null;
  }

  /** SMTP real disponível? */
  get configurado() {
    return Boolean(this.host && this.utilizador && this.password);
  }

  async #obterTransporte() {
    if (this.transporte) return this.transporte;
    const { default: nodemailer } = await import('nodemailer');
    this.transporte = nodemailer.createTransport({
      host: this.host,
      port: this.porta,
      secure: this.seguro,
      auth: { user: this.utilizador, pass: this.password }
    });
    return this.transporte;
  }

  async enviarEmail({ para, assunto, corpo }) {
    await fs.mkdir(this.pasta, { recursive: true });
    const id = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ficheiro = path.join(this.pasta, `${id}.eml`);
    const conteudo = [
      `To: ${para}`,
      `From: ${this.remetente}`,
      `Subject: ${assunto}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      corpo
    ].join('\r\n');
    await fs.writeFile(ficheiro, conteudo, 'utf8');

    if (!this.configurado) {
      return { id, ficheiro, provedor: 'SMTP simulado (outbox)' };
    }

    try {
      const transporte = await this.#obterTransporte();
      const info = await transporte.sendMail({ from: this.remetente, to: para, subject: assunto, text: corpo });
      return { id, ficheiro, provedor: 'SMTP real (nodemailer)', messageId: info.messageId };
    } catch (erro) {
      throw new Error(`Falha no envio SMTP real: ${erro.message}`);
    }
  }
}

/**
 * Adapter — mesma ideia, mas para a API de SMS.
 * Implementa apenas IEnviadorSMS (ISP).
 */
export class AdapterSMS extends IEnviadorSMS {
  constructor({ pasta = path.join(OUTBOX, 'sms') } = {}) {
    super();
    this.pasta = pasta;
  }

  async enviarSMS({ para, mensagem }) {
    await fs.mkdir(this.pasta, { recursive: true });
    const id = `sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ficheiro = path.join(this.pasta, `${id}.txt`);
    await fs.writeFile(ficheiro, `Para: ${para}\n\n${mensagem}\n`, 'utf8');
    return { id, ficheiro, provedor: 'Gateway SMS simulado' };
  }
}

/**
 * ISP — terceira interface pequena: um canal WhatsApp não precisa de
 * saber nada sobre e-mail ou SMS. Foi adicionado sem alterar nenhum
 * serviço existente — prova prática do ISP e da extensibilidade.
 */
export class IEnviadorWhatsApp {
  async enviarWhatsApp() {
    throw new Error('IEnviadorWhatsApp.enviarWhatsApp() não implementado.');
  }
}

/**
 * Adapter — traduz a interface do sistema (IEnviadorWhatsApp) para a API
 * externa do WhatsApp Business (simulada em outbox/whatsapp).
 */
export class AdapterWhatsApp extends IEnviadorWhatsApp {
  constructor({ pasta = path.join(OUTBOX, 'whatsapp') } = {}) {
    super();
    this.pasta = pasta;
  }

  async enviarWhatsApp({ para, mensagem }) {
    await fs.mkdir(this.pasta, { recursive: true });
    const id = `whatsapp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ficheiro = path.join(this.pasta, `${id}.whatsapp.txt`);
    await fs.writeFile(ficheiro, `Para: ${para}\nCanal: WhatsApp Business (simulado)\n\n${mensagem}\n`, 'utf8');
    return { id, ficheiro, provedor: 'WhatsApp Business simulado' };
  }
}

export { OUTBOX };
