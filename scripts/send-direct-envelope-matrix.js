const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { delay, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  ctaUrl,
  listPayload,
  nf,
  prepareImage,
  quick,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const log = (...args) => console.log('[send-direct-envelope-matrix]', ...args);

function bareUserJid(id) {
  const user = String(id || '').split('@')[0].split(':')[0];
  return user ? `${user}@s.whatsapp.net` : undefined;
}

function rows(prefix) {
  return [
    { header: 'A', title: `${prefix} opcao A`, description: 'direct envelope', id: `.${prefix}_a`, rowId: `.${prefix}_row_a` },
    { header: 'B', title: `${prefix} opcao B`, description: 'direct envelope', id: `.${prefix}_b`, rowId: `.${prefix}_row_b` },
    { header: 'C', title: `${prefix} opcao C`, description: 'direct envelope', id: `.${prefix}_c`, rowId: `.${prefix}_row_c` },
  ];
}

function selectPayload(prefix, extra = {}) {
  return {
    ...listPayload({
      title: extra.title || 'ABRIR LISTA',
      buttonText: extra.buttonText || extra.title || 'ABRIR LISTA',
      displayText: extra.displayText || extra.title || 'ABRIR LISTA',
      rows: rows(prefix),
      sectionTitle: prefix.toUpperCase(),
    }),
    ...extra,
  };
}

function buttonTextObjectPayload(prefix) {
  return {
    title: 'DX OBJECT',
    button_text: { display_text: 'ABRIR DX OBJETO' },
    sections: [
      {
        title: 'DX button_text object',
        rows: rows(prefix),
      },
    ],
  };
}

function cloudApiStylePayload(prefix) {
  return {
    type: 'list',
    header: { type: 'text', text: 'DX header cloud style' },
    body: { text: 'DX corpo cloud style' },
    footer: { text: 'DX footer cloud style' },
    action: {
      button: 'ABRIR DX ACTION',
      sections: [
        {
          title: 'DX action rows',
          rows: rows(prefix).map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
          })),
        },
      ],
    },
  };
}

function menuParams(limit = 2) {
  return {
    limited_time_offer: {
      text: 'DX teste',
      url: 'https://whatsapp.com',
      copy_code: 'DX',
      expiration_time: Math.floor(Date.now() / 1000) + 86400,
    },
    bottom_sheet: {
      in_thread_buttons_limit: limit,
      divider_indices: [1, 2, 3, 4, 5, 999],
      list_title: 'DX Direct Center',
      button_title: 'SHOW DX',
    },
    tap_target_configuration: {
      title: 'DX direto',
      description: 'direct interactive envelope',
      canonical_url: 'https://whatsapp.com',
      domain: 'whatsapp.com',
      button_index: 0,
    },
  };
}

function forwardedContext(ownerJid) {
  return proto.ContextInfo.create({
    mentionedJid: ownerJid ? [ownerJid] : [],
    forwardingScore: 999999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: '120363418977603376@newsletter',
      newsletterName: 'NanoBotzID Test',
      serverMessageId: 145,
    },
  });
}

function externalAdContext() {
  return proto.ContextInfo.create({
    forwardingScore: 1,
    isForwarded: true,
    alwaysShowAdAttribution: true,
    externalAdReply: {
      title: 'DX external ad',
      body: 'direct interactive',
      mediaType: 1,
      sourceUrl: 'https://whatsapp.com',
      showAdAttribution: true,
      containsAutoReply: false,
      renderLargerThumbnail: true,
    },
  });
}

function businessContext(ownerJid) {
  return proto.ContextInfo.create({
    forwardingScore: 1,
    isForwarded: true,
    businessMessageForwardInfo: {
      businessOwnerJid: ownerJid,
    },
  });
}

