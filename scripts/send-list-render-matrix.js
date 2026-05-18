const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  ctaUrl,
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
const log = (...args) => console.log('[send-list-render-matrix]', ...args);

function rows(prefix, label) {
  return [
    { header: label, title: `${label} item 1`, description: 'opcao 1', id: `.${prefix}_1`, rowId: `.${prefix}_row_1` },
    { header: label, title: `${label} item 2`, description: 'opcao 2', id: `.${prefix}_2`, rowId: `.${prefix}_row_2` },
    { header: label, title: `${label} item 3`, description: 'opcao 3', id: `.${prefix}_3`, rowId: `.${prefix}_row_3` },
  ];
}

function selectButton(label, prefix, sectionTitle = label) {
  return nf('single_select', listPayload({
    title: label,
    buttonText: label,
    displayText: label,
    rows: rows(prefix, sectionTitle),
    sectionTitle,
  }));
}

function multiSectionSelect(label) {
  return nf('single_select', {
    title: label,
    button_text: label,
    display_text: label,
    sections: [
      {
        title: 'Lista A',
        highlight_label: 'A',
        rows: rows('matrix_multi_a', 'A'),
      },
      {
        title: 'Lista B',
        highlight_label: 'B',
        rows: rows('matrix_multi_b', 'B'),
      },
    ],
  });
}

function card(media, label, buttons, footer = 'matrix') {
  return createCard({
    media,
    body: label,
    footer,
    subtitle: 'list render matrix',
    buttons,
  });
}

function oneCard(media, label, buttons, outer = 'none') {
  return createCarousel({
    cards: [card(media, label, buttons)],
    outer,
    outerText: label,
  });
}

function twoCards(media) {
  return createCarousel({
    cards: [
      card(media, 'LR-09 card A com lista unica', [
        selectButton('LISTA A', 'matrix_card_a', 'Card A'),
        quick('QUICK A', '.matrix_card_a_quick'),
      ], 'card A'),
      card(media, 'LR-09 card B com lista unica', [
        selectButton('LISTA B', 'matrix_card_b', 'Card B'),
        quick('QUICK B', '.matrix_card_b_quick'),
      ], 'card B'),
    ],
    outer: 'none',
    outerText: 'LR-09 duas listas em cards separados',
  });
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareImage(sock, thumbPath);

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid);

  const cases = [
    ['LR-01 lista unica + quick + copy', oneCard(media, 'LR-01 lista unica + quick + copy', [
      selectButton('ABRIR LISTA', 'matrix_01', 'LR-01'),
      quick('QUICK', '.matrix_01_quick'),
      ctaCopy('COPIAR', 'MATRIX-01'),
    ])],
    ['LR-02 somente uma lista', oneCard(media, 'LR-02 somente uma lista', [
      selectButton('ABRIR LISTA', 'matrix_02', 'LR-02'),
    ])],
    ['LR-03 lista + 6 botoes', oneCard(media, 'LR-03 lista + 6 botoes', [
      selectButton('ABRIR LISTA', 'matrix_03', 'LR-03'),
      quick('QUICK 1', '.matrix_03_quick_1'),
      ctaCopy('COPIAR 1', 'MATRIX-03-A'),
      ctaUrl('URL', 'https://whatsapp.com'),
      quick('QUICK 2', '.matrix_03_quick_2'),
      ctaCopy('COPIAR 2', 'MATRIX-03-B'),
    ])],
    ['LR-04 lista por ultimo', oneCard(media, 'LR-04 lista por ultimo', [
      quick('QUICK', '.matrix_04_quick'),
      ctaCopy('COPIAR', 'MATRIX-04'),
      selectButton('ABRIR LISTA', 'matrix_04', 'LR-04'),
    ])],
    ['LR-05 lista no meio', oneCard(media, 'LR-05 lista no meio', [
      quick('QUICK', '.matrix_05_quick'),
      selectButton('ABRIR LISTA', 'matrix_05', 'LR-05'),
      ctaCopy('COPIAR', 'MATRIX-05'),
    ])],
    ['LR-06 duas listas somente', oneCard(media, 'LR-06 duas listas somente', [
      selectButton('LISTA A', 'matrix_06_a', 'LR-06 A'),
      selectButton('LISTA B', 'matrix_06_b', 'LR-06 B'),
    ])],
    ['LR-07 duas listas + quick + copy', oneCard(media, 'LR-07 duas listas + quick + copy', [
      selectButton('LISTA A', 'matrix_07_a', 'LR-07 A'),
      selectButton('LISTA B', 'matrix_07_b', 'LR-07 B'),
      quick('QUICK', '.matrix_07_quick'),
      ctaCopy('COPIAR', 'MATRIX-07'),
    ])],
    ['LR-08 uma lista com duas secoes', oneCard(media, 'LR-08 uma lista com duas secoes', [
      multiSectionSelect('ABRIR LISTAS A/B'),
      quick('QUICK', '.matrix_08_quick'),
      ctaCopy('COPIAR', 'MATRIX-08'),
    ])],
    ['LR-09 duas listas em cards separados', twoCards(media)],
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
  console.error('[send-list-render-matrix] erro fatal:', err?.stack || err);
  process.exit(1);
});
