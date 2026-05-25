const path = require('path');
const crypto = require('crypto');
const { delay, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  listPayload,
  nf,
  prepareImage,
  quick,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const log = (...args) => console.log('[send-direct-interactive-matrix]', ...args);

function rows(prefix) {
  return [
    { header: 'A', title: `${prefix} item A`, description: 'opcao A', id: `.${prefix}_a`, rowId: `.${prefix}_row_a` },
    { header: 'B', title: `${prefix} item B`, description: 'opcao B', id: `.${prefix}_b`, rowId: `.${prefix}_row_b` },
    { header: 'C', title: `${prefix} item C`, description: 'opcao C', id: `.${prefix}_c`, rowId: `.${prefix}_row_c` },
  ];
}

function selectButton(prefix, label = 'ABRIR LISTA') {
  return nf('single_select', listPayload({
    title: label,
    buttonText: label,
    displayText: label,
    rows: rows(prefix),
    sectionTitle: prefix.toUpperCase(),
  }));
}

function buttonSet(prefix, mode = 'full') {
  const sets = {
    full: [
      selectButton(prefix),
      quick('QUICK', `.${prefix}_quick`),
      ctaCopy('COPIAR', prefix.toUpperCase()),
    ],
    onlyList: [
      selectButton(prefix),
    ],
    listLast: [
      quick('QUICK', `.${prefix}_quick`),
      ctaCopy('COPIAR', prefix.toUpperCase()),
      selectButton(prefix),
    ],
    noList: [
      quick('QUICK', `.${prefix}_quick`),
      ctaCopy('COPIAR', prefix.toUpperCase()),
    ],
    twoLists: [
      selectButton(`${prefix}a`, 'LISTA A'),
      selectButton(`${prefix}b`, 'LISTA B'),
      quick('QUICK', `.${prefix}_quick`),
    ],
  };

  return sets[mode] || sets.full;
}

function headerFromMode(media, mode) {
  if (mode === 'none') return undefined;
  if (mode === 'text') {
    return proto.Message.InteractiveMessage.Header.create({
      title: 'Titulo header direto',
      subtitle: 'DI',
      hasMediaAttachment: false,
    });
  }
  if (mode === 'emptyMedia') {
    return proto.Message.InteractiveMessage.Header.create({
      title: '',
      subtitle: '',
      hasMediaAttachment: true,
      ...media,
    });
  }

  return proto.Message.InteractiveMessage.Header.create({
    title: '',
    subtitle: 'DI',
    hasMediaAttachment: true,
    ...media,
  });
}

function directInteractive(media, options = {}) {
  const {
    label,
    prefix,
    footer = 'direct interactive matrix',
    bodyMode = 'text',
    footerMode = 'text',
    headerMode = 'media',
    buttons = 'full',
    messageParamsJson,
  } = options;

  return {
    interactiveMessage: proto.Message.InteractiveMessage.create({
      body: bodyMode === 'none'
        ? undefined
        : proto.Message.InteractiveMessage.Body.create({ text: bodyMode === 'empty' ? '' : label }),
      footer: footerMode === 'none'
        ? undefined
        : proto.Message.InteractiveMessage.Footer.create({ text: footerMode === 'empty' ? '' : footer }),
      header: headerFromMode(media, headerMode),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: buttonSet(prefix, buttons),
        messageParamsJson,
      }),
    }),
  };
}

function cloneMessageContent(content) {
  return proto.Message.fromObject(proto.Message.toObject(proto.Message.create(content)));
}

function future(content) {
  return proto.Message.FutureProofMessage.create({
    message: cloneMessageContent(content),
  });
}

