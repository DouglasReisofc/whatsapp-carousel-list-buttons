const fs = require('fs');
const { delay } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const waitArg = process.argv.find((arg) => arg.startsWith('--wait='));
const outArg = process.argv.find((arg) => arg.startsWith('--out='));
const waitMs = waitArg ? Number.parseInt(waitArg.split('=')[1], 10) : 180000;
const outFile = outArg ? outArg.slice('--out='.length) : 'response-dump.jsonl';
const startedAtSec = Math.floor(Date.now() / 1000) - 5;
const seen = new Set();
const log = (...args) => console.log('[watch-dump-list-response]', ...args);

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

function hasListResponse(message) {
  const content = unwrapMessage(message);
  return Boolean(content.interactiveResponseMessage || content.listResponseMessage || content.buttonsResponseMessage);
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  fs.writeFileSync(outFile, '', { flag: 'a' });

  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages || []) {
      if (!msg?.key?.id || seen.has(msg.key.id)) continue;
      seen.add(msg.key.id);
      if (msg.key.remoteJid !== targetJid || msg.key.fromMe) continue;
      if (unixTimestamp(msg.messageTimestamp) < startedAtSec) continue;
      if (!hasListResponse(msg.message)) continue;

      const content = unwrapMessage(msg.message);
      const dump = {
        key: msg.key,
        pushName: msg.pushName,
        messageTimestamp: unixTimestamp(msg.messageTimestamp),
        mtype: Object.keys(content)[0] || '',
        content,
      };

      fs.appendFileSync(outFile, `${JSON.stringify(dump)}\n`);
      log('dump', dump.mtype, msg.key.id, '->', outFile);
    }
  });

  log('ouvindo', targetJid, 'wait', `${waitMs}ms`, 'out', outFile);
  await delay(waitMs);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[watch-dump-list-response] erro fatal:', err?.stack || err);
  process.exit(1);
});
