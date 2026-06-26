import { join } from 'path';
import { existsSync } from 'fs';

/** Frontend build papkalarini qidirish (mahalliy va Render) */
export function resolveFrontendPath(): string | null {
  const candidates = [
    join(process.cwd(), 'public'),
    join(process.cwd(), '..', 'frontend', 'dist', 'frontend', 'browser'),
    join(process.cwd(), 'frontend', 'dist', 'frontend', 'browser'),
  ];

  for (const path of candidates) {
    if (existsSync(join(path, 'index.html'))) {
      return path;
    }
  }
  return null;
}
