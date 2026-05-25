const path = require('path');
const fs = require('fs');
const { delay, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
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

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const startCase = Number.parseInt(process.argv[5] || '1', 10);
const endCase = Number.parseInt(process.argv[6] || '999', 10);
const sendDelayMs = Number.parseInt(process.argv[7] || process.env.PR_DELAY_MS || '12000', 10);
const watchArg = process.argv.find((arg) => arg.startsWith('--watch='));
const dumpArg = process.argv.find((arg) => arg.startsWith('--dump='));
const buttonArg = process.argv.find((arg) => arg.startsWith('--button='));
const watchMs = watchArg ? Number.parseInt(watchArg.split('=')[1], 10) : 0;
const dumpFile = dumpArg ? dumpArg.slice('--dump='.length) : '';
const listButtonText = buttonArg ? buttonArg.slice('--button='.length) : 'ABRIR LISTA';
const log = (...args) => console.log('[send-proto-response-battery]', ...args);
const startedAtSec = Math.floor(Date.now() / 1000) - 5;
const seenResponses = new Set();

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

function attachResponseDump(sock) {
  if (!watchMs && !dumpFile) return;
  if (dumpFile) fs.writeFileSync(dumpFile, '');

  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages || []) {
      if (!msg?.key?.id || seenResponses.has(msg.key.id)) continue;
      seenResponses.add(msg.key.id);
      if (msg.key.remoteJid !== targetJid || msg.key.fromMe) continue;
      if (unixTimestamp(msg.messageTimestamp) < startedAtSec) continue;

      const content = unwrapMessage(msg.message);
      const mtype = Object.keys(content)[0] || '';
      if (!content.interactiveResponseMessage && !content.listResponseMessage && !content.buttonsResponseMessage) continue;

      const dump = {
        key: msg.key,
        pushName: msg.pushName,
        messageTimestamp: unixTimestamp(msg.messageTimestamp),
        mtype,
        content,
      };
      log('resposta', mtype, msg.key.id);
      if (dumpFile) fs.appendFileSync(dumpFile, `${JSON.stringify(dump)}\n`);
    }
  });
}

function caseNumber(label) {
  const match = String(label).match(/PR-(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function rows(prefix) {
  return [
    { header: 'A', title: `${prefix.toUpperCase()} opcao A`, description: 'proto compat', id: `${prefix}_a`, rowId: `${prefix}_a` },
    { header: 'B', title: `${prefix.toUpperCase()} opcao B`, description: 'segunda opcao', id: `${prefix}_b`, rowId: `${prefix}_b` },
  ];
}

function sections(prefix) {
  return [
    {
      title: `${prefix.toUpperCase()} lista`,
      highlight_label: 'teste',
      rows: rows(prefix),
    },
  ];
}

function nativePayload(prefix, extra = {}) {
  const shape = extra.__shape;
  const cleanExtra = { ...extra };
  delete cleanExtra.__shape;

  if (shape === 'cloudAction') {
    return {
      type: 'list',
      body: { text: `${prefix.toUpperCase()} body` },
      action: {
        button: listButtonText,
        sections: sections(prefix),
      },
      ...cleanExtra,
    };
  }

  return {
    title: listButtonText,
    button_text: listButtonText,
    display_text: listButtonText,
    sections: sections(prefix),
    ...cleanExtra,
  };
}

function interactiveButtons(prefix, extra = {}) {
  return [
    nf(extra.buttonName || 'single_select', nativePayload(prefix, extra.payload || {})),
    quick('QUICK', `${prefix}_quick`),
    ctaCopy('COPIAR', prefix.toUpperCase()),
  ];
}

function directNative(media, prefix, label, extra = {}) {
  const card = createCard({
    media,
    body: label,
    footer: extra.footer || 'proto battery',
    subtitle: 'PR',
    buttons: interactiveButtons(prefix, extra),
  });

  if (extra.nativeFlowMessage) {
    Object.assign(card.nativeFlowMessage, extra.nativeFlowMessage);
  }

  if (extra.contextInfo) {
    card.contextInfo = extra.contextInfo;
  }

  return createDirectInteractive(card);
}

function carouselNative(media, prefix, label, extra = {}) {
  const card = createCard({
    media,
    body: label,
    footer: extra.footer || 'proto battery',
    subtitle: 'PR',
    buttons: interactiveButtons(prefix, extra),
  });

  if (extra.nativeFlowMessage) {
    Object.assign(card.nativeFlowMessage, extra.nativeFlowMessage);
  }

  const content = createCarousel({
    cards: [card],
    outer: extra.outer || 'none',
    outerText: label,
  });

  if (extra.contextInfo) {
    content.interactiveMessage.contextInfo = extra.contextInfo;
  }

  if (extra.carouselVersion) {
    content.interactiveMessage.carouselMessage.messageVersion = extra.carouselVersion;
  }

  return content;
}

function simpleNative(prefix, label, extra = {}) {
  const message = proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({ text: label }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: extra.footer || 'proto battery' }),
    header: extra.noHeader
      ? undefined
      : proto.Message.InteractiveMessage.Header.create({
        title: '',
        subtitle: 'PR',
        hasMediaAttachment: false,
      }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: interactiveButtons(prefix, extra),
      messageParamsJson: extra.messageParamsJson,
      messageVersion: extra.messageVersion,
    }),
  });

  if (extra.contextInfo) {
    message.contextInfo = extra.contextInfo;
  }

  return message;
}

function directSimple(prefix, label, extra = {}) {
  return { interactiveMessage: simpleNative(prefix, label, extra) };
}

function carouselSimple(prefix, label, extra = {}) {
  return createCarousel({
    cards: [simpleNative(prefix, label, extra)],
    outer: extra.outer || 'none',
    outerText: label,
  });
}

function buttonsMessage(prefix, label, buttonName = 'single_select', buttonType = proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW, options = {}) {
  const button = {
    buttonText: { displayText: listButtonText },
    nativeFlowInfo: {
      name: buttonName,
      paramsJson: JSON.stringify(nativePayload(prefix, options.payload || {})),
    },
  };

  if (!options.noButtonId) {
    button.buttonId = options.buttonId || `${prefix}_list_button`;
  }

  if (!options.noType) {
    button.type = buttonType;
  }

  return proto.Message.fromObject({
    buttonsMessage: {
      contentText: label,
      footerText: 'buttonsMessage nativeFlowInfo',
      headerType: proto.Message.ButtonsMessage.HeaderType.EMPTY,
      buttons: [button],
    },
  });
}

