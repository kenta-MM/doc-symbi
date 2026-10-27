import { z } from 'zod';
import { textSchema } from './text';

export const imageByteLimit = 3 * 1024 * 1024;
const strings = z.array(textSchema).max(500);
export const imageSemanticsSchema = z.strictObject({
  version: z.literal(1), purpose: textSchema, summary: textSchema,
  entities: z.array(z.strictObject({ id: z.string().min(1), label: textSchema, role: textSchema })).max(500),
  relationships: z.array(z.strictObject({ from: z.string(), to: z.string(), meaning: textSchema })).max(1000),
  readingOrder: strings, assumptions: strings,
  sources: z.array(z.strictObject({ title: textSchema, url: z.url().refine(value => /^https?:\/\//.test(value)), accessedAt: z.iso.date() })).max(100),
}).superRefine((value, context) => {
  const ids = new Set(value.entities.map(entity => entity.id));
  if (ids.size !== value.entities.length) context.addIssue({ code: 'custom', message: '構成要素の ID が重複しています' });
  if (value.relationships.some(edge => !ids.has(edge.from) || !ids.has(edge.to)) || value.readingOrder.some(id => !ids.has(id)))
    context.addIssue({ code: 'custom', message: '関係・読み順には存在する構成要素 ID を指定してください' });
});
export type ImageSemantics = z.infer<typeof imageSemanticsSchema>;
export const emptyImageSemantics = (): ImageSemantics => ({ version: 1, purpose: '', summary: '', entities: [], relationships: [], readingOrder: [], assumptions: [], sources: [] });
export const imageFileSchema = z.strictObject({
  id: z.uuid(), fileName: z.string().min(1).max(255),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  byteLength: z.number().int().positive().max(imageByteLimit),
  width: z.number().int().positive().max(20000), height: z.number().int().positive().max(20000),
  data: z.string().max(4 * Math.ceil(imageByteLimit / 3)).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
}).superRefine((file, context) => {
  const bytes = file.data.length * 3 / 4 - (file.data.endsWith('==') ? 2 : file.data.endsWith('=') ? 1 : 0);
  if (bytes !== file.byteLength) context.addIssue({ code: 'custom', message: '画像のバイト数が一致しません' });
});
export type ImageFile = z.infer<typeof imageFileSchema>;
export const imageSource = (file: ImageFile): string => `data:${file.mimeType};base64,${file.data}`;
