const fs = require('fs');
const path = require('path');
const { delay, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
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
const sendDelayMs = Number.parseInt(process.argv[7] || process.env.CS_DELAY_MS || '10000', 10);
const log = (...args) => console.log('[send-carousel-snap-matrix]', ...args);

function caseNumber(label) {
  const match = String(label).match(/CS-(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function rows(prefix) {
  return [
    { header: 'A', title: `${prefix} item A`, description: 'snap carousel', id: `.${prefix}_a`, rowId: `.${prefix}_row_a` },
    { header: 'B', title: `${prefix} item B`, description: 'snap carousel', id: `.${prefix}_b`, rowId: `.${prefix}_row_b` },
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

function flowButtons(prefix, mode = 'full') {
  const list = listButton(prefix);
  const q = quick('QUICK', `.${prefix}_quick`);
  const cp = ctaCopy('COPIAR', prefix.toUpperCase());

  if (mode === 'listOnly') return [list];
  if (mode === 'quickOnly') return [q];
  if (mode === 'copyOnly') return [cp];
  if (mode === 'none') return [];
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
    subtitle: options.subtitle || 'CS',
    hasMediaAttachment: options.hasMediaAttachment ?? true,
    ...media,
  });
}

function realCard(media, label, prefix, options = {}) {
  return proto.Message.InteractiveMessage.create({
    body: body(label),
    footer: footer(options.footer || 'CS card'),
    header: mediaHeader(media, options.header || {}),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      messageVersion: options.nativeVersion,
      buttons: flowButtons(prefix, options.buttonsMode),
    }),
  });
}

function spacerCard(label, prefix, options = {}) {
  const hasHeader = options.header !== false;
  const hasBody = options.body !== false;
  const hasFooter = options.footer !== false;
  const buttons = flowButtons(prefix, options.buttonsMode || 'quickOnly');

  return proto.Message.InteractiveMessage.create({
    body: hasBody ? body(options.bodyText || '\u200B') : undefined,
    footer: hasFooter ? footer(options.footerText || '\u200B') : undefined,
    header: hasHeader
      ? proto.Message.InteractiveMessage.Header.create({
        title: options.headerTitle || '',
        subtitle: options.headerSubtitle || '',
        hasMediaAttachment: false,
      })
      : undefined,
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons,
    }),
  });
}

function ghostMediaCard(media, label, prefix, options = {}) {
  return proto.Message.InteractiveMessage.create({
    body: body(options.bodyText || label),
    footer: footer(options.footerText || 'CS ghost'),
    header: mediaHeader(media, options.header || {}),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: flowButtons(prefix, options.buttonsMode || 'quickOnly'),
    }),
  });
}

