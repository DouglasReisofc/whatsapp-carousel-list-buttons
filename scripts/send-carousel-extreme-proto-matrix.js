const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { delay, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  ctaUrl,
  nf,
  prepareImage,
  quick,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const startCase = Number.parseInt(process.argv[5] || '1', 10);
const endCase = Number.parseInt(process.argv[6] || '999', 10);
const sendDelayMs = Number.parseInt(process.argv[7] || process.env.CX_DELAY_MS || '9000', 10);
const log = (...args) => console.log('[send-carousel-extreme-proto-matrix]', ...args);

function caseNumber(label) {
  const match = String(label).match(/CX-(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function rows(prefix, mode = 'both') {
  const base = [
    { header: 'A', title: `${prefix} opcao A`, description: 'carousel proto extremo', id: `.${prefix}_a`, rowId: `.${prefix}_row_a` },
    { header: 'B', title: `${prefix} opcao B`, description: 'carousel proto extremo', id: `.${prefix}_b`, rowId: `.${prefix}_row_b` },
    { header: 'C', title: `${prefix} opcao C`, description: 'carousel proto extremo', id: `.${prefix}_c`, rowId: `.${prefix}_row_c` },
  ];

  if (mode === 'idOnly') return base.map(({ header, title, description, id }) => ({ header, title, description, id }));
  if (mode === 'rowIdOnly') return base.map(({ header, title, description, rowId }) => ({ header, title, description, rowId }));
  if (mode === 'clean') return base.map(({ title, id }) => ({ title, id }));
  if (mode === 'numbered') {
    return base.map((row, index) => ({
      title: row.title,
      description: row.description,
      id: String(index + 1),
      rowId: String(index + 1),
    }));
  }

  return base;
}

function sections(prefix, mode = 'both') {
  if (mode === 'multiSections') {
    return [
      {
        title: `${prefix.toUpperCase()} A`,
        highlight_label: 'um',
        rows: rows(`${prefix}a`, 'both').slice(0, 2),
      },
      {
        title: `${prefix.toUpperCase()} B`,
        highlight_label: 'dois',
        rows: rows(`${prefix}b`, 'both').slice(0, 2),
      },
    ];
  }

  return [
    {
      title: `${prefix.toUpperCase()} lista`,
      highlight_label: 'teste',
      rows: rows(prefix, mode),
    },
  ];
}

function selectPayload(prefix, mode = 'full') {
  if (mode === 'dummy') return { has_multiple_buttons: true };
  if (mode === 'buttonTextObject') {
    return {
      title: 'ABRIR LISTA',
      button_text: { display_text: 'ABRIR LISTA' },
      sections: sections(prefix),
    };
  }
  if (mode === 'buttonTextOnly') {
    return {
      button_text: 'ABRIR LISTA',
      sections: sections(prefix),
    };
  }
  if (mode === 'cloudAction') {
    return {
      type: 'list',
      body: { text: 'CX cloud body' },
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
    title: mode === 'shortTitle' ? 'LISTA' : 'ABRIR LISTA',
    button_text: 'ABRIR LISTA',
    display_text: 'ABRIR LISTA',
    sections: sections(prefix, mode),
  };
}

function listButton(name, prefix, payloadMode = 'full') {
  return nf(name, selectPayload(prefix, payloadMode));
}

function params(limit = 3) {
  return {
    bottom_sheet: {
      in_thread_buttons_limit: limit,
      divider_indices: [1, 2, 3, 999],
      list_title: 'CX lista',
      button_title: 'OPEN CX',
    },
    tap_target_configuration: {
      title: 'CX carousel',
      description: 'proto extremo',
      canonical_url: 'https://whatsapp.com',
      domain: 'whatsapp.com',
      button_index: 0,
    },
  };
}

function buttons(prefix, mode = 'full', payloadMode = 'full') {
  const select = listButton('single_select', prefix, payloadMode);
  const select2 = listButton('single_select', `${prefix}b`, payloadMode);
  const q = quick('QUICK', `.${prefix}_quick`);
  const cp = ctaCopy('COPIAR', prefix.toUpperCase());

  if (mode === 'listOnly') return [select];
  if (mode === 'quickFirst') return [q, select, cp];
  if (mode === 'listLast') return [q, cp, select];
  if (mode === 'copyFirst') return [cp, select, q];
  if (mode === 'url') return [select, q, ctaUrl('URL', 'https://whatsapp.com')];
  if (mode === 'twoLists') return [select, select2, q, cp];
  if (mode === 'dummyFirst') return [listButton('single_select', prefix, 'dummy'), listButton('call_permission_request', prefix, 'dummy'), select, cp, q];
  if (mode === 'dummyAfter') return [select, listButton('single_select', prefix, 'dummy'), listButton('call_permission_request', prefix, 'dummy'), cp, q];
  if (mode === 'v2Name') return [listButton('single_select_v2', prefix, payloadMode), q, cp];
  if (mode === 'listMessageName') return [listButton('list_message', prefix, payloadMode), q, cp];
  if (mode === 'listName') return [listButton('list', prefix, payloadMode), q, cp];

  return [select, q, cp];
}

function bodyField(mode, text) {
  if (mode === 'none') return undefined;
  if (mode === 'empty') return proto.Message.InteractiveMessage.Body.create({ text: '' });
  if (mode === 'zwsp') return proto.Message.InteractiveMessage.Body.create({ text: '\u200B' });
  return proto.Message.InteractiveMessage.Body.create({ text });
}

function footerField(mode, text) {
  if (mode === 'none') return undefined;
  if (mode === 'empty') return proto.Message.InteractiveMessage.Footer.create({ text: '' });
  if (mode === 'zwsp') return proto.Message.InteractiveMessage.Footer.create({ text: '\u200B' });
  return proto.Message.InteractiveMessage.Footer.create({ text });
}

function headerField(media, thumb, mode = 'media') {
  if (mode === 'none') return undefined;
  if (mode === 'outer') {
    return proto.Message.InteractiveMessage.Header.create({
      title: '',
      hasMediaAttachment: false,
    });
  }
  if (mode === 'text') {
    return proto.Message.InteractiveMessage.Header.create({
      title: 'CX titulo header',
      subtitle: 'CX',
      hasMediaAttachment: false,
    });
  }

  const header = {
    title: mode === 'mediaTitle' ? 'CX header title' : '',
    subtitle: mode === 'mediaNoSubtitle' ? '' : 'CX',
    hasMediaAttachment: mode === 'mediaFalse' ? false : true,
    ...media,
  };

  if (mode === 'jpegThumb' && thumb) {
    header.jpegThumbnail = thumb;
  }

  return proto.Message.InteractiveMessage.Header.create(header);
}

function card(media, thumb, label, prefix, options = {}) {
  return proto.Message.InteractiveMessage.create({
    body: bodyField(options.bodyMode || 'text', label),
    footer: footerField(options.footerMode || 'text', options.footer || 'CX card'),
    header: headerField(media, thumb, options.headerMode || 'media'),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      messageVersion: options.nativeVersion,
      messageParamsJson: options.nativeParams ? JSON.stringify(options.nativeParams) : undefined,
      buttons: buttons(prefix, options.buttonsMode, options.payloadMode),
    }),
  });
}

function carousel(cards, options = {}) {
  const carouselTypes = proto.Message.InteractiveMessage.CarouselMessage.CarouselCardType || {};
  const interactive = proto.Message.InteractiveMessage.create({
    contextInfo: options.contextInfo,
    body: bodyField(options.outerBody || 'none', options.outerText || 'CX outer'),
    footer: footerField(options.outerFooter || 'none', 'CX outer footer'),
    header: headerField({}, undefined, options.outerHeader || 'none'),
    carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
      cards,
      messageVersion: options.carouselVersion,
      carouselCardType: options.cardType === undefined
        ? (carouselTypes.HSCROLL_CARDS || 1)
        : options.cardType,
    }),
  });

  return { interactiveMessage: interactive };
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

function viewOnce(content, label) {
  return { viewOnceMessage: { message: { ...mci(label), ...content } } };
}

function viewOnceV2(content, label) {
  return { viewOnceMessageV2: { message: { ...mci(label), ...content } } };
}

function viewOnceV2Extension(content, label) {
  return { viewOnceMessageV2Extension: { message: { ...mci(label), ...content } } };
}

function ephemeral(content, label) {
  return { ephemeralMessage: { message: { ...mci(label), ...content } } };
}

function deviceSent(content, jid, label) {
  return {
    deviceSentMessage: {
      destinationJid: jid,
      phash: `${label}-phash`,
      message: { ...mci(label), ...content },
    },
  };
}

function template(content, label) {
  return {
    templateMessage: {
      templateId: `${label}_template`,
      interactiveMessageTemplate: content.interactiveMessage,
    },
  };
}

function cloneMessageContent(content) {
  return proto.Message.fromObject(proto.Message.toObject(proto.Message.create(content)));
}

function future(content) {
  return proto.Message.FutureProofMessage.create({ message: cloneMessageContent(content) });
}

function asFutureField(content, field) {
  return { [field]: future(content) };
}

function forwardedContext() {
  return proto.ContextInfo.create({
    forwardingScore: 999,
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
      title: 'CX external ad',
      body: 'carousel list',
      mediaType: 1,
      sourceUrl: 'https://whatsapp.com',
      showAdAttribution: true,
    },
  });
}

async function relay(sock, jid, content) {
  const msg = generateWAMessageFromContent(jid, content, { userJid: sock.user.id });
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  return msg;
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareImage(sock, thumbPath);
  const thumb = fs.existsSync(thumbPath) ? fs.readFileSync(thumbPath) : undefined;

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid);
  log('filtro CX', `${startCase}-${endCase}`, 'delay', `${sendDelayMs}ms`);

  const c = (n, text, options = {}) => card(media, thumb, `CX-${n} ${text}`, `cx${n}`, options);
  const root = (n, text, cardOptions = {}, carouselOptions = {}) =>
    carousel([c(n, text, cardOptions)], { carouselVersion: 1, ...carouselOptions });

  const cases = [
    ['CX-01 controle CLEAN-03 one card full', root('01', 'controle CLEAN-03 one card full')],
    ['CX-02 controle outer header vazio', root('02', 'controle outer header vazio', {}, { outerHeader: 'outer' })],
    ['CX-03 outer body/footer texto', root('03', 'outer body/footer texto', {}, { outerBody: 'text', outerFooter: 'text', outerHeader: 'outer' })],
    ['CX-04 card list only', root('04', 'card list only', { buttonsMode: 'listOnly' })],
    ['CX-05 quick first', root('05', 'quick first', { buttonsMode: 'quickFirst' })],
    ['CX-06 list last', root('06', 'list last', { buttonsMode: 'listLast' })],
    ['CX-07 copy first', root('07', 'copy first', { buttonsMode: 'copyFirst' })],
    ['CX-08 url no copy', root('08', 'url no copy', { buttonsMode: 'url' })],
    ['CX-09 dummy first bottom_sheet', root('09', 'dummy first bottom_sheet', { buttonsMode: 'dummyFirst', nativeVersion: 1, nativeParams: params(3) })],
    ['CX-10 dummy after bottom_sheet', root('10', 'dummy after bottom_sheet', { buttonsMode: 'dummyAfter', nativeVersion: 1, nativeParams: params(3) })],
    ['CX-11 two lists same card', root('11', 'two lists same card', { buttonsMode: 'twoLists' })],
    ['CX-12 multi sections one list', root('12', 'multi sections one list', { payloadMode: 'multiSections' })],
    ['CX-13 id only rows', root('13', 'id only rows', { payloadMode: 'idOnly' })],
    ['CX-14 rowId only rows', root('14', 'rowId only rows', { payloadMode: 'rowIdOnly' })],
    ['CX-15 clean rows', root('15', 'clean rows', { payloadMode: 'clean' })],
    ['CX-16 numbered rows', root('16', 'numbered rows', { payloadMode: 'numbered' })],
    ['CX-17 button_text object payload', root('17', 'button_text object payload', { payloadMode: 'buttonTextObject' })],
    ['CX-18 cloud action payload', root('18', 'cloud action payload', { payloadMode: 'cloudAction' })],
    ['CX-19 listType fields', root('19', 'listType fields', { payloadMode: 'listType' })],
    ['CX-20 card no footer', root('20', 'card no footer', { footerMode: 'none' })],
    ['CX-21 card empty footer', root('21', 'card empty footer', { footerMode: 'empty' })],
    ['CX-22 card no body', root('22', 'card no body', { bodyMode: 'none' })],
    ['CX-23 media no subtitle', root('23', 'media no subtitle', { headerMode: 'mediaNoSubtitle' })],
    ['CX-24 media title', root('24', 'media title', { headerMode: 'mediaTitle' })],
    ['CX-25 media hasMedia false', root('25', 'media hasMedia false', { headerMode: 'mediaFalse' })],
    ['CX-26 jpegThumbnail plus image', root('26', 'jpegThumbnail plus image', { headerMode: 'jpegThumb' })],
    ['CX-27 nativeFlow messageVersion 1', root('27', 'nativeFlow messageVersion 1', { nativeVersion: 1 })],
    ['CX-28 nativeFlow messageVersion 2', root('28', 'nativeFlow messageVersion 2', { nativeVersion: 2 })],
    ['CX-29 carousel messageVersion 2', root('29', 'carousel messageVersion 2', {}, { carouselVersion: 2 })],
    ['CX-30 carousel cardType undefined', root('30', 'carousel cardType undefined', {}, { cardType: undefined })],
    ['CX-31 carousel cardType 0', root('31', 'carousel cardType 0', {}, { cardType: 0 })],
    ['CX-32 carousel cardType 2', root('32', 'carousel cardType 2', {}, { cardType: 2 })],
    ['CX-33 two cards each list', carousel([
      c('33A', 'two cards A'),
      c('33B', 'two cards B'),
    ], { carouselVersion: 1 })],
    ['CX-34 three cards each list', carousel([
      c('34A', 'three cards A'),
      c('34B', 'three cards B'),
      c('34C', 'three cards C'),
    ], { carouselVersion: 1 })],
    ['CX-35 first card no list second list', carousel([
      card(media, thumb, 'CX-35 card A sem lista', 'cx35a', { buttonsMode: 'url' }),
      c('35B', 'card B com lista'),
    ], { carouselVersion: 1 })],
    ['CX-36 viewOnce raw carousel', viewOnce(root('36', 'viewOnce raw carousel'), 'cx36')],
    ['CX-37 viewOnceV2 raw carousel', viewOnceV2(root('37', 'viewOnceV2 raw carousel'), 'cx37')],
    ['CX-38 viewOnceV2Extension raw carousel', viewOnceV2Extension(root('38', 'viewOnceV2Extension raw carousel'), 'cx38')],
    ['CX-39 ephemeral raw carousel', ephemeral(root('39', 'ephemeral raw carousel'), 'cx39')],
    ['CX-40 deviceSent raw carousel', deviceSent(root('40', 'deviceSent raw carousel'), targetJid, 'cx40')],
    ['CX-41 template carousel', template(root('41', 'template carousel'), 'cx41')],
    ['CX-42 viewOnce template carousel', viewOnce(template(root('42', 'viewOnce template carousel'), 'cx42'), 'cx42')],
    ['CX-43 botInvoke future carousel', asFutureField(root('43', 'botInvoke future carousel'), 'botInvokeMessage')],
    ['CX-44 documentWithCaption future carousel', asFutureField(root('44', 'documentWithCaption future carousel'), 'documentWithCaptionMessage')],
    ['CX-45 forwarded context carousel', root('45', 'forwarded context carousel', {}, { contextInfo: forwardedContext() })],
    ['CX-46 externalAd context carousel', root('46', 'externalAd context carousel', {}, { contextInfo: externalAdContext() })],
    ['CX-47 name single_select_v2', root('47', 'name single_select_v2', { buttonsMode: 'v2Name' })],
    ['CX-48 name list_message', root('48', 'name list_message', { buttonsMode: 'listMessageName' })],
    ['CX-49 name list', root('49', 'name list', { buttonsMode: 'listName' })],
  ];

  const selected = cases.filter(([label]) => {
    const n = caseNumber(label);
    return n >= startCase && n <= endCase;
  });

  log('selecionados', `${selected.length}/${cases.length}`);

  for (const [label, content] of selected) {
    log('enviando', label);
    try {
      await relay(sock, targetJid, content);
      log('ok', label);
    } catch (err) {
      log('falhou', label, err?.message || err);
    }
    await delay(sendDelayMs);
  }

  await delay(1500);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[send-carousel-extreme-proto-matrix] erro fatal:', err?.stack || err);
  process.exit(1);
});