function legacyListContent(prefix, label) {
  return {
    listMessage: {
      title: label,
      description: `${label}\nlegacy hybrid`,
      buttonText: listButtonText,
      footerText: 'PR legacy',
      listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
      sections: [
        {
          title: `${prefix.toUpperCase()} legacy`,
          rows: rows(prefix).map((row) => ({
            title: row.title,
            description: row.description,
            rowId: row.rowId,
          })),
        },
      ],
    },
  };
}

function thumbnailBytes() {
  try {
    return fs.readFileSync(thumbPath);
  } catch {
    return undefined;
  }
}

function productListContent(ownerJid, prefix, label, extra = {}) {
  const productIds = extra.productIds || [`${prefix}_product_a`, `${prefix}_product_b`];
  const listType = extra.listType || proto.Message.ListMessage.ListType.PRODUCT_LIST;
  const listMessage = {
    title: label,
    description: `${label}\nproduct list proto`,
    buttonText: listButtonText,
    listType,
    productListInfo: {
      productSections: [
        {
          title: `${prefix.toUpperCase()} produtos`,
          products: productIds.map((productId) => ({ productId })),
        },
      ],
      headerImage: {
        productId: productIds[0],
        jpegThumbnail: thumbnailBytes(),
      },
      businessOwnerJid: ownerJid,
    },
    footerText: extra.footer || 'PR product list',
    contextInfo: extra.contextInfo,
  };

  if (extra.includeRows) {
    listMessage.sections = [
      {
        title: `${prefix.toUpperCase()} rows`,
        rows: rows(prefix).map((row) => ({
          title: row.title,
          description: row.description,
          rowId: row.rowId,
        })),
      },
    ];
  }

  return { listMessage };
}

function hybridLegacy(prefix, label, secondary) {
  return {
    ...legacyListContent(prefix, label),
    ...secondary,
  };
}

function phoneFromJid(jid) {
  return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function ownerJidFromSock(sock) {
  const phone = phoneFromJid(sock.user?.id || sock.user?.jid || '');
  return phone ? `${phone}@s.whatsapp.net` : '';
}

function imageMessage(media) {
  return media?.imageMessage
    ? proto.Message.ImageMessage.create(media.imageMessage)
    : undefined;
}

function productSnapshot(media, prefix, label) {
  return proto.Message.ProductMessage.ProductSnapshot.create({
    productImage: imageMessage(media),
    productId: `${prefix}_product`,
    title: `${label} produto`,
    description: 'catalog proto matrix',
    currencyCode: 'BRL',
    priceAmount1000: 1999000,
    retailerId: `${prefix}_retailer`,
    url: 'https://example.com/proto-product',
    productImageCount: media?.imageMessage ? 1 : 0,
    firstImageId: `${prefix}_image`,
    salePriceAmount1000: 1499000,
  });
}

function catalogSnapshot(media, prefix, label) {
  return proto.Message.ProductMessage.CatalogSnapshot.create({
    catalogImage: imageMessage(media),
    title: `${label} catalogo`,
    description: 'catalog proto matrix',
  });
}

function productMessage(media, ownerJid, prefix, label, extra = {}) {
  return proto.Message.ProductMessage.create({
    product: extra.catalogOnly ? undefined : productSnapshot(media, prefix, label),
    businessOwnerJid: ownerJid,
    catalog: catalogSnapshot(media, prefix, label),
    body: label,
    footer: extra.footer || 'PR catalog/product',
    contextInfo: extra.contextInfo,
  });
}

function productContent(media, ownerJid, prefix, label, extra = {}) {
  return {
    productMessage: productMessage(media, ownerJid, prefix, label, extra),
  };
}

function catalogParams(prefix, ownerJid, label, extra = {}) {
  const phone = phoneFromJid(ownerJid);
  return {
    display_text: extra.displayText || 'VER CATALOGO',
    id: `${prefix}_catalog_btn`,
    business_phone_number: phone,
    catalog_id: `${prefix}_catalog`,
    product_id: `${prefix}_product`,
    catalog_product_id: `${prefix}_product`,
    thumbnail_product_retailer_id: `${prefix}_retailer`,
    body: label,
  };
}

function catalogListPayload(prefix, ownerJid, extra = {}) {
  return nativePayload(prefix, {
    ...extra,
    response_type: 'list_response',
    response_message_type: 'listResponseMessage',
    native_flow_response: false,
    embedded_catalog: true,
    business_phone_number: phoneFromJid(ownerJid),
    catalog_id: `${prefix}_catalog`,
    catalog_product_id: `${prefix}_product`,
    product_id: `${prefix}_product`,
    thumbnail_product_retailer_id: `${prefix}_retailer`,
  });
}

function catalogMixedButtons(prefix, ownerJid, label, mode = 'list-first') {
  const list = nf('single_select', catalogListPayload(prefix, ownerJid));
  const catalog = nf('cta_catalog', catalogParams(prefix, ownerJid, label));
  const view = nf('view_catalog', catalogParams(prefix, ownerJid, label, { displayText: 'SHOW FITUR' }));

  if (mode === 'catalog-first') return [catalog, list, ctaCopy('COPIAR', prefix.toUpperCase())];
  if (mode === 'view-first') return [view, list, quick('QUICK', `${prefix}_quick`)];
  if (mode === 'catalog-view-list') return [catalog, view, list];
  return [list, catalog, ctaCopy('COPIAR', prefix.toUpperCase())];
}

function productHeaderInteractive(media, ownerJid, prefix, label, extra = {}) {
  const message = proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({ text: label }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: extra.footer || 'PR product header' }),
    header: proto.Message.InteractiveMessage.Header.create({
      title: '',
      subtitle: 'CAT',
      hasMediaAttachment: true,
      productMessage: productMessage(media, ownerJid, prefix, label, extra),
    }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: extra.buttons || interactiveButtons(prefix, extra),
      messageParamsJson: extra.messageParamsJson,
      messageVersion: extra.messageVersion,
    }),
  });

  if (extra.contextInfo) {
    message.contextInfo = extra.contextInfo;
  }

  return { interactiveMessage: message };
}

function catalogHeaderInteractive(media, ownerJid, prefix, label, extra = {}) {
  return productHeaderInteractive(media, ownerJid, prefix, label, { ...extra, catalogOnly: true });
}

function productHeaderCarousel(media, ownerJid, prefix, label, extra = {}) {
  const card = productHeaderInteractive(media, ownerJid, prefix, label, extra).interactiveMessage;
  const content = createCarousel({
    cards: [card],
    outer: extra.outer || 'none',
    outerText: label,
  });

  if (extra.contextInfo) {
    content.interactiveMessage.contextInfo = extra.contextInfo;
  }

  if (extra.carouselVersion) {
    content.interactiveMessage.carouselMessage.messageVersion = extra.carouselVersion;
  }

  return content;
}

