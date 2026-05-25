const crypto = require('crypto');
const path = require('path');
const { delay, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const { connectWa, normalizeJid } = require('../lib/connection');
const {
  ctaCopy,
  ctaUrl,
  listPayload,
  nf,
  prepareImage,
  quick,
} = require('../lib/interactive');

const targetJid = normalizeJid(process.argv[2] || '120363406245712972@g.us');
const sessionDir = process.argv[3] || './session';
const thumbPath = process.argv[4] || path.join(__dirname, '..', 'assets', 'thumb.jpg');
const startCase = Number.parseInt(process.argv[5] || '1', 10);
const endCase = Number.parseInt(process.argv[6] || '999', 10);
const sendDelayMs = Number.parseInt(process.argv[7] || process.env.AM_DELAY_MS || '12000', 10);
const log = (...args) => console.log('[send-allmenu-list-buttons-matrix]', ...args);

function caseNumber(label) {
  const match = String(label).match(/AM-(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function rows(prefix) {
  return [
    { header: 'Acesso', title: `${prefix} All Menu`, description: 'abre a lista geral', id: `.${prefix}_allmenu`, rowId: `.${prefix}_row_allmenu` },
    { header: 'Acesso', title: `${prefix} Owner Menu`, description: 'menu owner', id: `.${prefix}_owner`, rowId: `.${prefix}_row_owner` },
    { header: 'Categorias', title: `${prefix} Download`, description: 'menu download', id: `.${prefix}_download`, rowId: `.${prefix}_row_download` },
    { header: 'Categorias', title: `${prefix} Grupo`, description: 'menu grupo', id: `.${prefix}_group`, rowId: `.${prefix}_row_group` },
    { header: 'Categorias', title: `${prefix} Store`, description: 'menu store', id: `.${prefix}_store`, rowId: `.${prefix}_row_store` },
  ];
}

function sections(prefix, mode = 'menu') {
  if (mode === 'many') {
    return [
      {
        title: 'Acesso rapido',
        highlight_label: 'Populer',
        rows: rows(`${prefix}a`).slice(0, 2),
      },
      {
        title: 'Categorias',
        highlight_label: 'Menu',
        rows: rows(`${prefix}b`).slice(2),
      },
      {
        title: 'Documentacao',
        rows: [
          { title: `${prefix} Script`, description: 'info script', id: `.${prefix}_script`, rowId: `.${prefix}_row_script` },
          { title: `${prefix} Info Bot`, description: 'info bot', id: `.${prefix}_infobot`, rowId: `.${prefix}_row_infobot` },
        ],
      },
    ];
  }

  if (mode === 'compact') {
    return [
      {
        title: 'Menu',
        rows: rows(prefix).map(({ title, id }) => ({ title, id })),
      },
    ];
  }

  return [
    {
      title: 'List menu yang sering dipakai',
      highlight_label: 'Populer',
      rows: rows(prefix).slice(0, 2),
    },
    {
      title: 'List menu yang dipisahkan',
      rows: rows(prefix).slice(2),
    },
  ];
}

function nativeList(prefix, options = {}) {
  return {
    ...listPayload({
      title: options.title || 'LIST MENU',
      buttonText: options.buttonText || 'Show Fitur',
      displayText: options.displayText || options.buttonText || 'Show Fitur',
      sections: sections(prefix, options.sectionMode),
    }),
    ...(options.multiple ? { has_multiple_buttons: true } : {}),
  };
}

function bottomSheetParams(prefix, limit = 2, options = {}) {
  const params = {
    bottom_sheet: {
      in_thread_buttons_limit: limit,
      divider_indices: options.dividers || [1, 2, 3, 4, 5, 999],
      list_title: options.listTitle || 'NanoBotzID Command Center',
      button_title: options.buttonTitle || 'Show Fitur',
    },
  };

  if (options.offer !== false) {
    params.limited_time_offer = {
      text: 'NanoBotzID',
      url: 'https://whatsapp.com',
      copy_code: prefix.toUpperCase(),
      expiration_time: Date.now() + 3600000,
    };
  }

  if (options.includeList) {
    const embeddedList = nativeList(prefix, {
      title: options.embeddedTitle || 'LIST MENU',
      buttonText: options.embeddedButtonText || 'Show Fitur',
      displayText: options.embeddedDisplayText || 'Show Fitur',
      sectionMode: options.sectionMode || 'many',
      multiple: options.includeListMultiple,
    });

    params.title = embeddedList.title;
    params.button_text = embeddedList.button_text;
    params.display_text = embeddedList.display_text;
    params.sections = embeddedList.sections;

    if (embeddedList.has_multiple_buttons) {
      params.has_multiple_buttons = true;
    }
  }

  if (options.labelEverywhere) {
    Object.assign(params, {
      title: 'Show Fitur',
      label: 'Show Fitur',
      text: 'Show Fitur',
      button: 'Show Fitur',
      button_text: 'Show Fitur',
      display_text: 'Show Fitur',
      button_title: 'Show Fitur',
      button_label: 'Show Fitur',
      selected_id: `.${prefix}_show_fitur`,
      button_id: `.${prefix}_show_fitur`,
      id: `.${prefix}_show_fitur`,
      action: 'open_bottom_sheet',
      action_type: 'open_bottom_sheet',
      native_flow_action: 'open_bottom_sheet',
    });
    Object.assign(params.bottom_sheet, {
      title: 'Show Fitur',
      label: 'Show Fitur',
      text: 'Show Fitur',
      button: 'Show Fitur',
      button_text: 'Show Fitur',
      display_text: 'Show Fitur',
      button_label: 'Show Fitur',
      selected_id: `.${prefix}_show_fitur`,
      button_id: `.${prefix}_show_fitur`,
      id: `.${prefix}_show_fitur`,
      action: 'open_bottom_sheet',
      action_type: 'open_bottom_sheet',
    });
  }

  if (options.tap !== false) {
    params.tap_target_configuration = {
      title: 'NanoBotzID',
      description: 'allmenu native flow',
      canonical_url: 'https://whatsapp.com',
      domain: 'whatsapp.com',
      button_index: options.buttonIndex === undefined ? 0 : options.buttonIndex,
    };

    if (options.camelButtonIndex !== undefined) {
      params.tap_target_configuration.buttonIndex = options.camelButtonIndex;
    }

    if (options.tapExtra) {
      Object.assign(params.tap_target_configuration, options.tapExtra);
    }

    if (options.tapLabelEverywhere) {
      Object.assign(params.tap_target_configuration, {
        title: 'Show Fitur',
        label: 'Show Fitur',
        text: 'Show Fitur',
        button: 'Show Fitur',
        button_text: 'Show Fitur',
        display_text: 'Show Fitur',
        button_title: 'Show Fitur',
        button_label: 'Show Fitur',
        button_name: 'single_select',
        native_flow_name: 'single_select',
        selected_id: `.${prefix}_show_fitur`,
        button_id: `.${prefix}_show_fitur`,
        id: `.${prefix}_show_fitur`,
        action: 'open_bottom_sheet',
        action_type: 'open_bottom_sheet',
      });
    }
  }

  if (options.flowToken) {
    params.flow_token = options.flowToken;
    params.flow_action = options.flowAction || 'navigate';
    params.flow_action_payload = {
      screen: options.flowScreen || 'MENU',
    };
  }

  if (options.nestedButtons) {
    params.buttons = [
      {
        name: 'single_select',
        buttonParamsJson: JSON.stringify(nativeList(prefix, { title: 'LIST MENU', buttonText: 'LIST MENU', sectionMode: 'many' })),
      },
      {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: 'ALL MENU', id: `.${prefix}_all_nested` }),
      },
    ];
  }

  if (options.bottomSheetNestedButtons) {
    params.bottom_sheet.buttons = [
      nf('single_select', nativeList(prefix, {
        title: 'LIST MENU',
        buttonText: 'LIST MENU',
        displayText: 'LIST MENU',
        sectionMode: 'many',
        multiple: true,
      })),
      ctaCopy('COPY SHEET', `${prefix.toUpperCase()}-SHEET`),
      menuQuick(prefix, 'ALL MENU', 'all_sheet'),
    ];
  }

  if (options.bottomSheetSections) {
    params.bottom_sheet.sections = sections(prefix, 'many');
    params.bottom_sheet.title = options.bottomSheetTitle || 'LIST MENU';
    params.bottom_sheet.button_text = options.bottomSheetButtonText || 'Show Fitur';
    params.bottom_sheet.display_text = options.bottomSheetDisplayText || 'Show Fitur';
  }

  if (options.bottomSheetAction) {
    params.bottom_sheet.action = {
      button: options.bottomSheetButtonText || 'Show Fitur',
      sections: sections(prefix, 'many'),
    };
  }

  if (options.bottomSheetNativeFlow) {
    params.bottom_sheet.native_flow = {
      buttons: [
        nf('single_select', nativeList(prefix, { title: 'LIST MENU', buttonText: 'LIST MENU', sectionMode: 'many', multiple: true })),
        ctaCopy('COPY', `${prefix.toUpperCase()}-NF`),
      ],
    };
  }

  if (options.sheetExtra) {
    Object.assign(params.bottom_sheet, options.sheetExtra);
  }

  if (options.bottomSheetCamel) {
    params.bottomSheet = params.bottom_sheet;
    if (options.noSnakeBottomSheet) {
      delete params.bottom_sheet;
    }
  }

  if (options.extra) {
    Object.assign(params, options.extra);
  }

  return params;
}

function dummySelect() {
  return nf('single_select', { has_multiple_buttons: true });
}

function dummySelectWithLabel(label = 'Show Fitur') {
  return nf('single_select', {
    title: label,
    button_text: label,
    display_text: label,
    has_multiple_buttons: true,
  });
}

function dummyPermission() {
  return nf('call_permission_request', { has_multiple_buttons: true });
}

function menuQuick(prefix, label, id) {
  return quick(label, `.${prefix}_${id}`);
}

function cloudListPayload(prefix) {
  return {
    type: 'list',
    body: { text: 'Escolha uma opcao' },
    action: {
      button: 'Show Fitur',
      sections: sections(prefix, 'many').map((section) => ({
        title: section.title,
        rows: section.rows.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
        })),
      })),
    },
  };
}

