const path = require('path');
const crypto = require('crypto');
const { delay, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  ctaUrl,
  nf,
  prepareImage,
  quick,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const log = (...args) => console.log('[send-direct-list-iphone-probe]', ...args);

function rows(prefix, mode = 'both') {
  const base = [
    { header: 'A', title: `${prefix} A`, description: 'probe iphone', id: `.${prefix}_a`, rowId: `.${prefix}_row_a` },
    { header: 'B', title: `${prefix} B`, description: 'probe iphone', id: `.${prefix}_b`, rowId: `.${prefix}_row_b` },
  ];

  if (mode === 'idOnly') {
    return base.map(({ title, description, id }) => ({ title, description, id }));
  }

  if (mode === 'rowIdOnly') {
    return base.map(({ title, description, rowId }) => ({ title, description, rowId }));
  }

  if (mode === 'clean') {
    return base.map(({ title, id }) => ({ title, id }));
  }

  if (mode === 'numbered') {
    return base.map((row, index) => ({
      title: row.title,
      description: row.description,
      id: String(index + 1),
      rowId: String(index + 1),
    }));
  }

  return base;
}

function sections(prefix, rowMode = 'both') {
  return [
    {
      title: `${prefix.toUpperCase()} lista`,
      highlight_label: 'teste',
      rows: rows(prefix, rowMode),
    },
  ];
}

function selectPayload(prefix, mode = 'full') {
  if (mode === 'dummy') return { has_multiple_buttons: true };
  if (mode === 'titleOnly') return { title: 'ABRIR LISTA' };
  if (mode === 'emptySections') return { title: 'ABRIR LISTA', sections: [] };
  if (mode === 'buttonTextOnly') return { button_text: 'ABRIR LISTA', sections: sections(prefix) };
  if (mode === 'displayTextOnly') return { display_text: 'ABRIR LISTA', sections: sections(prefix) };
  if (mode === 'buttonTextObject') {
    return {
      title: 'ABRIR LISTA',
      button_text: { display_text: 'ABRIR LISTA' },
      sections: sections(prefix),
    };
  }
  if (mode === 'cloudAction') {
    return {
      type: 'list',
      header: { type: 'text', text: 'D1 header' },
      body: { text: 'D1 body' },
      footer: { text: 'D1 footer' },
      action: {
        button: 'ABRIR LISTA',
        sections: sections(prefix, 'idOnly').map((section) => ({
          title: section.title,
          rows: section.rows,
        })),
      },
    };
  }
  if (mode === 'listType') {
    return {
      title: 'ABRIR LISTA',
      list_type: 'SINGLE_SELECT',
      listType: 'SINGLE_SELECT',
      button_text: 'ABRIR LISTA',
      display_text: 'ABRIR LISTA',
      sections: sections(prefix),
    };
  }
  if (mode === 'idOnly') return { title: 'ABRIR LISTA', button_text: 'ABRIR LISTA', sections: sections(prefix, 'idOnly') };
  if (mode === 'rowIdOnly') return { title: 'ABRIR LISTA', button_text: 'ABRIR LISTA', sections: sections(prefix, 'rowIdOnly') };
  if (mode === 'cleanRows') return { title: 'ABRIR LISTA', button_text: 'ABRIR LISTA', sections: sections(prefix, 'clean') };
  if (mode === 'numberedRows') return { title: 'ABRIR LISTA', button_text: 'ABRIR LISTA', sections: sections(prefix, 'numbered') };

  return {
    title: 'ABRIR LISTA',
    button_text: 'ABRIR LISTA',
    display_text: 'ABRIR LISTA',
    sections: sections(prefix),
  };
}

function listButton(name, prefix, mode = 'full') {
  return nf(name, selectPayload(prefix, mode));
}

function buttonSet(prefix, mode) {
  if (mode === 'baselineNoList') return [quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'singleOnly') return [listButton('single_select', prefix, 'full')];
  if (mode === 'dummyThenBase') return [listButton('single_select', prefix, 'dummy'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'titleOnly') return [listButton('single_select', prefix, 'titleOnly'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'emptySections') return [listButton('single_select', prefix, 'emptySections'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'idOnly') return [listButton('single_select', prefix, 'idOnly'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'rowIdOnly') return [listButton('single_select', prefix, 'rowIdOnly'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'cleanRows') return [listButton('single_select', prefix, 'cleanRows'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'numberedRows') return [listButton('single_select', prefix, 'numberedRows'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'buttonTextOnly') return [listButton('single_select', prefix, 'buttonTextOnly'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'displayTextOnly') return [listButton('single_select', prefix, 'displayTextOnly'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'buttonTextObject') return [listButton('single_select', prefix, 'buttonTextObject'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'cloudAction') return [listButton('single_select', prefix, 'cloudAction'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'listType') return [listButton('single_select', prefix, 'listType'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'quickFirst') return [quick('QUICK', `.${prefix}_quick`), listButton('single_select', prefix, 'full'), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'copyFirst') return [ctaCopy('COPIAR', prefix.toUpperCase()), listButton('single_select', prefix, 'full'), quick('QUICK', `.${prefix}_quick`)];
  if (mode === 'urlInsteadCopy') return [quick('QUICK', `.${prefix}_quick`), listButton('single_select', prefix, 'full'), ctaUrl('URL', 'https://whatsapp.com')];
  if (mode === 'v2Name') return [listButton('single_select_v2', prefix, 'full'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'listMessageName') return [listButton('list_message', prefix, 'full'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'listName') return [listButton('list', prefix, 'full'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'multiSelect') return [listButton('multi_select', prefix, 'full'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];

  return [listButton('single_select', prefix, 'full'), quick('QUICK', `.${prefix}_quick`), ctaCopy('COPIAR', prefix.toUpperCase())];
}

function direct(media, label, prefix, mode, options = {}) {
  const header = options.noHeader
    ? undefined
    : proto.Message.InteractiveMessage.Header.create({
      title: '',
      subtitle: 'D1 probe',
      hasMediaAttachment: options.noMedia ? false : true,
      ...(options.noMedia ? {} : media),
    });

  return {
    interactiveMessage: proto.Message.InteractiveMessage.create({
      body: proto.Message.InteractiveMessage.Body.create({ text: label }),
      footer: proto.Message.InteractiveMessage.Footer.create({ text: 'base DI-10 + lista mutavel' }),
      header,
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        messageVersion: options.messageVersion,
        messageParamsJson: options.messageParamsJson ? JSON.stringify(options.messageParamsJson) : undefined,
        buttons: buttonSet(prefix, mode),
      }),
    }),
  };
}

function mci(label) {
  return {
    messageContextInfo: proto.MessageContextInfo.create({
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      messageSecret: crypto.randomBytes(32),
      paddingBytes: Buffer.from(label),
    }),
  };
}

function viewOnce(content, label) {
  return { viewOnceMessage: { message: { ...mci(label), ...content } } };
}

function viewOnceV2(content, label) {
  return { viewOnceMessageV2: { message: { ...mci(label), ...content } } };
}

function deviceSent(content, jid, label) {
  return {
    deviceSentMessage: {
      destinationJid: jid,
      phash: `${label}-phash`,
      message: { ...mci(label), ...content },
    },
  };
}

function template(content, label) {
  return {
    templateMessage: {
      templateId: `${label}_template`,
      interactiveMessageTemplate: content.interactiveMessage,
    },
  };
}

function buttonsMessage(label, prefix, buttonType = proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW) {
  return proto.Message.fromObject({
    buttonsMessage: {
      contentText: label,
      footerText: 'D1 buttonsMessage probe',
      headerType: 1,
      buttons: [
        {
          buttonId: `.${prefix}_native`,
          buttonText: { displayText: 'ABRIR LISTA' },
          type: buttonType,
          nativeFlowInfo: {
            name: 'single_select',
            paramsJson: JSON.stringify(selectPayload(prefix, 'full')),
          },
        },
      ],
    },
  });
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

  const d = (n, text, mode, options) => direct(media, `D1-${n} ${text}`, `d1${n}`, mode, options);

  const cases = [
    ['D1-10R reprise sem lista', d('10R', 'reprise sem lista', 'baselineNoList')],
    ['D1-11 dummy single_select vazio', d('11', 'dummy single_select vazio', 'dummyThenBase')],
    ['D1-12 single_select title only', d('12', 'single_select title only', 'titleOnly')],
    ['D1-13 single_select sections empty', d('13', 'single_select sections empty', 'emptySections')],
    ['D1-14 single_select id only rows', d('14', 'single_select id only rows', 'idOnly')],
    ['D1-15 single_select rowId only rows', d('15', 'single_select rowId only rows', 'rowIdOnly')],
    ['D1-16 single_select clean rows', d('16', 'single_select clean rows', 'cleanRows')],
    ['D1-17 single_select numbered ids', d('17', 'single_select numbered ids', 'numberedRows')],
    ['D1-18 button_text only', d('18', 'button_text only', 'buttonTextOnly')],
    ['D1-19 display_text only', d('19', 'display_text only', 'displayTextOnly')],
    ['D1-20 button_text object', d('20', 'button_text object', 'buttonTextObject')],
    ['D1-21 cloud action payload', d('21', 'cloud action payload', 'cloudAction')],
    ['D1-22 listType fields', d('22', 'listType fields', 'listType')],
    ['D1-23 quick first then list', d('23', 'quick first then list', 'quickFirst')],
    ['D1-24 copy first then list', d('24', 'copy first then list', 'copyFirst')],
    ['D1-25 url instead copy', d('25', 'url instead copy', 'urlInsteadCopy')],
    ['D1-26 native name single_select_v2', d('26', 'native name single_select_v2', 'v2Name')],
    ['D1-27 native name list_message', d('27', 'native name list_message', 'listMessageName')],
    ['D1-28 native name list', d('28', 'native name list', 'listName')],
    ['D1-29 native name multi_select', d('29', 'native name multi_select', 'multiSelect')],
    ['D1-30 only single_select no quick/copy', d('30', 'only single_select no quick/copy', 'singleOnly')],
    ['D1-31 no media with single_select', d('31', 'no media with single_select', 'default', { noMedia: true })],
    ['D1-32 no header with single_select', d('32', 'no header with single_select', 'default', { noHeader: true })],
    ['D1-33 messageVersion 1', d('33', 'messageVersion 1', 'default', { messageVersion: 1 })],
    ['D1-34 bottom_sheet params', d('34', 'bottom_sheet params', 'default', {
      messageVersion: 1,
      messageParamsJson: {
        bottom_sheet: {
          in_thread_buttons_limit: 1,
          list_title: 'D1 list',
          button_title: 'OPEN D1',
        },
      },
    })],
    ['D1-35 viewOnce direct list', viewOnce(d('35', 'viewOnce direct list', 'default'), 'd135')],
    ['D1-36 viewOnceV2 direct list', viewOnceV2(d('36', 'viewOnceV2 direct list', 'default'), 'd136')],
    ['D1-37 deviceSent direct list', deviceSent(d('37', 'deviceSent direct list', 'default'), targetJid, 'd137')],
    ['D1-38 template direct list', template(d('38', 'template direct list', 'default'), 'd138')],
    ['D1-39 buttonsMessage nativeFlow type2', buttonsMessage('D1-39 buttonsMessage nativeFlow type2', 'd139')],
    ['D1-40 buttonsMessage nativeFlow type4 raw', buttonsMessage('D1-40 buttonsMessage nativeFlow type4 raw', 'd140', 4)],
  ];

  for (const [label, content] of cases) {
    log('enviando', label);
    try {
      await relay(sock, targetJid, content);
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
  console.error('[send-direct-list-iphone-probe] erro fatal:', err?.stack || err);
  process.exit(1);
});
