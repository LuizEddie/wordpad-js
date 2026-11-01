# Wordpad JS: arquitetura e desenvolvimento

Este documento é a referência técnica do repositório para desenvolvedores e agentes de código. Ele descreve a implementação atual, seus limites e o fluxo recomendado para fazer alterações. Para instruções da interface destinadas a usuários finais, consulte [GUIA_DO_USUARIO.md](GUIA_DO_USUARIO.md).

## 1. Visão geral

O Wordpad JS é um editor de texto rico executado inteiramente no navegador. A interface é uma SPA React; o conteúdo editável é mantido como documento ProseMirror por meio do TipTap. O projeto não possui servidor de aplicação, API ou banco de dados remoto. O navegador mantém os documentos recentes em `localStorage`, e a aplicação pode ser instalada como PWA e carregada offline depois de seu primeiro acesso bem-sucedido.

O núcleo do editor está concentrado em `src/App.tsx`. Esse arquivo contém a configuração TipTap, estado e comandos da interface, paginação visual, réguas, persistência, importação, exportação, menus e a composição principal da tela. `src/docx-import.ts` implementa a conversão local de OOXML DOCX para HTML editável. Os estilos ficam em `src/style.css`.

## 2. Stack e dependências

| Tecnologia | Papel no projeto |
| --- | --- |
| React 18 | Componentes, estado e renderização da aplicação. |
| TypeScript 5 | Tipos estáticos e verificação do código. |
| Vite 6 | Servidor de desenvolvimento e build de produção. |
| Tailwind CSS 3 | Preflight/reset e configuração de CSS; a maior parte do layout atual usa regras CSS próprias em `src/style.css`. |
| TipTap 2 / ProseMirror | Modelo de documento, área editável, seleções, marcas, nós, comandos e extensões. |
| `docx` | Geração de arquivos DOCX no navegador. |
| JSZip | Leitura do pacote ZIP OOXML do DOCX e tratamento auxiliar na importação/exportação. |
| Mammoth | Conversão alternativa de DOCX quando o importador OOXML principal não consegue processar o arquivo. |
| FileSaver | Download local de arquivos gerados. |
| lucide-react | Ícones da faixa e dos menus. |
| vite-plugin-pwa / Workbox | Manifesto, service worker e pré-cache da aplicação. |

Não introduza dependências de rede ou serviços externos sem atualizar a arquitetura, a documentação de privacidade e o comportamento offline.

## 3. Estrutura do repositório

```text
.
├── AGENTS.md                   # Regras gerais obrigatórias para agentes neste repositório
├── agent-skills/               # Skills especializadas locais para agentes
│   ├── wordpad-docx-compatibility/SKILL.md
│   ├── wordpad-pagination-and-rulers/SKILL.md
│   └── wordpad-project-development/SKILL.md
├── docs/
│   ├── ARQUITETURA_E_DESENVOLVIMENTO.md # Este documento técnico
│   └── GUIA_DO_USUARIO.md      # Manual Markdown para usuários finais
├── public/
│   ├── guia-do-usuario.html    # Manual HTML aberto pelo modal Ajuda da aplicação
│   └── icon.svg                # Favicon do navegador e ícone declarado no manifesto PWA
├── src/
│   ├── App.tsx                 # Editor, UI, paginação, armazenamento e conversões
│   ├── docx-import.ts          # Leitura OOXML DOCX para HTML editável
│   ├── main.tsx                # Ponto de entrada React
│   ├── style.css               # Layout, editor, réguas, impressão e responsividade
│   └── vite-env.d.ts           # Tipos do cliente Vite (import.meta.env)
├── index.html                  # Documento HTML inicial do Vite
├── package.json                # Dependências e scripts npm/pnpm
├── pnpm-lock.yaml              # Lockfile pnpm; preservar e atualizar com pnpm
├── postcss.config.js           # Pipeline PostCSS/Tailwind
├── tailwind.config.js           # Conteúdo e tema Tailwind
├── tsconfig.json               # Configuração TypeScript
└── vite.config.ts              # React, PWA, manifesto e regras de cache
```

`dist/` é resultado gerado pelo build e não deve ser editado manualmente. `node_modules/` contém dependências locais. O lockfile presente é `pnpm-lock.yaml`, embora o README também mostre comandos npm para instalação.

