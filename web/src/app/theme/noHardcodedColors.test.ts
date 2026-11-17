import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Colors live only in src/app/theme (design system): components use tokens / CSS variables. */
const SRC = join(__dirname, '..', '..');
const THEME = join(SRC, 'app', 'theme');
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\(/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path === THEME ? [] : files(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

describe('design system', () => {
  it('no hard-coded colors outside src/app/theme', () => {
    const offenders = files(SRC).filter((f) => {
      const text = readFileSync(f, 'utf8');
      return HEX.test(text) || RGB.test(text);
    });
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });
});
