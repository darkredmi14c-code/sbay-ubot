import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiAnalysisResult } from '../common/types';

const SYSTEM_PROMPT = `Sen O'zbekistondagi Telegram guruhlaridagi xabarlarni tahlil qiluvchi yordamchisan.
Vazifang: xabar kunlik ish yoki kunlik ishchi haqida ekanligini aniqlash.

QAT'IY QOIDALAR:
1. Faqat JSON qaytar — boshqa matn yo'q.
2. Format: {"isDailyWork": true|false, "type": "employer"|"seeker", "reason": "qisqa sabab"}
3. isDailyWork=true faqat kunlik (bir kunlik, vaqtinchalik) ish yoki ishchi kerak bo'lsa.
4. type="employer" — ish beruvchi, xodim/qisman ishchi qidiradi.
5. type="seeker" — ishchi, kunlik ish qidiradi.
6. Doimiy ish, reklama, savdo, kurs, bot xabarlari uchun isDailyWork=false qaytar.
7. reason maydoni o'zbek tilida, 1 jumla.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly config: ConfigService) {}

  async analyzeMessage(text: string): Promise<AiAnalysisResult> {
    const provider = this.config.get<string>('AI_PROVIDER', 'groq');

    try {
      if (provider === 'gemini') {
        return await this.analyzeWithGemini(text);
      }
      return await this.analyzeWithGroq(text);
    } catch (error) {
      this.logger.error(`AI tahlil xatosi: ${(error as Error).message}`);
      return { isDailyWork: false, type: 'seeker', reason: 'AI xatosi' };
    }
  }

  private async analyzeWithGroq(text: string): Promise<AiAnalysisResult> {
    const apiKey = this.config.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new Error("GROQ_API_KEY o'rnatilmagan");
    }

    const model = this.config.get<string>('GROQ_MODEL', 'llama-3.1-8b-instant');

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Quyidagi xabarni tahlil qil:\n\n${text.slice(0, 4000)}`,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Groq API: ${response.status} — ${body}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices[0]?.message?.content ?? '{}';
    return this.parseResult(content);
  }

  private async analyzeWithGemini(text: string): Promise<AiAnalysisResult> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY o'rnatilmagan");
    }

    const model = this.config.get<string>(
      'GEMINI_MODEL',
      'gemini-2.0-flash-lite',
    );

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${SYSTEM_PROMPT}\n\nQuyidagi xabarni tahlil qil:\n\n${text.slice(0, 4000)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini API: ${response.status} — ${body}`);
    }

    const data = (await response.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
    };
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    return this.parseResult(content);
  }

  private parseResult(raw: string): AiAnalysisResult {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '');

    const parsed = JSON.parse(cleaned) as Partial<AiAnalysisResult>;

    const isDailyWork = parsed.isDailyWork === true;
    const type = parsed.type === 'employer' ? 'employer' : 'seeker';

    return {
      isDailyWork,
      type,
      reason: parsed.reason ?? '',
    };
  }
}
