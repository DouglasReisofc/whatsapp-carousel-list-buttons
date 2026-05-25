const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
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
const sendDelayMs = Number.parseInt(process.argv[7] || process.env.CA_DELAY_MS || '10000', 10);
const tmpDir = path.join(__dirname, '..', '.tmp', 'align');
const log = (...args) => console.log('[send-carousel-alignment-matrix]', ...args);

function caseNumber(label) {
  const match = String(label).match(/CA-(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function rows(prefix) {
  return [
    { header: 'A', title: `${prefix} item A`, description: 'alinhamento', id: `.${prefix}_a`, rowId: `.${prefix}_row_a` },
    { header: 'B', title: `${prefix} item B`, description: 'alinhamento', id: `.${prefix}_b`, rowId: `.${prefix}_row_b` },
  ];
}

function select(prefix) {
  return nf('single_select', {
    title: 'ABRIR LISTA',
    button_text: 'ABRIR LISTA',
    display_text: 'ABRIR LISTA',
    sections: [
      {
        title: `${prefix.toUpperCase()} lista`,
        highlight_label: 'align',
        rows: rows(prefix),
      },
    ],
  });
}

function cloneMediaWithDims(media, width, height) {
  if (!media?.imageMessage) return media;
  const imageMessage = proto.Message.ImageMessage.create(media.imageMessage);
  imageMessage.width = width;
  imageMessage.height = height;
  return { imageMessage };
}

function makeCard(media, label, prefix, options = {}) {
  const buttons = [
    select(prefix),
    quick('QUICK', `.${prefix}_quick`),
    ctaCopy('COPIAR', prefix.toUpperCase()),
  ];

  return proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({
      text: options.longBody
        ? `${label} - texto longo para forcar largura do card e testar centralizacao visual`
        : label,
    }),
    footer: proto.Message.InteractiveMessage.Footer.create({
      text: options.footer || 'CA card',
    }),
    header: proto.Message.InteractiveMessage.Header.create({
      title: options.headerTitle || '',
      subtitle: options.subtitle === false ? '' : 'CA',
      hasMediaAttachment: true,
      ...media,
    }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      messageVersion: options.nativeVersion,
      buttons,
    }),
  });
}

function makeCarousel(card, options = {}) {
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
        cards: options.cards || [card],
        messageVersion: options.carouselVersion || 1,
        carouselCardType: options.cardType || carouselTypes.HSCROLL_CARDS || 1,
      }),
    }),
  };
}

async function ensureVariantImages(sourcePath) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const base = await Jimp.read(sourcePath);

  const variants = {
    original: sourcePath,
    wideContain: path.join(tmpDir, 'wide-contain-1280x720.jpg'),
    wideCover: path.join(tmpDir, 'wide-cover-1280x720.jpg'),
    cinemaContain: path.join(tmpDir, 'cinema-contain-1200x630.jpg'),
    cinemaCover: path.join(tmpDir, 'cinema-cover-1200x630.jpg'),
    fourThreeContain: path.join(tmpDir, 'four-three-contain-1024x768.jpg'),
    veryWideContain: path.join(tmpDir, 'very-wide-contain-1600x720.jpg'),
    softPad: path.join(tmpDir, 'soft-pad-1400x900.jpg'),
  };

  await base.clone()
    .contain(1280, 720, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE)
    .quality(88)
    .writeAsync(variants.wideContain);

  await base.clone()
    .cover(1280, 720, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE)
    .quality(88)
    .writeAsync(variants.wideCover);

  await base.clone()
    .contain(1200, 630, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE)
    .quality(88)
    .writeAsync(variants.cinemaContain);

  await base.clone()
    .cover(1200, 630, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE)
    .quality(88)
    .writeAsync(variants.cinemaCover);

  await base.clone()
    .contain(1024, 768, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE)
    .quality(88)
    .writeAsync(variants.fourThreeContain);

  await base.clone()
    .contain(1600, 720, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE)
    .quality(88)
    .writeAsync(variants.veryWideContain);

  await base.clone()
    .contain(1400, 900, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE)
    .quality(88)
    .writeAsync(variants.softPad);

  return variants;
}

async function relay(sock, jid, content) {
  const msg = generateWAMessageFromContent(jid, content, { userJid: sock.user.id });
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  return msg;
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const images = await ensureVariantImages(thumbPath);

  const media = {};
  for (const [name, filePath] of Object.entries(images)) {
    media[name] = await prepareImage(sock, filePath);
  }

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid);
  log('filtro CA', `${startCase}-${endCase}`, 'delay', `${sendDelayMs}ms`);

  const card = (n, text, mediaKey, options = {}) =>
    makeCard(media[mediaKey], `CA-${n} ${text}`, `ca${n}`, options);

  const cases = [
    ['CA-01 baseline square original', makeCarousel(card('01', 'baseline square original', 'original'))],
    ['CA-02 square metadata 16x9', makeCarousel(makeCard(
      cloneMediaWithDims(media.original, 1280, 720),
      'CA-02 square metadata 16x9',
      'ca02'
    ))],
    ['CA-03 square metadata cinema', makeCarousel(makeCard(
      cloneMediaWithDims(media.original, 1200, 630),
      'CA-03 square metadata cinema',
      'ca03'
    ))],
    ['CA-04 square metadata 4x3', makeCarousel(makeCard(
      cloneMediaWithDims(media.original, 1024, 768),
      'CA-04 square metadata 4x3',
      'ca04'
    ))],
    ['CA-05 wide contain 1280x720', makeCarousel(card('05', 'wide contain 1280x720', 'wideContain'))],
    ['CA-06 wide cover 1280x720', makeCarousel(card('06', 'wide cover 1280x720', 'wideCover'))],
    ['CA-07 cinema contain 1200x630', makeCarousel(card('07', 'cinema contain 1200x630', 'cinemaContain'))],
    ['CA-08 cinema cover 1200x630', makeCarousel(card('08', 'cinema cover 1200x630', 'cinemaCover'))],
    ['CA-09 four-three contain 1024x768', makeCarousel(card('09', 'four-three contain 1024x768', 'fourThreeContain'))],
    ['CA-10 very wide contain 1600x720', makeCarousel(card('10', 'very wide contain 1600x720', 'veryWideContain'))],
    ['CA-11 soft pad 1400x900', makeCarousel(card('11', 'soft pad 1400x900', 'softPad'))],
    ['CA-12 long body width test', makeCarousel(card('12', 'long body width test', 'original', { longBody: true }))],
    ['CA-13 outer header width test', makeCarousel(card('13', 'outer header width test', 'original'), { outerHeader: true })],
    ['CA-14 outer text width test', makeCarousel(card('14', 'outer text width test', 'original'), {
      outerHeader: true,
      outerBody: 'CA-14 texto externo para testar largura e alinhamento',
      outerFooter: 'outer footer',
    })],
    ['CA-15 two wide cards', makeCarousel(card('15A', 'two wide cards A', 'wideContain'), {
      cards: [
        card('15A', 'two wide cards A', 'wideContain'),
        card('15B', 'two wide cards B', 'wideContain'),
      ],
    })],
    ['CA-16 wide contain nativeVersion 1', makeCarousel(card('16', 'wide contain nativeVersion 1', 'wideContain', { nativeVersion: 1 }))],
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
  console.error('[send-carousel-alignment-matrix] erro fatal:', err?.stack || err);
  process.exit(1);
});
