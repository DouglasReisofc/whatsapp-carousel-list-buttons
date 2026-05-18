# Proto e Migracao

Este arquivo existe para que o formato vencedor possa ser entendido fora do bot original e migrado para outra lib depois.

O ponto principal: nao e uma lista comum. O formato que passou no Android e no iPhone e uma `interactiveMessage` com `carouselMessage`, contendo 1 card, e os botoes ficam dentro do `nativeFlowMessage` do card.

## Resumo do vencedor

Nome interno usado nos testes: `R10-18`, depois limpo como `CLEAN-02` e `CLEAN-03`.

Funcionou:

- Android: sim
- iPhone: sim
- PV: sim
- grupo: sim
- com imagem no card: sim
- com lista `single_select`: sim
- com `quick_reply`: sim
- com `cta_copy`: sim

Estrutura vencedora:

```txt
message
└─ interactiveMessage
   ├─ header opcional, sem midia
   └─ carouselMessage
      ├─ messageVersion: 1
      ├─ carouselCardType: HSCROLL_CARDS ou 1
      └─ cards[0]
         ├─ body.text
         ├─ footer.text
         ├─ header
         │  ├─ hasMediaAttachment: true
         │  └─ imageMessage enviada/preparada pela lib
         └─ nativeFlowMessage
            └─ buttons[]
               ├─ single_select
               ├─ quick_reply
               └─ cta_copy
```

## Por que aparecia em duas partes

Quando o `interactiveMessage` externo do carousel tinha `body` e `footer`, alguns clientes renderizavam isso como um bloco acima do card.

Exemplo do problema:

```txt
interactiveMessage.body.text = "R10-18 PV - carousel..."
interactiveMessage.footer.text = "Teste no iPhone"
carouselMessage.cards[0].body.text = "PV teste vencedor card A"
```

Isso aparecia visualmente como uma parte de texto em cima e o card abaixo.

Solucao que funcionou:

- `CLEAN-02`: nao enviar `body` nem `footer` no `interactiveMessage` externo.
- `CLEAN-03`: tambem remover o `header` externo.
- Manter `body`, `footer`, `header com midia` e botoes dentro do card.

Na pratica, use `outer: "none"` como padrao.

## Payload generico do formato limpo

Este e o formato conceitual, independente do Baileys:

```js
{
  interactiveMessage: {
    header: {
      title: "",
      hasMediaAttachment: false
    },
    carouselMessage: {
      messageVersion: 1,
      carouselCardType: 1,
      cards: [
        {
          body: {
            text: "R10-18 clean card A"
          },
          footer: {
            text: "select + quick + copy"
          },
          header: {
            title: "",
            subtitle: "R10-18",
            hasMediaAttachment: true,
            imageMessage: "<midia preparada pela lib>"
          },
          nativeFlowMessage: {
            buttons: [
              {
                name: "single_select",
                buttonParamsJson: "{\"title\":\"ABRIR LISTA\",\"button_text\":\"ABRIR LISTA\",\"display_text\":\"ABRIR LISTA\",\"sections\":[...]}"
              },
              {
                name: "quick_reply",
                buttonParamsJson: "{\"display_text\":\"QUICK\",\"id\":\".winner_quick\"}"
              },
              {
                name: "cta_copy",
                buttonParamsJson: "{\"display_text\":\"COPIAR\",\"id\":\"copy_R10-18-CLEAN\",\"copy_code\":\"R10-18-CLEAN\"}"
              }
            ]
          }
        }
      ]
    }
  }
}
```

Observacoes importantes:

- `buttonParamsJson` e string JSON, nao objeto.
- `carouselCardType` pode aparecer na lib como enum `HSCROLL_CARDS`; quando nao existir, usamos `1`.
- A midia precisa ser preparada/uploadada pela lib antes de entrar no header do card.
- A lista fica dentro do botao `single_select`, nao como `listMessage` raiz.

## Formato dos botoes nativos

### single_select

```js
{
  name: "single_select",
  buttonParamsJson: JSON.stringify({
    title: "ABRIR LISTA",
    button_text: "ABRIR LISTA",
    display_text: "ABRIR LISTA",
    sections: [
      {
        title: "Lista R10-18",
        highlight_label: "ok",
        rows: [
          {
            header: "A",
            title: "Opcao A",
            description: "single_select vencedor",
            id: ".winner_a",
            rowId: ".winner_row_a"
          }
        ]
      }
    ]
  })
}
```

Campos testados nas rows:

- `header`
- `title`
- `description`
- `id`
- `rowId`

Para migrar, mantenha `id` e `rowId` enquanto nao souber qual campo a nova lib usa para resposta. Algumas libs preservam os dois, outras usam apenas um.

### quick_reply

```js
{
  name: "quick_reply",
  buttonParamsJson: JSON.stringify({
    display_text: "QUICK",
    id: ".winner_quick"
  })
}
```

### cta_copy

```js
{
  name: "cta_copy",
  buttonParamsJson: JSON.stringify({
    display_text: "COPIAR",
    id: "copy_R10-18-CLEAN",
    copy_code: "R10-18-CLEAN"
  })
}
```

### cta_url

Tambem foi usado nos testes de capacidade:

```js
{
  name: "cta_url",
  buttonParamsJson: JSON.stringify({
    display_text: "URL 1",
    url: "https://whatsapp.com",
    merchant_url: "https://whatsapp.com"
  })
}
```

## Resultado de capacidade testado

A bateria `send-capacity-test.js` enviou com sucesso:

