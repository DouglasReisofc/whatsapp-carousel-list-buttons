const fs = require('fs');
const path = require('path');
const { delay, generateWAMessageFromContent, jidNormalizedUser, proto } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  nf,
  prepareImage,
  quick,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const startCase = Number.parseInt(process.argv[5] || '1', 10);
const endCase = Number.parseInt(process.argv[6] || '999', 10);
const sendDelayMs = Number.parseInt(process.argv[7] || process.env.CN_DELAY_MS || '12000', 10);
const editDelayMs = Number.parseInt(process.argv[8] || process.env.CN_EDIT_DELAY_MS || '3500', 10);
const log = (...args) => console.log('[send-carousel-center-nudge]', ...args);
const RLM = '\u200F';
const RLE = '\u202B';
const PDF = '\u202C';

function caseNumber(label) {
  const match = String(label).match(/CN-(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function ownJid(sock) {
  const id = sock.user?.id || '';
  return jidNormalizedUser ? jidNormalizedUser(id) : id.replace(/:\d+@/, '@');
}

function rows(prefix) {
  return [
    { header: 'A', title: `${prefix} item A`, description: 'center snap', id: `.${prefix}_a`, rowId: `.${prefix}_row_a` },
    { header: 'B', title: `${prefix} item B`, description: 'center snap', id: `.${prefix}_b`, rowId: `.${prefix}_row_b` },
    { header: 'C', title: `${prefix} item C`, description: 'center snap', id: `.${prefix}_c`, rowId: `.${prefix}_row_c` },
  ];
}

function listButton(prefix, title = 'ABRIR LISTA') {
  return nf('single_select', {
    title,
    button_text: title,
    display_text: title,
    sections: [
      {
        title: `${prefix.toUpperCase()} lista`,
        highlight_label: 'snap',
        rows: rows(prefix),
      },
    ],
  });
}

function buttons(prefix, mode = 'full') {
  const list = listButton(prefix);
  const q = quick('QUICK', `.${prefix}_quick`);
  const cp = ctaCopy('COPIAR', prefix.toUpperCase());

  if (mode === 'listOnly') return [list];
  if (mode === 'quickOnly') return [q];
  if (mode === 'copyOnly') return [cp];
  if (mode === 'none') return [];
  if (mode === 'quickCopy') return [q, cp];
  return [list, q, cp];
}

function body(text) {
  return proto.Message.InteractiveMessage.Body.create({ text });
}

function footer(text) {
  return proto.Message.InteractiveMessage.Footer.create({ text });
}

function mediaHeader(media, options = {}) {
  return proto.Message.InteractiveMessage.Header.create({
    title: options.title || '',
    subtitle: options.subtitle || 'CN',
    hasMediaAttachment: options.hasMediaAttachment ?? true,
    ...media,
  });
}

function cloneMediaWithDims(media, width, height) {
  if (!media?.imageMessage) return media;
  const imageMessage = proto.Message.ImageMessage.create(media.imageMessage);
  imageMessage.width = width;
  imageMessage.height = height;
  return { imageMessage };
}

function card(media, label, prefix, options = {}) {
  return proto.Message.InteractiveMessage.create({
    body: options.body === false ? undefined : body(options.bodyText || label),
    footer: options.footer === false ? undefined : footer(options.footerText || 'CN card'),
    header: options.header === false
      ? undefined
      : mediaHeader(media, options.header || {}),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      messageVersion: options.nativeVersion,
      messageParamsJson: options.nativeParams ? JSON.stringify(options.nativeParams) : undefined,
      buttons: buttons(prefix, options.buttonsMode),
    }),
  });
}

function blankCard(label, prefix, options = {}) {
  const hasHeader = options.header !== false;
  const hasNative = options.native !== false;

  return proto.Message.InteractiveMessage.create({
    body: options.body === false ? undefined : body(options.bodyText || '\u200B'),
    footer: options.footer === false ? undefined : footer(options.footerText || '\u200B'),
    header: hasHeader
      ? proto.Message.InteractiveMessage.Header.create({
        title: options.headerTitle || '',
        subtitle: options.headerSubtitle || '',
        hasMediaAttachment: false,
      })
      : undefined,
    nativeFlowMessage: hasNative
      ? proto.Message.InteractiveMessage.NativeFlowMessage.create({
        messageVersion: options.nativeVersion,
        buttons: buttons(prefix, options.buttonsMode || 'quickOnly'),
      })
      : undefined,
  });
}

function carousel(cards, options = {}) {
  const carouselTypes = proto.Message.InteractiveMessage.CarouselMessage.CarouselCardType || {};
  const cardType = options.cardType === undefined ? (carouselTypes.HSCROLL_CARDS || 1) : options.cardType;

  return {
    interactiveMessage: proto.Message.InteractiveMessage.create({
      body: options.outerBody === undefined
        ? undefined
        : proto.Message.InteractiveMessage.Body.create({ text: options.outerBody }),
      footer: options.outerFooter === undefined
        ? undefined
        : proto.Message.InteractiveMessage.Footer.create({ text: options.outerFooter }),
      header: options.outerHeader
        ? proto.Message.InteractiveMessage.Header.create({ title: '', hasMediaAttachment: false })
        : undefined,
      carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
        cards,
        messageVersion: options.messageVersion || 1,
        carouselCardType: cardType,
      }),
    }),
  };
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

