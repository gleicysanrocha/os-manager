# Gestão de OS - Ordens de Serviço & Serviços Prestados

Uma aplicação web moderna, responsiva e de alta performance desenvolvida em **React / Next.js (App Router)** com **Tailwind CSS** e **Firebase** para gerenciamento de Ordens de Serviço e Serviços Prestados.

## Recursos do Aplicativo

- **Autenticação Segura**: Login e Cadastro de usuários integrados ao Firebase Auth.
- **Painel de Indicadores (Dashboard)**:
  - Faturamento Total do mês selecionado.
  - Valor Total Pago no mês selecionado.
  - Valor Total Pendente no mês selecionado.
- **Lançamento Rápido**: Formulário inteligente com campos de data, tipo de serviço, número da OS (opcional ou obrigatório conforme a regra do tipo de serviço), valor em R$ e observações.
- **Gestão de Tipos de Serviços**: Painel de configurações para cadastrar novos tipos de serviços e definir se o preenchimento do número da OS é obrigatório.
- **Filtros e Ações Rápidas**:
  - Filtro interativo por status (Todos, Pago, Pendente).
  - Filtro por mês de lançamento.
  - Alternador rápido de status de pagamento com apenas um clique diretamente na lista.
- **Módulo de Cobrança**:
  - Geração de resumo formatado de cobrança pronto para copiar e enviar via WhatsApp contendo todos os serviços pendentes do filtro ativo e o valor consolidado.

---

## Como Rodar Localmente

### 1. Configuração do Firebase
Para utilizar este projeto, você precisará de uma conta no Firebase:
1. Acesse o [Firebase Console](https://console.firebase.google.com/).
2. Crie um novo projeto Firebase.
3. No painel de controle do projeto, adicione um aplicativo da web (Web App) para obter as credenciais de configuração.
4. Ative a autenticação **Email/Senha** no menu *Authentication*.
5. Crie um banco de dados **Cloud Firestore** e habilite a escrita e leitura no modo de teste ou configure as regras de segurança padrão.

### 2. Configurando Variáveis de Ambiente
Renomeie ou edite o arquivo `.env.local` na raiz do projeto e preencha as variáveis com as credenciais obtidas no Firebase Console:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key_aqui
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_auth_domain_aqui
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_project_id_aqui
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_storage_bucket_aqui
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_messaging_sender_id_aqui
NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id_aqui
```

### 3. Rodando o Projeto
Instale as dependências e inicie o servidor de desenvolvimento:

```bash
# Instalar dependências
npm install

# Iniciar servidor local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador para ver o resultado.

---

## Enviando para o GitHub

Para subir seu projeto para um repositório no GitHub, execute os seguintes passos no seu terminal:

```bash
# Inicializar o repositório git local (caso ainda não esteja inicializado)
git init

# Adicionar todos os arquivos ao controle de versão (o arquivo .env.local é ignorado pelo .gitignore automaticamente)
git add .

# Criar o primeiro commit
git commit -m "feat: inicializando projeto gestao de os"

# Criar um repositório vazio no GitHub e vincular a esta pasta
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git

# Renomear branch principal para main
git branch -M main

# Enviar os arquivos para o repositório remoto
git push -u origin main
```

---

## Publicação (Deploy)

### Opção 1: Vercel (Recomendado)
A Vercel é a plataforma oficial dos criadores do Next.js e a forma mais fácil de publicar seu aplicativo:
1. Conecte sua conta do GitHub à [Vercel](https://vercel.com).
2. Clique em **Import Project** e selecione o repositório do projeto.
3. Na seção de **Environment Variables**, adicione as mesmas chaves e valores configurados no seu `.env.local`.
4. Clique em **Deploy**. O deploy será realizado de forma totalmente automatizada.

### Opção 2: Deploy Estático (GitHub Pages / Netlify / Hostings estáticos)
Como o projeto está configurado para ser executado no lado do cliente, você pode gerar um build estático:
1. No arquivo `next.config.ts`, adicione `output: 'export'` se desejar exportar arquivos HTML/CSS/JS estáticos.
2. Execute o comando:
   ```bash
   npm run build
   ```
3. A pasta `out` gerada conterá os arquivos estáticos prontos para serem hospedados em plataformas como GitHub Pages, Netlify ou AWS S3.
