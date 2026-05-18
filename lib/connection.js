const {
  default: makeWASocket,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const Pino = require('pino');

function normalizeJid(value) {
  if (!value) {
    throw new Error('informe o numero ou jid de destino');
  }

  if (value.includes('@')) {
    return value;
  }

  const digits = value.replace(/\D/g, '');
  if (!digits) {
    throw new Error(`jid invalido: ${value}`);
  }

  return digits.startsWith('120363') ? `${digits}@g.us` : `${digits}@s.whatsapp.net`;
}

function waitForOpen(sock, log, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout esperando conexao abrir')), timeoutMs);

    sock.ev.on('connection.update', (update) => {
      if (update.connection || update.receivedPendingNotifications !== undefined) {
        log('status', update.connection || '-', 'pending', update.receivedPendingNotifications);
      }

      if (
        update.connection === 'open' ||
        update.receivedPendingNotifications === true ||
        update.receivedPendingNotifications === 'true'
      ) {
        clearTimeout(timer);
        resolve();
      }

      if (update.connection === 'close') {
        const reason = new Boom(update.lastDisconnect?.error)?.output?.statusCode;
        if (reason === DisconnectReason.loggedOut) {
          clearTimeout(timer);
          reject(new Error('sessao deslogada'));
        }
      }
    });
  });
}

async function connectWa(options = {}) {
  const {
    sessionDir = './session',
    log = (...args) => console.log('[wa]', ...args),
    printQRInTerminal = true,
  } = options;

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({
    logger: Pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: 'fatal' })),
    },
    browser: ['Mac OS', 'Safari', '10.15.7'],
    printQRInTerminal,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
    keepAliveIntervalMs: 10000,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);
  await waitForOpen(sock, log);
  return sock;
}

module.exports = {
  connectWa,
  normalizeJid,
};
