import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, verificarConfig } from "./config.js";
import { abrirDb } from "./db.js";
import { criarApp } from "./app.js";
import { agendarBriefing } from "./briefing.js";

for (const aviso of verificarConfig()) console.warn(`[config] ${aviso}`);

abrirDb();
const aqui = path.dirname(fileURLToPath(import.meta.url));
// Em produção o servidor corre a partir de dist/server.js e a app está em dist/client.
const pastaCliente = path.resolve(aqui, config.producao ? "client" : "../dist/client");
const app = criarApp(pastaCliente);
agendarBriefing();

app.listen(config.porta, () => console.log(`Trinity a correr na porta ${config.porta}`));