### Documentação e instruções locais

- `README.md` é a página inicial para GitHub: resumo, recursos, execução rápida e links para documentação detalhada.
- `docs/GUIA_DO_USUARIO.md` é o manual completo em Markdown. `public/guia-do-usuario.html` é a versão servida pelo Vite e carregada em um `iframe` no modal **Ajuda** (`helpOpen` em `src/App.tsx`). Como são dois arquivos mantidos manualmente, mudanças na interface ou no manual devem atualizar ambos para que o conteúdo consultado no app não fique divergente.
- `docs/ARQUITETURA_E_DESENVOLVIMENTO.md` é a referência técnica para arquitetura, implementação e manutenção.
- `AGENTS.md` estabelece orientações gerais que se aplicam a agentes que atuam no repositório.
- `agent-skills/*/SKILL.md` contém procedimentos especializados que os agentes devem ler conforme a área da mudança. São instruções reutilizáveis, não código carregado em runtime pela aplicação.

As skills locais são organizadas em `agent-skills/` e referenciadas por `AGENTS.md`. Isso deixa instruções disponíveis junto ao código e as versiona com o projeto; não confundir essa pasta com uma dependência/runtime do editor.

## 4. Inicialização e comandos

Requer Node.js compatível com Vite 6 (recomenda-se Node 20+) e pnpm ou npm.

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

Os scripts definidos em `package.json` são:

- `dev`: inicia Vite em `0.0.0.0:3000`.
- `build`: executa `tsc -b` e, se não houver erros, `vite build`.
- `preview`: serve localmente o conteúdo de `dist/`.

Para validar uma alteração antes de entregá-la, execute `pnpm build`. Não edite o `dist/` como fonte de verdade. Para testar instalação/offline, sirva o build por HTTPS ou use `localhost`, que é tratado como contexto seguro pelo navegador.

## 5. Arquitetura de execução

### 5.1 Inicialização

`index.html` fornece o elemento `#root`. `src/main.tsx` monta `<App />` dentro de `React.StrictMode` e carrega `src/style.css`. O plugin PWA do Vite produz o manifesto e o service worker no build. `workbox.navigateFallback` envia navegações para `/index.html`; o service worker pré-armazena os arquivos selecionados pelo plugin.

O manual dentro do app é um recurso estático de `public/guia-do-usuario.html`; o botão **Ajuda** abre um modal e aponta o `iframe` para esse arquivo usando `import.meta.env.BASE_URL`. O navegador o serve como parte dos arquivos locais da aplicação. Ao alterar o conteúdo, mantenha-o sincronizado com `docs/GUIA_DO_USUARIO.md`.

### 5.2 Modelo e estado do documento

TipTap cria o editor em `App` com `useEditor`. O StarterKit cobre os blocos e marks de base; as extensões adicionais habilitam sublinhado, alinhamento, estilos de texto/cor/fonte, realce, imagem, link, tabelas, subscrito e sobrescrito. Extensões locais acrescentam tamanho de fonte, atributos de layout de parágrafo/célula, continuação de paginação e o nó `pageBreak`.

O estado React guarda metadados de interface/documento, por exemplo título, status de salvamento, papel, margens, menus abertos, guias e documento recente selecionado. O texto rico e a seleção pertencem ao estado TipTap/ProseMirror; as alterações devem usar comandos do editor em vez de alterar HTML diretamente no DOM. O handler de teclado captura Tab fora de tabelas para inserir o caractere de tabulação; CSS `white-space: pre-wrap` e `tab-size: 4` preservam sua exibição. Em células de tabela, o handler deixa a extensão de tabela controlar a navegação.

### 5.3 Persistência local

`STORAGE_KEY` é `wordpad-documents-v1`. `readDocs()` lê a lista guardada no `localStorage`; `save()` grava título, conteúdo HTML, data de atualização, papel e margens. A edição altera o status e um efeito aplica debounce de 900 ms antes da persistência. O conjunto de documentos recentes é limitado a 30 entradas. Essa persistência é específica ao perfil/origem do navegador e pode ser removida pelas configurações do navegador.

O botão de topo **Salvar** abre o menu de exportação. O salvamento local não depende desse menu. Na faixa inferior móvel há **Abrir**, **PDF** e **Inserir**; o acesso ao painel de documentos fica no botão hambúrguer da barra de contexto, que abre um drawer sobre a área do editor. A barra móvel não oferece um botão separado de salvar, pois a gravação local é automática.