function asFutureField(content, field) {
  return { [field]: future(content) };
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

function withInteractiveContext(content, jid, participant) {
  const message = cloneMessageContent(content);
  if (message.interactiveMessage) {
    message.interactiveMessage.contextInfo = proto.ContextInfo.create({
      remoteJid: jid,
      participant,
      forwardingScore: 0,
      isForwarded: false,
      mentionedJid: [],
      groupMentions: [],
      ephemeralSettingTimestamp: 0,
      expiration: 0,
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

async function relay(sock, jid, content) {
  const msg = generateWAMessageFromContent(jid, content, { userJid: sock.user.id });
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  return msg;
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareImage(sock, thumbPath);

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid);

  const base = (label, prefix, extra = {}) => directInteractive(media, { label, prefix, ...extra });
  const di01 = base('DI-01 direto base HS-04', 'di01');
  const di02 = base('DI-02 direto sem footer', 'di02', { footerMode: 'none' });
  const di03 = base('DI-03 direto footer vazio', 'di03', { footerMode: 'empty' });
  const di04 = base('DI-04 direto sem header', 'di04', { headerMode: 'none' });
  const di05 = base('DI-05 direto header texto sem midia', 'di05', { headerMode: 'text' });
  const di06 = base('DI-06 direto midia sem subtitle', 'di06', { headerMode: 'emptyMedia' });
  const di07 = base('DI-07 direto body vazio', 'di07', { bodyMode: 'empty' });
  const di08 = base('DI-08 direto somente lista', 'di08', { buttons: 'onlyList' });
  const di09 = base('DI-09 direto lista por ultimo', 'di09', { buttons: 'listLast' });
  const di10 = base('DI-10 direto sem lista', 'di10', { buttons: 'noList' });
  const di11 = base('DI-11 direto duas listas', 'di11', { buttons: 'twoLists' });
  const di12 = base('DI-12 direto messageParamsJson', 'di12', {
    messageParamsJson: JSON.stringify({
      from: 'api',
      surface: 'native_flow',
      version: 1,
    }),
  });

  const cases = [
    ['DI-01 direto base HS-04', di01],
    ['DI-02 direto sem footer', di02],
    ['DI-03 direto footer vazio', di03],
    ['DI-04 direto sem header', di04],
    ['DI-05 direto header texto sem midia', di05],
    ['DI-06 direto midia sem subtitle', di06],
    ['DI-07 direto body vazio', di07],
    ['DI-08 direto somente lista', di08],
    ['DI-09 direto lista por ultimo', di09],
    ['DI-10 direto sem lista', di10],
    ['DI-11 direto duas listas', di11],
    ['DI-12 direto messageParamsJson', di12],
    ['DI-13 direct viewOnceMessage', asFutureField(base('DI-13 direct viewOnceMessage', 'di13'), 'viewOnceMessage')],
    ['DI-14 direct viewOnceMessageV2', asFutureField(base('DI-14 direct viewOnceMessageV2', 'di14'), 'viewOnceMessageV2')],
    ['DI-15 direct viewOnceMessageV2Extension', asFutureField(base('DI-15 direct viewOnceMessageV2Extension', 'di15'), 'viewOnceMessageV2Extension')],
    ['DI-16 direct ephemeralMessage', asFutureField(base('DI-16 direct ephemeralMessage', 'di16'), 'ephemeralMessage')],
    ['DI-17 direct deviceSentMessage', wrapDevice(base('DI-17 direct deviceSentMessage', 'di17'), targetJid, 'di17-phash')],
    ['DI-18 direct deviceSent viewOnceV2', wrapDeviceFuture(base('DI-18 direct deviceSent viewOnceV2', 'di18'), targetJid, 'di18-phash', 'viewOnceMessageV2')],
    ['DI-19 direct root messageContextInfo', withRootContext(base('DI-19 direct root messageContextInfo', 'di19'), 'di19')],
    ['DI-20 direct context participant vazio', withInteractiveContext(base('DI-20 direct context participant vazio', 'di20'), targetJid, '')],
    ['DI-21 direct context participant self', withInteractiveContext(base('DI-21 direct context participant self', 'di21'), targetJid, sock.user?.id || '')],
    ['DI-22 direct botInvokeMessage', asFutureField(base('DI-22 direct botInvokeMessage', 'di22'), 'botInvokeMessage')],
    ['DI-23 direct documentWithCaption', asFutureField(base('DI-23 direct documentWithCaption', 'di23'), 'documentWithCaptionMessage')],
  ];

  for (const [label, content] of cases) {
    log('enviando', label);
    try {
      await relay(sock, targetJid, content);
      log('ok', label);
    } catch (err) {
      log('falhou', label, err?.message || err);
    }
    await delay(1500);
  }

  await delay(1500);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[send-direct-interactive-matrix] erro fatal:', err?.stack || err);
  process.exit(1);
});