function camelListPayload(prefix) {
  return {
    title: 'Show Fitur',
    buttonText: 'Show Fitur',
    displayText: 'Show Fitur',
    sections: sections(prefix, 'many'),
  };
}

function showFiturListPayload(prefix, options = {}) {
  const payload = nativeList(prefix, {
    title: options.title || 'Show Fitur',
    buttonText: options.buttonText || 'Show Fitur',
    displayText: options.displayText || 'Show Fitur',
    sectionMode: options.sectionMode || 'many',
    multiple: options.multiple,
  });

  if (options.stringMultiple) {
    payload.has_multiple_buttons = 'true';
  }

  if (options.buttonTextObject) {
    payload.button_text = { display_text: 'Show Fitur' };
  }

  if (options.withId) {
    payload.id = `.${prefix}_show_fitur`;
  }

  return payload;
}

function protoShowFiturTrigger(prefix, options = {}) {
  const payload = {
    title: 'Show Fitur',
    button_text: options.buttonTextObject ? { display_text: 'Show Fitur' } : 'Show Fitur',
    display_text: 'Show Fitur',
    label: 'Show Fitur',
    text: 'Show Fitur',
    button_label: 'Show Fitur',
    selected_id: `.${prefix}_show_fitur`,
    button_id: `.${prefix}_show_fitur`,
    id: `.${prefix}_show_fitur`,
    rowId: `.${prefix}_show_fitur_row`,
    action: options.action || 'open_bottom_sheet',
    action_type: options.actionType || 'open_bottom_sheet',
    native_flow_action: options.nativeFlowAction || 'open_bottom_sheet',
    button_index: options.buttonIndex === undefined ? 0 : options.buttonIndex,
    index: options.index === undefined ? 0 : options.index,
    type: options.type || 'bottom_sheet',
    target: options.target || 'bottom_sheet',
  };

  if (options.multiple !== false) {
    payload.has_multiple_buttons = options.stringMultiple ? 'true' : true;
  }

  if (options.sections) {
    payload.sections = sections(prefix, 'many');
  }

  if (options.extra) {
    Object.assign(payload, options.extra);
  }

  return nf(options.name || 'single_select', payload);
}

function allMenuButtons(prefix, mode = 'nano', listOptions = {}) {
  const list = nf('single_select', nativeList(prefix, { multiple: true, ...listOptions }));
  const copy = ctaCopy('COPY', prefix.toUpperCase());
  const copyButtons = [
    ctaCopy('COPIAR 1', `${prefix.toUpperCase()}-COPY-1`),
    ctaCopy('COPIAR 2', `${prefix.toUpperCase()}-COPY-2`),
    ctaCopy('COPIAR CMD', `.${prefix}_allmenu`),
    ctaCopy('COPIAR OWNER', `.${prefix}_owner`),
  ];
  const replyButtons = [
    menuQuick(prefix, 'MAIN MENU', 'main'),
    menuQuick(prefix, 'ALL MENU', 'all'),
    menuQuick(prefix, 'DOWNLOAD', 'download'),
    menuQuick(prefix, 'OWNER MENU', 'owner'),
  ];
  const quicks = [
    menuQuick(prefix, 'MAIN MENU', 'main'),
    menuQuick(prefix, 'ALL MENU', 'all'),
    menuQuick(prefix, 'DOWNLOAD', 'download'),
    menuQuick(prefix, 'OWNER MENU', 'owner'),
    menuQuick(prefix, 'GROUP MENU', 'group'),
    menuQuick(prefix, 'STORE MENU', 'store'),
  ];

  if (mode === 'nano') return [dummySelect(), dummyPermission(), list, copy, ...quicks];
  if (mode === 'noPermission') return [dummySelect(), list, copy, ...quicks];
  if (mode === 'dummyLabeled') return [dummySelectWithLabel(), dummyPermission(), list, copy, ...quicks];
  if (mode === 'dummyLabeledNoPermission') return [dummySelectWithLabel(), list, copy, ...quicks];
  if (mode === 'listFirst') return [list, copy, ...quicks];
  if (mode === 'listFirstWithDummy') return [list, dummySelect(), copy, ...quicks];
  if (mode === 'quickFirst') return [...quicks.slice(0, 2), list, copy, ...quicks.slice(2)];
  if (mode === 'showFiturList') return [nf('single_select', showFiturListPayload(prefix)), copy, ...quicks.slice(0, 4)];
  if (mode === 'showFiturListMultiple') return [nf('single_select', showFiturListPayload(prefix, { multiple: true })), copy, ...quicks.slice(0, 4)];
  if (mode === 'showFiturStringMultiple') return [nf('single_select', showFiturListPayload(prefix, { stringMultiple: true })), copy, ...quicks.slice(0, 4)];
  if (mode === 'showFiturButtonObject') return [nf('single_select', showFiturListPayload(prefix, { buttonTextObject: true })), copy, ...quicks.slice(0, 4)];
  if (mode === 'showFiturWithId') return [nf('single_select', showFiturListPayload(prefix, { withId: true })), copy, ...quicks.slice(0, 4)];
  if (mode === 'showFiturCamel') return [nf('single_select', camelListPayload(prefix)), copy, ...quicks.slice(0, 4)];
  if (mode === 'showFiturCloud') return [nf('single_select', cloudListPayload(prefix)), copy, ...quicks.slice(0, 4)];
  if (mode === 'showFiturCopyOnly') return copyButtons;
  if (mode === 'showFiturCopyOnlyDummy') return [dummySelect(), ...copyButtons];
  if (mode === 'showFiturReplyOnly') return replyButtons;
  if (mode === 'showFiturReplyOnlyDummy') return [dummySelect(), ...replyButtons];
  if (mode === 'showFiturListOnly') return [nf('single_select', showFiturListPayload(prefix, { multiple: true }))];
  if (mode === 'showFiturListOnlyPlain') return [nf('single_select', nativeList(prefix, { title: 'LIST MENU', buttonText: 'LIST MENU', displayText: 'LIST MENU', sectionMode: 'many', multiple: true }))];
  if (mode === 'showFiturListOnlyNoMultiple') return [nf('single_select', showFiturListPayload(prefix, { multiple: false }))];
  if (mode === 'showFiturListInsideMix') return [nf('single_select', showFiturListPayload(prefix, { multiple: true })), copy, ...replyButtons.slice(0, 2)];
  if (mode === 'protoCopyOnly') return [protoShowFiturTrigger(prefix), ...copyButtons];
  if (mode === 'protoReplyOnly') return [protoShowFiturTrigger(prefix), ...replyButtons];
  if (mode === 'protoListOnly') return [protoShowFiturTrigger(prefix, { sections: true }), nf('single_select', showFiturListPayload(prefix, { multiple: true }))];
  if (mode === 'protoCopyNoMultiple') return [protoShowFiturTrigger(prefix, { multiple: false }), ...copyButtons];
  if (mode === 'protoReplyNoMultiple') return [protoShowFiturTrigger(prefix, { multiple: false }), ...replyButtons];
  if (mode === 'protoListNoMultiple') return [protoShowFiturTrigger(prefix, { multiple: false, sections: true }), nf('single_select', showFiturListPayload(prefix, { multiple: false }))];
  if (mode === 'protoCopyStringMultiple') return [protoShowFiturTrigger(prefix, { stringMultiple: true }), ...copyButtons];
  if (mode === 'protoReplyButtonTextObject') return [protoShowFiturTrigger(prefix, { buttonTextObject: true }), ...replyButtons];
  if (mode === 'protoListActionNavigate') return [protoShowFiturTrigger(prefix, { action: 'navigate', actionType: 'navigate', nativeFlowAction: 'navigate', sections: true }), nf('single_select', showFiturListPayload(prefix, { multiple: true }))];
  if (mode === 'protoCopySheetExtra') return [protoShowFiturTrigger(prefix, { extra: { sheet: 'bottom_sheet', sheet_action: 'open', open: true } }), ...copyButtons];
  if (mode === 'protoReplySheetExtra') return [protoShowFiturTrigger(prefix, { extra: { sheet: 'bottom_sheet', sheet_action: 'open', open: true } }), ...replyButtons];
  if (mode === 'protoListSheetExtra') return [protoShowFiturTrigger(prefix, { sections: true, extra: { sheet: 'bottom_sheet', sheet_action: 'open', open: true } }), nf('single_select', showFiturListPayload(prefix, { multiple: true }))];
  if (mode === 'fullListThenPermission') return [nf('single_select', showFiturListPayload(prefix, { multiple: true })), dummyPermission(), copy, ...quicks.slice(0, 4)];
  if (mode === 'twoListsWithDummy') {
    return [
      dummySelect(),
      list,
      nf('single_select', nativeList(`${prefix}b`, { title: 'CATEGORIAS', buttonText: 'Categorias', multiple: true, sectionMode: 'many' })),
      copy,
      ...quicks.slice(0, 4),
    ];
  }
  if (mode === 'twoListsWithLabeledDummy') {
    return [
      dummySelectWithLabel(),
      list,
      nf('single_select', nativeList(`${prefix}b`, { title: 'CATEGORIAS', buttonText: 'Categorias', multiple: true, sectionMode: 'many' })),
      copy,
      ...quicks.slice(0, 4),
    ];
  }
  if (mode === 'twoListsWithPermission') {
    return [
      list,
      dummyPermission(),
      nf('single_select', nativeList(`${prefix}b`, { title: 'CATEGORIAS', buttonText: 'Categorias', multiple: true, sectionMode: 'many' })),
      copy,
      ...quicks.slice(0, 4),
    ];
  }
  if (mode === 'quickTriggerTwoLists') {
    return [
      quick('Show Fitur', `.${prefix}_open_sheet`),
      list,
      nf('single_select', nativeList(`${prefix}b`, { title: 'CATEGORIAS', buttonText: 'Categorias', multiple: true, sectionMode: 'many' })),
      copy,
      ...quicks.slice(0, 3),
    ];
  }
  if (mode === 'copyTriggerTwoLists') {
    return [
      ctaCopy('Show Fitur', `${prefix.toUpperCase()}-OPEN`),
      list,
      nf('single_select', nativeList(`${prefix}b`, { title: 'CATEGORIAS', buttonText: 'Categorias', multiple: true, sectionMode: 'many' })),
      ...quicks.slice(0, 4),
    ];
  }
  if (mode === 'twoListsCopies') {
    return [
      list,
      nf('single_select', nativeList(`${prefix}b`, { title: 'CATEGORIAS', buttonText: 'Categorias', multiple: true, sectionMode: 'many' })),
      copy,
      ctaCopy('COPY CMD', `.${prefix}_allmenu`),
      ...quicks.slice(0, 4),
    ];
  }
  if (mode === 'twoListsUrl') {
    return [
      list,
      nf('single_select', nativeList(`${prefix}b`, { title: 'CATEGORIAS', buttonText: 'Categorias', multiple: true, sectionMode: 'many' })),
      ctaUrl('URL MENU', 'https://whatsapp.com'),
      copy,
      ...quicks.slice(0, 3),
    ];
  }
  if (mode === 'actionsOnlySheet') return [dummySelect(), copy, ctaCopy('COPY CMD', `.${prefix}_allmenu`), ...quicks.slice(0, 4)];
  if (mode === 'singleListAllActions') return [list, copy, ctaCopy('COPY CMD', `.${prefix}_allmenu`), ctaUrl('URL MENU', 'https://whatsapp.com'), ...quicks.slice(0, 4)];
  if (mode === 'twoLists') {
    return [
      list,
      nf('single_select', nativeList(`${prefix}b`, { title: 'CATEGORIAS', buttonText: 'Categorias', multiple: true, sectionMode: 'many' })),
      copy,
      ...quicks.slice(0, 4),
    ];
  }
  if (mode === 'compactList') return [nf('single_select', nativeList(prefix, { multiple: true, sectionMode: 'compact' })), copy, ...quicks.slice(0, 3)];

  return [list, copy, ...quicks.slice(0, 2)];
}

