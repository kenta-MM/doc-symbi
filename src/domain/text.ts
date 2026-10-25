import { z } from 'zod';

export const textSchema = z.string().refine(text => !text.includes('\r'), '本文の改行は LF を使用してください');

export function assertTextOffset(text: string, offset: number): void {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) throw new RangeError('Invalid text offset');
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff) {
    throw new RangeError('Offset splits a surrogate pair');
  }
}

export function normalizeClipboard(text: string): string { return text.replace(/\r\n?/g, '\n'); }

export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const point = char.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}
