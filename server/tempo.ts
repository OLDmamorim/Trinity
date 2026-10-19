// Previsão do tempo com a Open-Meteo (grátis, sem chave).

const DESCRICAO: Record<number, string> = {
  0: "céu limpo", 1: "pouco nublado", 2: "parcialmente nublado", 3: "nublado",
  45: "nevoeiro", 48: "nevoeiro com geada",
  51: "chuvisco fraco", 53: "chuvisco", 55: "chuvisco forte",
  61: "chuva fraca", 63: "chuva", 65: "chuva forte",
  66: "chuva gelada fraca", 67: "chuva gelada",
  71: "neve fraca", 73: "neve", 75: "neve forte", 77: "grãos de neve",
  80: "aguaceiros fracos", 81: "aguaceiros", 82: "aguaceiros fortes",
  85: "aguaceiros de neve", 86: "aguaceiros de neve fortes",
  95: "trovoada", 96: "trovoada com granizo", 99: "trovoada forte com granizo",
};

export function descreverTempo(codigo: number | null | undefined): string {
  return codigo == null ? "sem dados" : DESCRICAO[codigo] ?? `código ${codigo}`;
}

async function obter<T>(url: string): Promise<T> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!resp.ok) throw new Error(`Meteorologia indisponível (${resp.status}).`);
  return (await resp.json()) as T;
}

type Local = { name: string; admin1?: string; latitude: number; longitude: number };

async function localizar(local: string): Promise<Local> {
  const procurar = (pais: string) =>
    obter<{ results?: Local[] }>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(local)}&count=1&language=pt${pais}`,
    );
  const r = (await procurar("&countryCode=PT")).results?.[0] ?? (await procurar("")).results?.[0];
  if (!r) throw new Error(`Não encontrei o local "${local}".`);
  return r;
}

type Previsao = {
  current?: { temperature_2m: number; apparent_temperature: number; precipitation: number; weather_code: number; wind_speed_10m: number };
  daily?: {
    time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[];
    precipitation_probability_max: number[]; precipitation_sum: number[]; wind_speed_10m_max: number[];
  };
};

/** Tempo atual e previsão diária (até 16 dias) para um local, na hora de Lisboa. */
export async function previsao(local = "Braga", dias = 3) {
  const l = await localizar(local);
  const p = await obter<Previsao>(
    `https://api.open-meteo.com/v1/forecast?latitude=${l.latitude}&longitude=${l.longitude}` +
      "&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max" +
      `&timezone=Europe%2FLisbon&forecast_days=${Math.min(16, Math.max(1, dias))}`,
  );
  const d = p.daily;
  return {
    local: [l.name, l.admin1].filter(Boolean).join(", "),
    agora: p.current
      ? {
          temperatura: p.current.temperature_2m,
          sensacao: p.current.apparent_temperature,
          ceu: descreverTempo(p.current.weather_code),
          chuvaMm: p.current.precipitation,
          ventoKmh: p.current.wind_speed_10m,
        }
      : null,
    dias: d
      ? d.time.map((dia, i) => ({
          dia,
          ceu: descreverTempo(d.weather_code[i]),
          min: d.temperature_2m_min[i],
          max: d.temperature_2m_max[i],
          probChuva: d.precipitation_probability_max[i],
          chuvaMm: d.precipitation_sum[i],
          ventoMaxKmh: d.wind_speed_10m_max[i],
        }))
      : [],
  };
}
