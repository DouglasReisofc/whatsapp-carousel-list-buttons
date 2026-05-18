const {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto,
} = require('@whiskeysockets/baileys');
const fs = require('fs');

function nf(name, params) {
  return { name, buttonParamsJson: JSON.stringify(params) };
}

function quick(label, id) {
  return nf('quick_reply', { display_text: label, id });
}

function ctaCopy(label, code) {
  return nf('cta_copy', {
    display_text: label,
    id: `copy_${code}`,
    copy_code: code,
  });
}

function ctaUrl(label, url) {
  return nf('cta_url', {
    display_text: label,
    url,
    merchant_url: url,
  });
}

function makeRows(count, prefix = 'item') {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return {
      header: n <= 10 ? `Grupo ${Math.ceil(n / 5)}` : undefined,
      title: `Item ${n}`,
      description: `Opcao de teste numero ${n}`,
      id: `.${prefix}_${n}`,
      rowId: `.${prefix}_row_${n}`,
    };
  });
}

function makeSections(count, mode = 'single') {
  const rows = makeRows(count, `cap_${count}`);

  if (mode === 'multi') {
    const sections = [];
    for (let index = 0; index < rows.length; index += 10) {
      sections.push({
        title: `Secao ${sections.length + 1}`,
        highlight_label: sections.length === 0 ? 'teste' : undefined,
        rows: rows.slice(index, index + 10),
      });
    }
    return sections;
  }

  return [
    {
      title: `${count} itens em uma secao`,
      highlight_label: 'teste',
      rows,
    },
  ];
}

function listPayload(options = {}) {
  const {
    title = 'ABRIR LISTA',
    buttonText = title,
    displayText = buttonText,
    sections,
    rows,
    sectionTitle = 'Lista',
    highlightLabel = 'ok',
  } = options;

  return {
    title,
    button_text: buttonText,
    display_text: displayText,
    sections: sections || [
      {
        title: sectionTitle,
        highlight_label: highlightLabel,
        rows,
      },
    ],
  };
}

function createCard(options = {}) {
  const {
    media = {},
    body = 'Card de teste',
    footer = 'R10-18 clean',
    subtitle = 'teste',
    buttons = [],
  } = options;

  return proto.Message.InteractiveMessage.create({
    body: proto.Message.InteractiveMessage.Body.create({ text: body }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
    header: proto.Message.InteractiveMessage.Header.create({
      title: '',
      subtitle,
      hasMediaAttachment: true,
      ...media,
    }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons,
    }),
  });
}

function outerBody(mode, text) {
  if (mode === 'text') return proto.Message.InteractiveMessage.Body.create({ text });
  if (mode === 'empty') return proto.Message.InteractiveMessage.Body.create({ text: '' });
  if (mode === 'zwsp') return proto.Message.InteractiveMessage.Body.create({ text: '\u200B' });
  return undefined;
}

function outerFooter(mode) {
  if (mode === 'text') return proto.Message.InteractiveMessage.Footer.create({ text: 'texto externo' });
  if (mode === 'empty') return proto.Message.InteractiveMessage.Footer.create({ text: '' });
  if (mode === 'zwsp') return proto.Message.InteractiveMessage.Footer.create({ text: '\u200B' });
  return undefined;
}

function createCarousel(options = {}) {
  const {
    cards,
    outer = 'none',
    outerText = 'carousel teste',
  } = options;
  const carouselTypes = proto.Message.InteractiveMessage.CarouselMessage.CarouselCardType || {};

  return {
    interactiveMessage: proto.Message.InteractiveMessage.create({
      body: outerBody(outer, outerText),
      footer: outerFooter(outer),
      header: outer === 'headerless'
        ? undefined
        : proto.Message.InteractiveMessage.Header.create({ title: '', hasMediaAttachment: false }),
      carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
        cards,
        messageVersion: 1,
        carouselCardType: carouselTypes.HSCROLL_CARDS || 1,
      }),
    }),
  };
}

function createDirectInteractive(card) {
  return { interactiveMessage: card };
}

async function prepareImage(sock, thumbPath) {
  if (!thumbPath || !fs.existsSync(thumbPath)) {
    return {};
  }

  return prepareWAMessageMedia(
    { image: { url: thumbPath } },
    { upload: sock.waUploadToServer }
  );
}

async function relayInteractive(sock, jid, content) {
  const msg = generateWAMessageFromContent(jid, content, { userJid: sock.user.id });
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  return msg;
}

module.exports = {
  ctaCopy,
  ctaUrl,
  createCard,
  createCarousel,
  createDirectInteractive,
  listPayload,
  makeSections,
  nf,
  prepareImage,
  quick,
  relayInteractive,
};