### 5.4 Paginação e papel

`PAPER_SIZES` define dimensões físicas em milímetros; o layout converte mm para CSS px usando 96 px por polegada. A folha visual usa a dimensão selecionada, as margens e o espaço visual entre páginas (`PAGE_GAP`). As réguas representam as margens e `adjustMargin()` atualiza os quatro valores em polegadas por interação de ponteiro. A espessura das réguas vem de `--ruler-size` (22 px) e o ritmo das marcações usa `--ruler-inch`; a área fora das margens é sombreada e as duas réguas compartilham superfície, ticks, números e marcadores.

`paginateDocument()` mede os blocos renderizados pelo DOM e insere nós `pageBreak` automáticos quando a altura útil é excedida. Recebe largura e altura físicas da folha e as quatro margens em pixels para calcular a área imprimível. Imagens importadas, coladas ou redimensionadas são reduzidas proporcionalmente quando ultrapassam a largura útil ou a altura imprimível de uma página; a atualização de atributos é feita com `setNodeMarkup`, sem editar o DOM do editor, e agenda um reflow para recalcular as páginas. Quebras automáticas também limpam imagens flutuantes. Para parágrafos que não cabem no espaço restante, `findTextSplitPosition()` examina caixas de glifos com `Range` e retorna tanto a posição ProseMirror quanto o limite visual da linha. `pageBreakHeightToPage()` encontra a próxima folha pela coordenada física do bloco, considerando a altura dos separadores anteriores que ainda serão inseridos no mesmo lote. Esse deslocamento pendente é necessário porque as posições DOM são medidas antes da transação estrutural; sem compensá-lo, cada separador anterior aumenta artificialmente a altura calculada dos seguintes e empurra o texto para os vãos. Em listas, mede os elementos `<li>` e separa o nó de lista antes do primeiro item que ultrapassa o espaço; se o próprio parágrafo do item cruza o limite, divide o texto e cria um fragmento de continuação sem marcador repetido. Ajusta também o início de listas numeradas. Quando a lista precisa passar primeiro para uma página nova, insere uma quebra antes do fragmento inicial e outra antes da continuação, incluindo o deslocamento das duas ao calcular o destino. O reflow recalcula os fragmentos seguintes. O limite de quebra de listas é medido pela geometria física da página no DOM, não pela soma lógica de alturas dos blocos anteriores, porque margens colapsadas entre títulos e parágrafos podem inflar essa soma e mover a lista inteira mesmo quando ainda cabem itens na página atual. Blocos e itens sem ponto de divisão válido começam na próxima página. As quebras geradas automaticamente são removidas e recalculadas durante o reflow; alterações estruturais de paginação são marcadas fora do histórico do usuário. Quebras manuais têm `automatic: false` e devem permanecer distintas das automáticas.

A folha visual é desenhada com altura e largura correspondentes ao formato selecionado em `PAPER_SIZES` (milímetros convertidos para CSS px a 96 dpi). A imagem de fundo se repete no passo `altura + PAGE_GAP`. `pageStackHeight` reserva explicitamente `pageCount × passo − PAGE_GAP` no elemento da folha, garantindo que uma página recém-contada tenha espaço visual completo desde o primeiro render; a altura total cresce sem redimensionar as folhas individuais.

Listas coladas do Word/Docs são nós TipTap `bulletList`/`orderedList` e passam pelo mesmo cálculo de geometria. A paginação tenta dividir entre itens e, quando um item contém um parágrafo comprido, divide o texto por posição ProseMirror e cria uma continuação sem repetir o marcador. O menu contextual mede sua caixa depois de renderizar e limita a posição aos limites do `visualViewport` (ou do viewport do documento); quando o conteúdo é maior que a tela, sua própria área rola.

Essa paginação é uma aproximação visual no navegador: fontes, zoom, métricas de texto e impressão podem produzir paginação diferente no Word/LibreOffice. Qualquer mudança em CSS de editor, altura/margens, quebras ou reflow pode afetar essa lógica. Leia a skill `wordpad-pagination-and-rulers` antes de alterá-la.

