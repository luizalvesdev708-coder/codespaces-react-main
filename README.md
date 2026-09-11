# Nexo RPPS

Console React com uma API Python leve para autenticação e dados de segurados.

## Desenvolvimento

Instale as dependências do frontend e backend:

```bash
npm install
python3 -m pip install -r requirements.txt
```

Em terminais separados, execute:

```bash
npm start
npm run start:backend
```

Para executar a API sem hot reload:

```bash
npm run start:backend:prod
```

Este projeto usa Uvicorn para servir o FastAPI. O comando `gunicorn` não é necessário; se for obrigatório no ambiente de produção, instale-o e use um worker ASGI compatível, como `uvicorn.workers.UvicornWorker`.

### Deploy no Render

O arquivo `render.yaml` já configura o serviço Python. No Render, use a raiz do repositório como diretório e deixe o Blueprint aplicar estas configurações. O comando correto é:

```bash
gunicorn -k uvicorn.workers.UvicornWorker backend.app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
```

Não use `gunicorn app:app`: o módulo da aplicação está em `backend.app`. Configure `CORS_ORIGINS` com a URL pública do frontend e defina um `DATABASE_PATH` persistente para não perder SQLite e uploads em redeploys.

O frontend fica em `http://localhost:3000` e encaminha `/api` para a API em `http://localhost:8000`.

Credenciais de demonstração: `sysadmin@rpps.sp.gov.br` / `admin123`.

O backend cria `backend/nexo.db` automaticamente, usa PBKDF2 para armazenar senhas e protege as rotas de dados com JWT. Em produção, defina `JWT_SECRET`, `DATABASE_PATH` e `CORS_ORIGINS` por variáveis de ambiente.

## Governança disponível

## Design e arquitetura

- Tokens compartilhados de tema em [`src/tokens.css`](src/tokens.css), com modos `dark`, `light` e `auto`.
- A interface usa estética HUD ciano/navy, grid técnico, foco visível e fallback PWA.
- A proposta de extração progressiva para micro-frontends está em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- A estratégia de migração para Android/iOS, offline-first e recursos nativos está em [`docs/MOBILE_ARCHITECTURE.md`](docs/MOBILE_ARCHITECTURE.md).
- O modo `auto` acompanha `prefers-color-scheme` em tempo real e a escolha é persistida por usuário.

- RBAC no backend com os perfis `SYSADMIN`, `Analista`, `Auditor`, `Gestor Financeiro` e `Atuário`.
- Contexto de tenant com troca sem logout, ambiente `PROD`/`HOMOLOG` e porte do RPPS.
- Auditoria persistida de login, leitura, troca de tenant e exportação.
- Health check de e-Social, CNIS, SICONFI e banco de dados.
- Central de notificações, versão do sistema e exportação CSV autenticada.
- Upload multipart de documentos com validação PDF/PNG/JPEG, limite de 10 MB, progresso, confirmação/erro e auditoria.
- Regras de preenchimento persistidas por tenant em `/api/settings`.
- Atualização de cadastro, ações de correção, exportação XML e registro de navegação em `/api/audit/action`.

SSO/SAML, MFA TOTP, webhooks de alertas, layouts oficiais XML/PDF de TCE/SPREV e rotinas de backup/DR continuam sendo pontos de integração de produção: a aplicação já expõe o contexto e as permissões necessários, mas esses serviços precisam de credenciais, políticas e contratos oficiais do ambiente do cliente.

## Checklist de interações

- [x] Menu lateral, abas, busca, tenant, tema, notificações, configurações, logout e alertas.
- [x] Seleção e drag-and-drop de documentos com validação, progresso, retry e auditoria.
- [x] Configurações de preenchimento com campos obrigatórios, formato de data, persistência e feedback.
- [x] Salvar/auditar cadastro, corrigir inconsistência e finalizar recadastramento.
- [x] Exportação CSV/XML e impressão para PDF pelo diálogo nativo do navegador.
- [x] Auditoria das ações autenticadas por usuário, tenant, horário, recurso e resultado.
- [ ] MFA real, SSO/SAML, envio externo de notificações e layout oficial de órgão: dependem de provedor/contrato do cliente.

Welcome to your shiny new Codespace running React! We've got everything fired up and running for you to explore React.

You've got a blank canvas to work on from a git perspective as well. There's a single initial commit with the what you're seeing right now - where you go from here is up to you!

Everything you do here is contained within this one codespace. There is no repository on GitHub yet. If and when you’re ready you can click "Publish Branch" and we’ll create your repository and push up your project. If you were just exploring then and have no further need for this code then you can simply delete your codespace and it's gone forever.

This project was bootstrapped for you with [Vite](https://vitejs.dev/).

## Available Scripts

In the project directory, you can run:

### `npm start`

We've already run this for you in the `Codespaces: server` terminal window below. If you need to stop the server for any reason you can just run `npm start` again to bring it back online.

Runs the app in the development mode.\
Open [http://localhost:3000/](http://localhost:3000/) in the built-in Simple Browser (`Cmd/Ctrl + Shift + P > Simple Browser: Show`) to view your running application.

The page will reload automatically when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## Learn More

You can learn more in the [Vite documentation](https://vitejs.dev/guide/).

To learn Vitest, a Vite-native testing framework, go to [Vitest documentation](https://vitest.dev/guide/)

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://sambitsahoo.com/blog/vite-code-splitting-that-works.html](https://sambitsahoo.com/blog/vite-code-splitting-that-works.html)

### Analyzing the Bundle Size

This section has moved here: [https://github.com/btd/rollup-plugin-visualizer#rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer#rollup-plugin-visualizer)

### Making a Progressive Web App

This section has moved here: [https://dev.to/hamdankhan364/simplifying-progressive-web-app-pwa-development-with-vite-a-beginners-guide-38cf](https://dev.to/hamdankhan364/simplifying-progressive-web-app-pwa-development-with-vite-a-beginners-guide-38cf)

### Advanced Configuration

This section has moved here: [https://vitejs.dev/guide/build.html#advanced-base-options](https://vitejs.dev/guide/build.html#advanced-base-options)

### Deployment

This section has moved here: [https://vitejs.dev/guide/build.html](https://vitejs.dev/guide/build.html)

### Troubleshooting

This section has moved here: [https://vitejs.dev/guide/troubleshooting.html](https://vitejs.dev/guide/troubleshooting.html)
