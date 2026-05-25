const path = require('path');
const { delay, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  createCard,
  createCarousel,
  listPayload,
  nf,
  prepareImage,
  quick,
  relayInteractive,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const log = (...args) => console.log('[send-group-header-grouping-test]', ...args);

function rows(prefix) {
  return [
    { header: 'A', title: `${prefix} item A`, description: 'opcao A', id: `.${prefix}_a`, rowId: `.${prefix}_row_a` },
    { header: 'B', title: `${prefix} item B`, description: 'opcao B', id: `.${prefix}_b`, rowId: `.${prefix}_row_b` },
  ];
}

function cardContent(media, label, prefix) {
  const card = createCard({
    media,
    body: label,
    footer: 'grouping test',
    subtitle: 'GH',
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

async function relayRaw(sock, jid, content) {
  const msg = generateWAMessageFromContent(jid, content, { userJid: sock.user.id });
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  return msg;
}

async function sendInvisibleText(sock, jid, text) {
  return sock.sendMessage(jid, { text });
}

async function sendProtocolOnly(sock, jid, tag) {
  return relayRaw(sock, jid, {
    protocolMessage: proto.Message.ProtocolMessage.create({
      type: proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION,
      timestampMs: Date.now(),
    }),
    messageContextInfo: proto.MessageContextInfo.create({
      paddingBytes: Buffer.from(tag),
    }),
  });
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareImage(sock, thumbPath);

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid);

  log('GH-01 invisivel + card rapido');
  await sendInvisibleText(sock, targetJid, '\u200B');
  await delay(250);
  await relayInteractive(sock, targetJid, cardContent(media, 'GH-01 depois de invisivel rapido', 'gh01'));
  await delay(1800);

  log('GH-02 invisivel + card lento');
  await sendInvisibleText(sock, targetJid, '\u2063');
  await delay(1400);
  await relayInteractive(sock, targetJid, cardContent(media, 'GH-02 depois de invisivel lento', 'gh02'));
  await delay(1800);

  log('GH-03 invisivel + card + delete invisivel');
  const seed = await sendInvisibleText(sock, targetJid, '\u200B');
  await delay(300);
  await relayInteractive(sock, targetJid, cardContent(media, 'GH-03 delete seed depois', 'gh03'));
  await delay(1200);
  try {
    await sock.sendMessage(targetJid, { delete: seed.key });
    log('GH-03 delete enviado');
  } catch (err) {
    log('GH-03 delete falhou', err?.message || err);
  }
  await delay(1800);

  log('GH-04 protocol only + card');
  try {
    await sendProtocolOnly(sock, targetJid, 'gh04');
  } catch (err) {
    log('GH-04 protocol falhou', err?.message || err);
  }
  await delay(500);
  await relayInteractive(sock, targetJid, cardContent(media, 'GH-04 depois de protocol only', 'gh04'));

  await delay(1500);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[send-group-header-grouping-test] erro fatal:', err?.stack || err);
  process.exit(1);
});
