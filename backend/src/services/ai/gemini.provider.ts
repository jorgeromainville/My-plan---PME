import { AiFailed, normalizeClasses, type AiInput, type AiProvider, type ScheduleClass } from './aiProvider';

// Gemini (Google AI Studio): key gratis y sin tarjeta en
// https://aistudio.google.com/apikey. Es multimodal: le mandamos la FOTO, así
// que entiende tablas, columnas y fotos giradas mejor que cualquier OCR.
const PROMPT = `Eres un asistente que digitaliza horarios escolares desde una foto o un texto OCR.
Devuelve la lista de clases del horario semanal.

Reglas:
- Responde SOLO con el JSON pedido (array de objetos).
- "day" en español, en minúsculas: lunes, martes, miercoles, jueves, viernes, sabado, domingo.
- "start" y "end" en 24h con formato HH:MM (por ejemplo "14:30"). Si ves "2:30 PM" escribe "14:30".
- Usa la columna de horas del horario para saber el inicio y el fin de cada clase.
- La foto puede estar girada o en columnas: interpreta la tabla como lo haría una persona.
- Junta bloques seguidos de la misma materia en una sola clase (inicio del primero, fin del último), pero NO los juntes si entre ellos hay un recreo o descanso.
- IGNORA: recreos, recesos, almuerzo, descansos, encabezados, nombres de días sueltos, números de hora y textos que no sean materias.
- Si el texto viene de un OCR desordenado (primero la lista de horas y después los días con sus materias), empareja cada materia con la hora que le toca en el orden de la tabla (la primera materia del día va con la primera hora, y así).
- No inventes materias. Si una clase no tiene hora legible, usa el orden de la tabla para estimarla.
- Si una materia aparece en varios días, devuélvela una vez por día.`;

const SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      day: { type: 'STRING' },
      subject: { type: 'STRING' },
      start: { type: 'STRING' },
      end: { type: 'STRING' },
    },
    required: ['day', 'subject', 'start', 'end'],
    propertyOrdering: ['day', 'subject', 'start', 'end'],
  },
};

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export class GeminiProvider implements AiProvider {
  name = 'gemini';
  private key: string;
  private models: string[];

  constructor(key: string, model: string, fallbacks = 'gemini-3-flash-preview,gemini-flash-latest') {
    this.key = key;
    // El modelo principal puede estar saturado (503) o no estar disponible para
    // la clave (404): probamos en cadena hasta que uno responda. El primero es el
    // más rápido y los siguientes sirven de respaldo si está saturado.
    const list = [model || 'gemini-flash-lite-latest', ...fallbacks.split(',')]
      .map((m) => m.trim())
      .filter(Boolean);
    this.models = [...new Set(list)];
  }

  private async call(model: string, parts: GeminiPart[]): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: SCHEMA,
          },
        }),
      });
    } catch {
      throw new AiFailed('No se pudo contactar a Gemini (revisa la conexión del servidor).');
    }
    if (!res.ok) return { ok: false, status: res.status, body: await res.text().catch(() => '') };
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      promptFeedback?: { blockReason?: string };
    };
    if (json.promptFeedback?.blockReason) {
      throw new AiFailed(`La IA bloqueó la imagen (${json.promptFeedback.blockReason}).`);
    }
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) throw new AiFailed('La IA no devolvió contenido.');
    return { ok: true, text };
  }

  async extractSchedule(input: AiInput): Promise<ScheduleClass[]> {
    const parts: GeminiPart[] = [{ text: PROMPT }];
    if (input.image) {
      parts.push({
        inline_data: { mime_type: input.mime || 'image/jpeg', data: input.image.toString('base64') },
      });
    }
    // Con foto, la IA ve mejor que el OCR: no le pasamos el texto (menos tokens
    // y menos confusión). El texto solo se usa en la pestaña "Texto".
    if (!input.image && input.text) {
      parts.push({ text: `Horario en texto:\n${input.text.slice(0, 8000)}` });
    }
    if (!input.image && !input.text) throw new AiFailed('No hay foto ni texto para analizar.');

    let last = '';
    for (const model of this.models) {
      const r = await this.call(model, parts);
      if (r.ok) return this.parse(r.text);

      last = `${model}: ${r.status}`;
      if (r.status === 400 && /API key not valid/i.test(r.body)) {
        throw new AiFailed('La GEMINI_API_KEY no es válida. Genérala en https://aistudio.google.com/apikey');
      }
      // 503 (saturado) / 429 (límite) / 404 (modelo no disponible) → siguiente modelo.
    }
    const friendly = /429/.test(last)
      ? 'Límite de uso de Gemini alcanzado. Espera un minuto y reintenta.'
      : 'Los modelos de Gemini están saturados ahora mismo. Reintenta en unos segundos.';
    throw new AiFailed(`${friendly} (${last})`);
  }

  private parse(text: string): ScheduleClass[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // A veces envuelve el JSON en ```json ... ```
      const m = text.match(/\[[\s\S]*\]/);
      if (!m) throw new AiFailed('La IA no devolvió JSON válido.');
      parsed = JSON.parse(m[0]);
    }
    return normalizeClasses(parsed);
  }
}
