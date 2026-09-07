# 💰 FinUp - Controle Financeiro Pessoal

Projeto desenvolvido para a disciplina de [NOME DA DISCIPLINA] da [NOME DA FACULDADE].

## 📁 Estrutura do Projeto
FinUp/
├── dataconnect/      # Firebase Data Connect (backend)
│ ├── schema/         # Definição do banco de dados
│ └── example/        # Queries e Mutations GraphQL
├── web-app/          # Aplicação Web (React + Vite)
│ ├── src/
│ └── package.json
├── mobile-app/       # Aplicação Mobile (React Native + Expo)
│ ├── src/
│ └── package.json
├── firebase.json     # Configuração dos emuladores
├── .firebaserc       # Projeto Firebase (finup-app6)
└── README.md

## 🚀 Como Rodar o Projeto

### Pré-requisitos

- Node.js 20+
- npm ou yarn
- Firebase CLI (`npm install -g firebase-tools`)

### 1. Clonar o Repositório

```bash
git clone URL_DO_REPOSITORIO
cd FinUp

**### 2. Configurar o Firebase**

bash

# Login no Firebase
firebase login

# Iniciar o emulador (mantenha rodando)
firebase emulators:start --only dataconnect

**### 3. Rodar a Aplicação Web**

bash

cd web-app
npm install
npm run dev
# Acesse: http://localhost:5173

**### 4. Rodar a Aplicação Mobile**

bash

cd mobile-app
npm install
npx expo start
# Escaneie o QR Code com o app Expo Go

🗄️ Firebase Data Connect
Estrutura do Banco de Dados

O schema está em dataconnect/schema/schema.gql e inclui:

    Usuários (Principal/Secundário)

    Contas (Corrente, Poupança, Cartão, Caixinha)

    Transações (Receita, Despesa, Transferência)

    Categorias (com subcategorias)

    Parcelamentos

    Recorrências

    Faturas de Cartão

Adicionando Novas Queries/Mutações

    Edite os arquivos em dataconnect/example/

    O SDK será gerado automaticamente em */src/dataconnect-generated/

👥 Equipe
Nome	Função
Carlos Cumpiam   Desenvolvimento Web e Backend
Carlos Furlan    Desenvolvimento Web e Backend
Douglas Bezerra  Desenvolvimento Mobile

📝 Licença

MIT
text


---

**### Passo 8: Adicionar e Commitar as Mudanças**

```bash
# 1. Verifique o status
git status

# 2. Adicione tudo
git add .

# 3. Commit com mensagem descritiva
git commit -m "refactor: reorganiza estrutura em monorepo

- Move projeto React Native para mobile-app/
- Adiciona projeto React Web em web-app/
- Adiciona Firebase Data Connect em dataconnect/
- Configura emuladores Firebase
- Atualiza .gitignore e README

BREAKING CHANGE: Estrutura do repositório foi alterada.
Todos devem atualizar com 'git pull' e ajustar seus caminhos locais."

# 4. Envie para o GitHub
git push origin main