function buttonsFor(prefix, mode = 'full') {
  const real = nf('single_select', selectPayload(prefix));
  const realMulti = nf('single_select', selectPayload(prefix, { has_multiple_buttons: true }));
  const dummySelect = nf('single_select', { has_multiple_buttons: true });
  const callPermission = nf('call_permission_request', { has_multiple_buttons: true });
  const copied = ctaCopy('COPIAR', prefix.toUpperCase());
  const q1 = quick('QUICK', `.${prefix}_quick`);
  const q2 = quick('MENU', `.${prefix}_menu`);

  if (mode === 'onlyReal') return [real];
  if (mode === 'realFirstMenu') return [realMulti, dummySelect, callPermission, copied, q1, q2];
  if (mode === 'dummyFirstMenu') return [dummySelect, callPermission, realMulti, copied, q1, q2];
  if (mode === 'quickBefore') return [q1, real, ctaUrl('URL', 'https://whatsapp.com')];
  if (mode === 'buttonObject') return [nf('single_select', buttonTextObjectPayload(prefix)), q1, copied];
  if (mode === 'cloud') return [nf('single_select', cloudApiStylePayload(prefix)), q1, copied];
  return [real, q1, copied];
}

function mediaHeader(media, thumb, options = {}) {
  const header = {
    title: options.title || '',
    subtitle: options.subtitle || 'DX',
    hasMediaAttachment: options.hasMediaAttachment ?? true,
  };

  if (options.jpegThumbnail && thumb) {
    header.jpegThumbnail = thumb;
  }

  if (options.includeMedia !== false) {
    Object.assign(header, media);
  }

  return proto.Message.InteractiveMessage.Header.create(header);
}

function direct(media, thumb, label, prefix, options = {}) {
  return proto.Message.InteractiveMessage.create({
    contextInfo: options.contextInfo,
    body: proto.Message.InteractiveMessage.Body.create({ text: label }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: options.footer || 'direct envelope matrix' }),
    header: mediaHeader(media, thumb, options.header || {}),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      messageParamsJson: options.params ? JSON.stringify(options.params) : undefined,
      messageVersion: options.messageVersion,
      buttons: buttonsFor(prefix, options.buttons),
    }),
  });
}

function content(interactiveMessage) {
  return { interactiveMessage };
}

function mci(label) {
  return {
    messageContextInfo: proto.MessageContextInfo.create({
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      messageSecret: crypto.randomBytes(32),
      paddingBytes: Buffer.from(label),
    }),
  };
}

function rawViewOnce(inner, label) {
  return { viewOnceMessage: { message: { ...mci(label), ...inner } } };
}

function rawViewOnceV2(inner, label) {
  return { viewOnceMessageV2: { message: { ...mci(label), ...inner } } };
}

function rawEphemeral(inner, label) {
  return { ephemeralMessage: { message: { ...mci(label), ...inner } } };
}

function rawDevice(inner, jid, label) {
  return {
    deviceSentMessage: {
      destinationJid: jid,
      phash: `${label}-phash`,
      message: { ...mci(label), ...inner },
    },
  };
}

function templateRoot(interactiveMessage, templateId) {
  return {
    templateMessage: {
      templateId,
      interactiveMessageTemplate: interactiveMessage,
    },
  };
}

function buttonsMessage(media, label, prefix, withImage = false) {
  const body = {
    contentText: label,
    footerText: 'DX buttonsMessage native flow',
    headerType: withImage ? 4 : 1,
    buttons: [
      {
        buttonId: `.${prefix}_button_native`,
        buttonText: { displayText: 'ABRIR DX' },
        type: proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW,
        nativeFlowInfo: {
          name: 'single_select',
          paramsJson: JSON.stringify(selectPayload(prefix)),
        },
      },
    ],
  };

  if (withImage && media?.imageMessage) {
    body.imageMessage = media.imageMessage;
  }

  return proto.Message.fromObject({ buttonsMessage: body });
}

