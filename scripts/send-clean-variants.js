const path = require('path');
const { delay } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  createCard,
  createCarousel,
  createDirectInteractive,
  listPayload,
  nf,
  prepareImage,
  quick,
  relayInteractive,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '559295296926@s.whatsapp.net');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const log = (...args) => console.log('[send-clean-variants]', ...args);

const rows = [
  { header: 'A', title: 'Opcao A', description: 'lista limpa', id: '.clean_a', rowId: '.clean_row_a' },
  { header: 'B', title: 'Opcao B', description: 'segunda opcao', id: '.clean_b', rowId: '.clean_row_b' },
  { title: 'Opcao C', description: 'terceira opcao', id: '.clean_c', rowId: '.clean_row_c' },
];

function buttons(label) {
  return [
    nf('single_select', listPayload({
      title: 'ABRIR LISTA',
      buttonText: 'ABRIR LISTA',
      displayText: 'ABRIR LISTA',
      rows,
      sectionTitle: label,
    })),
    quick('QUICK', '.clean_quick'),
    ctaCopy('COPIAR', 'CLEAN-COPY'),
  ];
}

function testCard(media, label) {
  return createCard({
    media,
    body: label,
    footer: 'card unico',
    subtitle: 'limpo',
    buttons: buttons(label),
  });
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  const media = await prepareImage(sock, thumbPath);

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid);

  const cases = [
    ['CLEAN-01 controle com texto externo', createCarousel({ cards: [testCard(media, 'CLEAN-01 controle com texto externo')], outer: 'text', outerText: 'CLEAN-01 controle com texto externo' })],
    ['CLEAN-02 carousel sem body/footer externo', createCarousel({ cards: [testCard(media, 'CLEAN-02 sem texto externo')], outer: 'none' })],
    ['CLEAN-03 carousel sem body/footer/header externo', createCarousel({ cards: [testCard(media, 'CLEAN-03 headerless externo')], outer: 'headerless' })],
    ['CLEAN-04 carousel body/footer vazio', createCarousel({ cards: [testCard(media, 'CLEAN-04 vazio externo')], outer: 'empty' })],
    ['CLEAN-05 carousel body/footer invisivel', createCarousel({ cards: [testCard(media, 'CLEAN-05 invisivel externo')], outer: 'zwsp' })],
    ['CLEAN-06 sem carousel direto', createDirectInteractive(testCard(media, 'CLEAN-06 direto sem carousel'))],
  ];

  for (const [label, content] of cases) {
    log('enviando', label);
    await relayInteractive(sock, targetJid, content);
    log('ok', label);
    await delay(1300);
  }

  await delay(1500);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[send-clean-variants] erro fatal:', err?.stack || err);
  process.exit(1);
});