function shopNativeDual(ownerJid, prefix, label, extra = {}) {
  const message = proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({ text: label }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: 'PR shop dual' }),
    header: proto.Message.InteractiveMessage.Header.create({ title: '', subtitle: 'SHOP', hasMediaAttachment: false }),
    shopStorefrontMessage: proto.Message.InteractiveMessage.ShopMessage.create({
      id: `${prefix}_shop`,
      surface: proto.Message.InteractiveMessage.ShopMessage.Surface.WA,
      messageVersion: extra.shopVersion || 3,
    }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: extra.buttons || catalogMixedButtons(prefix, ownerJid, label, extra.mode),
      messageParamsJson: extra.messageParamsJson,
      messageVersion: extra.messageVersion,
    }),
  });

  if (extra.contextInfo) {
    message.contextInfo = extra.contextInfo;
  }

  return {
    interactiveMessage: message,
  };
}

function collectionNativeDual(ownerJid, prefix, label, extra = {}) {
  const message = proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({ text: label }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: 'PR collection dual' }),
    header: proto.Message.InteractiveMessage.Header.create({ title: '', subtitle: 'COL', hasMediaAttachment: false }),
    collectionMessage: proto.Message.InteractiveMessage.CollectionMessage.create({
      bizJid: ownerJid,
      id: `${prefix}_collection`,
      messageVersion: extra.collectionVersion || 3,
    }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: extra.buttons || catalogMixedButtons(prefix, ownerJid, label, extra.mode),
      messageParamsJson: extra.messageParamsJson,
      messageVersion: extra.messageVersion,
    }),
  });

  if (extra.contextInfo) {
    message.contextInfo = extra.contextInfo;
  }

  return {
    interactiveMessage: message,
  };
}

function viewOnce(content, version = 1) {
  const message = {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
    },
    ...content,
  };

  if (version === 2) return { viewOnceMessageV2: { message } };
  if (version === 3) return { viewOnceMessageV2Extension: { message } };
  return { viewOnceMessage: { message } };
}

function futureProof(field, content, extraContext = {}) {
  return {
    [field]: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
          ...extraContext,
        },
        ...content,
      },
    },
  };
}

function nestedViewOnce(content, versions = [2, 3]) {
  return versions.reduce((current, version) => viewOnce(current, version), content);
}

function stackedFuture(fields, content) {
  return fields.reduce((current, field) => futureProof(field, current), content);
}

