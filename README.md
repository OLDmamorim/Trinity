# Trinity

A assistente pessoal do Marco: uma app no telemóvel (instalável a partir do Chrome) com quem se fala por escrito ou por voz. Lê os dados do PoweringEG, prepara o briefing da manhã e dá orientação para o dia.

## O que já faz (fase 1)
- **Hoje**: briefing do dia preparado com os dados do PoweringEG (prioridades, lojas sem visita, pendentes, reuniões). Pode ser ouvido em voz alta.
- **Conversa**: chat por texto ou voz (botão de microfone). Quando falas por voz, a resposta é lida em voz alta pelo telemóvel.
- **Notificação da manhã** com o briefing (8h, segunda a sexta, configurável).
- **Memória**: a Trinity guarda preferências e objetivos que lhe contas.
- Acesso só com palavra-passe (o Chrome guarda-a e preenche-a com a impressão digital).

Próximas fases: Google Calendar e Gmail, sugestões do YouTube, coaching. Ver o plano no projeto.

## Como funciona
- `client/`: app React (Vite + Tailwind) instalável (PWA), com service worker para notificações.
- `server/`: Node + Express. Fala com o Claude (com ferramentas para ler o PoweringEG), transcreve a voz com a OpenAI (whisper-1) e envia notificações push.
- Base de dados SQLite (nativa do Node 22) num volume.
- O PoweringEG é lido só através da API externa (`/api/external/...`) com uma chave própria; a Trinity nunca escreve no PoweringEG.

## Pôr a funcionar no Railway
1. No Railway: **New Project → Deploy from GitHub repo → OLDmamorim/Trinity**.
2. No serviço, **Settings → Volumes**: adicionar um volume montado em `/data`.
3. **Variables**: `TRINITY_PASSWORD`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `POWERING_URL`, `POWERING_API_KEY` e `DATA_DIR=/data`. O segredo da sessão e as chaves das notificações são gerados pela app na primeira vez e ficam no volume.
4. No PoweringEG (admin → Chaves de API), criar uma chave com a permissão **assistente** e colocá-la em `POWERING_API_KEY`. A chave fica associada a quem a cria, por isso deve ser criada pelo Marco.
5. **Settings → Networking → Generate Domain** e abrir esse endereço no Chrome do telemóvel.
6. No Chrome: menu ⋮ → **Instalar app** (ou "Adicionar ao ecrã principal"). Depois, no ecrã Hoje, tocar em "Ativar notificações".

## Desenvolvimento
```bash
npm install
cp .env.example .env   # preencher
npm run dev            # servidor na porta 3000
npm run dev:client     # app em http://localhost:5173 (com proxy para o servidor)
npm test && npm run typecheck && npm run build
```
