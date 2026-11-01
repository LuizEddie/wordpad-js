# Guia completo de uso do Wordpad JS

O Wordpad JS é um editor de texto rico que funciona no navegador, salva documentos neste dispositivo e pode ser instalado como PWA. Este guia descreve os controles disponíveis na versão atual.

## 1. Conheça a tela

- **Nome do documento:** edite o campo no topo. O nome é usado ao salvar localmente e nos arquivos exportados.
- **Indicador de salvamento:** mostra quando há alterações pendentes e quando o conteúdo foi gravado no armazenamento local.
- **Salvar:** abre o menu de exportação. O salvamento local acontece automaticamente enquanto você edita.
- **Ajuda:** abre este guia dentro do editor.
- **Documentos recentes:** painel lateral com documentos salvos neste navegador. Use **Novo documento** para começar outro ou o botão de lixeira ao lado de um item para excluí-lo do armazenamento local após confirmar.
- **Menu ☰:** no celular, abre ou fecha o painel de documentos recentes. Toque fora do painel para fechá-lo. A barra inferior contém Abrir, PDF e Inserir; as edições continuam sendo salvas automaticamente.
- **Área da folha:** clique no papel e digite. O rodapé informa a página atual, o total de páginas e a contagem de caracteres.
- **Guias:** Página Inicial, Inserir e Layout organizam as ferramentas.

## 2. Escrever e formatar texto

Clique na folha e digite. Para aplicar uma formatação a texto existente, selecione o trecho antes de usar o controle. Para definir a formatação do próximo texto, posicione o cursor no ponto desejado e escolha o controle.

Na guia **Página Inicial** você encontra:

- **Desfazer e refazer:** reverta ou reaplique alterações recentes.
- **Estilo de parágrafo:** texto normal, Título 1 ou Título 2.
- **Fonte e tamanho:** escolha a família tipográfica e o tamanho em pontos. O campo de tamanho mostra o tamanho usado no ponto do cursor (ou no início da seleção) e acompanha o estilo do parágrafo: Título 1 aparece como 24 pt e Título 2 como 18 pt.
- **Negrito, itálico, sublinhado, tachado, sobrescrito e subscrito.**
- **Cor da fonte:** clique no ícone de letra para aplicar a cor atual; use a seta para abrir a paleta e escolher uma cor pronta ou personalizada.
- **Realce:** selecione uma cor para destacar o texto.
- **Remover formatação:** retire marcas e estilo de bloco da seleção.
- **Alinhamento:** esquerda, centro, direita ou justificado.
- **Listas:** marcadores e numeração. Posicione o cursor em um parágrafo ou selecione vários parágrafos antes de ativar o tipo desejado. Pressione Enter para continuar a lista; em um item vazio, pressione Enter novamente para sair.
- **Citação e bloco de código.**

Os botões ativos ficam destacados quando o cursor está dentro de um trecho com aquela formatação.

No editor, pressione **Tab** para inserir uma tabulação de quatro espaços. Dentro de uma tabela, Tab mantém a navegação entre células. `Shift+Tab` mantém o comportamento padrão do navegador/editor.

Clique com o botão direito dentro da folha para abrir o menu contextual. Ele se posiciona dentro da área visível; em telas menores, role dentro do próprio menu para acessar todas as opções. Ele reúne desfazer/refazer, recortar/copiar/colar, selecionar tudo, formatação de texto, estilo de parágrafo, listas, alinhamento, links, inserção de imagem/tabela e quebra de página. **Colar** depende da permissão de área de transferência do navegador; se for bloqueado, use `Ctrl+V` ou `⌘+V`. O menu oferece os comandos disponíveis no Wordpad; recursos dependentes de conta ou colaboração do Google Docs, como comentários compartilhados, não fazem parte do editor offline.

## 3. Inserir conteúdo

Na guia **Inserir**, cada botão abre um menu com ações relacionadas.

### Imagem

