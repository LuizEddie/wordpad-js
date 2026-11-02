# Wordpad JS

Editor de documentos em React, TypeScript e Tailwind CSS, inspirado na faixa de ferramentas de editores de texto. Funciona no navegador, mantém os documentos no próprio dispositivo e pode ser instalado como PWA.

## Recursos

- Edição de texto rico com títulos, família e tamanho de fonte, paleta de cores do texto e realce, negrito, itálico, sublinhado, tachado, subscrito, sobrescrito, alinhamento, listas, citação e código.
- Réguas horizontal e vertical para ajustar visualmente as quatro margens; escolha A4 (padrão), Carta, Legal, A3 ou A5 na guia Layout.
- Inserção de imagens locais, links, tabelas editáveis e linhas horizontais. Imagens selecionadas podem ser redimensionadas pelo mouse em qualquer lado ou canto, alinhadas, configuradas para permitir texto ao lado e ter o texto alternativo editado. O seletor de tabela permite escolher linhas e colunas antes de inserir; na guia Inserir, acrescente ou remova linhas e colunas.
- Paginação automática por altura útil da folha e quebras de página manuais com `Ctrl+Enter`; o editor mostra as páginas e permite escolher o papel em Layout.
- Efeitos de hover, foco e estado ativo na faixa de ferramentas e botões.
- Menu contextual no botão direito com comandos de edição, formatação, alinhamento, listas, links e inserções disponíveis no editor.
- Salvamento automático e manual no `localStorage`; lista de até 30 documentos recentes por navegador.
- Importação de `.docx`, `.txt`, `.md`, `.html` e `.htm`.
- Exportação para `.docx`, `.txt`, `.md` e `.html`; impressão ou opção “Salvar como PDF” do navegador.
- PWA com cache de aplicação para inicialização offline após o primeiro acesso.
- Sem contas, servidores de aplicação ou chamadas a bancos de dados externos.

## Requisitos e execução

- Node.js 20 ou superior e npm.

```bash
npm install
npm run dev
```

Abra o endereço local informado pelo Vite. Para compilar e visualizar a versão final:

```bash
npm run build
npm run preview
```

Publique o conteúdo de `dist/` em um host estático com HTTPS para habilitar instalação e operação offline. Service workers não funcionam em `file://`; para desenvolvimento local use o servidor Vite.

## Testes automatizados

```bash
npm test          # executa a suíte uma vez
npm run test:watch
```

A suíte usa Vitest com jsdom e Testing Library. Os testes de unidade cobrem o pincel de formatação, os helpers de conversão de unidades/estilos e o importador DOCX (OOXML montado em memória com JSZip). Os testes de integração montam o `<App />`, exercitam a faixa de ferramentas, a aplicação do pincel por mouse/teclado e o salvamento automático no `localStorage`.

Os testes validam o modelo ProseMirror e o comportamento da interface, não a geometria real do navegador: jsdom não faz layout, então paginação visual, réguas, fidelidade de impressão e renderização final de arquivos DOCX/PDF continuam exigindo validação manual no navegador.

## Guia de uso

