# Instruções para agentes

- Antes de alterar código, leia `docs/ARQUITETURA_E_DESENVOLVIMENTO.md` e a skill relevante em `agent-skills/`.
- Preserve o funcionamento sem backend: documentos e arquivos são processados localmente no navegador.
- O editor usa TipTap/ProseMirror. Faça alterações no modelo por comandos/transações do editor, não manipulando diretamente o DOM editável.
- Para qualquer alteração de UI, mantenha acessibilidade básica (nome dos botões, foco, estados ativos/desabilitados) e atualize `docs/GUIA_DO_USUARIO.md` e `public/guia-do-usuario.html` quando a experiência do usuário mudar.
- Mudanças de paginação, réguas, imagens ou DOCX exigem seguir a skill específica e avaliar o comportamento visual/arquivo afetado; `pnpm build` sozinho não comprova fidelidade visual.
- Não editar `dist/` nem `node_modules/`; são artefatos gerados/dependências.
- Use TypeScript estrito e prefira alterações pequenas coerentes com os padrões existentes.
- Ao terminar mudanças de código, execute `pnpm build` e informe resultados e limitações reais.
