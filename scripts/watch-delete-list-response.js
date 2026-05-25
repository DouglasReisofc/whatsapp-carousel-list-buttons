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

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const shouldSend = process.argv.includes('--send');
const shouldDelete = !process.argv.includes('--no-delete');
const shouldReply = !process.argv.includes('--no-reply');
const waitArg = process.argv.find((arg) => arg.startsWith('--wait='));
const waitMs = waitArg ? Number.parseInt(waitArg.split('=')[1], 10) : 180000;
const startedAtSec = Math.floor(Date.now() / 1000) - 5;
const seen = new Set();
const log = (...args) => console.log('[watch-delete-list-response]', ...args);

function unwrapMessage(message) {
  let current = message;
  for (let guard = 0; guard < 8 && current; guard += 1) {
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
      continue;
    }
    if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message;
      continue;
    }
    if (current.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message;
      continue;
    }
    if (current.viewOnceMessageV2Extension?.message) {
      current = current.viewOnceMessageV2Extension.message;
      continue;
    }
    if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message;
      continue;
    }
    break;
  }
  return current || {};
}

function unixTimestamp(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJson(value) {
  if (!value || typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function readSelection(message) {
  const content = unwrapMessage(message);

  const native = content.interactiveResponseMessage?.nativeFlowResponseMessage;
  if (native) {
    const params = parseJson(native.paramsJson);
    return {
      kind: `native:${native.name || 'unknown'}`,
      id: params.id || params.row_id || params.rowId || params.selected_id || params.selection_id || '',
      title: params.title || params.display_text || params.text || params.label || '',
      description: params.description || params.subtext || '',
      params,
    };
  }

  const list = content.listResponseMessage;
  if (list) {
    return {
      kind: 'legacy:listResponseMessage',
      id: list.singleSelectReply?.selectedRowId || '',
      title: list.title || '',
      description: list.description || '',
      params: {},
    };
  }

  return null;
}

function responseText(selection) {
  const label = selection.title || selection.id || 'item selecionado';
  const detail = selection.description ? `\n${selection.description}` : '';
  return `✅ Lista normalizada\n${label}${detail}`;
}

function testContent(media) {
  const rows = [
    { header: 'A', title: 'Normalizar A', description: 'teste delete + reply', id: 'norm_a', rowId: 'norm_row_a' },
    { header: 'B', title: 'Normalizar B', description: 'segunda opcao', id: 'norm_b', rowId: 'norm_row_b' },
  ];

  const buttons = [
    nf('single_select', listPayload({
      title: 'ABRIR LISTA',
      buttonText: 'ABRIR LISTA',
      displayText: 'ABRIR LISTA',
      rows,
      sectionTitle: 'Normalizacao',
    })),
    quick('QUICK', 'norm_quick'),
    ctaCopy('COPIAR', 'NORMALIZAR'),
  ];

  const card = createCard({
    media,
    body: 'FIX-01 normalizar resposta da lista',
    footer: 'delete + reply normal',
    subtitle: 'observer fix',
    buttons,
  });

  return createCarousel({
    cards: [card],
    outer: 'none',
    outerText: 'normalizar lista',
  });
}

async function handleMessage(sock, msg) {
  if (!msg?.key?.id || seen.has(msg.key.id)) return;
  seen.add(msg.key.id);

  if (msg.key.remoteJid !== targetJid || msg.key.fromMe) return;
  if (unixTimestamp(msg.messageTimestamp) < startedAtSec) return;

  const selection = readSelection(msg.message);
  if (!selection) return;

  const actor = msg.key.participant || msg.participant || msg.pushName || 'participante';
  log('capturado', selection.kind, 'id=', selection.id || '-', 'title=', selection.title || '-', 'actor=', actor);

  if (shouldDelete) {
    try {
      await sock.sendMessage(targetJid, { delete: msg.key });
      log('delete solicitado para', msg.key.id);
    } catch (err) {
      log('delete falhou', err?.message || err);
    }
  }

  if (shouldReply) {
    try {
      await sock.sendMessage(targetJid, { text: responseText(selection) });
      log('reply normal enviado');
    } catch (err) {
      log('reply falhou', err?.message || err);
    }
  }
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages || []) {
      await handleMessage(sock, msg);
    }
  });

  log('ouvindo', targetJid, 'delete', shouldDelete, 'reply', shouldReply, 'wait', `${waitMs}ms`);

  if (shouldSend) {
    const media = await prepareImage(sock, thumbPath);
    await relayInteractive(sock, targetJid, testContent(media));
    log('teste FIX-01 enviado');
  }

  await delay(waitMs);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[watch-delete-list-response] erro fatal:', err?.stack || err);
  process.exit(1);
});
