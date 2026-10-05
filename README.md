# FinUp - Controle financeiro pessoal

Aplicação multiplataforma de controle financeiro desenvolvida para a disciplina de Laboratório de Desenvolvimento Multiplataforma da FATEC Marília.

## Estrutura

- `webapp/`: aplicação web React + Vite.
- `mobileapp/`: aplicação React Native + Expo.
- `shared/`: tipos e operações compartilhados de Firestore.
- `firestore.rules` e `firestore.indexes.json`: regras e índices do banco.
- `firebase.json`: configuração de Firestore, Hosting e emuladores.

## Projeto Firebase

O único projeto usado pelos aplicativos e pelo Hosting é **FinUp**, ID `finup-app6`. O `.firebaserc` seleciona esse projeto. As configurações locais devem ser copiadas dos exemplos:

```powershell
Copy-Item webapp\.env.example webapp\.env
Copy-Item mobileapp\.env.example mobileapp\.env
```

Preencha `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, `EXPO_PUBLIC_FIREBASE_API_KEY` e `EXPO_PUBLIC_FIREBASE_APP_ID` com os valores do app web FinUp cadastrado no Firebase Console. Não versione arquivos `.env`.

Os aplicativos validam o ID `finup-app6` na inicialização para evitar conexões acidentais aos projetos de desenvolvimento ou a outro Firebase.

## Modelo Firestore

- `usuarios/{uid}`: perfil associado ao UID do Firebase Authentication.
- `familias/{familiaId}`: família; o usuário principal usa seu UID como `familiaId`.
- `familias/{familiaId}/contas/{contaId}`: contas e saldos.
- `familias/{familiaId}/categorias/{categoriaId}`: categorias iniciais criadas junto com uma nova família.
- `familias/{familiaId}/transacoes/{transacaoId}`: receitas, despesas e registros das duas pontas de uma transferência.
- `familias/{familiaId}/transferencias/{transferenciaId}`: vínculo atômico das duas pontas de uma transferência.
- `familias/{familiaId}/logs_atividades/{logId}`: auditoria das operações.
- `convites/{token}`: convites vinculados ao e-mail autenticado.

As regras restringem os documentos financeiros a membros da família e os convites a quem os enviou ou ao e-mail convidado. As consultas atuais usam índices de campo simples; os índices compostos serão adicionados em `firestore.indexes.json` caso novas consultas os exijam.

## Desenvolvimento

Requisitos: Node.js 20+, npm, Firebase CLI e JDK 21+ para os testes do emulador. Instale as dependências na raiz, em `webapp/` e em `mobileapp/`, conforme os respectivos lockfiles.

```powershell
Push-Location webapp
npm run dev
Pop-Location
```

Para o app mobile, configure `mobileapp/.env` e inicie o Expo:

```powershell
Push-Location mobileapp
npm start
Pop-Location
```

Para usar os emuladores, defina `VITE_USE_FIREBASE_EMULATORS=true` no `.env` web e `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true` no `.env` mobile. O Android Emulator usa `10.0.2.2` para acessar a máquina host; iOS Simulator e navegador local normalmente usam `127.0.0.1`.

```powershell
firebase emulators:start --project finup-app6 --only auth,firestore,hosting
```

Os testes de regras e de operações financeiras usam um projeto de demonstração isolado:

```powershell
npm run test:firestore
```

É necessário ter JDK 21 ou superior para iniciar a versão atual do emulador Firestore.

## Operações e saldos

As operações compartilhadas estão em `shared/services/finupService.ts`. Receitas e despesas efetivadas atualizam o saldo na mesma transação Firestore; lançamentos pendentes não alteram o saldo até serem efetivados. Uma transferência efetivada debita a origem e credita o destino atomicamente. O formulário oferece criação de contas e exige contas distintas para transferências.

## Regras, índices e Hosting

Para publicar regras e índices:

```powershell
firebase deploy --only firestore:rules,firestore:indexes --project finup-app6
```

Para publicar a aplicação web:

```powershell
Push-Location webapp
npm run build
Pop-Location
firebase deploy --only hosting --project finup-app6
```

O Hosting usa o site `finup-app6` e reescreve as rotas da SPA para `index.html`.

## Dados legados e contas existentes

O projeto Firestore será iniciado vazio, conforme definido para esta migração; não há cópia automática das tabelas SQL Connect. A API Data Connect dos projetos anteriores não está habilitada/acessível neste ambiente. Os perfis e vínculos familiares legados não foram recriados. Contas antigas de Authentication sem um perfil correspondente em `usuarios/{uid}` ficam sem acesso financeiro até que esses vínculos sejam recuperados; não são convertidas automaticamente em famílias principais.

Contas de Authentication são independentes dos dados do Firestore. A importação das contas antigas precisa preservar UIDs e os parâmetros de hash de senha do projeto de origem; uma conta existente no destino prevalece sobre um e-mail duplicado. Não compartilhe chaves ou parâmetros de hash em arquivos versionados.

## Equipe

| Nome | Função |
| --- | --- |
| Carlos Cumpiam | Desenvolvimento Web e Backend |
| Carlos Furlan | Desenvolvimento Web e Backend |
| Douglas Bezerra | Desenvolvimento Mobile |

## Licença

MIT
