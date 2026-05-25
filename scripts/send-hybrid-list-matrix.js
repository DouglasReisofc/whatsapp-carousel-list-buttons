const path = require('path');
const { delay, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  listPayload,
  nf,
  prepareImage,
  quick,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const log = (...args) => console.log('[send-hybrid-list-matrix]', ...args);

function rows(prefix) {
  return [
    { header: 'A', title: `${prefix} item A`, description: 'hybrid list', id: `.${prefix}_a`, rowId: `.${prefix}_row_a` },
    { header: 'B', title: `${prefix} item B`, description: 'hybrid list', id: `.${prefix}_b`, rowId: `.${prefix}_row_b` },
    { header: 'C', title: `${prefix} item C`, description: 'hybrid list', id: `.${prefix}_c`, rowId: `.${prefix}_row_c` },
  ];
}

function listSections(prefix) {
  return [
    {
      title: `${prefix.toUpperCase()} lista`,
      highlight_label: 'teste',
      rows: rows(prefix),
    },
  ];
}

function nativeListPayload(prefix) {
  return listPayload({
    title: 'ABRIR LISTA',
    buttonText: 'ABRIR LISTA',
    displayText: 'ABRIR LISTA',
    sections: listSections(prefix),
  });
}

function directNoList(media, label, prefix) {
  return proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({ text: label }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: 'D2 DI-10 base sem lista' }),
    header: proto.Message.InteractiveMessage.Header.create({
      title: '',
      subtitle: 'D2',
      hasMediaAttachment: true,
      ...media,
    }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: [
        quick('QUICK', `.${prefix}_quick`),
        ctaCopy('COPIAR', prefix.toUpperCase()),
      ],
    }),
  });
}

function directList(media, label, prefix) {
  return proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({ text: label }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: 'D2 direct list' }),
    header: proto.Message.InteractiveMessage.Header.create({
      title: '',
      subtitle: 'D2',
      hasMediaAttachment: true,
      ...media,
    }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      messageVersion: 1,
      buttons: [
        nf('single_select', nativeListPayload(prefix)),
        quick('QUICK', `.${prefix}_quick`),
        ctaCopy('COPIAR', prefix.toUpperCase()),
      ],
    }),
  });
}

function listMessage(label, prefix, withContext = false) {
  return proto.Message.fromObject({
    listMessage: {
      title: label,
      description: `${label}\nlistMessage direto`,
      buttonText: 'ABRIR LISTA',
      footerText: 'D2 listMessage',
      listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
      contextInfo: withContext ? {
        forwardingScore: 1,
        isForwarded: true,
      } : undefined,
      sections: [
        {
          title: `${prefix.toUpperCase()} legacy`,
          rows: rows(prefix).map((row) => ({
            title: row.title,
            description: row.description,
            rowId: row.rowId || row.id,
          })),
        },
      ],
    },
  });
}

function buttonsMessage(label, prefix, options = {}) {
  const buttons = options.responseFirst
    ? [
      { buttonId: `.${prefix}_fallback`, buttonText: { displayText: 'FALLBACK' }, type: proto.Message.ButtonsMessage.Button.Type.RESPONSE },
      {
        buttonId: `.${prefix}_native`,
        buttonText: { displayText: 'ABRIR LISTA' },
        type: proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW,
        nativeFlowInfo: {
          name: options.name || 'single_select',
          paramsJson: JSON.stringify(nativeListPayload(prefix)),
        },
      },
    ]
    : [
      {
        buttonId: `.${prefix}_native`,
        buttonText: { displayText: 'ABRIR LISTA' },
        type: proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW,
        nativeFlowInfo: {
          name: options.name || 'single_select',
          paramsJson: JSON.stringify(nativeListPayload(prefix)),
        },
      },
      ...(options.responseAfter ? [
        { buttonId: `.${prefix}_fallback`, buttonText: { displayText: 'FALLBACK' }, type: proto.Message.ButtonsMessage.Button.Type.RESPONSE },
      ] : []),
    ];

  return proto.Message.fromObject({
    buttonsMessage: {
      contentText: label,
      footerText: 'D2 buttonsMessage nativeFlow',
      headerType: 1,
      buttons,
    },
  });
}