O PDF/impressão, ao contrário, é gerado pelo próprio navegador a partir do mesmo DOM e das mesmas quebras: o `@page` recebe o papel e as margens do documento e o CSS de impressão zera o `padding` da folha e o `height` dos separadores, de modo que cada página impressa começa na margem superior com a mesma largura útil da tela. Se a largura útil ou a escala não coincidir com o editor, verifique primeiro se larguras `inline` do `article`/`.page-layout` estão sendo sobrescritas com `!important` no bloco `@media print`.

### 5.5 Importação

`openFile()` despacha pelo sufixo do arquivo:

- `.docx`: tenta `convertDocxToEditableHtml()` em `src/docx-import.ts`; a conversão principal abre OOXML via JSZip e traduz estrutura suportada, estilos de execução, links, imagens embutidas, listas, tabelas e formatação básica. Lê tamanho da página e margens via `readDocxPageSetup()`. Mammoth é a alternativa em caso de falha no importador principal.
- `.html` e `.htm`: carrega markup HTML como conteúdo editável.
- `.txt`, `.md` e `.markdown`: carrega texto sem renderizar sintaxe Markdown como marcas ricas.

Importar substitui o documento aberto. DOCX é um formato complexo; os recursos não reconhecidos podem ser omitidos ou simplificados. Evite prometer fidelidade pixel a pixel.

### 5.6 Exportação

- `exportDocx()` converte a árvore JSON TipTap usando `docxBlocks()` e `inlineRuns()`, gera um pacote DOCX com `docx` e baixa pelo FileSaver. Imagens WEBP são convertidas para JPEG no navegador por `prepareDocxImages()` antes da geração. `readDocxPageSetup()` atua na importação e não deve ser confundida com o gerador.
- O mapeamento busca reproduzir o que a folha do editor mostra, usando as mesmas medidas do CSS (`src/style.css`). Comprimentos em `px`/`pt`/`em` são convertidos para twips com `cssLengthToTwips()` (15 twips por px, 20 por pt) e entrelinhas com `cssLineHeightToTwips()`.
- Entrelinha usa `LineRuleType.EXACT` com twips derivados da altura de linha do editor (1.65 × tamanho da fonte; títulos 1.2), e não `AUTO`, porque o Word recalcula `AUTO` a partir das métricas da própria fonte e abre o espaçamento. Parágrafos normais levam `after: 240` (1em), títulos usam `headingGap()`/`headingSizePt()`/`headingLineHeight()` (h1 24pt, h2 18pt, h3+ 12pt, com as margens do preflight).
- O controle de espaçamento da guia Página Inicial grava `margin-top`, `margin-bottom` e `line-height` no atributo `docxLayout` do parágrafo/título via `setNodeMarkup`. O exportador lê essas mesmas declarações primeiro e só cai nos padrões de estilo quando a chave não existe; por isso o DOCX preserva o espaçamento personalizado. Células de tabela e itens de lista seguem a mesma regra. O diálogo **Espaçamento personalizado** lê os valores pintados pelo navegador (`getComputedStyle`), então listas, títulos e documentos importados começam com os valores reais.
- Listas recebem definições de numeração inline por lista (`bulletNumbering()` reaproveitado, `orderedNumbering()` com `reference` único para preservar reinícios de contagem), 9 níveis, texto a `32px + 30px × nível` e recuo deslocado de 20px. Só o primeiro parágrafo de cada item recebe marcador; os demais ficam alinhados ao texto. O `margin-bottom` do container de lista é aplicado apenas no último item da lista mais externa.
- Duas listas do mesmo tipo imediatamente vizinhas no JSON — ou separadas apenas por uma quebra de página — são tratadas como uma única lista visual (`DocxBlockContext.listContinues`): o último item do primeiro trecho não recebe `after: 240`, pois o `1em` cairia no meio da lista. Em listas ordenadas o trecho só conta como continuação quando a numeração segue a anterior (`isListContinuation()`), então um reinício deliberado de `<ol>` mantém o espaçamento entre as listas. A paginação cria esses trechos ao dividir uma lista que cruza a página; quando um reflow posterior remove a quebra, `paginateDocument()` rejunta os trechos já adjacentes, o que também restaura a medição correta.
- Citação usa `DOCX_QUOTE_COLOR`, borda esquerda `B6C8DE` e recuo de 17px, com `space` calculado a partir do recuo da primeira linha (renderizadores ancoram a borda na primeira linha, e o OOXML limita a distância a 31pt). Listas dentro da citação herdam o recuo e a mesma borda.
- Bloco de código usa fonte monoespaçada, fundo `F2F4F7` e bordas na mesma cor (72/8pt) para reproduzir o padding de 12px e a largura total do `<pre>`.
- Tabelas mantêm `table-layout: fixed`, cabeçalho centralizado/negrito com fundo `EDF2F8`, bordas `9AA6B5` e o `after: 240` do parágrafo interno, que define a altura da linha como no editor. Separador horizontal usa `AEB8C4` com 18px de altura.
- Links saem em `1155CC` e sublinhados, como o CSS do editor aplica a `a`. Marcas só são escritas quando existem no JSON: um `bold: false` explícito cancelaria o negrito herdado de título ou cabeçalho de tabela.
- Quebras de página manuais aplicam `pageBreakBefore` ao parágrafo seguinte, sem criar parágrafo vazio. Quebras automáticas da paginação do editor **não** são exportadas: Word/LibreOffice repaginam com métricas de fonte próprias e, ao gravar essas quebras, uma diferença de poucas linhas deixa páginas quase em branco (um título ou um único item de lista isolado). Só as quebras inseridas pelo usuário são preservadas. Se a quebra vier logo depois de um título, ela é movida para o próprio título; junto com `keepNext` nos títulos, isso evita que o título fique sozinho e que a quebra original deixe uma página em branco. Ao alterar `src/style.css`, revise estas constantes e funções para manter a correspondência.
- `exportPdf()` chama `window.print()`; o navegador oferece “Salvar como PDF”. O `<style>` do componente injeta um `@page` dinâmico com o tamanho do papel escolhido (`PAPER_SIZES`) e as quatro margens em polegadas; o `@media print` de `src/style.css` remove molduras, réguas, barra de ferramentas e o espaçamento visual entre páginas. As quebras automáticas continuam no DOM como `.page-break` com `break-after: page`, então o PDF sai com as mesmas páginas do editor. Como o React grava `width`, `min-width`, `min-height` e `padding` inline no `article` (e a largura da `.page-layout`), o CSS de impressão precisa redefini-los com `!important`; sem isso o Chrome reduz a escala do conteúdo para caber uma folha mais larga que a área imprimível e o PDF deixa de coincidir com a tela. `print-color-adjust: exact` preserva fundos de tabelas, blocos de código e realces, e o bloco de impressão também esconde seleção de nós, alças de redimensionamento de imagem e menus contextuais. O `html` também recebe `background:#fff!important`: o `:root` tem fundo cinza na tela, e sem essa correção o fundo da página (canvas) aparece como uma faixa cinza no espaço em branco restante da última página.
- `exportText()`, `exportHtml()` e `exportMarkdown()` geram downloads locais. A exportação Markdown atual parte de texto simples, sem converter todas as marcas TipTap em sintaxe Markdown.

