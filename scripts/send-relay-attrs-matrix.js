const path = require('path');
const { delay, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  createCard,
  createCarousel,
  listPayload,
  nf,
  prepareImage,
  quick,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const log = (...args) => console.log('[send-relay-attrs-matrix]', ...args);

function rows(prefix) {
  return [
    { title: `${prefix} item A`, description: 'opcao A', id: `.${prefix}_a`, rowId: `.${prefix}_row_a` },
    { title: `${prefix} item B`, description: 'opcao B', id: `.${prefix}_b`, rowId: `.${prefix}_row_b` },
  ];
}

function content(media, label, prefix) {
  const card = createCard({
    media,
    body: label,
    footer: 'relay attrs matrix',
    subtitle: 'RA',
    buttons: [
      nf('single_select', listPayload({
        title: 'ABRIR LISTA',
        buttonText: 'ABRIR LISTA',
        displayText: 'ABRIR LISTA',
        rows: rows(prefix),
        sectionTitle: prefix.toUpperCase(),
      })),
      quick('QUICK', `.${prefix}_quick`),
      ctaCopy('COPIAR', prefix.toUpperCase()),
    ],
  });

  return createCarousel({
    cards: [card],
    outer: 'headerless',
    outerText: label,
  });
}

async function relay(sock, jid, body, options = {}) {
  const msg = generateWAMessageFromContent(jid, body, { userJid: sock.user.id });
  await sock.relayMessage(jid, msg.message, {
    messageId: msg.key.id,
    ...options,
  });
  return msg;
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareImage(sock, thumbPath);

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid);

  const cases = [
    ['RA-01 relay default', content(media, 'RA-01 relay default', 'ra01'), {}],
    ['RA-02 category peer', content(media, 'RA-02 category peer', 'ra02'), {
      additionalAttributes: { category: 'peer' },
    }],
    ['RA-03 category peer high_force', content(media, 'RA-03 category peer high_force', 'ra03'), {
      additionalAttributes: { category: 'peer', push_priority: 'high_force' },
    }],
    ['RA-04 bot additional node', content(media, 'RA-04 bot additional node', 'ra04'), {
      additionalNodes: [{ tag: 'bot', attrs: { biz_bot: '1' } }],
    }],
    ['RA-05 participant self', content(media, 'RA-05 participant self', 'ra05'), {
      participant: { jid: sock.user.id },
    }],
  ];

  for (const [label, body, options] of cases) {
    log('enviando', label);
    try {
      await relay(sock, targetJid, body, options);
      log('ok', label);
    } catch (err) {
      log('falhou', label, err?.message || err);
    }
    await delay(1600);
  }

  await delay(1500);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[send-relay-attrs-matrix] erro fatal:', err?.stack || err);
  process.exit(1);
});