function templateDirect(interactiveMessage, label) {
  return {
    templateMessage: {
      templateId: `${label}_template`,
      interactiveMessageTemplate: interactiveMessage,
    },
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

function hybrid(fields) {
  return proto.Message.fromObject(fields);
}

function protocolEdit(key, editedMessage) {
  return {
    protocolMessage: {
      key,
      type: proto.Message.ProtocolMessage.Type.MESSAGE_EDIT,
      editedMessage,
      timestampMs: Date.now(),
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

  async function send(label, fn) {
    log('enviando', label);
    try {
      await fn();
      log('ok', label);
    } catch (err) {
      log('falhou', label, err?.message || err);
    }
    await delay(1500);
  }

  await send('D2-01 controle DI-10 sem lista', () => relay(sock, targetJid, {
    interactiveMessage: directNoList(media, 'D2-01 controle DI-10 sem lista', 'd201'),
  }));

  await send('D2-02 listMessage root', () => relay(sock, targetJid, listMessage('D2-02 listMessage root', 'd202')));
  await send('D2-03 listMessage root context', () => relay(sock, targetJid, listMessage('D2-03 listMessage root context', 'd203', true)));
  await send('D2-04 listMessage viewOnce', () => relay(sock, targetJid, viewOnce(listMessage('D2-04 listMessage viewOnce', 'd204'))));
  await send('D2-05 buttonsMessage nativeFlow', () => relay(sock, targetJid, buttonsMessage('D2-05 buttonsMessage nativeFlow', 'd205')));
  await send('D2-06 buttonsMessage response after', () => relay(sock, targetJid, buttonsMessage('D2-06 buttonsMessage response after', 'd206', { responseAfter: true })));
  await send('D2-07 buttonsMessage response first', () => relay(sock, targetJid, buttonsMessage('D2-07 buttonsMessage response first', 'd207', { responseFirst: true })));
  await send('D2-08 buttonsMessage name single_select_v2', () => relay(sock, targetJid, buttonsMessage('D2-08 buttonsMessage name single_select_v2', 'd208', { name: 'single_select_v2' })));

  await send('D2-09 template direct list', () => relay(sock, targetJid,
    templateDirect(directList(media, 'D2-09 template direct list', 'd209'), 'd209')
  ));
  await send('D2-10 viewOnce template direct list', () => relay(sock, targetJid,
    viewOnce(templateDirect(directList(media, 'D2-10 viewOnce template direct list', 'd210'), 'd210'))
  ));

  await send('D2-11 hybrid direct sem lista + listMessage', () => relay(sock, targetJid, hybrid({
    interactiveMessage: directNoList(media, 'D2-11 hybrid direct sem lista + listMessage', 'd211'),
    listMessage: listMessage('D2-11 fallback listMessage', 'd211').listMessage,
  })));

  await send('D2-12 hybrid listMessage + direct sem lista', () => relay(sock, targetJid, hybrid({
    listMessage: listMessage('D2-12 fallback listMessage', 'd212').listMessage,
    interactiveMessage: directNoList(media, 'D2-12 hybrid listMessage + direct sem lista', 'd212'),
  })));

  await send('D2-13 hybrid direct sem lista + buttonsMessage', () => relay(sock, targetJid, hybrid({
    interactiveMessage: directNoList(media, 'D2-13 hybrid direct sem lista + buttonsMessage', 'd213'),
    buttonsMessage: buttonsMessage('D2-13 fallback buttonsMessage', 'd213').buttonsMessage,
  })));

  await send('D2-14 hybrid direct list + listMessage', () => relay(sock, targetJid, hybrid({
    interactiveMessage: directList(media, 'D2-14 hybrid direct list + listMessage', 'd214'),
    listMessage: listMessage('D2-14 fallback listMessage', 'd214').listMessage,
  })));

  await send('D2-15 viewOnce hybrid direct sem lista + listMessage', () => relay(sock, targetJid, viewOnce(hybrid({
    interactiveMessage: directNoList(media, 'D2-15 viewOnce hybrid direct sem lista + listMessage', 'd215'),
    listMessage: listMessage('D2-15 fallback listMessage', 'd215').listMessage,
  }))));

  await send('D2-16 protocol edit texto para listMessage', async () => {
    const base = await sock.sendMessage(targetJid, { text: 'D2-16 base protocol edit -> listMessage' });
    await delay(800);
    await relay(sock, targetJid, protocolEdit(base.key, listMessage('D2-16 edit listMessage', 'd216')));
  });

  await send('D2-17 protocol edit texto para direct list', async () => {
    const base = await sock.sendMessage(targetJid, { text: 'D2-17 base protocol edit -> direct list' });
    await delay(800);
    await relay(sock, targetJid, protocolEdit(base.key, {
      interactiveMessage: directList(media, 'D2-17 edit direct list', 'd217'),
    }));
  });

  await send('D2-18 protocol edit texto para hybrid', async () => {
    const base = await sock.sendMessage(targetJid, { text: 'D2-18 base protocol edit -> hybrid' });
    await delay(800);
    await relay(sock, targetJid, protocolEdit(base.key, hybrid({
      interactiveMessage: directNoList(media, 'D2-18 edit hybrid direct sem lista + list', 'd218'),
      listMessage: listMessage('D2-18 edit fallback list', 'd218').listMessage,
    })));
  });

  await delay(1500);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[send-hybrid-list-matrix] erro fatal:', err?.stack || err);
  process.exit(1);
});