function header(media, mode = 'media') {
  if (mode === 'none') return undefined;
  if (mode === 'text') {
    return proto.Message.InteractiveMessage.Header.create({
      title: 'NANO COMMAND CENTER',
      subtitle: 'allmenu',
      hasMediaAttachment: false,
    });
  }

  return proto.Message.InteractiveMessage.Header.create({
    title: '',
    subtitle: mode === 'noSubtitle' ? '' : 'allmenu',
    hasMediaAttachment: true,
    ...media,
  });
}

function interactive(media, label, prefix, options = {}) {
  return proto.Message.InteractiveMessage.create({
    contextInfo: options.contextInfo,
    body: options.body === false ? undefined : proto.Message.InteractiveMessage.Body.create({ text: options.bodyText || label }),
    footer: options.footer === false ? undefined : proto.Message.InteractiveMessage.Footer.create({ text: options.footerText || options.footer || 'NanoBotzID | allmenu test' }),
    header: header(media, options.header || 'media'),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      messageVersion: options.messageVersion,
      messageParamsJson: options.params === false ? undefined : JSON.stringify(bottomSheetParams(prefix, options.limit === undefined ? 2 : options.limit, options.paramsOptions || {})),
      buttons: allMenuButtons(prefix, options.buttonsMode || 'nano', options.listOptions || {}),
    }),
  });
}

function asContent(message) {
  return { interactiveMessage: message };
}

function messageContext(label) {
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
  return {
    viewOnceMessage: {
      message: {
        ...messageContext(label),
        ...content,
      },
    },
  };
}

function ephemeral(content, label) {
  return {
    ephemeralMessage: {
      message: {
        ...messageContext(label),
        ...content,
      },
    },
  };
}

function deviceSent(content, jid, label) {
  return {
    deviceSentMessage: {
      destinationJid: jid,
      phash: `${label}-phash`,
      message: {
        ...messageContext(label),
        ...content,
      },
    },
  };
}

function viewOnceV2(content, label) {
  return {
    viewOnceMessageV2: {
      message: {
        ...messageContext(label),
        ...content,
      },
    },
  };
}

function viewOnceV2Extension(content, label) {
  return {
    viewOnceMessageV2Extension: {
      message: {
        ...messageContext(label),
        ...content,
      },
    },
  };
}

function deviceSentViewOnce(content, jid, label) {
  return deviceSent(viewOnce(content, label), jid, `${label}-device`);
}

function cloneMessageContent(content) {
  return proto.Message.fromObject(proto.Message.toObject(proto.Message.create(content)));
}

function future(content) {
  return proto.Message.FutureProofMessage.create({
    message: cloneMessageContent(content),
  });
}

function asFutureField(content, field) {
  return { [field]: future(content) };
}

function carousel(cards, options = {}) {
  const carouselTypes = proto.Message.InteractiveMessage.CarouselMessage.CarouselCardType || {};
  return {
    interactiveMessage: proto.Message.InteractiveMessage.create({
      body: options.outerText ? proto.Message.InteractiveMessage.Body.create({ text: options.outerText }) : undefined,
      header: options.outerHeader === false ? undefined : proto.Message.InteractiveMessage.Header.create({ title: '', hasMediaAttachment: false }),
      carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
        cards,
        messageVersion: options.messageVersion || 1,
        carouselCardType: options.cardType || carouselTypes.HSCROLL_CARDS || 1,
      }),
    }),
  };
}

function listMessage(label, prefix) {
  return proto.Message.fromObject({
    listMessage: {
      title: 'LIST MENU',
      description: label,
      buttonText: 'Show Fitur',
      footerText: 'legacy allmenu list',
      listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
      sections: sections(prefix, 'many').map((section) => ({
        title: section.title,
        rows: section.rows.map((row) => ({
          title: row.title,
          description: row.description,
          rowId: row.rowId || row.id,
        })),
      })),
    },
  });
}

function buttonsMessage(label, prefix) {
  return proto.Message.fromObject({
    buttonsMessage: {
      contentText: label,
      footerText: 'buttonsMessage native list',
      headerType: 1,
      buttons: [
        {
          buttonId: `.${prefix}_native`,
          buttonText: { displayText: 'Show Fitur' },
          type: proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW,
          nativeFlowInfo: {
            name: 'single_select',
            paramsJson: JSON.stringify(nativeList(prefix, { sectionMode: 'many', multiple: true })),
          },
        },
        { buttonId: `.${prefix}_quick`, buttonText: { displayText: 'QUICK' }, type: proto.Message.ButtonsMessage.Button.Type.RESPONSE },
      ],
    },
  });
}

function legacyNativeButton(prefix, options = {}) {
  const payload = options.payload || showFiturListPayload(prefix, {
    multiple: options.multiple,
    stringMultiple: options.stringMultiple,
    buttonTextObject: options.buttonTextObject,
    withId: options.withId,
  });

  const nativeFlowInfo = {
    name: options.name || 'single_select',
    paramsJson: JSON.stringify(payload),
  };

  if (options.buttonParamsJson) {
    nativeFlowInfo.buttonParamsJson = JSON.stringify(payload);
  }

  return {
    buttonId: options.buttonId === false ? undefined : `.${prefix}_native`,
    buttonText: options.noButtonText ? undefined : { displayText: options.buttonText || 'Show Fitur' },
    type: options.numericType ? 4 : proto.Message.ButtonsMessage.Button.Type.NATIVE_FLOW,
    nativeFlowInfo,
  };
}

function legacyResponseButton(prefix, label = 'ALL MENU') {
  return {
    buttonId: `.${prefix}_${label.toLowerCase().replace(/\s+/g, '_')}`,
    buttonText: { displayText: label },
    type: proto.Message.ButtonsMessage.Button.Type.RESPONSE,
  };
}

function buttonsMessageVariant(label, prefix, options = {}) {
  const buttons = options.buttons || [
    legacyNativeButton(prefix, options),
    legacyResponseButton(prefix, 'ALL MENU'),
    legacyResponseButton(prefix, 'OWNER'),
  ];

  return proto.Message.fromObject({
    buttonsMessage: {
      contentText: label,
      footerText: options.footer === false ? undefined : 'legacy buttons allmenu',
      headerType: options.headerType || 1,
      text: options.text,
      buttons,
    },
  });
}

function commandRows(prefix, count = 8, mode = 'idOnly') {
  const commandNames = ['menu', 'allmenu', 'ownermenu', 'groupmenu', 'downloadmenu', 'storemenu', 'aimenu', 'gamemenu', 'bugmenu', 'infobot', 'script', 'ping'];

  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    const command = commandNames[index] || `cmd${n}`;
    const base = {
      header: index < 2 ? 'Acesso' : 'Comandos',
      title: `${n}. ${command}`,
      description: `Executar .${command}`,
      id: `.${command}`,
      rowId: `.${command}`,
    };

    if (mode === 'both') return base;
    if (mode === 'rowIdOnly') return { title: base.title, description: base.description, rowId: base.rowId };
    if (mode === 'titleOnly') return { title: base.title, id: base.id };
    if (mode === 'noDescription') return { title: base.title, id: base.id };
    if (mode === 'withHeader') return { header: base.header, title: base.title, description: base.description, id: base.id };
    return { title: base.title, description: base.description, id: base.id };
  });
}

function menuSections(prefix, options = {}) {
  if (options.split) {
    return [
      {
        title: options.firstTitle || 'Acesso rapido',
        ...(options.highlight === false ? {} : { highlight_label: 'Menu' }),
        rows: commandRows(prefix, Math.min(options.count || 8, 4), options.rowMode),
      },
      {
        title: options.secondTitle || 'Mais comandos',
        rows: commandRows(`${prefix}b`, Math.max((options.count || 8) - 4, 2), options.rowMode),
      },
    ];
  }

  return [
    {
      title: options.sectionTitle === undefined ? 'Comandos do bot' : options.sectionTitle,
      ...(options.highlight === false ? {} : { highlight_label: 'Menu' }),
      rows: commandRows(prefix, options.count || 8, options.rowMode),
    },
  ];
}

function menuListPayload(prefix, options = {}) {
  const payload = {
    title: options.title || 'Show Fitur',
    sections: menuSections(prefix, options),
  };

  if (options.buttonText !== false) {
    payload.button_text = options.buttonText || payload.title;
  }

  if (options.displayText !== false) {
    payload.display_text = options.displayText || payload.button_text || payload.title;
  }

  if (options.hasMultiple) {
    payload.has_multiple_buttons = true;
  }

  if (options.listType) {
    payload.list_type = 'SINGLE_SELECT';
    payload.listType = 'SINGLE_SELECT';
  }

  if (options.extra) {
    Object.assign(payload, options.extra);
  }

  return payload;
}