DOCX e PDF precisam ser avaliados com exemplos que incluam texto formatado, listas, tabelas, imagens e quebras. Um build bem-sucedido apenas comprova tipos e empacotamento, não fidelidade visual de documentos.

## 6. Mapa de funções e responsabilidades

### `src/App.tsx`

O arquivo é extenso e atualmente reúne áreas distintas. Principais funções/helpers:

| Símbolo | Responsabilidade |
| --- | --- |
| `readDocs` | Lê os documentos recentes do `localStorage`, tolerando JSON inválido. |
| `prepareDocxImages` | Converte fontes WEBP embutidas para JPEG e prepara os nós de imagem para o exportador DOCX. |
| `inlineRuns` | Traduz nós inline/marks do TipTap em `TextRun`, `ImageRun` e hyperlink DOCX. |
| `docxBlocks` | Traduz parágrafos, títulos, listas, tabelas, imagens, separadores e quebras para blocos DOCX. |
| `readDocxPageSetup` | Lê dimensões de papel e margens de `word/document.xml`. |
| `findTextSplitPosition` | Procura posição de divisão em um bloco de texto a partir do limite de página renderizado. |
| `paginateDocument` | Insere/atualiza quebras automáticas e calcula páginas a partir da geometria DOM. |
| `FontSize` / `PaginationContinuation` / `ListItemPaginationContinuation` / `ParagraphLayout` / `TableAppearance` | Extensões TipTap que persistem atributos em nós e marks. A continuação de item de lista suprime marcador repetido entre páginas. |
| `PageBreak` | Nó de bloco atômico usado para quebras manuais/automáticas e espaço entre folhas. |
| `EditableImageView` | Node view da imagem selecionada, com oito alças de resize controladas pelo mouse/pointer. |
| `compressImage` | Redimensiona/comprime imagens locais para reduzir o peso armazenado no documento. |
| `save` | Salva o documento atual e metadados no armazenamento local. |
| `deleteSavedDocument` | Confirma a exclusão e remove o documento da chave `wordpad-documents-v1`, atualizando o painel de recentes. |
| `newDocument` / `openFile` | Inicia um documento ou importa arquivo local para a instância do editor. |
| `insertImage` / `addLink` / `insertTable` | Comandos de inserção de conteúdo rico. |
| `adjustMargin` | Converte movimento nas réguas em atualizações limitadas de margem. |
| `toggleInsertMenu` / `popupPosition` | Controla menus de categoria e posicionamento dos popovers. |
| `openEditorContextMenu` / `ContextItem` | Preserva a seleção ou posiciona o cursor sob o clique direito e apresenta comandos contextuais do editor. |
| `copyFromEditor` / `pasteIntoEditor` | Integra recortar/copiar/colar com a Clipboard API e fallback de `execCommand` para cópia/corte. A leitura de texto para colar depende das permissões do navegador. |
| `closeMobileSidebarOnOutside` | Fecha o drawer móvel em pointerdown fora do painel e do botão de alternância. |
| `exportDocx` / `exportPdf` / `exportText` / `exportHtml` / `exportMarkdown` | Exportações locais. |
| `toolbar` / `insertTools` | Grupos de controles das guias Página Inicial e Inserir. |