async function relay(sock, jid, content, options = {}) {
  const msg = generateWAMessageFromContent(jid, content, { userJid: sock.user.id });
  await sock.relayMessage(jid, msg.message, {
    messageId: msg.key.id,
    additionalAttributes: options.additionalAttributes,
  });
  return msg;
}

function editPayload(key, editedMessage, options = {}) {
  const editKey = {
    ...key,
    ...(options.participant ? { participant: options.participant } : {}),
  };

  return {
    protocolMessage: {
      key: editKey,
      editedMessage: proto.Message.create(editedMessage),
      timestampMs: Date.now(),
      type: proto.Message.ProtocolMessage.Type.MESSAGE_EDIT,
    },
  };
}

async function editInteractive(sock, jid, original, editedMessage, options = {}) {
  const content = editPayload(original.key, editedMessage, options);
  const editMsg = generateWAMessageFromContent(jid, content, { userJid: sock.user.id });
  await sock.relayMessage(jid, editMsg.message, {
    messageId: editMsg.key.id,
    additionalAttributes: { edit: options.editAttr || '1' },
  });
  return editMsg;
}

async function sendCase(sock, spec) {
  log('enviando', spec.label);
  const sent = await relay(sock, targetJid, spec.initial);
  log('ok', spec.label, 'id', sent.key.id);

  if (spec.edit) {
    await delay(spec.editDelayMs || editDelayMs);
    log('editando', spec.label, 'modo', spec.edit.mode);
    await editInteractive(sock, targetJid, sent, spec.edit.content, {
      participant: spec.edit.withParticipant ? ownJid(sock) : undefined,
      editAttr: spec.edit.editAttr,
    });
    log('edit ok', spec.label);
  }
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareImage(sock, thumbPath);
  const hasThumb = fs.existsSync(thumbPath);

  log('conectado como', sock.user?.id || 'desconhecido', 'thumb', hasThumb ? 'ok' : 'sem thumb');
  log('enviando para', targetJid);
  log('filtro CN', `${startCase}-${endCase}`, 'delay', `${sendDelayMs}ms`, 'editDelay', `${editDelayMs}ms`);

  const real = (n, text, options = {}) => card(media, `CN-${n} ${text}`, `cn${n}`, options);
  const blank = (n, options = {}) => blankCard(`CN-${n} blank`, `cn${n}`, options);

  const cn01 = carousel([real('01', 'hscroll control')]);
  const cn02Initial = carousel([real('02', 'edit same before snap')]);
  const cn02Edit = carousel([real('02E', 'edit same after snap')]);
  const cn03Initial = carousel([
    real('03A', 'two cards before edit A'),
    real('03B', 'two cards before edit B'),
  ]);
  const cn03Edit = carousel([real('03E', 'edited to one card')]);
  const cn04Initial = carousel([real('04', 'one card before edit')]);
  const cn04Edit = carousel([
    real('04A', 'edited two cards A'),
    real('04B', 'edited two cards B'),
  ]);
  const cn05Initial = carousel([real('05', 'outer zwsp before edit')], {
    outerHeader: true,
    outerBody: '\u200B',
    outerFooter: '\u200B',
  });
  const cn05Edit = carousel([real('05E', 'outer removed after edit')]);
  const cn06Initial = carousel([
    blank('06A', { bodyText: '\u200B', footerText: '\u200B', buttonsMode: 'quickOnly' }),
    real('06B', 'real after skinny blank'),
  ]);
  const cn07Initial = carousel([
    blank('07A', { header: false, bodyText: '\u200B', footerText: '\u200B', buttonsMode: 'none' }),
    real('07B', 'real after no-button blank'),
  ]);
  const cn08 = carousel([
    blank('08A', { header: false, footer: false, bodyText: '\u200B', buttonsMode: 'quickOnly' }),
    real('08B', 'real after headerless blank'),
  ]);
  const cn09 = carousel([real('09', 'native params index hint', {
    nativeVersion: 1,
    nativeParams: {
      carousel: { initial_index: 0, initial_card_index: 0, snap: 'center' },
      hscroll: { align: 'center', snap_align: 'center' },
    },
  })]);
  const cn10 = viewOnce(carousel([real('10', 'viewOnce hscroll control')]));
  const narrowMedia = cloneMediaWithDims(media, 120, 720);
  const microMedia = cloneMediaWithDims(media, 1, 1);

  const cn13 = carousel([
    card(media, 'CN-13 lead real quick only', 'cn13lead', { buttonsMode: 'quickOnly' }),
    real('13B', 'target after lead quick'),
  ]);
  const cn14 = carousel([
    card(media, 'CN-14 lead real no buttons', 'cn14lead', { buttonsMode: 'none' }),
    real('14B', 'target after lead no buttons'),
  ]);
  const cn15 = carousel([
    card(media, 'CN-15 lead media compact', 'cn15lead', {
      bodyText: '\u200B',
      footer: false,
      buttonsMode: 'quickOnly',
    }),
    real('15B', 'target after compact media'),
  ]);
  const cn16 = carousel([
    card(narrowMedia, 'CN-16 lead narrow metadata', 'cn16lead', {
      bodyText: '\u200B',
      footer: false,
      buttonsMode: 'quickOnly',
    }),
    real('16B', 'target after narrow metadata'),
  ]);
  const cn17 = carousel([
    card(microMedia, 'CN-17 lead micro metadata', 'cn17lead', {
      bodyText: '\u200B',
      footer: false,
      buttonsMode: 'quickOnly',
    }),
    real('17B', 'target after micro metadata'),
  ]);
  const cn18 = carousel([real('18', 'cardType UNKNOWN zero')], { cardType: 0 });
  const cn19 = carousel([real('19', 'cardType ALBUM image')], { cardType: 2 });
  const cn20 = viewOnce(carousel([real('20', 'viewOnce cardType ALBUM image')], { cardType: 2 }));
  const cn21 = carousel([card(media, `${RLM}CN-21 RLM body single`, 'cn21', {
    footerText: `${RLM}CN card`,
  })]);
  const cn22 = carousel([card(media, `${RLE}\u0627\u062e\u062a\u0628\u0627\u0631 CN-22 rtl single${PDF}`, 'cn22', {
    footerText: `${RLE}CN card${PDF}`,
  })]);
  const cn23 = carousel([real('23', 'outer RLM body')], {
    outerHeader: true,
    outerBody: `${RLM}CN-23 outer rtl`,
  });
  const cn24 = carousel([
    card(media, `${RLM}CN-24A RLM first`, 'cn24a'),
    card(media, `${RLM}CN-24B RLM second`, 'cn24b'),
  ]);

  const cases = [
    { label: 'CN-01 hscroll single control', initial: cn01 },
    {
      label: 'CN-02 edit same single with edit attr',
      initial: cn02Initial,
      edit: { mode: 'same-single', content: cn02Edit, editAttr: '1' },
    },
    {
      label: 'CN-03 two cards then edit to one',
      initial: cn03Initial,
      edit: { mode: 'two-to-one', content: cn03Edit, editAttr: '1' },
    },
    {
      label: 'CN-04 one card then edit to two',
      initial: cn04Initial,
      edit: { mode: 'one-to-two', content: cn04Edit, editAttr: '1' },
    },
    {
      label: 'CN-05 outer zwsp then edit clean',
      initial: cn05Initial,
      edit: { mode: 'outer-clean', content: cn05Edit, editAttr: '1' },
    },
    { label: 'CN-06 skinny blank before real', initial: cn06Initial },
    { label: 'CN-07 no-button blank before real', initial: cn07Initial },
    { label: 'CN-08 headerless blank before real', initial: cn08 },
    { label: 'CN-09 native params snap center hint', initial: cn09 },
    { label: 'CN-10 viewOnce hscroll control', initial: cn10 },
    {
      label: 'CN-11 edit same with participant key',
      initial: carousel([real('11', 'edit participant before')]),
      edit: {
        mode: 'same-single-participant',
        content: carousel([real('11E', 'edit participant after')]),
        editAttr: '1',
        withParticipant: true,
      },
    },
    {
      label: 'CN-12 edit attr 2 pin-style probe',
      initial: carousel([real('12', 'edit attr two before')]),
      edit: {
        mode: 'edit-attr-2',
        content: carousel([real('12E', 'edit attr two after')]),
        editAttr: '2',
      },
    },
    { label: 'CN-13 lead real quick only before target', initial: cn13 },
    { label: 'CN-14 lead real no buttons before target', initial: cn14 },
    { label: 'CN-15 lead compact media before target', initial: cn15 },
    { label: 'CN-16 lead narrow metadata before target', initial: cn16 },
    { label: 'CN-17 lead micro metadata before target', initial: cn17 },
    { label: 'CN-18 cardType UNKNOWN zero', initial: cn18 },
    { label: 'CN-19 cardType ALBUM image', initial: cn19 },
    { label: 'CN-20 viewOnce cardType ALBUM image', initial: cn20 },
    { label: 'CN-21 RLM body single', initial: cn21 },
    { label: 'CN-22 Arabic RTL single', initial: cn22 },
    { label: 'CN-23 outer RLM body', initial: cn23 },
    { label: 'CN-24 two cards RLM text', initial: cn24 },
  ];

  const selected = cases.filter(({ label }) => {
    const n = caseNumber(label);
    return n >= startCase && n <= endCase;
  });

  log('selecionados', `${selected.length}/${cases.length}`);

  for (const spec of selected) {
    try {
      await sendCase(sock, spec);
    } catch (err) {
      log('falhou', spec.label, err?.message || err);
    }
    await delay(sendDelayMs);
  }

  await delay(1500);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[send-carousel-center-nudge] erro fatal:', err?.stack || err);
  process.exit(1);
});
