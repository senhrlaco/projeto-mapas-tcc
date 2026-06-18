# Sistema de Logística e Check-in (Geofencing)

Projeto de TCC - Análise e Desenvolvimento de Sistemas (2026).
Desenvolvido por Lucas dos Santos de Oliveira Mello.

---

## Sobre o Projeto

Este sistema foi criado para resolver a ineficiência e a instabilidade técnica geradas por sistemas de rastreamento contínuo em equipes externas. O projeto substitui o rastreamento em segundo plano por um modelo de check-in pontual baseado em geofencing. 

Foi estabelecido um raio de validação de 100 metros do endereço do cliente. A solução preserva a privacidade e a bateria do colaborador, e garante à gestão (Painel Web) a segurança de que a visita foi realizada no local correto.

O ecossistema é dividido em três partes integradas:
1. Mobile (App do Agente): Aplicativo intuitivo em React Native para o colaborador em campo registrar sua chegada com validação nativa de GPS simulado (Anti Fake-GPS).
2. Back-end (API): Servidor central em Node.js que recebe as coordenadas e realiza o cálculo matemático da cerca virtual através da Fórmula de Haversine.
3. Painel Web (Gestão): Dashboard administrativo em React integrado à API do Mapbox para visualização, geocodificação e auditoria de presenças em tempo real.

---

## Tecnologias Utilizadas

- Back-end: Node.js, Express, Prisma ORM
- Banco de Dados: PostgreSQL
- Painel Web: React, Vite, TailwindCSS, Mapbox API
- Mobile: React Native, Expo

---

## Entendendo o Banco de Dados (DATABASE_URL)

Este projeto não utiliza arquivos físicos `.sql` para importar o banco de dados. Em vez disso, utilizamos o Prisma ORM, que lê uma URL de conexão e constrói as tabelas automaticamente.

A string de conexão deve ser colocada no arquivo `.env` do back-end e segue o formato padrão do PostgreSQL:
`DATABASE_URL="postgresql://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO"`

Como configurar:
- Local: Se você usa o PostgreSQL instalado no seu próprio computador (via pgAdmin ou Docker), o link será algo parecido com: `postgresql://postgres:suasenha@localhost:5432/tcc_logistica`
- Nuvem: Se você não quiser instalar um banco local, pode criar um banco PostgreSQL gratuito na nuvem (como no site Neon.tech) e colar a URL que eles fornecem.

Ao rodar os comandos de atualização explicados abaixo, o Prisma vai ler essa URL, conectar no banco e criar toda a estrutura de tabelas sozinho.

---

## Passo a Passo para Rodar o Sistema

### 1. Clonar o Repositório
No seu terminal, baixe o código e entre na pasta:
```bash
git clone https://github.com/senhrlaco/projeto-mapas-tcc.git
cd projeto-mapas-tcc
```

### 2. Configurar a API (Back-end)
Abra o terminal e acesse a pasta da API:
```bash
cd apps/backend-api
npm install
```
Crie um arquivo chamado `.env` nesta pasta e adicione as variáveis de ambiente:
```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/nome_do_banco"
JWT_SECRET="chave_secreta_para_testes"
ADMIN_PASSWORD="admin123"
```
Gere as tabelas no banco de dados e crie o usuário administrador padrão:
```bash
npx prisma db push
npx prisma db seed
npm run dev
```
A API estará rodando na porta 3333. O login gerado pelo comando seed é `admin` com a senha `admin123`.

### 3. Configurar o Painel Web
Abra um NOVO terminal (deixe o back-end rodando no primeiro) e acesse a pasta do painel:
```bash
cd apps/web-panel
npm install
```
Crie um arquivo `.env` nesta pasta informando onde a API está rodando e a chave do mapa:
```env
VITE_API_URL="http://localhost:3333/api"
VITE_MAPBOX_TOKEN="coloque_aqui_sua_chave_publica_do_mapbox"
```
Inicie o servidor do painel:
```bash
npm run dev
```
Acesse `http://localhost:5173` no seu navegador e faça login com as credenciais de admin criadas no passo anterior.

### 4. Configurar o Aplicativo Mobile
Abra um terceiro terminal e acesse a pasta do app:
```bash
cd apps/mobile-app
npm install
```
Como o celular é uma máquina separada do computador, você não pode usar `localhost` para acessar a API. Crie o arquivo `.env` com o IP da sua rede Wi-Fi (exemplo: 192.168.0.15):
```env
API_URL="http://192.168.0.15:3333/api"
```
Rode o servidor de desenvolvimento do Expo:
```bash
npx expo start -c --lan
```
Instale o aplicativo gratuito Expo Go no seu smartphone, escaneie o QR Code que apareceu no terminal e teste o sistema.

---

## Como gerar o instalador (APK) para Android

Se você quiser testar o aplicativo diretamente no celular de forma autônoma (sem depender do Expo Go conectado ao PC), você pode compilar o arquivo `.apk`.

No terminal, dentro da pasta `apps/mobile-app`, execute:
```bash
npm install -g eas-cli
eas build -p android --profile preview
```
O sistema pedirá para você fazer login com uma conta da Expo (criada gratuitamente no site deles) e começará a compilar o arquivo. Quando finalizar, o terminal exibirá um link direto para baixar o `.apk` pronto para instalação em qualquer dispositivo Android.
