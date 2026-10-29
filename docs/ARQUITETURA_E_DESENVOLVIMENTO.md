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

O estado React guarda metadados de interface/documento, por exemplo título, status de salvamento, papel, margens, menus abertos, guias e documento recente selecionado. O texto rico e a seleção pertencem ao estado TipTap/ProseMirror; as alterações devem usar comandos do editor em vez de alterar HTML diretamente no DOM.

### 5.3 Persistência local

`STORAGE_KEY` é `wordpad-documents-v1`. `readDocs()` lê a lista guardada no `localStorage`; `save()` grava título, conteúdo HTML, data de atualização, papel e margens. A edição altera o status e um efeito aplica debounce de 900 ms antes da persistência. O conjunto de documentos recentes é limitado a 30 entradas. Essa persistência é específica ao perfil/origem do navegador e pode ser removida pelas configurações do navegador.

O botão de topo **Salvar** abre o menu de exportação. O salvamento local não depende desse menu. Há também controles simplificados na barra móvel; ao alterar essas ações, preserve a distinção entre salvar no armazenamento local e exportar arquivo.

### 5.4 Paginação e papel

`PAPER_SIZES` define dimensões físicas em milímetros; o layout converte mm para CSS px usando 96 px por polegada. A folha visual usa a dimensão selecionada, as margens e o espaço visual entre páginas (`PAGE_GAP`). As réguas representam as margens e `adjustMargin()` atualiza os quatro valores em polegadas por interação de ponteiro.

`paginateDocument()` mede os blocos renderizados pelo DOM e insere nós `pageBreak` automáticos quando a altura útil é excedida. Para parágrafos altos, `findTextSplitPosition()` examina caixas de glifos com `Range` e encontra posição de texto para dividir o parágrafo antes do limite da página. As quebras geradas automaticamente são removidas e recalculadas durante o reflow; alterações estruturais de paginação são marcadas fora do histórico do usuário. Quebras manuais têm `automatic: false` e devem permanecer distintas das automáticas.

Essa paginação é uma aproximação visual no navegador: fontes, zoom, métricas de texto e impressão podem produzir paginação diferente no Word/LibreOffice. Qualquer mudança em CSS de editor, altura/margens, quebras ou reflow pode afetar essa lógica. Leia a skill `wordpad-pagination-and-rulers` antes de alterá-la.

### 5.5 Importação

`openFile()` despacha pelo sufixo do arquivo:

- `.docx`: tenta `convertDocxToEditableHtml()` em `src/docx-import.ts`; a conversão principal abre OOXML via JSZip e traduz estrutura suportada, estilos de execução, links, imagens embutidas, listas, tabelas e formatação básica. Lê tamanho da página e margens via `readDocxPageSetup()`. Mammoth é a alternativa em caso de falha no importador principal.
- `.html` e `.htm`: carrega markup HTML como conteúdo editável.
- `.txt`, `.md` e `.markdown`: carrega texto sem renderizar sintaxe Markdown como marcas ricas.

Importar substitui o documento aberto. DOCX é um formato complexo; os recursos não reconhecidos podem ser omitidos ou simplificados. Evite prometer fidelidade pixel a pixel.

### 5.6 Exportação

- `exportDocx()` converte a árvore JSON TipTap usando `docxBlocks()` e `inlineRuns()`, gera um pacote DOCX com `docx` e baixa pelo FileSaver. Imagens WEBP são convertidas para JPEG no navegador por `prepareDocxImages()` antes da geração. `readDocxPageSetup()` atua na importação e não deve ser confundida com o gerador.
- `exportPdf()` chama `window.print()`; o navegador oferece “Salvar como PDF”. CSS `@page` e regras `@media print` definem a aparência de impressão.
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
| `FontSize` / `PaginationContinuation` / `ParagraphLayout` / `TableAppearance` | Extensões TipTap que persistem atributos em nós e marks. |
| `PageBreak` | Nó de bloco atômico usado para quebras manuais/automáticas e espaço entre folhas. |
| `EditableImageView` | Node view da imagem selecionada, com oito alças de resize controladas pelo mouse/pointer. |
| `compressImage` | Redimensiona/comprime imagens locais para reduzir o peso armazenado no documento. |
| `save` | Salva o documento atual e metadados no armazenamento local. |
| `newDocument` / `openFile` | Inicia um documento ou importa arquivo local para a instância do editor. |
| `insertImage` / `addLink` / `insertTable` | Comandos de inserção de conteúdo rico. |
| `adjustMargin` | Converte movimento nas réguas em atualizações limitadas de margem. |
| `toggleInsertMenu` / `popupPosition` | Controla menus de categoria e posicionamento dos popovers. |
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