function menuButtonSet(prefix, options = {}) {
  const select = nf(options.name || 'single_select', menuListPayload(prefix, options));
  const quicks = [
    menuQuick(prefix, 'ALL MENU', 'all'),
    menuQuick(prefix, 'OWNER', 'owner'),
    menuQuick(prefix, 'DOWNLOAD', 'download'),
    menuQuick(prefix, 'GROUP', 'group'),
  ];
  const copy = ctaCopy('COPY CMD', `.${prefix}_menu`);

  if (options.onlyList) return [select];
  if (options.quickBefore) return [quicks[0], select, copy, ...quicks.slice(1, 3)];
  if (options.copyBefore) return [copy, select, ...quicks.slice(0, 3)];
  if (options.manyQuick) return [select, copy, ...quicks];
  return [select, quicks[0], copy];
}

function menuInteractive(media, label, prefix, options = {}) {
  return proto.Message.InteractiveMessage.create({
    body: options.body === false ? undefined : proto.Message.InteractiveMessage.Body.create({ text: label }),
    footer: options.footer === false ? undefined : proto.Message.InteractiveMessage.Footer.create({ text: options.footer || 'menu commands test' }),
    header: header(media, options.header || 'media'),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      messageVersion: options.messageVersion,
      messageParamsJson: options.params ? JSON.stringify(options.params) : undefined,
      buttons: menuButtonSet(prefix, options),
    }),
  });
}

function menuCarousel(media, n, text, options = {}, carouselOptions = {}) {
  return carousel([
    menuInteractive(media, `AM-${n} ${text}`, `am${n}`, options),
  ], carouselOptions);
}

function exactSheetParams(prefix, options = {}) {
  const params = {
    limited_time_offer: {
      text: options.offerText || 'NanoBotzID',
      url: options.offerUrl || 'https://t.me/nanobotz',
      copy_code: options.copyCode || prefix.toUpperCase(),
      expiration_time: options.expiration === 'plus'
        ? Date.now() + 3600000
        : Date.now() * 999,
    },
    bottom_sheet: {
      in_thread_buttons_limit: options.limit === undefined ? 2 : options.limit,
      divider_indices: options.dividers || [1, 2, 3, 4, 5, 999],
      list_title: options.listTitle || 'NanoBotzID Command Center',
      button_title: options.buttonTitle || 'Show Fitur',
    },
    tap_target_configuration: {
      title: options.tapTitle || ' X ',
      description: options.tapDescription || 'NanoBotzID',
      canonical_url: options.canonicalUrl || 'https://t.me/nanobotz',
      domain: options.domain || 'shop.example.com',
      button_index: options.buttonIndex === undefined ? 0 : options.buttonIndex,
    },
  };

  if (options.noOffer) delete params.limited_time_offer;
  if (options.noTap) delete params.tap_target_configuration;
  if (options.noDividers) delete params.bottom_sheet.divider_indices;
  if (options.sheetExtra) Object.assign(params.bottom_sheet, options.sheetExtra);
  if (options.tapExtra && params.tap_target_configuration) Object.assign(params.tap_target_configuration, options.tapExtra);
  if (options.extra) Object.assign(params, options.extra);

  return params;
}

function sheetRows(prefix) {
  return [
    { title: 'All Menu', description: 'Abrir todos comandos', id: `.${prefix}_allmenu` },
    { title: 'Owner Menu', description: 'Comandos owner', id: `.${prefix}_owner` },
    { title: 'Download Menu', description: 'Comandos download', id: `.${prefix}_download` },
    { title: 'Group Menu', description: 'Comandos grupo', id: `.${prefix}_group` },
  ];
}

function sheetListPayload(prefix, options = {}) {
  return {
    title: options.title || 'LIST MENU',
    sections: [
      {
        title: options.sectionTitle || 'Comandos internos',
        highlight_label: options.highlight === false ? undefined : 'Menu',
        rows: sheetRows(prefix),
      },
    ],
    has_multiple_buttons: options.multiple === false ? undefined : true,
  };
}

function sheetQuick(prefix, label, id) {
  return quick(label, `.${prefix}_${id}`);
}

function sheetButtons(prefix, mode = 'exact') {
  const dummy = nf('single_select', { has_multiple_buttons: true });
  const dummyLabeled = nf('single_select', {
    title: 'Show Fitur',
    button_text: 'Show Fitur',
    display_text: 'Show Fitur',
    has_multiple_buttons: true,
  });
  const permission = nf('call_permission_request', { has_multiple_buttons: true });
  const list = nf('single_select', sheetListPayload(prefix));
  const listNoMultiple = nf('single_select', sheetListPayload(prefix, { multiple: false }));
  const copy = ctaCopy('COPY', `${prefix.toUpperCase()}-COPY`);
  const copyLong = ctaCopy('COPY COMMAND', `.${prefix}_allmenu`);
  const qMain = sheetQuick(prefix, 'MAIN MENU', 'main');
  const qAll = sheetQuick(prefix, 'ALL MENU', 'all');
  const qOwner = sheetQuick(prefix, 'OWNER MENU', 'owner');
  const qDown = sheetQuick(prefix, 'DOWNLOAD', 'download');

  if (mode === 'buttonIndex3') return [dummy, permission, list, copy, qMain, qAll, qOwner];
  if (mode === 'labeledDummy') return [dummyLabeled, permission, list, copy, qMain, qAll, qOwner];
  if (mode === 'listFirst') return [list, dummy, permission, copy, qMain, qAll, qOwner];
  if (mode === 'copyBeforeList') return [dummy, permission, copy, list, qMain, qAll, qOwner];
  if (mode === 'quickBeforeList') return [dummy, permission, qMain, list, copy, qAll, qOwner];
  if (mode === 'noPermission') return [dummy, list, copy, qMain, qAll, qOwner, qDown];
  if (mode === 'noDummy') return [list, copy, qMain, qAll, qOwner, qDown];
  if (mode === 'copyOnlyVisible') return [dummy, permission, copy, qMain, qAll, list];
  if (mode === 'listNoMultiple') return [dummy, permission, listNoMultiple, copy, qMain, qAll];
  if (mode === 'manyActions') return [dummy, permission, list, copyLong, qMain, qAll, qOwner, qDown, ctaCopy('COPY 2', `${prefix.toUpperCase()}-COPY2`)];
  if (mode === 'twoLists') return [
    dummy,
    permission,
    list,
    nf('single_select', sheetListPayload(`${prefix}b`, { title: 'CATEGORIAS', sectionTitle: 'Categorias' })),
    copy,
    qMain,
    qAll,
  ];

  return [dummy, permission, list, copy, qMain, qAll, qOwner, qDown];
}

function sheetInteractive(media, label, prefix, options = {}) {
  return proto.Message.InteractiveMessage.create({
    contextInfo: options.contextInfo,
    body: proto.Message.InteractiveMessage.Body.create({ text: label }),
    footer: proto.Message.InteractiveMessage.Footer.create({ text: options.footer || 'bottom_sheet internal buttons' }),
    header: header(media, options.header || 'media'),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      messageVersion: options.messageVersion,
      messageParamsJson: JSON.stringify(exactSheetParams(prefix, options.params || {})),
      buttons: sheetButtons(prefix, options.mode || 'exact'),
    }),
  });
}

function sheetContent(media, n, text, options = {}) {
  return {
    interactiveMessage: sheetInteractive(media, `AM-${n} ${text}`, `am${n}`, options),
  };
}

function sheetCarousel(media, n, text, options = {}, carouselOptions = {}) {
  return carousel([
    sheetInteractive(media, `AM-${n} ${text}`, `am${n}`, options),
  ], carouselOptions);
}

function sendMessageSheet(media, n, text, options = {}) {
  return async (sock, jid) => {
    await sock.sendMessage(jid, sheetContent(media, n, text, options));
  };
}

function withMessageContext(content, label, options = {}) {
  return {
    messageContextInfo: proto.MessageContextInfo.create({
      ...(options.device === false ? {} : {
        deviceListMetadata: {},
        deviceListMetadataVersion: options.deviceVersion || 2,
      }),
      ...(options.secret === false ? {} : { messageSecret: crypto.randomBytes(32) }),
      ...(options.padding === false ? {} : { paddingBytes: Buffer.from(label) }),
    }),
    ...content,
  };
}

function forwardedSheetContext(label = 'NanoBotzID') {
  return proto.ContextInfo.create({
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: '120363418977603376@newsletter',
      newsletterName: label,
      serverMessageId: 145,
    },
  });
}

function externalSheetContext() {
  return proto.ContextInfo.create({
    forwardingScore: 1,
    isForwarded: true,
    alwaysShowAdAttribution: true,
    externalAdReply: {
      title: 'NanoBotzID',
      body: 'bottom sheet menu',
      mediaType: 1,
      sourceUrl: 'https://whatsapp.com',
      showAdAttribution: true,
    },
  });
}

function deviceSentRaw(content, jid, label, options = {}) {
  return {
    deviceSentMessage: {
      destinationJid: options.destination === false ? undefined : jid,
      phash: options.phash === false ? undefined : `${label}-phash`,
      message: options.messageContext === false ? content : withMessageContext(content, label),
    },
  };
}