### `src/docx-import.ts`

`convertDocxToEditableHtml(file)` lê o ZIP OOXML no cliente, resolve relações e mídia, converte runs e parágrafos em HTML, agrupa itens numerados/marcados e converte tabelas. A função escapa conteúdo textual e atributos que serializa. As conversões de XML/HTML devem continuar locais; não enviar documento para um serviço remoto.

### `src/style.css`

Contém tokens/regras globais, layout de janela e faixas, folha de edição, réguas, menus, handles de imagem, estilos ricos, impressão e media queries. Há regras aditivas no fim do arquivo para corrigir casos específicos; ao modificar um controle visual, busque todas as regras existentes para o seletor antes de acrescentar outra. Evite criar duplicações conflitantes e não remova estilos de paginação sem conferir seus efeitos no editor e no print.

## 7. Como escrever e editar código

1. **Localize a fonte de verdade.** Procure pelo componente/ação com `rg`. Toolbar e lógica de estado estão em `App.tsx`; renderização rica e paginação dependem também de `style.css`; importador DOCX está em `docx-import.ts`.
2. **Siga o modelo TipTap.** Modifique o documento com `editor.chain().focus()...run()` ou comandos TipTap. Para novos atributos persistentes, crie/estenda uma extensão global e implemente `parseHTML` e `renderHTML`; importe/reimporte e exporte depois para preservar os atributos.
3. **Preserve seleção e foco.** Menus e controles da faixa não devem destruir a seleção do editor antes do comando. Use eventos apropriados e `chain().focus()` nas ações.
4. **Mantenha comandos acessíveis.** Botões devem ter `type="button"`, nome visível ou `aria-label`, estado ativo/desabilitado coerente e foco/hover legíveis. Ícones são de lucide-react.
5. **Evite dependência de backend.** Arquivos devem ser processados com APIs do navegador. Conteúdo não deve ser enviado para analytics, APIs, storage remoto ou serviços de conversão.
6. **Atualize documentação.** Alterações visíveis devem ser refletidas em `docs/GUIA_DO_USUARIO.md` e na cópia incorporada `public/guia-do-usuario.html`; alterações de arquitetura devem atualizar este documento e/ou as skills.
7. **Use os gerenciadores coerentemente.** O repositório mantém `pnpm-lock.yaml`. Se mudar dependências, atualize o lockfile com pnpm e confira o diff; não remova ou regenere lockfiles sem necessidade.
8. **Valide o resultado.** Execute `pnpm build`. Para ajustes em paginação, réguas, imagens, tabelas ou exportação, valide também o fluxo visual/arquivo pertinente; build isolado não detecta erros de medição/renderização.

