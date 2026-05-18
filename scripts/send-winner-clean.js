const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  createCard,
  createCarousel,
  listPayload,
  nf,
  prepareImage,
  quick,
  relayInteractive,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '559295296926@s.whatsapp.net');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const outerMode = process.argv[5] || 'none';
const log = (...args) => console.log('[send-winner-clean]', ...args);

const rows = [
  { header: 'A', title: 'Opcao A', description: 'single_select vencedor', id: '.winner_a', rowId: '.winner_row_a' },
  { header: 'B', title: 'Opcao B', description: 'segunda opcao', id: '.winner_b', rowId: '.winner_row_b' },
  { title: 'Opcao C', description: 'terceira opcao', id: '.winner_c', rowId: '.winner_row_c' },
];

function winnerContent(media) {
  const buttons = [
    nf('single_select', listPayload({
      title: 'ABRIR LISTA',
      buttonText: 'ABRIR LISTA',
      displayText: 'ABRIR LISTA',
      rows,
      sectionTitle: 'Lista R10-18',
    })),
    quick('QUICK', '.winner_quick'),
    ctaCopy('COPIAR', 'R10-18-CLEAN'),
  ];

  const card = createCard({
    media,
    body: 'R10-18 clean card A',
    footer: 'select + quick + copy',
    subtitle: 'R10-18',
    buttons,
  });

  return createCarousel({
    cards: [card],
    outer: outerMode,
    outerText: 'R10-18 clean winner',
  });
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareImage(sock, thumbPath);

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid, 'outerMode', outerMode);

  await relayInteractive(sock, targetJid, winnerContent(media));
  log('ok enviado');

  await delay(1500);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[send-winner-clean] erro fatal:', err?.stack || err);
  process.exit(1);
});