function templateMessage(content, label) {
  return {
    templateMessage: {
      templateId: `${label}_template`,
      interactiveMessageTemplate: cloneMessageContent(content).interactiveMessage,
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
  log('filtro AM', `${startCase}-${endCase}`, 'delay', `${sendDelayMs}ms`);

  const card = (n, text, extra = {}) => interactive(media, `AM-${n} ${text}`, `am${n}`, extra);
  const oneCard = (n, text, extra = {}, carouselOptions = {}) =>
    carousel([card(n, text, extra)], carouselOptions);

  const cases = [
    ['AM-01 direct viewOnce nano allmenu exact', viewOnce(asContent(card('01', 'direct viewOnce nano allmenu exact')), 'am01')],
    ['AM-02 direct raw nano allmenu', asContent(card('02', 'direct raw nano allmenu'))],
    ['AM-03 direct viewOnce list first', viewOnce(asContent(card('03', 'direct viewOnce list first', { buttonsMode: 'listFirst' })), 'am03')],
    ['AM-04 direct viewOnce no permission', viewOnce(asContent(card('04', 'direct viewOnce no permission', { buttonsMode: 'noPermission' })), 'am04')],
    ['AM-05 direct viewOnce limit 4 buttons', viewOnce(asContent(card('05', 'direct viewOnce limit 4 buttons', { limit: 4 })), 'am05')],
    ['AM-06 direct viewOnce compact list', viewOnce(asContent(card('06', 'direct viewOnce compact list', { buttonsMode: 'compactList' })), 'am06')],
    ['AM-07 carousel nano exact one card', oneCard('07', 'carousel nano exact one card')],
    ['AM-08 carousel list first one card', oneCard('08', 'carousel list first one card', { buttonsMode: 'listFirst' })],
    ['AM-09 carousel no permission', oneCard('09', 'carousel no permission', { buttonsMode: 'noPermission' })],
    ['AM-10 carousel two lists same card', oneCard('10', 'carousel two lists same card', { buttonsMode: 'twoLists', limit: 4 })],
    ['AM-11 carousel two cards nano', carousel([
      card('11A', 'carousel two cards nano A'),
      card('11B', 'carousel two cards nano B', { buttonsMode: 'listFirst', limit: 3 }),
    ])],
    ['AM-12 viewOnce carousel nano', viewOnce(oneCard('12', 'viewOnce carousel nano'), 'am12')],
    ['AM-13 ephemeral carousel nano', ephemeral(oneCard('13', 'ephemeral carousel nano'), 'am13')],
    ['AM-14 deviceSent carousel nano', deviceSent(oneCard('14', 'deviceSent carousel nano'), targetJid, 'am14')],
    ['AM-15 carousel no outer header', oneCard('15', 'carousel no outer header', {}, { outerHeader: false })],
    ['AM-16 carousel card text header', oneCard('16', 'carousel card text header', { header: 'text' })],
    ['AM-17 legacy listMessage viewOnce', viewOnce(listMessage('AM-17 legacy listMessage viewOnce', 'am17'), 'am17')],
    ['AM-18 buttonsMessage native list viewOnce', viewOnce(buttonsMessage('AM-18 buttonsMessage native list viewOnce', 'am18'), 'am18')],
    ['AM-19 ios tap index 2 real list', oneCard('19', 'ios tap index 2 real list', { paramsOptions: { buttonIndex: 2 } })],
    ['AM-20 ios tap index 1 permission', oneCard('20', 'ios tap index 1 permission', { paramsOptions: { buttonIndex: 1 } })],
    ['AM-21 params include title sections', oneCard('21', 'params include title sections', { paramsOptions: { includeList: true, buttonIndex: 2 } })],
    ['AM-22 params include sections no offer', oneCard('22', 'params include sections no offer', { paramsOptions: { includeList: true, buttonIndex: 2, offer: false } })],
    ['AM-23 params no tap target', oneCard('23', 'params no tap target', { paramsOptions: { includeList: true, tap: false, offer: false } })],
    ['AM-24 dummy labeled first', oneCard('24', 'dummy labeled first', { buttonsMode: 'dummyLabeled' })],
    ['AM-25 dummy labeled include sections', oneCard('25', 'dummy labeled include sections', { buttonsMode: 'dummyLabeled', paramsOptions: { includeList: true, buttonIndex: 0 } })],
    ['AM-26 real list first button index 0', oneCard('26', 'real list first button index 0', { buttonsMode: 'listFirst', paramsOptions: { buttonIndex: 0, offer: false } })],
    ['AM-27 real list first include sections', oneCard('27', 'real list first include sections', { buttonsMode: 'listFirst', paramsOptions: { includeList: true, buttonIndex: 0, offer: false } })],
    ['AM-28 dummy labeled no permission', oneCard('28', 'dummy labeled no permission', { buttonsMode: 'dummyLabeledNoPermission', paramsOptions: { buttonIndex: 1, offer: false } })],
    ['AM-29 bottom sheet limit 1', oneCard('29', 'bottom sheet limit 1', { limit: 1, paramsOptions: { buttonIndex: 2, offer: false, dividers: [1, 999] } })],
    ['AM-30 bottom sheet limit 6', oneCard('30', 'bottom sheet limit 6', { limit: 6, paramsOptions: { buttonIndex: 2, offer: false, dividers: [1, 2, 3, 4, 5, 6, 999] } })],
    ['AM-31 direct viewOnce include sections', viewOnce(asContent(card('31', 'direct viewOnce include sections', { paramsOptions: { includeList: true, buttonIndex: 2, offer: false } })), 'am31')],
    ['AM-32 direct viewOnce real list first', viewOnce(asContent(card('32', 'direct viewOnce real list first', { buttonsMode: 'listFirst', paramsOptions: { buttonIndex: 0, offer: false } })), 'am32')],
    ['AM-33 carousel text header include sections', oneCard('33', 'carousel text header include sections', { header: 'text', paramsOptions: { includeList: true, buttonIndex: 2, offer: false } })],
    ['AM-34 carousel no card header include sections', oneCard('34', 'carousel no card header include sections', { header: 'none', paramsOptions: { includeList: true, buttonIndex: 2, offer: false } })],
    ['AM-35 unicode button title original', oneCard('35', 'unicode button title original', { paramsOptions: { buttonTitle: '𝐒𝐡𝐨𝐰 𝐅𝐢𝐭𝐮𝐫', listTitle: 'NanoBotzID Command Center', buttonIndex: 2 } })],
    ['AM-36 list first plus dummy after', oneCard('36', 'list first plus dummy after', { buttonsMode: 'listFirstWithDummy', paramsOptions: { includeList: true, buttonIndex: 0, offer: false } })],
    ['AM-37 show fitur real list no sheet', oneCard('37', 'show fitur real list no sheet', { buttonsMode: 'showFiturList', params: false })],
    ['AM-38 show fitur real list multiple no sheet', oneCard('38', 'show fitur real list multiple no sheet', { buttonsMode: 'showFiturListMultiple', params: false })],
    ['AM-39 show fitur string multiple no sheet', oneCard('39', 'show fitur string multiple no sheet', { buttonsMode: 'showFiturStringMultiple', params: false })],
    ['AM-40 show fitur button text object', oneCard('40', 'show fitur button text object', { buttonsMode: 'showFiturButtonObject', params: false })],
    ['AM-41 show fitur with id no sheet', oneCard('41', 'show fitur with id no sheet', { buttonsMode: 'showFiturWithId', params: false })],
    ['AM-42 show fitur camel payload no sheet', oneCard('42', 'show fitur camel payload no sheet', { buttonsMode: 'showFiturCamel', params: false })],
    ['AM-43 show fitur cloud payload no sheet', oneCard('43', 'show fitur cloud payload no sheet', { buttonsMode: 'showFiturCloud', params: false })],
    ['AM-44 full list first with bottom sheet', oneCard('44', 'full list first with bottom sheet', { buttonsMode: 'showFiturListMultiple', paramsOptions: { buttonIndex: 0, offer: false } })],
    ['AM-45 full list first include sections sheet', oneCard('45', 'full list first include sections sheet', { buttonsMode: 'showFiturListMultiple', paramsOptions: { includeList: true, buttonIndex: 0, offer: false } })],
    ['AM-46 full list then permission sheet', oneCard('46', 'full list then permission sheet', { buttonsMode: 'fullListThenPermission', paramsOptions: { buttonIndex: 0, offer: false } })],
    ['AM-47 tap index string zero', oneCard('47', 'tap index string zero', { buttonsMode: 'showFiturListMultiple', paramsOptions: { buttonIndex: '0', offer: false } })],
    ['AM-48 tap camel buttonIndex', oneCard('48', 'tap camel buttonIndex', { buttonsMode: 'showFiturListMultiple', paramsOptions: { buttonIndex: 0, camelButtonIndex: 0, offer: false } })],
    ['AM-49 flow token plus sheet', oneCard('49', 'flow token plus sheet', { buttonsMode: 'showFiturListMultiple', paramsOptions: { buttonIndex: 0, offer: false, flowToken: 'am49-flow-token' } })],
    ['AM-50 nested buttons in params', oneCard('50', 'nested buttons in params', { buttonsMode: 'showFiturListMultiple', paramsOptions: { buttonIndex: 0, offer: false, nestedButtons: true } })],
    ['AM-51 camel bottomSheet both', oneCard('51', 'camel bottomSheet both', { buttonsMode: 'showFiturListMultiple', paramsOptions: { buttonIndex: 0, offer: false, bottomSheetCamel: true } })],
    ['AM-52 camel bottomSheet only', oneCard('52', 'camel bottomSheet only', { buttonsMode: 'showFiturListMultiple', paramsOptions: { buttonIndex: 0, offer: false, bottomSheetCamel: true, noSnakeBottomSheet: true } })],
    ['AM-53 nativeFlow version 1 real list', oneCard('53', 'nativeFlow version 1 real list', { buttonsMode: 'showFiturListMultiple', messageVersion: 1, paramsOptions: { buttonIndex: 0, offer: false } })],
    ['AM-54 nativeFlow version 2 real list', oneCard('54', 'nativeFlow version 2 real list', { buttonsMode: 'showFiturListMultiple', messageVersion: 2, paramsOptions: { buttonIndex: 0, offer: false } })],
    ['AM-55 viewOnce carousel show fitur no sheet', viewOnce(oneCard('55', 'viewOnce carousel show fitur no sheet', { buttonsMode: 'showFiturList', params: false }), 'am55')],
    ['AM-56 viewOnceV2 carousel show fitur sheet', viewOnceV2(oneCard('56', 'viewOnceV2 carousel show fitur sheet', { buttonsMode: 'showFiturListMultiple', paramsOptions: { buttonIndex: 0, offer: false } }), 'am56')],
    ['AM-57 viewOnceV2Extension show fitur sheet', viewOnceV2Extension(oneCard('57', 'viewOnceV2Extension show fitur sheet', { buttonsMode: 'showFiturListMultiple', paramsOptions: { buttonIndex: 0, offer: false } }), 'am57')],
    ['AM-58 deviceSent show fitur no sheet', deviceSent(oneCard('58', 'deviceSent show fitur no sheet', { buttonsMode: 'showFiturList', params: false }), targetJid, 'am58')],
    ['AM-59 deviceSent viewOnce show fitur sheet', deviceSentViewOnce(oneCard('59', 'deviceSent viewOnce show fitur sheet', { buttonsMode: 'showFiturListMultiple', paramsOptions: { buttonIndex: 0, offer: false } }), targetJid, 'am59')],
    ['AM-60 future botInvoke show fitur sheet', asFutureField(oneCard('60', 'future botInvoke show fitur sheet', { buttonsMode: 'showFiturListMultiple', paramsOptions: { buttonIndex: 0, offer: false } }), 'botInvokeMessage')],
    ['AM-61 legacy BM show fitur list', buttonsMessageVariant('AM-61 legacy BM show fitur list', 'am61')],
    ['AM-62 legacy BM numeric type4', buttonsMessageVariant('AM-62 legacy BM numeric type4', 'am62', { numericType: true })],
    ['AM-63 legacy BM multiple payload', buttonsMessageVariant('AM-63 legacy BM multiple payload', 'am63', { multiple: true })],
    ['AM-64 legacy BM string multiple', buttonsMessageVariant('AM-64 legacy BM string multiple', 'am64', { stringMultiple: true })],
    ['AM-65 legacy BM buttonParamsJson duplicate', buttonsMessageVariant('AM-65 legacy BM buttonParamsJson duplicate', 'am65', { buttonParamsJson: true })],
    ['AM-66 legacy BM response first', buttonsMessageVariant('AM-66 legacy BM response first', 'am66', {
      buttons: [
        legacyResponseButton('am66', 'ALL MENU'),
        legacyNativeButton('am66', { numericType: true }),
        legacyResponseButton('am66', 'OWNER'),
      ],
    })],
    ['AM-67 legacy BM two native', buttonsMessageVariant('AM-67 legacy BM two native', 'am67', {
      buttons: [
        legacyNativeButton('am67a', { buttonText: 'Show Fitur' }),
        legacyNativeButton('am67b', { buttonText: 'Categorias', payload: nativeList('am67b', { title: 'Categorias', buttonText: 'Categorias', sectionMode: 'many' }) }),
      ],
    })],
    ['AM-68 viewOnce legacy BM', viewOnce(buttonsMessageVariant('AM-68 viewOnce legacy BM', 'am68', { numericType: true }), 'am68')],
    ['AM-69 template carousel show fitur no sheet', templateMessage(oneCard('69', 'template carousel show fitur no sheet', { buttonsMode: 'showFiturList', params: false }), 'am69')],
    ['AM-70 viewOnce template carousel show fitur', viewOnce(templateMessage(oneCard('70', 'viewOnce template carousel show fitur', { buttonsMode: 'showFiturList', params: false }), 'am70'), 'am70')],
    ['AM-71 listMessage root show fitur', listMessage('AM-71 listMessage root show fitur', 'am71')],
    ['AM-72 viewOnce listMessage show fitur', viewOnce(listMessage('AM-72 viewOnce listMessage show fitur', 'am72'), 'am72')],
    ['AM-73 direct show fitur no sheet', asContent(card('73', 'direct show fitur no sheet', { buttonsMode: 'showFiturList', params: false }))],
    ['AM-74 direct viewOnce show fitur no sheet', viewOnce(asContent(card('74', 'direct viewOnce show fitur no sheet', { buttonsMode: 'showFiturList', params: false })), 'am74')],
    ['AM-75 direct viewOnceV2 show fitur no sheet', viewOnceV2(asContent(card('75', 'direct viewOnceV2 show fitur no sheet', { buttonsMode: 'showFiturList', params: false })), 'am75')],
    ['AM-76 direct deviceSent show fitur no sheet', deviceSent(asContent(card('76', 'direct deviceSent show fitur no sheet', { buttonsMode: 'showFiturList', params: false })), targetJid, 'am76')],
    ['AM-77 carousel cardType 2 no sheet', oneCard('77', 'carousel cardType 2 no sheet', { buttonsMode: 'showFiturList', params: false }, { cardType: 2 })],
    ['AM-78 carousel cardType 2 sheet', oneCard('78', 'carousel cardType 2 sheet', { buttonsMode: 'showFiturListMultiple', paramsOptions: { buttonIndex: 0, offer: false } }, { cardType: 2 })],
    ['AM-79 R10 clone menu 5 rows', menuCarousel(media, '79', 'R10 clone menu 5 rows', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' })],
    ['AM-80 R10 clone show fitur 5 rows', menuCarousel(media, '80', 'R10 clone show fitur 5 rows', { title: 'Show Fitur', buttonText: 'Show Fitur', displayText: 'Show Fitur', count: 5, sectionTitle: 'Lista Show Fitur' })],
    ['AM-81 one section 10 comandos', menuCarousel(media, '81', 'one section 10 comandos', { count: 10, sectionTitle: 'Comandos' })],
    ['AM-82 one section 20 comandos', menuCarousel(media, '82', 'one section 20 comandos', { count: 20, sectionTitle: 'Comandos' })],
    ['AM-83 split sections clean', menuCarousel(media, '83', 'split sections clean', { count: 10, split: true, highlight: false })],
    ['AM-84 title only rows', menuCarousel(media, '84', 'title only rows', { count: 8, rowMode: 'titleOnly', sectionTitle: 'Comandos' })],
    ['AM-85 rows with header', menuCarousel(media, '85', 'rows with header', { count: 8, rowMode: 'withHeader', sectionTitle: 'Comandos' })],
    ['AM-86 rowId only rows', menuCarousel(media, '86', 'rowId only rows', { count: 8, rowMode: 'rowIdOnly', sectionTitle: 'Comandos' })],
    ['AM-87 exact yts style direct viewOnce', viewOnce(asContent(menuInteractive(media, 'AM-87 exact yts style direct viewOnce', 'am87', { title: 'CLICK HERE', buttonText: false, displayText: false, count: 8, sectionTitle: '', footer: 'NanoBotzID' })), 'am87')],
    ['AM-88 carousel only list button', menuCarousel(media, '88', 'carousel only list button', { count: 8, onlyList: true, sectionTitle: 'Comandos' })],
    ['AM-89 carousel list quick before', menuCarousel(media, '89', 'carousel list quick before', { count: 8, quickBefore: true, sectionTitle: 'Comandos' })],
    ['AM-90 carousel list copy before', menuCarousel(media, '90', 'carousel list copy before', { count: 8, copyBefore: true, sectionTitle: 'Comandos' })],
    ['AM-91 carousel many quick commands', menuCarousel(media, '91', 'carousel many quick commands', { count: 8, manyQuick: true, sectionTitle: 'Comandos' })],
    ['AM-92 no footer menu list', menuCarousel(media, '92', 'no footer menu list', { count: 8, footer: false, sectionTitle: 'Comandos' })],
    ['AM-93 no body menu list', menuCarousel(media, '93', 'no body menu list', { count: 8, body: false, sectionTitle: 'Comandos' })],
    ['AM-94 no media header menu list', menuCarousel(media, '94', 'no media header menu list', { count: 8, header: 'text', sectionTitle: 'Comandos' })],
    ['AM-95 no card header menu list', menuCarousel(media, '95', 'no card header menu list', { count: 8, header: 'none', sectionTitle: 'Comandos' })],
    ['AM-96 listType menu fields', menuCarousel(media, '96', 'listType menu fields', { count: 8, listType: true, sectionTitle: 'Comandos' })],
    ['AM-97 viewOnce R10 clone menu', viewOnce(menuCarousel(media, '97', 'viewOnce R10 clone menu', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }), 'am97')],
    ['AM-98 viewOnceV2 R10 clone menu', viewOnceV2(menuCarousel(media, '98', 'viewOnceV2 R10 clone menu', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }), 'am98')],
    ['AM-99 ephemeral R10 clone menu', ephemeral(menuCarousel(media, '99', 'ephemeral R10 clone menu', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }), 'am99')],
    ['AM-100 deviceSent R10 clone menu', deviceSent(menuCarousel(media, '100', 'deviceSent R10 clone menu', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }), targetJid, 'am100')],
    ['AM-101 future documentWithCaption R10', asFutureField(menuCarousel(media, '101', 'future documentWithCaption R10', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }), 'documentWithCaptionMessage')],
    ['AM-102 future botInvoke R10', asFutureField(menuCarousel(media, '102', 'future botInvoke R10', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }), 'botInvokeMessage')],
    ['AM-103 template R10 clone menu', templateMessage(menuCarousel(media, '103', 'template R10 clone menu', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }), 'am103')],
    ['AM-104 viewOnce template R10 clone', viewOnce(templateMessage(menuCarousel(media, '104', 'viewOnce template R10 clone', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }), 'am104'), 'am104')],
    ['AM-105 carousel version 2 R10 clone', menuCarousel(media, '105', 'carousel version 2 R10 clone', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }, { messageVersion: 2 })],
    ['AM-106 carousel cardType 0 R10 clone', menuCarousel(media, '106', 'carousel cardType 0 R10 clone', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }, { cardType: 0 })],
    ['AM-107 outer headerless R10 clone', menuCarousel(media, '107', 'outer headerless R10 clone', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }, { outerHeader: false })],
    ['AM-108 outer body text R10 clone', menuCarousel(media, '108', 'outer body text R10 clone', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }, { outerText: 'AM-108 outer body text R10 clone' })],
    ['AM-109 direct R10 clone menu', asContent(menuInteractive(media, 'AM-109 direct R10 clone menu', 'am109', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' }))],
    ['AM-110 direct viewOnce R10 clone', viewOnce(asContent(menuInteractive(media, 'AM-110 direct viewOnce R10 clone', 'am110', { title: 'ABRIR LISTA', buttonText: 'ABRIR LISTA', displayText: 'ABRIR LISTA', count: 5, sectionTitle: 'Lista R10 menu' })), 'am110')],
    ['AM-111 direct yts no media header', viewOnce(asContent(menuInteractive(media, 'AM-111 direct yts no media header', 'am111', { title: 'CLICK HERE', buttonText: false, displayText: false, count: 8, sectionTitle: '', header: 'text', footer: 'NanoBotzID' })), 'am111')],
    ['AM-112 direct yts only list', viewOnce(asContent(menuInteractive(media, 'AM-112 direct yts only list', 'am112', { title: 'CLICK HERE', buttonText: false, displayText: false, count: 8, sectionTitle: '', onlyList: true, footer: 'NanoBotzID' })), 'am112')],
    ['AM-113 sheet exact public clone direct', sheetContent(media, '113', 'sheet exact public clone direct')],
    ['AM-114 sheet exact public clone carousel', sheetCarousel(media, '114', 'sheet exact public clone carousel')],
    ['AM-115 sheet viewOnce direct exact', viewOnce(sheetContent(media, '115', 'sheet viewOnce direct exact'), 'am115')],
    ['AM-116 sheet viewOnce carousel exact', viewOnce(sheetCarousel(media, '116', 'sheet viewOnce carousel exact'), 'am116')],
    ['AM-117 sheet button index 3', sheetCarousel(media, '117', 'sheet button index 3', { mode: 'buttonIndex3', params: { buttonIndex: 3 } })],
    ['AM-118 sheet button index 4 copy', sheetCarousel(media, '118', 'sheet button index 4 copy', { params: { buttonIndex: 4 } })],
    ['AM-119 sheet button index 5 quick', sheetCarousel(media, '119', 'sheet button index 5 quick', { params: { buttonIndex: 5 } })],
    ['AM-120 sheet labeled dummy trigger', sheetCarousel(media, '120', 'sheet labeled dummy trigger', { mode: 'labeledDummy', params: { buttonIndex: 0 } })],
    ['AM-121 sheet list first trigger', sheetCarousel(media, '121', 'sheet list first trigger', { mode: 'listFirst', params: { buttonIndex: 0 } })],
    ['AM-122 sheet copy before list', sheetCarousel(media, '122', 'sheet copy before list', { mode: 'copyBeforeList', params: { buttonIndex: 0 } })],
    ['AM-123 sheet quick before list', sheetCarousel(media, '123', 'sheet quick before list', { mode: 'quickBeforeList', params: { buttonIndex: 0 } })],
    ['AM-124 sheet no permission', sheetCarousel(media, '124', 'sheet no permission', { mode: 'noPermission', params: { buttonIndex: 0 } })],
    ['AM-125 sheet no dummy', sheetCarousel(media, '125', 'sheet no dummy', { mode: 'noDummy', params: { buttonIndex: 0 } })],
    ['AM-126 sheet copy only visible list last', sheetCarousel(media, '126', 'sheet copy only visible list last', { mode: 'copyOnlyVisible', params: { buttonIndex: 0 } })],
    ['AM-127 sheet list without multiple flag', sheetCarousel(media, '127', 'sheet list without multiple flag', { mode: 'listNoMultiple', params: { buttonIndex: 0 } })],
    ['AM-128 sheet many internal actions', sheetCarousel(media, '128', 'sheet many internal actions', { mode: 'manyActions', params: { buttonIndex: 0, limit: 3 } })],
    ['AM-129 sheet two internal lists', sheetCarousel(media, '129', 'sheet two internal lists', { mode: 'twoLists', params: { buttonIndex: 0, limit: 4 } })],
    ['AM-130 sheet no offer exact', sheetCarousel(media, '130', 'sheet no offer exact', { params: { noOffer: true, buttonIndex: 0 } })],
    ['AM-131 sheet no tap target', sheetCarousel(media, '131', 'sheet no tap target', { params: { noTap: true } })],
    ['AM-132 sheet no dividers', sheetCarousel(media, '132', 'sheet no dividers', { params: { noDividers: true, buttonIndex: 0 } })],
    ['AM-133 sheet limit 1 exact', sheetCarousel(media, '133', 'sheet limit 1 exact', { params: { limit: 1, buttonIndex: 0 } })],
    ['AM-134 sheet limit 8 exact', sheetCarousel(media, '134', 'sheet limit 8 exact', { params: { limit: 8, buttonIndex: 0 } })],
    ['AM-135 sheet no media header', sheetCarousel(media, '135', 'sheet no media header', { header: 'text', params: { buttonIndex: 0 } })],
    ['AM-136 sheet direct sendMessage exact', sendMessageSheet(media, '136', 'sheet direct sendMessage exact')],
    ['AM-137 sheet viewOnceV2 exact', viewOnceV2(sheetCarousel(media, '137', 'sheet viewOnceV2 exact'), 'am137')],
    ['AM-138 sheet viewOnceV2Extension exact', viewOnceV2Extension(sheetCarousel(media, '138', 'sheet viewOnceV2Extension exact'), 'am138')],
    ['AM-139 sheet ephemeral exact', ephemeral(sheetCarousel(media, '139', 'sheet ephemeral exact'), 'am139')],
    ['AM-140 sheet deviceSent exact', deviceSentRaw(sheetCarousel(media, '140', 'sheet deviceSent exact'), targetJid, 'am140')],
    ['AM-141 sheet deviceSent no phash', deviceSentRaw(sheetCarousel(media, '141', 'sheet deviceSent no phash'), targetJid, 'am141', { phash: false })],
    ['AM-142 sheet deviceSent no destination', deviceSentRaw(sheetCarousel(media, '142', 'sheet deviceSent no destination'), targetJid, 'am142', { destination: false })],
    ['AM-143 sheet future documentWithCaption', asFutureField(sheetCarousel(media, '143', 'sheet future documentWithCaption'), 'documentWithCaptionMessage')],
    ['AM-144 sheet future botInvoke', asFutureField(sheetCarousel(media, '144', 'sheet future botInvoke'), 'botInvokeMessage')],
    ['AM-145 sheet direct root messageContext', withMessageContext(sheetContent(media, '145', 'sheet direct root messageContext'), 'am145')],
    ['AM-146 sheet carousel root messageContext', withMessageContext(sheetCarousel(media, '146', 'sheet carousel root messageContext'), 'am146')],
    ['AM-147 sheet forwarded newsletter context', sheetCarousel(media, '147', 'sheet forwarded newsletter context', { contextInfo: forwardedSheetContext() })],
    ['AM-148 sheet externalAd context', sheetCarousel(media, '148', 'sheet externalAd context', { contextInfo: externalSheetContext() })],
    ['AM-149 sheet tap whatsapp domain', sheetCarousel(media, '149', 'sheet tap whatsapp domain', { params: { buttonIndex: 0, domain: 'whatsapp.com', canonicalUrl: 'https://whatsapp.com/channel/0029Va' } })],
    ['AM-150 sheet tap wa me domain', sheetCarousel(media, '150', 'sheet tap wa me domain', { params: { buttonIndex: 0, domain: 'wa.me', canonicalUrl: 'https://wa.me/559293337205' } })],
    ['AM-151 sheet tap business facebook', sheetCarousel(media, '151', 'sheet tap business facebook', { params: { buttonIndex: 0, domain: 'business.facebook.com', canonicalUrl: 'https://business.facebook.com' } })],
    ['AM-152 sheet no canonical tap', sheetCarousel(media, '152', 'sheet no canonical tap', { params: { buttonIndex: 0, tapExtra: { canonical_url: '', domain: '' } } })],
    ['AM-153 sheet button title abrir menu', sheetCarousel(media, '153', 'sheet button title abrir menu', { params: { buttonIndex: 0, buttonTitle: 'ABRIR MENU', listTitle: 'Menu do bot' } })],
    ['AM-154 sheet button title unicode', sheetCarousel(media, '154', 'sheet button title unicode', { params: { buttonIndex: 0, buttonTitle: '𝐒𝐡𝐨𝐰 𝐅𝐢𝐭𝐮𝐫', listTitle: 'NanoBotzID Command Center' } })],
    ['AM-155 sheet extra button type', sheetCarousel(media, '155', 'sheet extra button type', { params: { buttonIndex: 0, sheetExtra: { button_type: 'BOTTOM_SHEET_BTN', action_type: 'BOTTOM_SHEET' } } })],
    ['AM-156 sheet extra smb quick reply', sheetCarousel(media, '156', 'sheet extra smb quick reply', { params: { buttonIndex: 0, sheetExtra: { entry_point: 'SMB_QUICK_REPLY_LIST', button_type: 1 } } })],
    ['AM-157 sheet params has multiple root', sheetCarousel(media, '157', 'sheet params has multiple root', { params: { buttonIndex: 0, extra: { has_multiple_buttons: true } } })],
    ['AM-158 sheet params action payload', sheetCarousel(media, '158', 'sheet params action payload', { params: { buttonIndex: 0, extra: { action: { name: 'open_bottom_sheet', button: 'Show Fitur' } } } })],
    ['AM-159 anchor no permission sheet', oneCard('159', 'anchor no permission sheet', { buttonsMode: 'noPermission' })],
    ['AM-160 anchor two lists sheet', oneCard('160', 'anchor two lists sheet', { buttonsMode: 'twoLists', limit: 4 })],
    ['AM-161 two lists no offer', oneCard('161', 'two lists no offer', { buttonsMode: 'twoLists', limit: 4, paramsOptions: { offer: false, buttonIndex: 0 } })],
    ['AM-162 two lists tap index 1', oneCard('162', 'two lists tap index 1', { buttonsMode: 'twoLists', limit: 4, paramsOptions: { offer: false, buttonIndex: 1 } })],
    ['AM-163 two lists tap index string 0', oneCard('163', 'two lists tap index string 0', { buttonsMode: 'twoLists', limit: 4, paramsOptions: { offer: false, buttonIndex: '0' } })],
    ['AM-164 two lists no tap target', oneCard('164', 'two lists no tap target', { buttonsMode: 'twoLists', limit: 4, paramsOptions: { offer: false, tap: false } })],
    ['AM-165 two lists camel tap index', oneCard('165', 'two lists camel tap index', { buttonsMode: 'twoLists', limit: 4, paramsOptions: { offer: false, buttonIndex: 0, camelButtonIndex: 0 } })],
    ['AM-166 two lists bottom nested buttons', oneCard('166', 'two lists bottom nested buttons', { buttonsMode: 'twoLists', limit: 4, paramsOptions: { offer: false, buttonIndex: 0, bottomSheetNestedButtons: true } })],
    ['AM-167 two lists bottom sections', oneCard('167', 'two lists bottom sections', { buttonsMode: 'twoLists', limit: 4, paramsOptions: { offer: false, buttonIndex: 0, bottomSheetSections: true } })],
    ['AM-168 two lists bottom action', oneCard('168', 'two lists bottom action', { buttonsMode: 'twoLists', limit: 4, paramsOptions: { offer: false, buttonIndex: 0, bottomSheetAction: true } })],
    ['AM-169 two lists bottom native flow', oneCard('169', 'two lists bottom native flow', { buttonsMode: 'twoLists', limit: 4, paramsOptions: { offer: false, buttonIndex: 0, bottomSheetNativeFlow: true } })],
    ['AM-170 two lists with dummy trigger', oneCard('170', 'two lists with dummy trigger', { buttonsMode: 'twoListsWithDummy', limit: 4, paramsOptions: { offer: false, buttonIndex: 0 } })],
    ['AM-171 two lists labeled dummy', oneCard('171', 'two lists labeled dummy', { buttonsMode: 'twoListsWithLabeledDummy', limit: 4, paramsOptions: { offer: false, buttonIndex: 0 } })],
    ['AM-172 two lists with permission', oneCard('172', 'two lists with permission', { buttonsMode: 'twoListsWithPermission', limit: 4, paramsOptions: { offer: false, buttonIndex: 0 } })],
    ['AM-173 quick trigger two lists', oneCard('173', 'quick trigger two lists', { buttonsMode: 'quickTriggerTwoLists', limit: 4, paramsOptions: { offer: false, buttonIndex: 0 } })],
    ['AM-174 copy trigger two lists', oneCard('174', 'copy trigger two lists', { buttonsMode: 'copyTriggerTwoLists', limit: 4, paramsOptions: { offer: false, buttonIndex: 0 } })],
    ['AM-175 two lists two copies', oneCard('175', 'two lists two copies', { buttonsMode: 'twoListsCopies', limit: 4, paramsOptions: { offer: false, buttonIndex: 0 } })],
    ['AM-176 two lists url', oneCard('176', 'two lists url', { buttonsMode: 'twoListsUrl', limit: 4, paramsOptions: { offer: false, buttonIndex: 0 } })],
    ['AM-177 actions only sheet', oneCard('177', 'actions only sheet', { buttonsMode: 'actionsOnlySheet', limit: 4, paramsOptions: { offer: false, buttonIndex: 0 } })],
    ['AM-178 single list all actions version 1', oneCard('178', 'single list all actions version 1', { buttonsMode: 'singleListAllActions', messageVersion: 1, limit: 4, paramsOptions: { offer: false, buttonIndex: 0 } })],
    ['AM-179 show fitur copy only limit 0', oneCard('179', 'show fitur copy only limit 0', { buttonsMode: 'showFiturCopyOnly', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [] } })],
    ['AM-180 show fitur copy only limit 1', oneCard('180', 'show fitur copy only limit 1', { buttonsMode: 'showFiturCopyOnly', limit: 1, paramsOptions: { offer: false, tap: false, dividers: [] } })],
    ['AM-181 show fitur copy only limit 2', oneCard('181', 'show fitur copy only limit 2', { buttonsMode: 'showFiturCopyOnly', limit: 2, paramsOptions: { offer: false, tap: false, dividers: [] } })],
    ['AM-182 show fitur copy only tap index', oneCard('182', 'show fitur copy only tap index', { buttonsMode: 'showFiturCopyOnly', limit: 1, paramsOptions: { offer: false, buttonIndex: 0, dividers: [] } })],
    ['AM-183 show fitur copy dummy limit 1', oneCard('183', 'show fitur copy dummy limit 1', { buttonsMode: 'showFiturCopyOnlyDummy', limit: 1, paramsOptions: { offer: false, buttonIndex: 0, dividers: [] } })],
    ['AM-184 show fitur reply only limit 0', oneCard('184', 'show fitur reply only limit 0', { buttonsMode: 'showFiturReplyOnly', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [] } })],
    ['AM-185 show fitur reply only limit 1', oneCard('185', 'show fitur reply only limit 1', { buttonsMode: 'showFiturReplyOnly', limit: 1, paramsOptions: { offer: false, tap: false, dividers: [] } })],
    ['AM-186 show fitur reply only limit 2', oneCard('186', 'show fitur reply only limit 2', { buttonsMode: 'showFiturReplyOnly', limit: 2, paramsOptions: { offer: false, tap: false, dividers: [] } })],
    ['AM-187 show fitur reply only tap index', oneCard('187', 'show fitur reply only tap index', { buttonsMode: 'showFiturReplyOnly', limit: 1, paramsOptions: { offer: false, buttonIndex: 0, dividers: [] } })],
    ['AM-188 show fitur reply dummy limit 1', oneCard('188', 'show fitur reply dummy limit 1', { buttonsMode: 'showFiturReplyOnlyDummy', limit: 1, paramsOptions: { offer: false, buttonIndex: 0, dividers: [] } })],
    ['AM-189 show fitur list only limit 0', oneCard('189', 'show fitur list only limit 0', { buttonsMode: 'showFiturListOnly', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [] } })],
    ['AM-190 show fitur list only limit 1', oneCard('190', 'show fitur list only limit 1', { buttonsMode: 'showFiturListOnly', limit: 1, paramsOptions: { offer: false, tap: false, dividers: [] } })],
    ['AM-191 show fitur list plain limit 0', oneCard('191', 'show fitur list plain limit 0', { buttonsMode: 'showFiturListOnlyPlain', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [] } })],
    ['AM-192 show fitur list no multiple', oneCard('192', 'show fitur list no multiple', { buttonsMode: 'showFiturListOnlyNoMultiple', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [] } })],
    ['AM-193 show fitur list inside mix', oneCard('193', 'show fitur list inside mix', { buttonsMode: 'showFiturListInsideMix', limit: 1, paramsOptions: { offer: false, buttonIndex: 0, dividers: [] } })],
    ['AM-194 proto copy trigger no tap', oneCard('194', 'proto copy trigger no tap', { buttonsMode: 'protoCopyOnly', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-195 proto reply trigger no tap', oneCard('195', 'proto reply trigger no tap', { buttonsMode: 'protoReplyOnly', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-196 proto list trigger no tap', oneCard('196', 'proto list trigger no tap', { buttonsMode: 'protoListOnly', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-197 proto copy all labels tap', oneCard('197', 'proto copy all labels tap', { buttonsMode: 'protoCopyOnly', limit: 0, paramsOptions: { offer: false, buttonIndex: 0, dividers: [], labelEverywhere: true, tapLabelEverywhere: true } })],
    ['AM-198 proto reply all labels tap', oneCard('198', 'proto reply all labels tap', { buttonsMode: 'protoReplyOnly', limit: 0, paramsOptions: { offer: false, buttonIndex: 0, dividers: [], labelEverywhere: true, tapLabelEverywhere: true } })],
    ['AM-199 proto list all labels tap', oneCard('199', 'proto list all labels tap', { buttonsMode: 'protoListOnly', limit: 0, paramsOptions: { offer: false, buttonIndex: 0, dividers: [], labelEverywhere: true, tapLabelEverywhere: true } })],
    ['AM-200 proto copy body show fitur', oneCard('200', 'proto copy body show fitur', { buttonsMode: 'protoCopyOnly', bodyText: 'Show Fitur', footer: false, limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-201 proto reply body show fitur', oneCard('201', 'proto reply body show fitur', { buttonsMode: 'protoReplyOnly', bodyText: 'Show Fitur', footer: false, limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-202 proto list body show fitur', oneCard('202', 'proto list body show fitur', { buttonsMode: 'protoListOnly', bodyText: 'Show Fitur', footer: false, limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-203 proto copy message version 0', oneCard('203', 'proto copy message version 0', { buttonsMode: 'protoCopyOnly', messageVersion: 0, limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-204 proto reply message version 1', oneCard('204', 'proto reply message version 1', { buttonsMode: 'protoReplyOnly', messageVersion: 1, limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-205 proto list message version 2', oneCard('205', 'proto list message version 2', { buttonsMode: 'protoListOnly', messageVersion: 2, limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-206 proto copy no multiple', oneCard('206', 'proto copy no multiple', { buttonsMode: 'protoCopyNoMultiple', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-207 proto reply no multiple', oneCard('207', 'proto reply no multiple', { buttonsMode: 'protoReplyNoMultiple', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-208 proto list no multiple', oneCard('208', 'proto list no multiple', { buttonsMode: 'protoListNoMultiple', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-209 proto copy string multiple', oneCard('209', 'proto copy string multiple', { buttonsMode: 'protoCopyStringMultiple', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-210 proto reply button text object', oneCard('210', 'proto reply button text object', { buttonsMode: 'protoReplyButtonTextObject', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-211 proto list action navigate', oneCard('211', 'proto list action navigate', { buttonsMode: 'protoListActionNavigate', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-212 proto copy sheet extra', oneCard('212', 'proto copy sheet extra', { buttonsMode: 'protoCopySheetExtra', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true, sheetExtra: { sheet_action: 'open', open: true } } })],
    ['AM-213 proto reply sheet extra', oneCard('213', 'proto reply sheet extra', { buttonsMode: 'protoReplySheetExtra', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true, sheetExtra: { sheet_action: 'open', open: true } } })],
    ['AM-214 proto list sheet extra', oneCard('214', 'proto list sheet extra', { buttonsMode: 'protoListSheetExtra', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true, sheetExtra: { sheet_action: 'open', open: true } } })],
    ['AM-215 proto copy text header', oneCard('215', 'proto copy text header', { buttonsMode: 'protoCopyOnly', header: 'text', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-216 proto reply no header', oneCard('216', 'proto reply no header', { buttonsMode: 'protoReplyOnly', header: 'none', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-217 proto list no subtitle', oneCard('217', 'proto list no subtitle', { buttonsMode: 'protoListOnly', header: 'noSubtitle', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true } })],
    ['AM-218 proto list params include list', oneCard('218', 'proto list params include list', { buttonsMode: 'protoListOnly', limit: 0, paramsOptions: { offer: false, tap: false, dividers: [], labelEverywhere: true, includeList: true, includeListMultiple: true } })],
  ];

  const selected = cases.filter(([label]) => {
    const n = caseNumber(label);
    return n >= startCase && n <= endCase;
  });

  log('selecionados', `${selected.length}/${cases.length}`);

  for (const [label, content] of selected) {
    log('enviando', label);
    try {
      if (typeof content === 'function') {
        await content(sock, targetJid);
      } else {
        await relay(sock, targetJid, content);
      }
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
  console.error('[send-allmenu-list-buttons-matrix] erro fatal:', err?.stack || err);
  process.exit(1);
});
