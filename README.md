# WhatsApp Carousel List Buttons

Projeto separado somente para preservar os scripts de envio de listas, botoes e carousels testados no WhatsApp com Baileys.

Este pacote foi extraido do `nanobot` sem levar o bot inteiro, comandos, banco, sessoes ou `node_modules`.

## Formato vencedor

O formato que funcionou no Android e no iPhone foi:

- `interactiveMessage.carouselMessage`
- 1 card no carousel
- `carouselCardType: HSCROLL_CARDS`
- midia dentro do header do card
- botoes no `nativeFlowMessage.buttons` do card
- combinacao testada: `single_select` + `quick_reply` + `cta_copy`
- sem `body/footer` externo no carousel (`CLEAN-02`) ou sem `body/footer/header` externo (`CLEAN-03`)

Esse ajuste remove aquela "segunda parte" que aparecia antes da mensagem, porque o texto extra vinha do `body/footer` externo do carousel.

## Resultado dos testes

Passaram nos testes manuais:

- `R10-18`: card select + quick + copy
- `CLEAN-02`: carousel sem body/footer externo
- `CLEAN-03`: carousel sem body/footer/header externo
- listas com 5, 10, 15, 20, 30 e 50 itens
- lista em uma secao e em multiplas secoes
- card com 4, 5, 6, 8 e 10 botoes nativos
- dois botoes `single_select` no mesmo card

## Como usar

Instale as dependencias:

```bash
npm install
```

Coloque uma sessao Baileys em `./session` ou deixe o script abrir QR no terminal. A pasta `session/` fica fora do Git de proposito.

Enviar o formato limpo vencedor:

```bash
npm run send:winner -- 559295296926
```

Enviar para um grupo usando o JID completo:

```bash
npm run send:winner -- 120363406245712972@g.us
```

Enviar a bateria de variantes limpas:

```bash
npm run send:clean -- 559295296926
```

Enviar a bateria de capacidade:

```bash
npm run send:capacity -- 559295296926
```

Argumentos aceitos pelos scripts:

```bash
node scripts/send-winner-clean.js <jid-ou-numero> [sessionDir] [thumbPath] [outerMode]
```

`outerMode` pode ser `none` para `CLEAN-02` ou `headerless` para `CLEAN-03`.

## Importante antes de subir para o GitHub

Nao envie:

- `session/`
- `node_modules/`
- `.env`
- logs

Esses itens ja estao no `.gitignore`.
