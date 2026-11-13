import { IEnviadorEmail, IEnviadorSMS, IEnviadorWhatsApp } from './canais.js';

class Notificacao {
  constructor(canal) {
    this.canal = canal;
  }

  async enviar() {
    throw new Error('Notificação não implementada.');
  }
}

export class EmailNotificacao extends Notificacao {
  constructor(enviadorEmail) {
    super('email');
    if (!(enviadorEmail instanceof IEnviadorEmail)) {
      throw new Error('EmailNotificacao exige um IEnviadorEmail.');
    }
    this.enviador = enviadorEmail;
  }

  async enviar({ para, assunto, corpo }) {
    return this.enviador.enviarEmail({ para, assunto, corpo });
  }
}

export class WhatsAppNotificacao extends Notificacao {
  constructor(enviadorWhatsApp) {
    super('whatsapp');
    if (!(enviadorWhatsApp instanceof IEnviadorWhatsApp)) {
      throw new Error('WhatsAppNotificacao exige um IEnviadorWhatsApp.');
    }
    this.enviador = enviadorWhatsApp;
  }

  async enviar({ para, assunto, corpo }) {
    return this.enviador.enviarWhatsApp({ para, mensagem: `${assunto}\n${corpo}` });
  }
}

export class SMSNotificacao extends Notificacao {
  constructor(enviadorSMS) {
    super('sms');
    if (!(enviadorSMS instanceof IEnviadorSMS)) {
      throw new Error('SMSNotificacao exige um IEnviadorSMS.');
    }
    this.enviador = enviadorSMS;
  }

  async enviar({ para, assunto, corpo }) {
    return this.enviador.enviarSMS({ para, mensagem: `${assunto}\n${corpo}` });
  }
}

/**
 * Factory Method — quem chama pede "uma notificação do tipo X"
 * e recebe a classe concreta certa, sem conhecer a sua construção.
 */
export class NotificacaoFactory {
  #email;
  #sms;
  #whatsapp;

  constructor({ emailAdapter, smsAdapter, whatsappAdapter = null }) {
    this.#email = emailAdapter;
    this.#sms = smsAdapter;
    this.#whatsapp = whatsappAdapter;
  }

  criar(tipo) {
    if (tipo === 'email') return new EmailNotificacao(this.#email);
    if (tipo === 'sms') return new SMSNotificacao(this.#sms);
    if (tipo === 'whatsapp') {
      if (!this.#whatsapp) throw new Error('Canal WhatsApp não configurado.');
      return new WhatsAppNotificacao(this.#whatsapp);
    }
    throw new Error(`Tipo de notificação desconhecido: ${tipo}`);
  }
}