### Padrões de implementação

- TypeScript estrito; defina tipos explícitos para metadados e funções novas em vez de adicionar `any`.
- Preserve a separação entre conteúdo ProseMirror, estado de apresentação React e metadados persistidos.
- Ao processar arquivo, trate ausência de arquivo, XML inválido e relações/mídia ausentes sem travar a UI.
- Dados embutidos como imagens podem aumentar muito o `localStorage`; mantenha compressão e limites de tamanho razoáveis e dê feedback de falha de quota.
- Não use HTML arbitrário não confiável diretamente em `dangerouslySetInnerHTML`. As importações precisam passar por conversão/normalização apropriada.
- Preserve unidades explicitamente: papel em mm; margens em polegadas; layout DOM em px; tamanho de fonte em pt; OOXML usa twips/EMU e requer conversões documentadas.

## 8. Compatibilidade, segurança e limites

- Compatibilidade principal de arquivo: DOCX, HTML, TXT e Markdown simples na importação; DOCX, HTML, TXT, Markdown simples e PDF via impressão na exportação.
- Não há suporte nativo para DOC legado, ODT, formatos proprietários de Google Docs, arquivos criptografados, comentários/revisão completos, macros ou colaboração.
- Imagens são processadas em memória e incorporadas no conteúdo para persistência local. Não há upload remoto.
- `localStorage` é síncrono e tem quota limitada. Se forem introduzidos documentos grandes ou muitos binários, avalie IndexedDB, preservando o requisito offline e local e planejando migração dos dados existentes.
- O PWA depende do primeiro carregamento online e de um contexto seguro (HTTPS ou localhost). O cache não é mecanismo de backup dos documentos.

## 9. Checklist de mudança

- [ ] Mantém edição e salvamento local funcionando.
- [ ] Mantém undo/redo e seleção do editor nas ações da toolbar.
- [ ] Não ultrapassa as margens nem escreve no vão entre páginas.
- [ ] Mantém as dimensões escolhidas para folha e o comportamento das réguas.
- [ ] Considera desktop, viewport estreita e impressão quando a mudança for visual.
- [ ] Importa e exporta os tipos de conteúdo afetados sem perda indevida.
- [ ] Atualiza o guia de usuário quando muda a interface.
- [ ] Executa `pnpm build` e registra limitações observadas.

## 10. Instruções para agentes

`AGENTS.md` é o ponto de entrada curto para agentes e direciona para este manual e as skills relevantes. As skills ficam em `agent-skills/`:

| Skill | Quando aplicar |
| --- | --- |
| [`wordpad-project-development`](../agent-skills/wordpad-project-development/SKILL.md) | Mudanças gerais em UI, estado, TipTap, armazenamento local, documentação ou estrutura do projeto. |
| [`wordpad-pagination-and-rulers`](../agent-skills/wordpad-pagination-and-rulers/SKILL.md) | Papel, margens, réguas, quebras automáticas/manuais, fluxo de texto, contagem de páginas e impressão. |
| [`wordpad-docx-compatibility`](../agent-skills/wordpad-docx-compatibility/SKILL.md) | Importação/exportação DOCX, OOXML, imagens, listas, tabelas, formatação e configuração da página. |

As skills definem contexto, invariantes, arquivos relevantes e validações específicas; elas complementam `AGENTS.md` e não substituem a documentação técnica. Se uma tarefa atravessar mais de uma área, leia todas as skills aplicáveis. Ao concluir, informe as alterações, arquivos principais, validação feita e limitações conhecidas.

## 11. Índice da documentação do projeto

- [README do projeto](../README.md): apresentação e comandos rápidos.
- [Guia completo do usuário](GUIA_DO_USUARIO.md): operações da interface, formatos e solução de problemas.
- [Instruções gerais para agentes](../AGENTS.md): regras essenciais do checkout.
- [Skill de desenvolvimento geral](../agent-skills/wordpad-project-development/SKILL.md).
- [Skill de paginação e réguas](../agent-skills/wordpad-pagination-and-rulers/SKILL.md).
- [Skill de compatibilidade DOCX](../agent-skills/wordpad-docx-compatibility/SKILL.md).
