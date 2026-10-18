// Base de dados local (SQLite nativo do Node). Guarda conversa, memórias, briefings e subscrições push.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

let db: DatabaseSync | null = null;

export function abrirDb(ficheiro?: string): DatabaseSync {
  if (db) return db;
  const destino = ficheiro ?? path.join(config.pastaDados, "trinity.db");
  if (destino !== ":memory:") fs.mkdirSync(path.dirname(destino), { recursive: true });
  db = new DatabaseSync(destino);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS mensagens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      papel TEXT NOT NULL CHECK (papel IN ('user','assistant')),
      texto TEXT NOT NULL,
      por_voz INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS memorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      texto TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS briefings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dia TEXT NOT NULL,
      texto TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS segredos (
      nome TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subscricoes_push (
      endpoint TEXT PRIMARY KEY,
      dados TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export function fecharDb() {
  db?.close();
  db = null;
}

// ---------- Conversa ----------
export type Mensagem = { id: number; papel: "user" | "assistant"; texto: string; por_voz: number; criado_em: string };

export function guardarMensagem(papel: "user" | "assistant", texto: string, porVoz = false): Mensagem {
  const r = abrirDb()
    .prepare("INSERT INTO mensagens (papel, texto, por_voz) VALUES (?, ?, ?) RETURNING *")
    .get(papel, texto, porVoz ? 1 : 0);
  return r as unknown as Mensagem;
}

export function ultimasMensagens(limite = 30): Mensagem[] {
  const rows = abrirDb()
    .prepare("SELECT * FROM mensagens ORDER BY id DESC LIMIT ?")
    .all(limite) as unknown as Mensagem[];
  return rows.reverse();
}

export function apagarConversa() {
  abrirDb().exec("DELETE FROM mensagens");
}

// ---------- Memórias ----------
export type Memoria = { id: number; texto: string; criado_em: string };

export function listarMemorias(): Memoria[] {
  return abrirDb().prepare("SELECT * FROM memorias ORDER BY id").all() as unknown as Memoria[];
}

export function guardarMemoria(texto: string): Memoria {
  return abrirDb().prepare("INSERT INTO memorias (texto) VALUES (?) RETURNING *").get(texto) as unknown as Memoria;
}

export function apagarMemoria(id: number): boolean {
  return Number(abrirDb().prepare("DELETE FROM memorias WHERE id = ?").run(id).changes) > 0;
}

// ---------- Briefings ----------
export type Briefing = { id: number; dia: string; texto: string; criado_em: string };

export function guardarBriefing(dia: string, texto: string): Briefing {
  return abrirDb().prepare("INSERT INTO briefings (dia, texto) VALUES (?, ?) RETURNING *").get(dia, texto) as unknown as Briefing;
}

export function briefingDoDia(dia: string): Briefing | undefined {
  return abrirDb().prepare("SELECT * FROM briefings WHERE dia = ? ORDER BY id DESC LIMIT 1").get(dia) as unknown as
    | Briefing
    | undefined;
}

// ---------- Push ----------
export function guardarSubscricao(endpoint: string, dados: unknown) {
  abrirDb()
    .prepare("INSERT INTO subscricoes_push (endpoint, dados) VALUES (?, ?) ON CONFLICT(endpoint) DO UPDATE SET dados = excluded.dados")
    .run(endpoint, JSON.stringify(dados));
}

export function listarSubscricoes(): { endpoint: string; dados: string }[] {
  return abrirDb().prepare("SELECT endpoint, dados FROM subscricoes_push").all() as unknown as { endpoint: string; dados: string }[];
}

export function apagarSubscricao(endpoint: string) {
  abrirDb().prepare("DELETE FROM subscricoes_push WHERE endpoint = ?").run(endpoint);
}

// ---------- Segredos gerados pela própria app ----------
/** Devolve o segredo guardado com este nome, ou cria-o com `gerar` na primeira vez. */
export function segredo(nome: string, gerar: () => string): string {
  const d = abrirDb();
  const r = d.prepare("SELECT valor FROM segredos WHERE nome = ?").get(nome) as { valor: string } | undefined;
  if (r) return r.valor;
  const valor = gerar();
  d.prepare("INSERT INTO segredos (nome, valor) VALUES (?, ?)").run(nome, valor);
  return valor;
}
