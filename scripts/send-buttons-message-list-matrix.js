const path = require('path');
const { delay, generateWAMessageFromContent, prepareWAMessageMedia, proto } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const log = (...args) => console.log('[send-buttons-message-list-matrix]', ...args);

function rowBase(prefix) {
  return [
    { header: 'A', title: `${prefix} A`, description: 'buttonsMessage list', id: `.${prefix}_a`, rowId: `.${prefix}_row_a` },
    { header: 'B', title: `${prefix} B`, description: 'buttonsMessage list', id: `.${prefix}_b`, rowId: `.${prefix}_row_b` },
  ];
}

function rows(prefix, mode) {
  const base = rowBase(prefix);
  if (mode === 'idOnly') return base.map(({ title, description, id }) => ({ title, description, id }));
  if (mode === 'rowIdOnly') return base.map(({ title, description, rowId }) => ({ title, description, rowId }));
  if (mode === 'clean') return base.map(({ title, id }) => ({ title, id }));
  return base;
}

function sections(prefix, mode) {
  return [
    {
      title: `${prefix.toUpperCase()} BM`,
      highlight_label: 'bm',
      rows: rows(prefix, mode),
    },
  ];
}

function payload(prefix, mode = 'full') {
  if (mode === 'titleOnly') return { title: 'ABRIR LISTA' };
  if (mode === 'buttonTextOnly') return { button_text: 'ABRIR LISTA', sections: sections(prefix) };
  if (mode === 'displayTextOnly') return { display_text: 'ABRIR LISTA', sections: sections(prefix) };
  if (mode === 'buttonTextObject') {
    return {
      title: 'ABRIR LISTA',
      button_text: { display_text: 'ABRIR LISTA' },
      sections: sections(prefix),
    };
  }
  if (mode === 'cloudAction') {
    return {
      type: 'list',
      body: { text: 'D3 body' },
      action: {
        button: 'ABRIR LISTA',
        sections: sections(prefix, 'idOnly').map((section) => ({
          title: section.title,
          rows: section.rows,
        })),
      },
    };
  }
  if (mode === 'listType') {
    return {
      title: 'ABRIR LISTA',
      button_text: 'ABRIR LISTA',
      display_text: 'ABRIR LISTA',
      list_type: 'SINGLE_SELECT',
      listType: 'SINGLE_SELECT',
      sections: sections(prefix),
    };
  }

  return {
    title: 'ABRIR LISTA',
    button_text: 'ABRIR LISTA',
    display_text: 'ABRIR LISTA',
    sections: sections(prefix, mode),
  };
}

function nativeButton(prefix, options = {}) {
  return {
    buttonId: options.buttonId === false ? undefined : `.${prefix}_native`,
    buttonText: options.noButtonText ? undefined : { displayText: options.buttonText || 'ABRIR LISTA' },
    type: proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW,
    nativeFlowInfo: {
      name: options.name || 'single_select',
      paramsJson: JSON.stringify(payload(prefix, options.payloadMode)),
    },
  };
}

function responseButton(prefix, text = 'FALLBACK') {
  return {
    buttonId: `.${prefix}_fallback`,
    buttonText: { displayText: text },
    type: proto.Message.ButtonsMessage.Button.Type.RESPONSE,
  };
}

function buttonsMessage(label, prefix, options = {}) {
  const body = {
    contentText: label,
    footerText: options.footer === false ? undefined : (options.footer || 'D3 buttonsMessage type=2'),
    contextInfo: options.contextInfo,
    headerType: options.headerType || 1,
    text: options.text,
    imageMessage: options.imageMessage,
    locationMessage: options.locationMessage,
    buttons: options.buttons || [nativeButton(prefix, options)],
  };

  return proto.Message.fromObject({ buttonsMessage: body });
}

function viewOnce(content) {
  return {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
        },
        ...content,
      },
    },
  };
}

function contextInfo(kind) {
  if (kind === 'forward') {
    return {
      forwardingScore: 999,
      isForwarded: true,
    };
  }
  if (kind === 'ad') {
    return {
      forwardingScore: 1,
      isForwarded: true,
      alwaysShowAdAttribution: true,
      externalAdReply: {
        title: 'D3 ad',
        body: 'buttonsMessage list',
        mediaType: 1,
        sourceUrl: 'https://whatsapp.com',
        showAdAttribution: true,
      },
    };
  }
  return undefined;
}

