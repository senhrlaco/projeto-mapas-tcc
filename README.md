# Sistema de Logistica e Check-in (Geofencing)

Projeto de TCC - Analise e Desenvolvimento de Sistemas (2026).
Desenvolvido por Lucas dos Santos de Oliveira Mello.

Este sistema foi criado para substituir o rastreamento continuo de equipes externas por um modelo de check-in pontual baseado em geofencing (raio de 100 metros). O projeto e dividido em tres partes: uma API (Backend), um Painel Web (Gestao) e um Aplicativo Mobile (Agente).

## Tecnologias Utilizadas
- Backend: Node.js, Express, Prisma ORM
- Banco de Dados: PostgreSQL
- Painel Web: React, Vite, TailwindCSS
- Mobile: React Native, Expo

---

## Entendendo o Banco de Dados (DATABASE_URL)

Este projeto nao utiliza arquivos fisicos `.sql` para importar o banco de dados. Em vez disso, utilizamos o Prisma ORM, que le uma URL de conexao e constroi as tabelas automaticamente.

A string de conexao deve ser colocada no arquivo `.env` do backend e segue o formato padrao do PostgreSQL:
`DATABASE_URL="postgresql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO"`

Como configurar:
- Se voce usa o PostgreSQL instalado no seu proprio computador (via pgAdmin ou Docker), o link sera parecido com: `postgresql://postgres:suasenha@localhost:5432/tcc_logistica`
- Se voce nao quiser instalar um banco local, pode criar um banco PostgreSQL gratuito na nuvem (como no site Neon.tech) e colar a URL que eles fornecem.

Ao rodar os comandos de atualizacao explicados abaixo, o Prisma vai ler essa URL, conectar no banco e criar toda a estrutura de tabelas sozinho.

---

## Passo a Passo para Rodar o Sistema

### 1. Clonar o Repositorio
No seu terminal, baixe o codigo e entre na pasta:
```bash
git clone [https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git](https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git)
cd SEU_REPOSITORIO
```

### 2. Configurar a API (Backend)
Abra o terminal e acesse a pasta da API:
```bash
cd apps/backend-api
npm install
```
Crie um arquivo chamado `.env` nesta pasta e adicione as variaveis de ambiente:
```text
DATABASE_URL="postgresql://usuario:senha@localhost:5432/nome_do_banco"
JWT_SECRET="chave_secreta_para_testes"
ADMIN_PASSWORD="admin123"
```
Gere as tabelas no banco de dados e crie o usuario administrador padrao:
```bash
npx prisma db push
npx prisma db seed
npm run dev
```
A API estara rodando na porta 3333. O login gerado pelo comando seed e `admin` com a senha `admin123`.

### 3. Configurar o Painel Web
Abra um NOVO terminal (deixe o backend rodando no primeiro) e acesse a pasta do painel:
```bash
cd apps/web-panel
npm install
```
Crie um arquivo `.env` nesta pasta informando onde a API esta rodando:
```text
VITE_API_URL="http://localhost:3333/api"
```
Inicie o servidor do painel:
```bash
npm run dev
```
Acesse `http://localhost:5173` no seu navegador e faca login com as credenciais de admin criadas no passo anterior.

### 4. Configurar o Aplicativo Mobile
Abra um terceiro terminal e acesse a pasta do app:
```bash
cd apps/mobile-app
npm install
```
Como o celular e uma maquina separada do computador, voce nao pode usar "localhost" para acessar a API. Crie o arquivo `.env` com o IP da sua rede Wi-Fi (exemplo: 192.168.0.15):
```text
API_URL="[http://192.168.0.15:3333/api](http://192.168.0.15:3333/api)"
```
Rode o servidor de desenvolvimento do Expo:
```bash
npx expo start -c --lan
```
Instale o aplicativo gratuito "Expo Go" no seu smartphone, escaneie o QR Code que apareceu no terminal e teste o sistema.

---

## Como gerar o instalador (APK) para Android

Se voce quiser testar o aplicativo diretamente no celular de forma autonoma (sem depender do Expo Go conectado ao PC), voce pode compilar o arquivo `.apk`.

No terminal, dentro da pasta `apps/mobile-app`, execute:
```bash
npm install -g eas-cli
eas build -p android --profile preview
```
O sistema pedira para voce fazer login com uma conta da Expo (criada gratuitamente no site deles) e comecara a compilar o arquivo. Quando finalizar, o terminal exibira um link direto para baixar o `.apk` pronto para instalacao em qualquer dispositivo Android.