function carousel(cards, options = {}) {
  const carouselTypes = proto.Message.InteractiveMessage.CarouselMessage.CarouselCardType || {};
  return {
    interactiveMessage: proto.Message.InteractiveMessage.create({
      body: options.outerBody
        ? proto.Message.InteractiveMessage.Body.create({ text: options.outerBody })
        : undefined,
      footer: options.outerFooter
        ? proto.Message.InteractiveMessage.Footer.create({ text: options.outerFooter })
        : undefined,
      header: options.outerHeader
        ? proto.Message.InteractiveMessage.Header.create({ title: '', hasMediaAttachment: false })
        : undefined,
      carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
        cards,
        messageVersion: options.messageVersion || 1,
        carouselCardType: options.cardType === undefined
          ? (carouselTypes.HSCROLL_CARDS || 1)
          : options.cardType,
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

async function relay(sock, jid, content) {
  const msg = generateWAMessageFromContent(jid, content, { userJid: sock.user.id });
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  return msg;
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareImage(sock, thumbPath);
  const hasThumb = fs.existsSync(thumbPath);

  log('conectado como', sock.user?.id || 'desconhecido', 'thumb', hasThumb ? 'ok' : 'sem thumb');
  log('enviando para', targetJid);
  log('filtro CS', `${startCase}-${endCase}`, 'delay', `${sendDelayMs}ms`);

  const r = (n, text, options = {}) => realCard(media, `CS-${n} ${text}`, `cs${n}`, options);
  const sp = (n, options = {}) => spacerCard(`CS-${n} spacer`, `cs${n}`, options);
  const gh = (n, text, options = {}) => ghostMediaCard(media, `CS-${n} ${text}`, `cs${n}`, options);

  const cases = [
    ['CS-01 cardType2 single card control', carousel([r('01', 'cardType2 single card control')], { cardType: 2 })],
    ['CS-02 cardType2 duplicate real cards', carousel([
      r('02A', 'duplicate real card A'),
      r('02B', 'duplicate real card B'),
    ], { cardType: 2 })],
    ['CS-03 cardType2 three duplicate real cards', carousel([
      r('03A', 'duplicate real card A'),
      r('03B', 'duplicate real card B'),
      r('03C', 'duplicate real card C'),
    ], { cardType: 2 })],
    ['CS-04 cardType2 spacer before real', carousel([
      sp('04A', { buttonsMode: 'quickOnly' }),
      r('04B', 'real after spacer'),
    ], { cardType: 2 })],
    ['CS-05 cardType2 real then spacer', carousel([
      r('05A', 'real before spacer'),
      sp('05B', { buttonsMode: 'quickOnly' }),
    ], { cardType: 2 })],
    ['CS-06 cardType2 spacer real spacer', carousel([
      sp('06A', { buttonsMode: 'quickOnly' }),
      r('06B', 'real between spacers'),
      sp('06C', { buttonsMode: 'quickOnly' }),
    ], { cardType: 2 })],
    ['CS-07 cardType2 ghost media before real', carousel([
      gh('07A', 'ghost media before', { buttonsMode: 'quickOnly' }),
      r('07B', 'real after media ghost'),
    ], { cardType: 2 })],
    ['CS-08 cardType2 real then ghost media', carousel([
      r('08A', 'real before media ghost'),
      gh('08B', 'ghost media after', { buttonsMode: 'quickOnly' }),
    ], { cardType: 2 })],
    ['CS-09 cardType1 spacer before real', carousel([
      sp('09A', { buttonsMode: 'quickOnly' }),
      r('09B', 'cardType1 real after spacer'),
    ], { cardType: 1 })],
    ['CS-10 cardType1 spacer real spacer', carousel([
      sp('10A', { buttonsMode: 'quickOnly' }),
      r('10B', 'cardType1 real between spacers'),
      sp('10C', { buttonsMode: 'quickOnly' }),
    ], { cardType: 1 })],
    ['CS-11 cardType2 no-header spacer before real', carousel([
      sp('11A', { header: false, bodyText: '\u200B', footerText: '\u200B', buttonsMode: 'quickOnly' }),
      r('11B', 'real after no-header spacer'),
    ], { cardType: 2 })],
    ['CS-12 cardType2 no-body spacer before real', carousel([
      sp('12A', { body: false, footerText: '\u200B', buttonsMode: 'quickOnly' }),
      r('12B', 'real after no-body spacer'),
    ], { cardType: 2 })],
    ['CS-13 cardType2 list-only real', carousel([
      r('13', 'list-only real', { buttonsMode: 'listOnly' }),
    ], { cardType: 2 })],
    ['CS-14 cardType2 list-only duplicate', carousel([
      r('14A', 'list-only duplicate A', { buttonsMode: 'listOnly' }),
      r('14B', 'list-only duplicate B', { buttonsMode: 'listOnly' }),
    ], { cardType: 2 })],
    ['CS-15 cardType2 outer header', carousel([
      r('15', 'cardType2 outer header'),
    ], { cardType: 2, outerHeader: true })],
    ['CS-16 cardType2 outer body snap nudge', carousel([
      r('16', 'cardType2 outer body snap nudge'),
    ], { cardType: 2, outerHeader: true, outerBody: '\u200B', outerFooter: '\u200B' })],
    ['CS-17 viewOnce cardType2 single', viewOnce(carousel([
      r('17', 'viewOnce cardType2 single'),
    ], { cardType: 2 }))],
    ['CS-18 viewOnce cardType2 spacer real', viewOnce(carousel([
      sp('18A', { buttonsMode: 'quickOnly' }),
      r('18B', 'viewOnce real after spacer'),
    ], { cardType: 2 }))],
    ['CS-19 hscroll single control', carousel([
      r('19', 'hscroll single control'),
    ], { cardType: 1 })],
    ['CS-20 hscroll duplicate real cards', carousel([
      r('20A', 'hscroll duplicate real A'),
      r('20B', 'hscroll duplicate real B'),
    ], { cardType: 1 })],
    ['CS-21 hscroll three duplicate real cards', carousel([
      r('21A', 'hscroll duplicate real A'),
      r('21B', 'hscroll duplicate real B'),
      r('21C', 'hscroll duplicate real C'),
    ], { cardType: 1 })],
    ['CS-22 hscroll real then ghost media', carousel([
      r('22A', 'hscroll real then ghost'),
      gh('22B', 'hscroll ghost media after', { buttonsMode: 'quickOnly' }),
    ], { cardType: 1 })],
    ['CS-23 hscroll ghost media then real', carousel([
      gh('23A', 'hscroll ghost media before', { buttonsMode: 'quickOnly' }),
      r('23B', 'hscroll real after ghost'),
    ], { cardType: 1 })],
    ['CS-24 hscroll real ghost real', carousel([
      r('24A', 'hscroll real A'),
      gh('24B', 'hscroll ghost media middle', { buttonsMode: 'quickOnly' }),
      r('24C', 'hscroll real C'),
    ], { cardType: 1 })],
    ['CS-25 hscroll same real card twice', carousel([
      r('25A', 'hscroll same real card twice'),
      r('25A', 'hscroll same real card twice'),
    ], { cardType: 1 })],
    ['CS-26 hscroll two cards list only', carousel([
      r('26A', 'hscroll list only A', { buttonsMode: 'listOnly' }),
      r('26B', 'hscroll list only B', { buttonsMode: 'listOnly' }),
    ], { cardType: 1 })],
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
  console.error('[send-carousel-snap-matrix] erro fatal:', err?.stack || err);
  process.exit(1);
});
