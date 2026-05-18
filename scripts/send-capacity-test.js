const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  ctaUrl,
  createCard,
  createCarousel,
  listPayload,
  makeSections,
  nf,
  prepareImage,
  quick,
  relayInteractive,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '559295296926@s.whatsapp.net');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const log = (...args) => console.log('[send-capacity-test]', ...args);

function capacityPayload(label, rowCount, sectionMode = 'single') {
  return listPayload({
    title: 'ABRIR LISTA',
    buttonText: 'ABRIR LISTA',
    displayText: 'ABRIR LISTA',
    sections: makeSections(rowCount, sectionMode),
    sectionTitle: label,
  });
}

function defaultButtons(label, rowCount = 10, sectionMode = 'single') {
  return [
    nf('single_select', capacityPayload(label, rowCount, sectionMode)),
    quick('QUICK', `.quick_${rowCount}`),
    ctaCopy('COPIAR', `COPY-${rowCount}`),
  ];
}

function manyButtons(label, rowCount, buttonCount) {
  const buttons = [
    nf('single_select', capacityPayload(label, rowCount)),
    quick('QUICK 1', '.cap_quick_1'),
    ctaCopy('COPIAR 1', 'CAP-COPY-1'),
    ctaUrl('URL 1', 'https://whatsapp.com'),
    quick('QUICK 2', '.cap_quick_2'),
    ctaCopy('COPIAR 2', 'CAP-COPY-2'),
    quick('QUICK 3', '.cap_quick_3'),
    ctaUrl('URL 2', 'https://www.whatsapp.com'),
    quick('QUICK 4', '.cap_quick_4'),
    ctaCopy('COPIAR 3', 'CAP-COPY-3'),
  ];
  return buttons.slice(0, buttonCount);
}

function twoSelectButtons(label) {
  return [
    nf('single_select', capacityPayload(`${label} lista A`, 10)),
    nf('single_select', {
      title: 'ABRIR LISTA 2',
      button_text: 'ABRIR LISTA 2',
      display_text: 'ABRIR LISTA 2',
      sections: makeSections(10, 'multi'),
    }),
    quick('QUICK', '.cap_two_select_quick'),
    ctaCopy('COPIAR', 'CAP-TWO-SELECT'),
  ];
}

function capacityCard(media, label, buttons) {
  return createCard({
    media,
    body: label,
    footer: 'capacidade',
    subtitle: 'teste',
    buttons,
  });
}

function capacityCarousel(media, label, buttons, outer = 'none') {
  return createCarousel({
    cards: [capacityCard(media, label, buttons)],
    outer,
    outerText: label,
  });
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareImage(sock, thumbPath);

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid);

  const cases = [
    ['CAP-01 CLEAN-02 5 itens 3 botoes', capacityCarousel(media, 'CAP-01 5 itens 3 botoes', defaultButtons('CAP-01', 5))],
    ['CAP-02 CLEAN-02 10 itens 3 botoes', capacityCarousel(media, 'CAP-02 10 itens 3 botoes', defaultButtons('CAP-02', 10))],
    ['CAP-03 CLEAN-02 15 itens 3 botoes', capacityCarousel(media, 'CAP-03 15 itens 3 botoes', defaultButtons('CAP-03', 15))],
    ['CAP-04 CLEAN-02 20 itens 3 botoes', capacityCarousel(media, 'CAP-04 20 itens 3 botoes', defaultButtons('CAP-04', 20))],
    ['CAP-05 CLEAN-02 30 itens 3 botoes', capacityCarousel(media, 'CAP-05 30 itens 3 botoes', defaultButtons('CAP-05', 30))],
    ['CAP-06 CLEAN-02 50 itens 3 botoes', capacityCarousel(media, 'CAP-06 50 itens 3 botoes', defaultButtons('CAP-06', 50))],
    ['CAP-07 CLEAN-03 20 itens headerless', capacityCarousel(media, 'CAP-07 20 itens headerless', defaultButtons('CAP-07', 20), 'headerless')],
    ['CAP-08 CLEAN-03 50 itens headerless', capacityCarousel(media, 'CAP-08 50 itens headerless', defaultButtons('CAP-08', 50), 'headerless')],
    ['CAP-09 30 itens multi section 3 botoes', capacityCarousel(media, 'CAP-09 30 itens multi section', defaultButtons('CAP-09', 30, 'multi'))],
    ['CAP-10 50 itens multi section 3 botoes', capacityCarousel(media, 'CAP-10 50 itens multi section', defaultButtons('CAP-10', 50, 'multi'))],
    ['CAP-11 10 itens 4 botoes', capacityCarousel(media, 'CAP-11 10 itens 4 botoes', manyButtons('CAP-11', 10, 4))],
    ['CAP-12 10 itens 5 botoes', capacityCarousel(media, 'CAP-12 10 itens 5 botoes', manyButtons('CAP-12', 10, 5))],
    ['CAP-13 10 itens 6 botoes', capacityCarousel(media, 'CAP-13 10 itens 6 botoes', manyButtons('CAP-13', 10, 6))],
    ['CAP-14 10 itens 8 botoes', capacityCarousel(media, 'CAP-14 10 itens 8 botoes', manyButtons('CAP-14', 10, 8))],
    ['CAP-15 10 itens 10 botoes', capacityCarousel(media, 'CAP-15 10 itens 10 botoes', manyButtons('CAP-15', 10, 10))],
    ['CAP-16 duas listas single_select no card', capacityCarousel(media, 'CAP-16 duas listas no mesmo card', twoSelectButtons('CAP-16'))],
    ['CAP-17 duas listas headerless', capacityCarousel(media, 'CAP-17 duas listas headerless', twoSelectButtons('CAP-17'), 'headerless')],
  ];

  for (const [label, content] of cases) {
    log('enviando', label);
    try {
      await relayInteractive(sock, targetJid, content);
      log('ok', label);
    } catch (err) {
      log('falhou', label, err?.message || err);
    }
    await delay(1400);
  }

  await delay(1500);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[send-capacity-test] erro fatal:', err?.stack || err);
  process.exit(1);
});