1. Abra **Imagem → Inserir do computador** e escolha um arquivo de imagem.
2. Clique na imagem no documento para selecioná-la. Alças aparecem nos quatro lados e nos quatro cantos.
3. Arraste uma alça lateral para ajustar somente largura ou altura; arraste um canto para ajustar as duas dimensões.
4. No menu **Imagem**, ajuste a largura em pixels, o texto alternativo, o alinhamento e a quebra de texto.
5. **Texto à direita** posiciona a imagem à esquerda e permite que o texto flua à direita. **Texto à esquerda** posiciona a imagem à direita. **Sem quebra** coloca o texto em blocos acima e abaixo da imagem.
6. Use **Remover imagem** para apagar a imagem selecionada.

### Link

Abra **Link → Adicionar ou editar link** com o cursor em um texto selecionado. Informe o endereço quando solicitado. Para retirar um link, selecione um trecho vinculado e escolha **Remover link**.

Um clique em um link abre o endereço em uma nova aba; links de e-mail e telefone abrem o aplicativo correspondente. Para posicionar o cursor ou selecionar o texto do link sem abri-lo, mantenha **Alt** (ou **Ctrl**) pressionado ao clicar.

### Tabela

1. Abra **Tabela** e passe o mouse sobre a grade para escolher o número de linhas e colunas (até 8 × 8).
2. Clique na célula da grade que representa o tamanho desejado. A tabela é inserida com uma linha de cabeçalho.
3. Clique em uma célula para editá-la. Abra **Tabela** novamente para adicionar ou remover linha/coluna ou excluir a tabela.
4. Os comandos de edição ficam desabilitados quando o cursor não está dentro de uma tabela.

### Mais e Arquivo

- **Mais → Linha horizontal** insere um separador no documento.
- **Mais → Quebra de página** começa uma página nova. `Ctrl+Enter` no Windows/Linux ou `⌘+Enter` no macOS insere a mesma quebra no cursor.
- **Arquivo → Abrir documento** importa um arquivo local.

## 4. Página, margens e paginação

Na guia **Layout**:

- Escolha **A4** (padrão), Carta, Ofício/Legal, A3 ou A5.
- Arraste os marcadores azuis nas réguas para alterar as margens esquerda, direita, superior e inferior.
- Você também pode digitar as margens em polegadas nos campos correspondentes.
- O editor acrescenta páginas e cria quebras automáticas conforme o texto alcança a área útil. Parágrafos longos podem ser divididos entre páginas.
- Listas também continuam na página seguinte apenas a partir do item ou trecho que exceder o espaço disponível; o marcador não é repetido no meio de um item continuado.
- Imagens maiores que a área útil são reduzidas proporcionalmente para caber na folha. Uma imagem que cabe na página, mas não no espaço restante, começa na próxima página; o conteúdo não deve ocupar o vão cinza entre folhas.
- Cada folha mantém o tamanho escolhido em **Papel** (A4, Carta, Ofício/Legal, A3 ou A5). O editor adiciona páginas com as mesmas dimensões, sem alterar o tamanho das páginas anteriores.
- O rodapé mostra **Página atual de total**.
- **Visualizar / PDF** abre a janela de impressão do navegador; selecione **Salvar como PDF** para criar um PDF com o mesmo papel, as mesmas margens e as mesmas páginas do editor. Na caixa de impressão, não altere as margens nem a escala (100%) e desmarque **Cabeçalhos e rodapés**.

O navegador pode paginar de maneira um pouco diferente do Word por diferenças de fontes, impressão e métricas de texto.

## 5. Salvar, abrir e exportar

### Salvamento local

O editor salva automaticamente as alterações no armazenamento local do navegador após uma breve pausa. O indicador no topo mostra o estado. Até 30 documentos recentes ficam disponíveis no painel lateral, no mesmo perfil de navegador e dispositivo. Para excluir um documento, clique na lixeira ao lado dele e confirme. Se ele estiver aberto, a edição atual permanece na tela, mas alterações futuras podem salvá-lo novamente. O menu **Salvar** serve para exportar arquivos; não é necessário acioná-lo para gravar a cópia local.

### Abrir arquivos

Em **Inserir → Arquivo → Abrir documento**, escolha `.docx`, `.txt`, `.md`, `.markdown`, `.html` ou `.htm`. O arquivo aberto substitui o conteúdo atual do editor; se precisar manter as duas versões, salve ou exporte o documento atual antes.