async function relay(sock, jid, body) {
  const msg = generateWAMessageFromContent(jid, body, { userJid: sock.user.id });
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  return msg;
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareImage(sock, thumbPath);
  const thumb = fs.existsSync(thumbPath) ? fs.readFileSync(thumbPath) : undefined;
  const ownerJid = bareUserJid(sock.user?.id);

  log('conectado como', sock.user?.id || 'desconhecido', 'owner', ownerJid || '-');
  log('enviando para', targetJid);

  const base = (label, prefix, options) => content(direct(media, thumb, label, prefix, options));

  const cases = [
    ['DX-01 DI-01 + nativeFlow messageVersion 1', base('DX-01 DI-01 + nativeFlow messageVersion 1', 'dx01', { messageVersion: 1 })],
    ['DX-02 DI-01 + nativeFlow messageVersion 2', base('DX-02 DI-01 + nativeFlow messageVersion 2', 'dx02', { messageVersion: 2 })],
    ['DX-03 DI-01 + nativeFlow messageVersion 3', base('DX-03 DI-01 + nativeFlow messageVersion 3', 'dx03', { messageVersion: 3 })],
    ['DX-04 bottom_sheet params', base('DX-04 bottom_sheet params', 'dx04', { messageVersion: 1, params: menuParams(3) })],
    ['DX-05 dummy menu bottom_sheet', base('DX-05 dummy menu bottom_sheet', 'dx05', { messageVersion: 1, params: menuParams(2), buttons: 'dummyFirstMenu' })],
    ['DX-06 real first menu bottom_sheet', base('DX-06 real first menu bottom_sheet', 'dx06', { messageVersion: 1, params: menuParams(2), buttons: 'realFirstMenu' })],
    ['DX-07 only real bottom_sheet', base('DX-07 only real bottom_sheet', 'dx07', { messageVersion: 1, params: menuParams(1), buttons: 'onlyReal' })],
    ['DX-08 button_text objeto', base('DX-08 button_text objeto', 'dx08', { messageVersion: 1, params: menuParams(2), buttons: 'buttonObject' })],
    ['DX-09 cloud api style payload', base('DX-09 cloud api style payload', 'dx09', { messageVersion: 1, params: menuParams(2), buttons: 'cloud' })],
    ['DX-10 quick antes select + url', base('DX-10 quick antes select + url', 'dx10', { messageVersion: 1, buttons: 'quickBefore' })],
    ['DX-11 templateMessage direct', templateRoot(direct(media, thumb, 'DX-11 templateMessage direct', 'dx11', { messageVersion: 1 }), 'dx11_template_direct')],
    ['DX-12 viewOnce templateMessage direct', rawViewOnce(templateRoot(direct(media, thumb, 'DX-12 viewOnce template direct', 'dx12', { messageVersion: 1 }), 'dx12_template_direct'), 'dx12')],
    ['DX-13 raw viewOnce direct + mci', rawViewOnce(base('DX-13 raw viewOnce direct + mci', 'dx13', { messageVersion: 1 }), 'dx13')],
    ['DX-14 raw viewOnceV2 direct + mci', rawViewOnceV2(base('DX-14 raw viewOnceV2 direct + mci', 'dx14', { messageVersion: 1 }), 'dx14')],
    ['DX-15 raw ephemeral direct + mci', rawEphemeral(base('DX-15 raw ephemeral direct + mci', 'dx15', { messageVersion: 1 }), 'dx15')],
    ['DX-16 raw deviceSent direct + mci', rawDevice(base('DX-16 raw deviceSent direct + mci', 'dx16', { messageVersion: 1 }), targetJid, 'dx16')],
    ['DX-17 forwarded newsletter context', base('DX-17 forwarded newsletter context', 'dx17', { messageVersion: 1, contextInfo: forwardedContext(ownerJid) })],
    ['DX-18 externalAdReply context', base('DX-18 externalAdReply context', 'dx18', { messageVersion: 1, contextInfo: externalAdContext() })],
    ['DX-19 business forward context', base('DX-19 business forward context', 'dx19', { messageVersion: 1, contextInfo: businessContext(ownerJid) })],
    ['DX-20 jpegThumbnail junto com imageMessage', base('DX-20 jpegThumbnail junto com imageMessage', 'dx20', { messageVersion: 1, header: { jpegThumbnail: true } })],
    ['DX-21 jpegThumbnail sem imageMessage', base('DX-21 jpegThumbnail sem imageMessage', 'dx21', { messageVersion: 1, header: { jpegThumbnail: true, includeMedia: false, hasMediaAttachment: true } })],
    ['DX-22 buttonsMessage native flow sem imagem', buttonsMessage(media, 'DX-22 buttonsMessage native flow sem imagem', 'dx22', false)],
    ['DX-23 buttonsMessage native flow com imagem', buttonsMessage(media, 'DX-23 buttonsMessage native flow com imagem', 'dx23', true)],
  ];

  for (const [label, body] of cases) {
    log('enviando', label);
    try {
      await relay(sock, targetJid, body);
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
  console.error('[send-direct-envelope-matrix] erro fatal:', err?.stack || err);
  process.exit(1);
});