- 5 itens, 3 botoes
- 10 itens, 3 botoes
- 15 itens, 3 botoes
- 20 itens, 3 botoes
- 30 itens, 3 botoes
- 50 itens, 3 botoes
- 30 itens divididos em multiplas secoes
- 50 itens divididos em multiplas secoes
- 4 botoes no card
- 5 botoes no card
- 6 botoes no card
- 8 botoes no card
- 10 botoes no card
- 2 botoes `single_select` no mesmo card

Esse teste confirma envio pela lib e renderizacao reportada pelo usuario, mas nao significa que o WhatsApp documenta oficialmente esses limites.

## Observacao apos o teste no grupo

No print do `CAP-17 duas listas headerless`, o card renderizou a imagem, o texto, o `QUICK` e o `COPIAR`, mas nao mostrou os botoes `single_select`.

Isso e importante porque o envio retornou OK, mas a renderizacao do cliente pode ocultar listas quando existem dois `single_select` no mesmo card.

Hipoteses que precisam ser consideradas ao migrar:

- alguns clientes aceitam somente um `single_select` visivel por card;
- a ordem do `single_select` pode influenciar;
- o limite real pode ser de um botao de lista mais outros botoes simples;
- multiplas secoes dentro de uma unica lista tendem a ser uma alternativa melhor do que duas listas nativas separadas;
- duas listas em cards separados podem ser melhor do que duas listas no mesmo card.

Para investigar isso foi criado:

```bash
npm run send:list-matrix -- 120363406245712972@g.us
```

Essa bateria envia:

- `LR-01`: uma lista + quick + copy
- `LR-02`: somente uma lista
- `LR-03`: uma lista + 6 botoes
- `LR-04`: lista por ultimo
- `LR-05`: lista no meio
- `LR-06`: duas listas somente
- `LR-07`: duas listas + quick + copy
- `LR-08`: uma lista com duas secoes
- `LR-09`: duas listas em cards separados

Se a meta for producao/migracao, prefira primeiro `LR-08` ou `LR-09` quando precisar representar duas listas.

## Validacao ADB da parte de cima

Validacao feita em Android via ADB com WhatsApp Business aberto no grupo `Downloads 24 H`.

Resultado observado: mesmo mensagens `headerless` continuam aparecendo com uma faixa superior contendo o nome do remetente do grupo e horario, por exemplo `Aluka` ou `Niako`.

Isso nao e o `body`, `footer` ou `header` externo do proto. No modo `headerless`, o objeto gerado localmente fica sem `body`, sem `footer` e sem `header` externos:

```txt
OUTER headerless
has body: false null
has footer: false null
has header: false null
has carousel: true cards: 1
```

Conclusao: no grupo, essa parte superior restante e cabecalho visual do proprio WhatsApp para mensagens recebidas em grupo. Ela identifica o participante que enviou a mensagem. O proto consegue remover texto externo duplicado do carousel, mas nao consegue remover o nome do remetente que o cliente mostra no grupo.

Implicacao para migracao:

- `CLEAN-02`/`CLEAN-03` removem a parte extra criada por `interactiveMessage.body/footer` externo.
- Eles nao removem o cabecalho de participante do grupo.
- Para ver a mensagem sem nome de remetente acima, o teste precisa ser em PV ou no proprio aparelho/conta que enviou a mensagem como `fromMe`.

## Como migrar para outra lib

Ao trocar de lib, procure estes recursos:

- enviar mensagem construida por proto/raw content
- criar `InteractiveMessage`
- criar `CarouselMessage`
- enviar/uploadar imagem antes de colocar no header do card
- relatar mensagem com um `messageId` proprio ou gerado pela lib
- suportar `nativeFlowMessage.buttons`

Mapa Baileys para outra lib:

```txt
generateWAMessageFromContent(jid, content, { userJid })
=> montar uma mensagem raw/proto para o jid

relayMessage(jid, msg.message, { messageId })
=> enviar a mensagem raw/proto ja montada

prepareWAMessageMedia({ image }, { upload })
=> fazer upload da imagem e receber imageMessage/proto de midia

proto.Message.InteractiveMessage.create(...)
=> criar objeto/proto InteractiveMessage

proto.Message.InteractiveMessage.CarouselMessage.create(...)
=> criar objeto/proto CarouselMessage

nativeFlowMessage.buttons
=> lista de botoes com name + buttonParamsJson
```

Se a nova lib nao tiver helper para carousel/lista, mas permitir proto bruto, monte a arvore do payload manualmente seguindo este arquivo.

## O que evitar

Evite estes formatos se o objetivo for funcionar nos dois:

- `listMessage` simples como raiz, porque nao foi o formato que passou nos dois clientes.
- `deviceSentMessage`/`viewOnce` como base principal, porque alguns testes apareceram no iPhone mas nao no Android.
- `interactiveMessage.body/footer` externo com texto, porque cria a parte extra acima do card.
- mandar texto separado antes do card quando quiser uma mensagem visualmente unica.

## Arquivos principais

- `scripts/send-winner-clean.js`: envio minimo do vencedor.
- `scripts/send-clean-variants.js`: bateria que compara os modos externos.
- `scripts/send-capacity-test.js`: bateria de limite de itens/botoes.
- `scripts/send-list-render-matrix.js`: bateria focada em quando a lista aparece ou some.
- `lib/interactive.js`: funcoes reutilizaveis que montam o proto.
- `lib/connection.js`: conexao Baileys isolada do bot completo.

## Comandos de validacao

```bash
npm run check
npm run send:winner -- 559295296926
npm run send:clean -- 559295296926
npm run send:capacity -- 559295296926
npm run send:list-matrix -- 120363406245712972@g.us
```

Antes de subir para GitHub, confirme que `session/` continua ignorado:

```bash
git status --short --ignored
```

O esperado e ver:

```txt
!! node_modules/
!! session/
```
