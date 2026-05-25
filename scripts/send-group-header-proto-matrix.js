const path = require('path');
const crypto = require('crypto');
const { delay, proto } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  createCard,
  createCarousel,
  createDirectInteractive,
  listPayload,
  nf,
  prepareImage,
  quick,
  relayInteractive,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const log = (...args) => console.log('[send-group-header-proto-matrix]', ...args);

function rows(prefix) {
  return [
    { header: 'A', title: `${prefix} item A`, description: 'opcao A', id: `.${prefix}_a`, rowId: `.${prefix}_row_a` },
    { header: 'B', title: `${prefix} item B`, description: 'opcao B', id: `.${prefix}_b`, rowId: `.${prefix}_row_b` },
  ];
}

function buttons(prefix) {
  return [
    nf('single_select', listPayload({
      title: 'ABRIR LISTA',
      buttonText: 'ABRIR LISTA',
      displayText: 'ABRIR LISTA',
      rows: rows(prefix),
      sectionTitle: prefix.toUpperCase(),
    })),
    quick('QUICK', `.${prefix}_quick`),
    ctaCopy('COPIAR', prefix.toUpperCase()),
  ];
}

function baseCard(media, label, prefix) {
  return createCard({
    media,
    body: label,
    footer: 'header proto matrix',
    subtitle: 'HS',
    buttons: buttons(prefix),
  });
}

function baseCarousel(media, label, prefix, outer = 'headerless') {
  return createCarousel({
    cards: [baseCard(media, label, prefix)],
    outer,
    outerText: label,
  });
}

function cloneMessageContent(content) {
  return proto.Message.fromObject(proto.Message.toObject(proto.Message.create(content)));
}

function future(content) {
  return proto.Message.FutureProofMessage.create({
    message: cloneMessageContent(content),
  });
}

function withRootContext(content, variant) {
  const message = cloneMessageContent(content);
  message.messageContextInfo = proto.MessageContextInfo.create({
    deviceListMetadataVersion: 2,
    messageSecret: crypto.randomBytes(32),
    paddingBytes: Buffer.from(variant),
  });
  return message;
}

function withInteractiveContext(content, jid, participantMode) {
  const message = cloneMessageContent(content);
  const interactive = message.interactiveMessage ||
    message.viewOnceMessage?.message?.interactiveMessage ||
    message.ephemeralMessage?.message?.interactiveMessage;

  if (interactive) {
    interactive.contextInfo = proto.ContextInfo.create({
      remoteJid: jid,
      participant: participantMode,
      forwardingScore: 0,
      isForwarded: false,
      mentionedJid: [],
      groupMentions: [],
    });
  }

  return message;
}

function wrapDevice(content, jid, phash) {
  return {
    deviceSentMessage: proto.Message.DeviceSentMessage.create({
      destinationJid: jid,
      message: cloneMessageContent(content),
      phash,
    }),
  };
}

function wrapDeviceFuture(content, jid, phash, field) {
  return wrapDevice({ [field]: future(content) }, jid, phash);
}

function asFutureField(content, field) {
  return { [field]: future(content) };
}

function withAlbumPlusInteractive(content) {
  const message = cloneMessageContent(content);
  message.albumMessage = proto.Message.AlbumMessage.create({
    expectedImageCount: 1,
    expectedVideoCount: 0,
  });
  return message;
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareImage(sock, thumbPath);

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid);

  const direct = createDirectInteractive(baseCard(media, 'HS-04 direto sem carousel', 'hs04'));
  const headless = baseCarousel(media, 'HS-01 headerless puro', 'hs01', 'headerless');
  const noOuter = baseCarousel(media, 'HS-02 outer none com header vazio', 'hs02', 'none');
  const rootCtx = withRootContext(baseCarousel(media, 'HS-03 root messageContextInfo', 'hs03', 'headerless'), 'hs03');
  const interactiveCtxBlank = withInteractiveContext(
    baseCarousel(media, 'HS-12 contextInfo participant vazio', 'hs12', 'headerless'),
    targetJid,
    ''
  );
  const interactiveCtxSelf = withInteractiveContext(
    baseCarousel(media, 'HS-13 contextInfo participant self', 'hs13', 'headerless'),
    targetJid,
    sock.user?.id || ''
  );

  const cases = [
    ['HS-01 headerless puro', headless],
    ['HS-02 outer none com header vazio', noOuter],
    ['HS-03 root messageContextInfo', rootCtx],
    ['HS-04 direto sem carousel', direct],
    ['HS-05 viewOnceMessage', asFutureField(baseCarousel(media, 'HS-05 viewOnceMessage', 'hs05', 'headerless'), 'viewOnceMessage')],
    ['HS-06 viewOnceMessageV2', asFutureField(baseCarousel(media, 'HS-06 viewOnceMessageV2', 'hs06', 'headerless'), 'viewOnceMessageV2')],
    ['HS-07 viewOnceMessageV2Extension', asFutureField(baseCarousel(media, 'HS-07 viewOnceMessageV2Extension', 'hs07', 'headerless'), 'viewOnceMessageV2Extension')],
    ['HS-08 ephemeralMessage', asFutureField(baseCarousel(media, 'HS-08 ephemeralMessage', 'hs08', 'headerless'), 'ephemeralMessage')],
    ['HS-09 deviceSentMessage', wrapDevice(baseCarousel(media, 'HS-09 deviceSentMessage', 'hs09', 'headerless'), targetJid, 'hs09-phash')],
    ['HS-10 deviceSent viewOnceV2', wrapDeviceFuture(baseCarousel(media, 'HS-10 deviceSent viewOnceV2', 'hs10', 'headerless'), targetJid, 'hs10-phash', 'viewOnceMessageV2')],
    ['HS-11 botInvokeMessage future', asFutureField(baseCarousel(media, 'HS-11 botInvokeMessage future', 'hs11', 'headerless'), 'botInvokeMessage')],
    ['HS-12 contextInfo participant vazio', interactiveCtxBlank],
    ['HS-13 contextInfo participant self', interactiveCtxSelf],
    ['HS-14 albumMessage + interactive', withAlbumPlusInteractive(baseCarousel(media, 'HS-14 albumMessage + interactive', 'hs14', 'headerless'))],
    ['HS-15 documentWithCaption future', asFutureField(baseCarousel(media, 'HS-15 documentWithCaption future', 'hs15', 'headerless'), 'documentWithCaptionMessage')],
  ];

  for (const [label, content] of cases) {
    log('enviando', label);
    try {
      await relayInteractive(sock, targetJid, content);
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
  console.error('[send-group-header-proto-matrix] erro fatal:', err?.stack || err);
  process.exit(1);
});