- DOCX é convertido para o modelo do editor. O importador preserva conteúdo e formatação comum, imagens, links, listas, tabelas e configurações de página que são compatíveis.
- HTML é interpretado como estrutura de texto rico.
- TXT e Markdown são carregados linha a linha como texto; a sintaxe Markdown não é renderizada automaticamente como formatação.

### Exportar arquivos

Abra **Salvar** no topo e escolha um formato:

- **Word (.docx):** inclui texto, formatação comum, listas, tabelas, imagens, links, quebras e tamanho de página/margens.
- **PDF / Imprimir:** abre a caixa de impressão do navegador. Escolha **Salvar como PDF**. O PDF usa o papel e as margens do documento e mantém as páginas do editor; não altere as margens nem a escala (100%) e desmarque **Cabeçalhos e rodapés**.
- **Texto (.txt):** exporta o texto sem formatação.
- **HTML:** exporta estrutura e formatação suportadas pelo editor.
- **Markdown (.md):** exporta o conteúdo textual; não converte todas as marcas de formatação para sintaxe Markdown.

DOCX não é uma cópia pixel a pixel. Comentários, controle de alterações, cabeçalhos/rodapés, objetos flutuantes, gráficos, equações, colunas, fontes incorporadas e alguns estilos avançados podem ser simplificados. O Word e o LibreOffice podem recalcular a paginação ao abrir o arquivo.

Não há suporte nativo para `.doc` legado, `.odt`, documentos proprietários do Google Docs ou arquivos protegidos por senha. Converta esses formatos para DOCX, HTML ou texto antes de importar.

## 6. Instalar e usar offline

Abra a aplicação uma vez com conexão e aguarde o carregamento completo. Em um site publicado com HTTPS, use a opção **Instalar aplicativo** do navegador ou **Adicionar à tela inicial** no celular. Depois que os arquivos da aplicação estiverem em cache, o PWA poderá iniciar offline.

A primeira visita offline não é possível antes de o aplicativo ser carregado e armazenado em cache. A abertura e exportação de arquivos dependem das opções e permissões oferecidas pelo navegador.

## 7. Privacidade e cópias de segurança

O conteúdo fica no armazenamento local deste navegador; não há conta ou sincronização com servidor. Limpar os dados do navegador, mudar de perfil ou usar outro dispositivo pode tornar os documentos recentes indisponíveis. Exporte cópias importantes pelo menu **Salvar** e guarde-as em local seguro.

## 8. Solução de problemas

- **Não encontro um comando:** abra a guia correspondente e clique no menu de categoria; as opções de Imagem, Link, Tabela, Mais e Arquivo ficam nos dropdowns da guia Inserir.
- **Controles da imagem não aparecem:** clique diretamente na imagem para selecioná-la e abra **Inserir → Imagem**.
- **Não consigo alterar uma tabela:** coloque o cursor em uma célula; os comandos de tabela ficam habilitados somente dentro dela.
- **As alterações não aparecem em Documentos recentes:** aguarde o indicador de salvamento confirmar a gravação e confira se está no mesmo navegador/perfil.
- **O DOCX mudou de aparência:** confira se o tamanho do papel e as margens são os esperados. Recursos avançados e métricas de fontes podem ser interpretados de outra forma em cada editor.
- **Não consigo salvar PDF:** em **Salvar → PDF / Imprimir**, escolha a impressora **Salvar como PDF** na caixa de impressão do sistema.
- **A aplicação não abre offline:** conecte-se, abra a aplicação e aguarde o primeiro carregamento/cache. A instalação PWA requer um endereço HTTPS (exceto `localhost` durante desenvolvimento).

## Atalhos conhecidos

- `Ctrl+Enter` no Windows/Linux ou `⌘+Enter` no macOS: inserir quebra de página.
- `Ctrl+Z` / `⌘+Z`: desfazer.
- `Ctrl+Y` ou `Ctrl+Shift+Z` / `⌘+Shift+Z`: refazer (o atalho pode variar conforme o navegador).

Para recursos sem atalho listado, use os botões e menus do editor.