1. Digite no papel central. As alterações são gravadas automaticamente no armazenamento local após uma breve pausa; o indicador no topo informa o estado. O botão **Salvar** abre as opções de exportação.
2. Na guia **Página Inicial**, ajuste fonte, tamanho, cor, realce, estilo de parágrafo, alinhamento, listas e outras formatações. Desfazer e refazer usam o histórico de edição.
3. Na guia **Inserir**, use os menus de categoria **Imagem**, **Link**, **Tabela**, **Mais** ou **Arquivo**. Imagens podem ser redimensionadas pelas alças nos lados e cantos, alinhadas e configuradas para permitir texto ao lado. O menu **Tabela** oferece uma grade para escolher linhas e colunas, além de comandos para editar a tabela selecionada.
4. Na guia **Layout**, escolha o tamanho do papel (A4 é o padrão) e ajuste as margens pelos marcadores nas réguas ou pelos campos em polegadas. O conteúdo cria novas páginas automaticamente ao alcançar o limite útil da folha. Use `Ctrl+Enter` (Windows/Linux) ou `⌘+Enter` (macOS) para inserir uma quebra manual.
5. Acesse **Ajuda** no topo para consultar o guia completo dentro da aplicação. A versão em Markdown está em [`docs/GUIA_DO_USUARIO.md`](docs/GUIA_DO_USUARIO.md).
6. Para importar, abra **Inserir → Arquivo → Abrir documento**. A importação substitui o conteúdo atual; exporte uma cópia antes se quiser preservá-lo.
7. Em **Salvar**, escolha Word (`.docx`), texto, HTML, Markdown ou PDF/Imprimir. Para PDF, selecione “Salvar como PDF” na janela de impressão do navegador.
8. Instale pelo comando “Instalar aplicativo” do navegador (ou “Adicionar à tela inicial” em dispositivos móveis) depois de abrir a versão HTTPS publicada.

Consulte o [guia completo do usuário](docs/GUIA_DO_USUARIO.md) para instruções detalhadas sobre edição, imagens, tabelas, paginação, importação, exportação, uso offline e solução de problemas. O mesmo guia também está disponível na aplicação pelo botão **Ajuda**.

Para contribuir no código, consulte a [documentação técnica de arquitetura e desenvolvimento](docs/ARQUITETURA_E_DESENVOLVIMENTO.md), as [instruções para agentes](AGENTS.md) e as skills locais em [`agent-skills/`](agent-skills/).

## Formatos e compatibilidade

DOCX é o formato recomendado para trocar arquivos com Microsoft Word, LibreOffice Writer e Google Docs. A importação lê o pacote OOXML localmente e preserva texto formatado, títulos, alinhamentos, espaçamento e recuos de parágrafo, listas, tabelas, hyperlinks, imagens embutidas, quebras de página, tamanho de papel e margens. O conversor Mammoth é usado como alternativa para arquivos DOCX fora do padrão esperado. A exportação inclui imagens, tabelas com bordas, links, quebras, fonte Arial padrão, tamanhos, cores, realce e alinhamento. Comentários, controle de alterações, cabeçalhos/rodapés, fontes incorporadas, objetos flutuantes, gráficos, equações, colunas e detalhes avançados de estilos podem ser simplificados. A conversão entre o modelo de página do Word e o editor não é pixel a pixel; o Word pode recalcular a paginação conforme suas fontes e métricas ao abrir o DOCX. TXT, Markdown e HTML são importados como texto/estrutura simples. PDF é produzido pelo mecanismo de impressão do navegador.

O editor cobre os recursos comuns de formatação e inserção encontrados em editores ricos como HugeRTE/TinyMCE. Recursos de suíte de escritório, como colaboração em tempo real, comentários, revisão, mala direta, referências, macros, paginação avançada e sincronização, ficam fora do escopo desta aplicação offline.

Não há suporte nativo para abrir `.doc` legado, `.odt`, formatos proprietários de Google Docs ou arquivos protegidos por senha. Converta esses arquivos para DOCX, HTML ou texto em um editor compatível antes de importar. O Wordpad não promete equivalência completa a suítes profissionais de escritório.

## Privacidade e armazenamento

O conteúdo editado permanece no armazenamento local do navegador e não é sincronizado. Dados do `localStorage` podem ser removidos pelo usuário, por limpeza dos dados do navegador ou por políticas de armazenamento. Exporte cópias importantes para o computador. O PWA em cache permite abrir a aplicação sem rede após o primeiro carregamento; abrir/importar e salvar arquivos continuam sujeitos às permissões e recursos do navegador.

## Tecnologias

React, TypeScript, Vite, Tailwind CSS, TipTap, Mammoth, JSZip, docx, FileSaver, vite-plugin-pwa, Vitest, jsdom e Testing Library.