function deviceSent(jid, content, phash = 'proto-response-battery') {
  return {
    deviceSentMessage: {
      destinationJid: jid,
      phash,
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

function templateInteractive(content, templateId) {
  return {
    templateMessage: {
      templateId,
      interactiveMessageTemplate: content.interactiveMessage,
    },
  };
}

function rootContext(content, label) {
  const secret = Buffer.alloc(32);
  Buffer.from(label).copy(secret);
  return {
    messageContextInfo: {
      messageSecret: secret,
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
    },
    ...content,
  };
}

function bizNativeNode(name) {
  const privacyModeTs = String(Math.floor(Date.now() / 1000) - 77980457);
  return [{
    tag: 'biz',
    attrs: {
      actual_actors: '2',
      host_storage: '2',
      privacy_mode_ts: privacyModeTs,
    },
    content: [{
      tag: 'engagement',
      attrs: {
        customer_service_state: 'open',
        conversation_state: 'open',
      },
    }, {
      tag: 'interactive',
      attrs: {
        type: 'native_flow',
        v: '1',
      },
      content: [{
        tag: 'native_flow',
        attrs: {
          v: '9',
          name,
        },
        content: [],
      }],
    }],
  }];
}

async function relay(sock, jid, content, options = {}) {
  const msg = generateWAMessageFromContent(jid, content, { userJid: sock.user.id });
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id, ...options });
  return msg;
}

async function sendLegacyList(sock, jid, prefix, label, viewOnceFlag = false) {
  await sock.sendMessage(jid, {
    title: label,
    text: `${label}\nlegacy sendMessage`,
    footer: 'PR legacy',
    buttonText: listButtonText,
    sections: sections(prefix).map((section) => ({
      title: section.title,
      rows: section.rows.map((row) => ({
        title: row.title,
        description: row.description,
        rowId: row.rowId,
      })),
    })),
    viewOnce: viewOnceFlag,
  });
}

async function main() {
  const sock = await connectWa({ sessionDir, log });
  attachResponseDump(sock);
  const media = await prepareImage(sock, thumbPath);
  const ownerJid = ownerJidFromSock(sock);
  const msgParams = (prefix, mode) => JSON.stringify({
    surface: 'list',
    mode,
    button: 'single_select',
    response_hint: 'list_response',
    sections: sections(prefix),
  });
  const noQuoteHints = {
    response_type: 'list_response',
    response_message_type: 'listResponseMessage',
    selected_reply_type: 'list',
    native_flow_response: false,
    suppress_quote: true,
    disable_quote: true,
    quote: false,
    quoted: false,
    no_quote: true,
    response_should_quote: false,
    selection_display_text: 'Opcao A',
  };
  const autoContext = {
    quotedType: 1,
    forwardingScore: 0,
    isForwarded: false,
    mentionedJid: [],
  };
  const legacyListPayload = {
    list_type: 'SINGLE_SELECT',
    listType: 'SINGLE_SELECT',
    response_type: 'list_response',
    response_message_type: 'listResponseMessage',
    sections: [
      {
        title: 'Legacy-ish',
        rows: rows('pr27').map((row) => ({
          title: row.title,
          description: row.description,
          rowId: row.rowId,
          row_id: row.rowId,
        })),
      },
    ],
  };

  const cases = [
    ['PR-01 legacy list sendMessage', (jid) => sendLegacyList(sock, jid, 'pr01', 'PR-01 legacy list sendMessage')],
    ['PR-02 legacy list sendMessage viewOnce', (jid) => sendLegacyList(sock, jid, 'pr02', 'PR-02 legacy list sendMessage viewOnce', true)],
    ['PR-03 buttonsMessage nativeFlowInfo single_select', (jid) => relay(sock, jid, buttonsMessage('pr03', 'PR-03 buttonsMessage nativeFlowInfo single_select'))],
    ['PR-04 buttonsMessage nativeFlowInfo menu_options', (jid) => relay(sock, jid, buttonsMessage('pr04', 'PR-04 buttonsMessage nativeFlowInfo menu_options', 'menu_options'))],
    ['PR-05 buttonsMessage nativeFlowInfo response type', (jid) => relay(sock, jid, buttonsMessage('pr05', 'PR-05 buttonsMessage nativeFlowInfo response type', 'single_select', proto.Message.ButtonsMessage.Button.Type.RESPONSE))],
    ['PR-06 direct messageParamsJson v1', (jid) => relayInteractive(sock, jid, directNative(media, 'pr06', 'PR-06 direct messageParamsJson v1', { nativeFlowMessage: { messageParamsJson: msgParams('pr06', 'direct-v1'), messageVersion: 1 } }))],
    ['PR-07 direct messageParamsJson v3 context', (jid) => relayInteractive(sock, jid, directNative(media, 'pr07', 'PR-07 direct messageParamsJson v3 context', { nativeFlowMessage: { messageParamsJson: msgParams('pr07', 'direct-v3'), messageVersion: 3 }, contextInfo: { forwardingScore: 0, isForwarded: false } }))],
    ['PR-08 carousel messageVersion 2 nativeFlow v3', (jid) => relayInteractive(sock, jid, carouselNative(media, 'pr08', 'PR-08 carousel messageVersion 2 nativeFlow v3', { nativeFlowMessage: { messageParamsJson: msgParams('pr08', 'carousel-v3'), messageVersion: 3 }, carouselVersion: 2 }))],
    ['PR-09 carousel payload response hints', (jid) => relayInteractive(sock, jid, carouselNative(media, 'pr09', 'PR-09 carousel payload response hints', { payload: { response_type: 'list_response', response_message_type: 'listResponseMessage', native_flow_response: false, list_type: 'SINGLE_SELECT', listType: 'SINGLE_SELECT' } }))],
    ['PR-10 carousel viewOnceV2 response hints', (jid) => relay(sock, jid, viewOnce(carouselNative(media, 'pr10', 'PR-10 carousel viewOnceV2 response hints', { payload: { response_type: 'list_response', response_message_type: 'listResponseMessage' } }), 2))],
    ['PR-11 buttonsMessage nativeFlowInfo unknown type', (jid) => relay(sock, jid, buttonsMessage('pr11', 'PR-11 buttonsMessage nativeFlowInfo unknown type', 'single_select', proto.Message.ButtonsMessage.Button.Type.UNKNOWN))],
    ['PR-12 buttonsMessage nativeFlowInfo no type', (jid) => relay(sock, jid, buttonsMessage('pr12', 'PR-12 buttonsMessage nativeFlowInfo no type', 'single_select', proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW, { noType: true }))],
    ['PR-13 buttonsMessage nativeFlowInfo no buttonId', (jid) => relay(sock, jid, buttonsMessage('pr13', 'PR-13 buttonsMessage nativeFlowInfo no buttonId', 'single_select', proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW, { noButtonId: true }))],
    ['PR-14 buttonsMessage menu_options unknown type', (jid) => relay(sock, jid, buttonsMessage('pr14', 'PR-14 buttonsMessage menu_options unknown type', 'menu_options', proto.Message.ButtonsMessage.Button.Type.UNKNOWN))],
    ['PR-15 buttonsMessage response hints in native payload', (jid) => relay(sock, jid, buttonsMessage('pr15', 'PR-15 buttonsMessage response hints in native payload', 'single_select', proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW, { payload: { response_type: 'buttons_response', response_message_type: 'buttonsResponseMessage', selected_reply_type: 'button' } }))],
    ['PR-16 carousel no-quote response hints', (jid) => relayInteractive(sock, jid, carouselNative(media, 'pr16', 'PR-16 carousel no-quote response hints', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr16', 'no-quote-hints'), messageVersion: 3 } }))],
    ['PR-17 carousel viewOnce no-quote hints', (jid) => relay(sock, jid, viewOnce(carouselNative(media, 'pr17', 'PR-17 carousel viewOnce no-quote hints', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr17', 'viewonce-noquote'), messageVersion: 3 } }), 1))],
    ['PR-18 carousel viewOnceV2 no-quote hints', (jid) => relay(sock, jid, viewOnce(carouselNative(media, 'pr18', 'PR-18 carousel viewOnceV2 no-quote hints', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr18', 'viewoncev2-noquote'), messageVersion: 3 } }), 2))],
    ['PR-19 carousel viewOnceV2Ext no-quote hints', (jid) => relay(sock, jid, viewOnce(carouselNative(media, 'pr19', 'PR-19 carousel viewOnceV2Ext no-quote hints', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr19', 'viewoncev2ext-noquote'), messageVersion: 3 } }), 3))],
    ['PR-20 carousel ephemeral no-quote hints', (jid) => relay(sock, jid, futureProof('ephemeralMessage', carouselNative(media, 'pr20', 'PR-20 carousel ephemeral no-quote hints', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr20', 'ephemeral-noquote'), messageVersion: 3 } })))],
    ['PR-21 carousel deviceSent no-quote hints', (jid) => relay(sock, jid, deviceSent(jid, carouselNative(media, 'pr21', 'PR-21 carousel deviceSent no-quote hints', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr21', 'devicesent-noquote'), messageVersion: 3 } }), 'pr21-native-list'))],
    ['PR-22 direct no-quote response hints', (jid) => relayInteractive(sock, jid, directNative(media, 'pr22', 'PR-22 direct no-quote response hints', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr22', 'direct-noquote'), messageVersion: 3 } }))],
    ['PR-23 buttonsMessage cloud action payload', (jid) => relay(sock, jid, buttonsMessage('pr23', 'PR-23 buttonsMessage cloud action payload', 'single_select', proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW, { payload: { __shape: 'cloudAction', response_type: 'list_response', response_message_type: 'listResponseMessage' } }))],
    ['PR-24 buttonsMessage viewOnceV2 cloud action', (jid) => relay(sock, jid, viewOnce(buttonsMessage('pr24', 'PR-24 buttonsMessage viewOnceV2 cloud action', 'single_select', proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW, { payload: { __shape: 'cloudAction', response_type: 'list_response', response_message_type: 'listResponseMessage' } }), 2))],
    ['PR-25 template interactive carousel', (jid) => relay(sock, jid, templateInteractive(carouselNative(media, 'pr25', 'PR-25 template interactive carousel', { payload: noQuoteHints, contextInfo: autoContext }), 'pr25_template'))],
    ['PR-26 template interactive direct', (jid) => relay(sock, jid, templateInteractive(directNative(media, 'pr26', 'PR-26 template interactive direct', { payload: noQuoteHints, contextInfo: autoContext }), 'pr26_template'))],
    ['PR-27 carousel legacy row id payload', (jid) => relayInteractive(sock, jid, carouselNative(media, 'pr27', 'PR-27 carousel legacy row id payload', { payload: legacyListPayload, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr27', 'legacy-row-payload'), messageVersion: 2 } }))],
    ['PR-28 direct list only no quick copy', (jid) => relayInteractive(sock, jid, directNative(media, 'pr28', 'PR-28 direct list only no quick copy', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { buttons: [nf('single_select', nativePayload('pr28', noQuoteHints))], messageParamsJson: msgParams('pr28', 'direct-list-only'), messageVersion: 3 } }))],
    ['PR-29 carousel question context', (jid) => relayInteractive(sock, jid, carouselNative(media, 'pr29', 'PR-29 carousel question context', { payload: noQuoteHints, contextInfo: { ...autoContext, isQuestion: true, questionReplyQuotedMessage: { serverQuestionId: 'pr29' } }, nativeFlowMessage: { messageParamsJson: msgParams('pr29', 'question-context'), messageVersion: 3 } }))],
    ['PR-30 carousel minimal action payload', (jid) => relayInteractive(sock, jid, carouselNative(media, 'pr30', 'PR-30 carousel minimal action payload', { payload: { title: listButtonText, button_text: listButtonText, display_text: listButtonText, action: { sections: sections('pr30') }, type: 'single_select' }, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr30', 'minimal-action'), messageVersion: 1 } }))],
    ['PR-31 carousel root messageContextInfo', (jid) => relay(sock, jid, rootContext(carouselNative(media, 'pr31', 'PR-31 carousel root messageContextInfo', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr31', 'root-context'), messageVersion: 3 } }), 'pr31-root-context'))],
    ['PR-32 carousel biz node single_select', (jid) => relay(sock, jid, rootContext(carouselNative(media, 'pr32', 'PR-32 carousel biz node single_select', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr32', 'biz-single-select'), messageVersion: 3 } }), 'pr32-biz-single'), { additionalNodes: bizNativeNode('single_select') })],
    ['PR-33 carousel biz node menu_options', (jid) => relay(sock, jid, rootContext(carouselNative(media, 'pr33', 'PR-33 carousel biz node menu_options', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr33', 'biz-menu-options'), messageVersion: 3 } }), 'pr33-biz-menu'), { additionalNodes: bizNativeNode('menu_options') })],
    ['PR-34 carousel biz attrs native_flow_name', (jid) => relay(sock, jid, rootContext(carouselNative(media, 'pr34', 'PR-34 carousel biz attrs native_flow_name', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr34', 'biz-attr-name'), messageVersion: 3 } }), 'pr34-biz-attr'), { additionalNodes: [{ tag: 'biz', attrs: { native_flow_name: 'single_select' }, content: [] }] })],
    ['PR-35 carousel stanza type interactive', (jid) => relay(sock, jid, rootContext(carouselNative(media, 'pr35', 'PR-35 carousel stanza type interactive', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr35', 'stanza-type-interactive'), messageVersion: 3 } }), 'pr35-stanza-interactive'), { additionalAttributes: { type: 'interactive' } })],
    ['PR-36 carousel stanza type native_flow', (jid) => relay(sock, jid, rootContext(carouselNative(media, 'pr36', 'PR-36 carousel stanza type native_flow', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr36', 'stanza-type-native-flow'), messageVersion: 3 } }), 'pr36-stanza-native'), { additionalAttributes: { type: 'native_flow' } })],
    ['PR-37 direct no media header', (jid) => relay(sock, jid, rootContext(directSimple('pr37', 'PR-37 direct no media header', { payload: noQuoteHints, contextInfo: autoContext, messageParamsJson: msgParams('pr37', 'direct-no-media'), messageVersion: 3 }), 'pr37-no-media'))],
    ['PR-38 direct no header', (jid) => relay(sock, jid, rootContext(directSimple('pr38', 'PR-38 direct no header', { payload: noQuoteHints, contextInfo: autoContext, noHeader: true, messageParamsJson: msgParams('pr38', 'direct-no-header'), messageVersion: 3 }), 'pr38-no-header'))],
    ['PR-39 carousel no media header', (jid) => relay(sock, jid, rootContext(carouselSimple('pr39', 'PR-39 carousel no media header', { payload: noQuoteHints, contextInfo: autoContext, messageParamsJson: msgParams('pr39', 'carousel-no-media'), messageVersion: 3 }), 'pr39-carousel-no-media'))],
    ['PR-40 carousel no header', (jid) => relay(sock, jid, rootContext(carouselSimple('pr40', 'PR-40 carousel no header', { payload: noQuoteHints, contextInfo: autoContext, noHeader: true, messageParamsJson: msgParams('pr40', 'carousel-no-header'), messageVersion: 3 }), 'pr40-carousel-no-header'))],
    ['PR-41 direct button name menu_options', (jid) => relay(sock, jid, rootContext(directNative(media, 'pr41', 'PR-41 direct button name menu_options', { buttonName: 'menu_options', payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr41', 'name-menu-options'), messageVersion: 3 } }), 'pr41-name-menu'))],
    ['PR-42 carousel button name menu_options', (jid) => relay(sock, jid, rootContext(carouselNative(media, 'pr42', 'PR-42 carousel button name menu_options', { buttonName: 'menu_options', payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr42', 'name-menu-options'), messageVersion: 3 } }), 'pr42-name-menu'))],
    ['PR-43 direct no header name menu_options', (jid) => relay(sock, jid, rootContext(directSimple('pr43', 'PR-43 direct no header name menu_options', { buttonName: 'menu_options', payload: noQuoteHints, contextInfo: autoContext, noHeader: true, messageParamsJson: msgParams('pr43', 'no-header-name-menu'), messageVersion: 3 }), 'pr43-no-header-menu'))],
    ['PR-44 carousel no header name menu_options', (jid) => relay(sock, jid, rootContext(carouselSimple('pr44', 'PR-44 carousel no header name menu_options', { buttonName: 'menu_options', payload: noQuoteHints, contextInfo: autoContext, noHeader: true, messageParamsJson: msgParams('pr44', 'carousel-no-header-menu'), messageVersion: 3 }), 'pr44-carousel-no-header-menu'))],
    ['PR-45 legacy list plus buttonsMessage', (jid) => relay(sock, jid, rootContext(hybridLegacy('pr45', 'PR-45 legacy list plus buttonsMessage', buttonsMessage('pr45b', 'PR-45 secondary buttonsMessage')), 'pr45-hybrid-buttons'))],
    ['PR-46 legacy list plus direct interactive', (jid) => relay(sock, jid, rootContext(hybridLegacy('pr46', 'PR-46 legacy list plus direct interactive', directSimple('pr46b', 'PR-46 secondary direct interactive', { payload: noQuoteHints, contextInfo: autoContext, noHeader: true, messageParamsJson: msgParams('pr46b', 'hybrid-direct'), messageVersion: 3 })), 'pr46-hybrid-direct'))],
    ['PR-47 legacy list plus carousel interactive', (jid) => relay(sock, jid, rootContext(hybridLegacy('pr47', 'PR-47 legacy list plus carousel interactive', carouselSimple('pr47b', 'PR-47 secondary carousel interactive', { payload: noQuoteHints, contextInfo: autoContext, noHeader: true, messageParamsJson: msgParams('pr47b', 'hybrid-carousel'), messageVersion: 3 })), 'pr47-hybrid-carousel'))],
    ['PR-48 legacy list plus media carousel', (jid) => relay(sock, jid, rootContext(hybridLegacy('pr48', 'PR-48 legacy list plus media carousel', carouselNative(media, 'pr48b', 'PR-48 secondary media carousel', { payload: noQuoteHints, contextInfo: autoContext, nativeFlowMessage: { messageParamsJson: msgParams('pr48b', 'hybrid-media-carousel'), messageVersion: 3 } })), 'pr48-hybrid-media-carousel'))],
    ['PR-49 raw legacy list relay control', (jid) => relay(sock, jid, rootContext(legacyListContent('pr49', 'PR-49 raw legacy list relay control'), 'pr49-legacy-control'))],
    ['PR-50 root product snapshot', (jid) => relay(sock, jid, rootContext(productContent(media, ownerJid, 'pr50', 'PR-50 root product snapshot'), 'pr50-product-root'))],
    ['PR-51 root catalog snapshot', (jid) => relay(sock, jid, rootContext(productContent(media, ownerJid, 'pr51', 'PR-51 root catalog snapshot', { catalogOnly: true }), 'pr51-catalog-root'))],
    ['PR-52 viewOnce product snapshot', (jid) => relay(sock, jid, viewOnce(rootContext(productContent(media, ownerJid, 'pr52', 'PR-52 viewOnce product snapshot'), 'pr52-product-viewonce'), 2))],
    ['PR-53 direct product header list', (jid) => relay(sock, jid, rootContext(productHeaderInteractive(media, ownerJid, 'pr53', 'PR-53 direct product header list', { payload: noQuoteHints, contextInfo: autoContext, messageParamsJson: msgParams('pr53', 'product-header-list'), messageVersion: 3 }), 'pr53-product-header'))],
    ['PR-54 carousel product header list', (jid) => relay(sock, jid, rootContext(productHeaderCarousel(media, ownerJid, 'pr54', 'PR-54 carousel product header list', { payload: noQuoteHints, contextInfo: autoContext, messageParamsJson: msgParams('pr54', 'product-carousel-list'), messageVersion: 3, carouselVersion: 2 }), 'pr54-product-carousel'))],
    ['PR-55 direct catalog header list', (jid) => relay(sock, jid, rootContext(catalogHeaderInteractive(media, ownerJid, 'pr55', 'PR-55 direct catalog header list', { payload: noQuoteHints, contextInfo: autoContext, messageParamsJson: msgParams('pr55', 'catalog-header-list'), messageVersion: 3 }), 'pr55-catalog-header'))],
    ['PR-56 carousel catalog header list', (jid) => relay(sock, jid, rootContext(productHeaderCarousel(media, ownerJid, 'pr56', 'PR-56 carousel catalog header list', { catalogOnly: true, payload: noQuoteHints, contextInfo: autoContext, messageParamsJson: msgParams('pr56', 'catalog-carousel-list'), messageVersion: 3, carouselVersion: 2 }), 'pr56-catalog-carousel'))],
    ['PR-57 direct product cta catalog then list', (jid) => relay(sock, jid, rootContext(productHeaderInteractive(media, ownerJid, 'pr57', 'PR-57 direct product cta catalog then list', { buttons: catalogMixedButtons('pr57', ownerJid, 'PR-57 direct product cta catalog then list', 'catalog-first'), contextInfo: autoContext, messageParamsJson: msgParams('pr57', 'product-cta-list'), messageVersion: 3 }), 'pr57-product-cta-list'))],
    ['PR-58 carousel product cta catalog then list', (jid) => relay(sock, jid, rootContext(productHeaderCarousel(media, ownerJid, 'pr58', 'PR-58 carousel product cta catalog then list', { buttons: catalogMixedButtons('pr58', ownerJid, 'PR-58 carousel product cta catalog then list', 'catalog-first'), contextInfo: autoContext, messageParamsJson: msgParams('pr58', 'carousel-product-cta-list'), messageVersion: 3, carouselVersion: 2 }), 'pr58-carousel-product-cta-list'))],
    ['PR-59 direct product view catalog then list', (jid) => relay(sock, jid, rootContext(productHeaderInteractive(media, ownerJid, 'pr59', 'PR-59 direct product view catalog then list', { buttons: catalogMixedButtons('pr59', ownerJid, 'PR-59 direct product view catalog then list', 'view-first'), contextInfo: autoContext, messageParamsJson: msgParams('pr59', 'product-view-list'), messageVersion: 3 }), 'pr59-product-view-list'))],
    ['PR-60 carousel product catalog view list', (jid) => relay(sock, jid, rootContext(productHeaderCarousel(media, ownerJid, 'pr60', 'PR-60 carousel product catalog view list', { buttons: catalogMixedButtons('pr60', ownerJid, 'PR-60 carousel product catalog view list', 'catalog-view-list'), contextInfo: autoContext, messageParamsJson: msgParams('pr60', 'carousel-catalog-view-list'), messageVersion: 3, carouselVersion: 2 }), 'pr60-carousel-catalog-view-list'))],
    ['PR-61 shop storefront dual native list', (jid) => relay(sock, jid, rootContext(shopNativeDual(ownerJid, 'pr61', 'PR-61 shop storefront dual native list', { mode: 'catalog-first', contextInfo: autoContext, messageParamsJson: msgParams('pr61', 'shop-dual-native'), messageVersion: 3 }), 'pr61-shop-dual'))],
    ['PR-62 collection dual native list', (jid) => relay(sock, jid, rootContext(collectionNativeDual(ownerJid, 'pr62', 'PR-62 collection dual native list', { mode: 'list-first', contextInfo: autoContext, messageParamsJson: msgParams('pr62', 'collection-dual-native'), messageVersion: 3 }), 'pr62-collection-dual'))],
    ['PR-63 product root plus direct interactive', (jid) => relay(sock, jid, rootContext({ ...productContent(media, ownerJid, 'pr63', 'PR-63 product root plus direct interactive'), ...directSimple('pr63b', 'PR-63 secondary direct interactive', { payload: noQuoteHints, contextInfo: autoContext, noHeader: true, messageParamsJson: msgParams('pr63b', 'product-plus-direct'), messageVersion: 3 }) }, 'pr63-product-direct'))],
    ['PR-64 catalog root plus carousel interactive', (jid) => relay(sock, jid, rootContext({ ...productContent(media, ownerJid, 'pr64', 'PR-64 catalog root plus carousel interactive', { catalogOnly: true }), ...carouselSimple('pr64b', 'PR-64 secondary carousel interactive', { payload: noQuoteHints, contextInfo: autoContext, noHeader: true, messageParamsJson: msgParams('pr64b', 'catalog-plus-carousel'), messageVersion: 3 }) }, 'pr64-catalog-carousel'))],
    ['PR-65 product list catalog proto', (jid) => relay(sock, jid, rootContext(productListContent(ownerJid, 'pr65', 'PR-65 product list catalog proto', { contextInfo: autoContext }), 'pr65-product-list'))],
    ['PR-66 product list plus rows', (jid) => relay(sock, jid, rootContext(productListContent(ownerJid, 'pr66', 'PR-66 product list plus rows', { includeRows: true, contextInfo: autoContext }), 'pr66-product-list-rows'))],
    ['PR-67 single select plus productListInfo', (jid) => relay(sock, jid, rootContext(productListContent(ownerJid, 'pr67', 'PR-67 single select plus productListInfo', { includeRows: true, listType: proto.Message.ListMessage.ListType.SINGLE_SELECT, contextInfo: autoContext }), 'pr67-single-product-info'))],
    ['PR-68 product list plus productMessage', (jid) => relay(sock, jid, rootContext({ ...productListContent(ownerJid, 'pr68', 'PR-68 product list plus productMessage', { contextInfo: autoContext }), ...productContent(media, ownerJid, 'pr68p', 'PR-68 secondary productMessage') }, 'pr68-list-product-message'))],
    ['PR-69 product list plus buttonsMessage', (jid) => relay(sock, jid, rootContext({ ...productListContent(ownerJid, 'pr69', 'PR-69 product list plus buttonsMessage', { contextInfo: autoContext }), ...buttonsMessage('pr69b', 'PR-69 secondary buttonsMessage') }, 'pr69-list-buttons'))],
    ['PR-70 product list plus direct interactive', (jid) => relay(sock, jid, rootContext({ ...productListContent(ownerJid, 'pr70', 'PR-70 product list plus direct interactive', { contextInfo: autoContext }), ...directSimple('pr70b', 'PR-70 secondary direct interactive', { payload: noQuoteHints, contextInfo: autoContext, noHeader: true, messageParamsJson: msgParams('pr70b', 'product-list-direct'), messageVersion: 3 }) }, 'pr70-list-direct'))],
    ['PR-71 botInvoke collection dual', (jid) => relay(sock, jid, rootContext(futureProof('botInvokeMessage', collectionNativeDual(ownerJid, 'pr71', 'PR-71 botInvoke collection dual', { mode: 'list-first', contextInfo: autoContext, messageParamsJson: msgParams('pr71', 'botinvoke-collection'), messageVersion: 3 })), 'pr71-botinvoke'))],
    ['PR-72 groupMentioned collection dual', (jid) => relay(sock, jid, rootContext(futureProof('groupMentionedMessage', collectionNativeDual(ownerJid, 'pr72', 'PR-72 groupMentioned collection dual', { mode: 'list-first', contextInfo: autoContext, messageParamsJson: msgParams('pr72', 'groupmentioned-collection'), messageVersion: 3 })), 'pr72-groupmentioned'))],
    ['PR-73 associatedChild collection dual', (jid) => relay(sock, jid, rootContext(futureProof('associatedChildMessage', collectionNativeDual(ownerJid, 'pr73', 'PR-73 associatedChild collection dual', { mode: 'list-first', contextInfo: autoContext, messageParamsJson: msgParams('pr73', 'associatedchild-collection'), messageVersion: 3 })), 'pr73-associatedchild'))],
    ['PR-74 botTask collection dual', (jid) => relay(sock, jid, rootContext(futureProof('botTaskMessage', collectionNativeDual(ownerJid, 'pr74', 'PR-74 botTask collection dual', { mode: 'list-first', contextInfo: autoContext, messageParamsJson: msgParams('pr74', 'bottask-collection'), messageVersion: 3 })), 'pr74-bottask'))],
    ['PR-75 question collection dual', (jid) => relay(sock, jid, rootContext(futureProof('questionMessage', collectionNativeDual(ownerJid, 'pr75', 'PR-75 question collection dual', { mode: 'list-first', contextInfo: { ...autoContext, isQuestion: true, questionReplyQuotedMessage: { serverQuestionId: 'pr75' } }, messageParamsJson: msgParams('pr75', 'question-collection'), messageVersion: 3 })), 'pr75-question'))],
    ['PR-76 collection list only no params', (jid) => relay(sock, jid, rootContext(collectionNativeDual(ownerJid, 'pr76', 'PR-76 collection list only no params', { buttons: [nf('single_select', nativePayload('pr76'))] }), 'pr76-collection-list-only'))],
    ['PR-77 collection list only v1', (jid) => relay(sock, jid, rootContext(collectionNativeDual(ownerJid, 'pr77', 'PR-77 collection list only v1', { buttons: [nf('single_select', nativePayload('pr77', noQuoteHints))], contextInfo: autoContext, messageVersion: 1 }), 'pr77-collection-v1'))],
    ['PR-78 collection list only v2', (jid) => relay(sock, jid, rootContext(collectionNativeDual(ownerJid, 'pr78', 'PR-78 collection list only v2', { buttons: [nf('single_select', nativePayload('pr78', noQuoteHints))], contextInfo: autoContext, messageVersion: 2 }), 'pr78-collection-v2'))],
    ['PR-79 collection catalog list v1', (jid) => relay(sock, jid, rootContext(collectionNativeDual(ownerJid, 'pr79', 'PR-79 collection catalog list v1', { buttons: [nf('single_select', catalogListPayload('pr79', ownerJid))], contextInfo: autoContext, messageParamsJson: msgParams('pr79', 'collection-catalog-v1'), messageVersion: 1 }), 'pr79-collection-catalog-v1'))],
    ['PR-80 collection list no context', (jid) => relay(sock, jid, rootContext(collectionNativeDual(ownerJid, 'pr80', 'PR-80 collection list no context', { buttons: [nf('single_select', nativePayload('pr80'))], messageVersion: 3 }), 'pr80-collection-no-context'))],
    ['PR-81 viewOnce v1 collection outside root', (jid) => relay(sock, jid, rootContext(viewOnce(collectionNativeDual(ownerJid, 'pr81', 'PR-81 viewOnce v1 collection outside root', { buttons: [nf('single_select', nativePayload('pr81'))], contextInfo: autoContext, messageVersion: 3 }), 1), 'pr81-vo1-root-outside'))],
    ['PR-82 viewOnce v1 collection inside root', (jid) => relay(sock, jid, viewOnce(rootContext(collectionNativeDual(ownerJid, 'pr82', 'PR-82 viewOnce v1 collection inside root', { buttons: [nf('single_select', nativePayload('pr82'))], contextInfo: autoContext, messageVersion: 3 }), 'pr82-vo1-root-inside'), 1))],
    ['PR-83 viewOnceV2 collection outside root', (jid) => relay(sock, jid, rootContext(viewOnce(collectionNativeDual(ownerJid, 'pr83', 'PR-83 viewOnceV2 collection outside root', { buttons: [nf('single_select', nativePayload('pr83', noQuoteHints))], contextInfo: autoContext, messageVersion: 3 }), 2), 'pr83-vov2-root-outside'))],
    ['PR-84 viewOnceV2Ext collection outside root', (jid) => relay(sock, jid, rootContext(viewOnce(collectionNativeDual(ownerJid, 'pr84', 'PR-84 viewOnceV2Ext collection outside root', { buttons: [nf('single_select', nativePayload('pr84', noQuoteHints))], contextInfo: autoContext, messageVersion: 3 }), 3), 'pr84-vov2ext-root-outside'))],
    ['PR-85 nested viewOnce v2 ext collection', (jid) => relay(sock, jid, rootContext(nestedViewOnce(collectionNativeDual(ownerJid, 'pr85', 'PR-85 nested viewOnce v2 ext collection', { buttons: [nf('single_select', nativePayload('pr85', noQuoteHints))], contextInfo: autoContext, messageVersion: 3 }), [2, 3]), 'pr85-nested-viewonce'))],
    ['PR-86 documentWithCaption collection', (jid) => relay(sock, jid, rootContext(futureProof('documentWithCaptionMessage', collectionNativeDual(ownerJid, 'pr86', 'PR-86 documentWithCaption collection', { buttons: [nf('single_select', nativePayload('pr86'))], contextInfo: autoContext, messageVersion: 3 })), 'pr86-doc-caption'))],
    ['PR-87 documentWithCaption viewOnce collection', (jid) => relay(sock, jid, rootContext(futureProof('documentWithCaptionMessage', viewOnce(collectionNativeDual(ownerJid, 'pr87', 'PR-87 documentWithCaption viewOnce collection', { buttons: [nf('single_select', nativePayload('pr87', noQuoteHints))], contextInfo: autoContext, messageVersion: 3 }), 2)), 'pr87-doc-viewonce'))],
    ['PR-88 viewOnce documentWithCaption collection', (jid) => relay(sock, jid, rootContext(viewOnce(futureProof('documentWithCaptionMessage', collectionNativeDual(ownerJid, 'pr88', 'PR-88 viewOnce documentWithCaption collection', { buttons: [nf('single_select', nativePayload('pr88', noQuoteHints))], contextInfo: autoContext, messageVersion: 3 })), 2), 'pr88-viewonce-doc'))],
    ['PR-89 editedMessage collection', (jid) => relay(sock, jid, rootContext(futureProof('editedMessage', collectionNativeDual(ownerJid, 'pr89', 'PR-89 editedMessage collection', { buttons: [nf('single_select', nativePayload('pr89'))], contextInfo: autoContext, messageVersion: 3 })), 'pr89-edited'))],
    ['PR-90 statusAddYours collection', (jid) => relay(sock, jid, rootContext(futureProof('statusAddYours', collectionNativeDual(ownerJid, 'pr90', 'PR-90 statusAddYours collection', { buttons: [nf('single_select', nativePayload('pr90'))], contextInfo: autoContext, messageVersion: 3 })), 'pr90-status-add-yours'))],
    ['PR-91 deviceSent viewOnce collection', (jid) => relay(sock, jid, rootContext(deviceSent(jid, viewOnce(collectionNativeDual(ownerJid, 'pr91', 'PR-91 deviceSent viewOnce collection', { buttons: [nf('single_select', nativePayload('pr91', noQuoteHints))], contextInfo: autoContext, messageVersion: 3 }), 2), 'pr91-devicesent-viewonce'), 'pr91-devicesent-viewonce-root'))],
    ['PR-92 viewOnce deviceSent collection', (jid) => relay(sock, jid, rootContext(viewOnce(deviceSent(jid, collectionNativeDual(ownerJid, 'pr92', 'PR-92 viewOnce deviceSent collection', { buttons: [nf('single_select', nativePayload('pr92', noQuoteHints))], contextInfo: autoContext, messageVersion: 3 }), 'pr92-viewonce-devicesent'), 2), 'pr92-viewonce-devicesent-root'))],
    ['PR-93 ephemeral viewOnce collection', (jid) => relay(sock, jid, rootContext(stackedFuture(['ephemeralMessage'], viewOnce(collectionNativeDual(ownerJid, 'pr93', 'PR-93 ephemeral viewOnce collection', { buttons: [nf('single_select', nativePayload('pr93', noQuoteHints))], contextInfo: autoContext, messageVersion: 3 }), 2)), 'pr93-ephemeral-viewonce'))],
    ['PR-94 viewOnce ephemeral collection', (jid) => relay(sock, jid, rootContext(viewOnce(stackedFuture(['ephemeralMessage'], collectionNativeDual(ownerJid, 'pr94', 'PR-94 viewOnce ephemeral collection', { buttons: [nf('single_select', nativePayload('pr94', noQuoteHints))], contextInfo: autoContext, messageVersion: 3 })), 2), 'pr94-viewonce-ephemeral'))],
  ];

  const selected = cases.filter(([label]) => {
    const n = caseNumber(label);
    return n >= startCase && n <= endCase;
  });

  log('conectado como', sock.user?.id || 'desconhecido');
  log('enviando para', targetJid, 'filtro', `${startCase}-${endCase}`, 'delay', `${sendDelayMs}ms`);

  for (const [label, send] of selected) {
    try {
      log('enviando', label);
      await send(targetJid);
      log('ok', label);
    } catch (err) {
      log('falhou', label, err?.message || err);
    }
    await delay(sendDelayMs);
  }

  if (watchMs > 0) {
    log('aguardando respostas', `${watchMs}ms`, dumpFile || '');
    await delay(watchMs);
  }

  await delay(1500);
  sock.end(undefined);
  process.exit(0);
}

main().catch((err) => {
  console.error('[send-proto-response-battery] erro fatal:', err?.stack || err);
  process.exit(1);
});
