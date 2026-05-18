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

## Documentacao tecnica

Para migrar isso para outra lib ou entender o proto sem depender do bot original, veja:

[docs/PROTO-E-MIGRACAO.md](docs/PROTO-E-MIGRACAO.md)

Esse documento explica:

- arvore completa do `interactiveMessage.carouselMessage`
- formato do `single_select`, `quick_reply`, `cta_copy` e `cta_url`
- motivo da mensagem aparecer em duas partes
- mapa de Baileys para uma lib com proto/raw message
- resultados de capacidade testados
- o que evitar ao tentar funcionar em Android e iPhone

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

Enviar matriz focada em renderizacao de listas:

```bash
npm run send:list-matrix -- 120363406245712972@g.us
```

Argumentos aceitos pelos scripts:

```bash
node scripts/send-winner-clean.js <jid-ou-numero> [sessionDir] [thumbPath] [outerMode]
```

`outerMode` pode ser `none` para `CLEAN-02` ou `headerless` para `CLEAN-03`.

## Observacao sobre duas listas

O envio com dois `single_select` no mesmo card pode retornar OK, mas alguns clientes podem renderizar apenas os outros botoes, como `quick_reply` e `cta_copy`.

Para duas listas, os formatos mais seguros para continuar testando sao:

- uma unica `single_select` com multiplas secoes
- duas listas em cards separados no carousel

O script `send:list-matrix` testa exatamente esses cenarios.

## Observacao sobre a parte de cima no grupo

No Android validado via ADB, mesmo mensagens `headerless` aparecem com uma faixa superior com o nome do remetente do grupo e horario.

Isso e do proprio WhatsApp em mensagens recebidas no grupo. O proto remove o texto externo duplicado do carousel, mas nao remove o cabecalho visual do participante.

## Importante antes de subir para o GitHub

Nao envie:

- `session/`
- `node_modules/`
- `.env`
- logs

Esses itens ja estao no `.gitignore`.