async function relay(sock, jid, content) {
  const msg = generateWAMessageFromContent(jid, content, { userJid: sock.user.id });
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  return msg;
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareWAMessageMedia(
    { image: { url: thumbPath } },
    { upload: sock.waUploadToServer }
  ).catch(() => ({}));

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid);

  const cases = [
    ['D3-01 BM full payload', buttonsMessage('D3-01 BM full payload', 'd301')],
    ['D3-02 BM id only rows', buttonsMessage('D3-02 BM id only rows', 'd302', { payloadMode: 'idOnly' })],
    ['D3-03 BM rowId only rows', buttonsMessage('D3-03 BM rowId only rows', 'd303', { payloadMode: 'rowIdOnly' })],
    ['D3-04 BM clean rows', buttonsMessage('D3-04 BM clean rows', 'd304', { payloadMode: 'clean' })],
    ['D3-05 BM title only', buttonsMessage('D3-05 BM title only', 'd305', { payloadMode: 'titleOnly' })],
    ['D3-06 BM button_text only', buttonsMessage('D3-06 BM button_text only', 'd306', { payloadMode: 'buttonTextOnly' })],
    ['D3-07 BM display_text only', buttonsMessage('D3-07 BM display_text only', 'd307', { payloadMode: 'displayTextOnly' })],
    ['D3-08 BM button_text object', buttonsMessage('D3-08 BM button_text object', 'd308', { payloadMode: 'buttonTextObject' })],
    ['D3-09 BM cloud action', buttonsMessage('D3-09 BM cloud action', 'd309', { payloadMode: 'cloudAction' })],
    ['D3-10 BM listType fields', buttonsMessage('D3-10 BM listType fields', 'd310', { payloadMode: 'listType' })],
    ['D3-11 BM no buttonId', buttonsMessage('D3-11 BM no buttonId', 'd311', { buttonId: false })],
    ['D3-12 BM no buttonText', buttonsMessage('D3-12 BM no buttonText', 'd312', { noButtonText: true })],
    ['D3-13 BM name single_select_v2', buttonsMessage('D3-13 BM name single_select_v2', 'd313', { name: 'single_select_v2' })],
    ['D3-14 BM name list_message', buttonsMessage('D3-14 BM name list_message', 'd314', { name: 'list_message' })],
    ['D3-15 BM name list', buttonsMessage('D3-15 BM name list', 'd315', { name: 'list' })],
    ['D3-16 BM response after', buttonsMessage('D3-16 BM response after', 'd316', {
      buttons: [nativeButton('d316'), responseButton('d316')],
    })],
    ['D3-17 BM response first', buttonsMessage('D3-17 BM response first', 'd317', {
      buttons: [responseButton('d317'), nativeButton('d317')],
    })],
    ['D3-18 BM two native names', buttonsMessage('D3-18 BM two native names', 'd318', {
      buttons: [nativeButton('d318a', { name: 'single_select' }), nativeButton('d318b', { name: 'single_select_v2' })],
    })],
    ['D3-19 BM header text type2', buttonsMessage('D3-19 BM header text type2', 'd319', {
      headerType: 2,
      text: 'D3 header text',
    })],
    ['D3-20 BM header image type4', buttonsMessage('D3-20 BM header image type4', 'd320', {
      headerType: 4,
      imageMessage: media.imageMessage,
    })],
    ['D3-21 BM header location type6', buttonsMessage('D3-21 BM header location type6', 'd321', {
      headerType: 6,
      locationMessage: {
        degreesLatitude: -3.119,
        degreesLongitude: -60.021,
        name: 'D3 Manaus',
      },
    })],
    ['D3-22 BM sem footer', buttonsMessage('D3-22 BM sem footer', 'd322', { footer: false })],
    ['D3-23 BM context forwarded', buttonsMessage('D3-23 BM context forwarded', 'd323', { contextInfo: contextInfo('forward') })],
    ['D3-24 BM context externalAd', buttonsMessage('D3-24 BM context externalAd', 'd324', { contextInfo: contextInfo('ad') })],
    ['D3-25 viewOnce BM full', viewOnce(buttonsMessage('D3-25 viewOnce BM full', 'd325'))],
    ['D3-26 viewOnce BM response first', viewOnce(buttonsMessage('D3-26 viewOnce BM response first', 'd326', {
      buttons: [responseButton('d326'), nativeButton('d326')],
    }))],
  ];

  for (const [label, content] of cases) {
    log('enviando', label);
    try {
      await relay(sock, targetJid, content);
      log('ok', label);
    } catch (err) {
      log('falhou', label, err?.message || err);
    }
    await delay(1300);
  }

  await delay(1500);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[send-buttons-message-list-matrix] erro fatal:', err?.stack || err);
  process.exit(1);
});
