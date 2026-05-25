const path = require('path');
const { delay, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  createCard,
  createCarousel,
  createDirectInteractive,
  nf,
  prepareImage,
  quick,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const startCase = Number.parseInt(process.argv[5] || '1', 10);
const endCase = Number.parseInt(process.argv[6] || '999', 10);
const sendDelayMs = Number.parseInt(process.argv[7] || process.env.RC_DELAY_MS || '12000', 10);
const log = (...args) => console.log('[send-response-compat-matrix]', ...args);

function caseNumber(label) {
  const match = String(label).match(/RC-(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function baseRows(prefix, mode = 'full') {
  const base = [
    {
      header: 'A',
      title: `${prefix.toUpperCase()} opcao A`,
      description: 'compat list reply',
      id: `${prefix}_a`,
      rowId: `${prefix}_row_a`,
      row_id: `${prefix}_row_a`,
      selected_id: `${prefix}_a`,
    },
    {
      header: 'B',
      title: `${prefix.toUpperCase()} opcao B`,
      description: 'segunda opcao',
      id: `${prefix}_b`,
      rowId: `${prefix}_row_b`,
      row_id: `${prefix}_row_b`,
      selected_id: `${prefix}_b`,
    },
  ];

  if (mode === 'idOnly') return base.map(({ title, description, id }) => ({ title, description, id }));
  if (mode === 'rowIdOnly') return base.map(({ title, description, rowId }) => ({ title, description, rowId }));
  if (mode === 'row_id') return base.map(({ title, description, row_id }) => ({ title, description, row_id }));
  if (mode === 'clean') return base.map(({ title, id }) => ({ title, id }));
  if (mode === 'selected') return base.map(({ title, description, selected_id }) => ({ title, description, selected_id }));
  if (mode === 'numeric') {
    return base.map((row, index) => ({
      title: row.title,
      description: row.description,
      id: String(index + 1),
      rowId: String(index + 1),
    }));
  }

  return base;
}

function sections(prefix, mode = 'full') {
  return [
    {
      title: `${prefix.toUpperCase()} lista`,
      highlight_label: 'ok',
      rows: baseRows(prefix, mode),
    },
  ];
}

function nativeListPayload(prefix, options = {}) {
  if (options.cloudAction) {
    return {
      type: 'list',
      body: { text: `${prefix.toUpperCase()} body` },
      action: {
        button: 'ABRIR LISTA',
        sections: sections(prefix, options.rowsMode || 'idOnly').map((section) => ({
          title: section.title,
          rows: section.rows,
        })),
      },
    };
  }

  const payload = {
    title: options.title || 'ABRIR LISTA',
    button_text: options.buttonTextObject ? { display_text: 'ABRIR LISTA' } : 'ABRIR LISTA',
    display_text: 'ABRIR LISTA',
    sections: sections(prefix, options.rowsMode || 'full'),
  };

  if (options.listType) {
    payload.list_type = 'SINGLE_SELECT';
    payload.listType = 'SINGLE_SELECT';
  }

  if (options.extra) {
    Object.assign(payload, options.extra);
  }

  return payload;
}

function listButton(prefix, options = {}) {
  return nf(options.name || 'single_select', nativeListPayload(prefix, options));
}

function card(media, label, prefix, options = {}) {
  const buttons = [
    listButton(prefix, options),
    ...(options.onlyList ? [] : [
      quick('QUICK', `${prefix}_quick`),
      ctaCopy('COPIAR', prefix.toUpperCase()),
    ]),
  ];

  return createCard({
    media,
    body: label,
    footer: options.footer || 'RC compat',
    subtitle: options.subtitle || 'RC',
    buttons,
  });
}

function carousel(media, n, label, options = {}) {
  return createCarousel({
    cards: [card(media, label, `rc${n}`, options)],
    outer: options.outer || 'none',
    outerText: label,
  });
}

function direct(media, n, label, options = {}) {
  return createDirectInteractive(card(media, label, `rc${n}`, options));
}

function listMessage(n, label, options = {}) {
  const prefix = `rc${n}`;
  return proto.Message.fromObject({
    listMessage: {
      title: label,
      description: `${label}\nlegacy listMessage`,
      buttonText: 'ABRIR LISTA',
      footerText: options.footer === false ? undefined : 'RC legacy',
      listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
      sections: [
        {
          title: `${prefix.toUpperCase()} legacy`,
          rows: baseRows(prefix, 'rowIdOnly'),
        },
      ],
    },
  });
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

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid);
  log('filtro RC', `${startCase}-${endCase}`, 'delay', `${sendDelayMs}ms`);

  const cases = [
    ['RC-01 legacy listMessage root', listMessage('01', 'RC-01 legacy listMessage root')],
    ['RC-02 legacy listMessage viewOnce', viewOnce(listMessage('02', 'RC-02 legacy listMessage viewOnce'))],
    ['RC-03 direct interactive native full', direct(media, '03', 'RC-03 direct interactive native full')],
    ['RC-04 carousel native full', carousel(media, '04', 'RC-04 carousel native full')],
    ['RC-05 carousel id only rows', carousel(media, '05', 'RC-05 carousel id only rows', { rowsMode: 'idOnly' })],
    ['RC-06 carousel rowId only rows', carousel(media, '06', 'RC-06 carousel rowId only rows', { rowsMode: 'rowIdOnly' })],
    ['RC-07 carousel row_id snake rows', carousel(media, '07', 'RC-07 carousel row_id snake rows', { rowsMode: 'row_id' })],
    ['RC-08 carousel selected_id rows', carousel(media, '08', 'RC-08 carousel selected_id rows', { rowsMode: 'selected' })],
    ['RC-09 carousel numeric rows', carousel(media, '09', 'RC-09 carousel numeric rows', { rowsMode: 'numeric' })],
    ['RC-10 carousel listType fields', carousel(media, '10', 'RC-10 carousel listType fields', { listType: true })],
    ['RC-11 carousel button_text object', carousel(media, '11', 'RC-11 carousel button_text object', { buttonTextObject: true })],
    ['RC-12 carousel cloud action payload', carousel(media, '12', 'RC-12 carousel cloud action payload', { cloudAction: true })],
    ['RC-13 carousel list only no quick copy', carousel(media, '13', 'RC-13 carousel list only no quick copy', { onlyList: true })],
    ['RC-14 direct legacy-ish rows only', direct(media, '14', 'RC-14 direct legacy-ish rows only', { rowsMode: 'rowIdOnly', onlyList: true })],
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
  console.error('[send-response-compat-matrix] erro fatal:', err?.stack || err);
  process.exit(1);
});
