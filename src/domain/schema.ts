import { z } from 'zod';
import { metadataSchema } from './metadata';
import { textSchema } from './text';
import { imageFileSchema, imageSemanticsSchema } from './image';
import { formattingSchema, languageSchema, bodyVersion } from './rich-text';
import { quizQuestionsSchema } from './quiz';

const identity = { id: z.uuid(), metadata: metadataSchema };
const formatting = formattingSchema.optional();
export const paragraphSchema = z.strictObject({ ...identity, kind: z.literal('paragraph'), text: textSchema, formatting });
export const headingSchema = z.strictObject({ ...identity, kind: z.literal('heading'), text: textSchema, formatting, level: z.number().int().min(1).max(6) });
export const codeSchema = z.strictObject({ ...identity, kind: z.literal('code'), text: textSchema, language: languageSchema.optional() });
export const listSchema = z.strictObject({
  ...identity, kind: z.literal('list'), style: z.enum(['bullet', 'ordered']),
  get items(): z.ZodArray<z.ZodObject<{
    id: typeof identity.id; metadata: typeof metadataSchema;
    text: typeof textSchema; formatting: typeof formatting; children: z.ZodArray<typeof listSchema>;
  }>> {
    return z.array(z.strictObject({ ...identity, text: textSchema, formatting, children: z.array(listSchema) })).min(1);
  },
});
export const listItemSchema = listSchema.shape.items.element;
export const imageSchema = z.strictObject({ ...identity, kind: z.literal('image'), file: imageFileSchema, caption: textSchema, alt: textSchema, semantics: imageSemanticsSchema,
  displaySize: z.strictObject({ width: z.number().int().positive().max(20000), height: z.number().int().positive().max(20000) }).optional(),
});
export type ImageBlock = z.infer<typeof imageSchema>;
export const tableCellSchema = z.strictObject({ ...identity, text: textSchema, formatting, header: z.boolean() });
export const tableSchema = z.strictObject({ ...identity, kind: z.literal('table'), rows: z.array(z.array(tableCellSchema).min(1).max(20)).min(1).max(100) }).refine(table => table.rows.every(row => row.length === table.rows[0]!.length), '表の列数が一致しません');
export const quizSchema = z.strictObject({ ...identity, kind: z.literal('quiz'), questions: quizQuestionsSchema });
export type QuizBlock = z.infer<typeof quizSchema>;
export const blockSchema = z.discriminatedUnion('kind', [paragraphSchema, headingSchema, codeSchema, listSchema, imageSchema, tableSchema, quizSchema]);
export const documentSchema = z.strictObject({
  format: z.literal('docsymbi'), schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), ...identity,
  title: z.string().refine(value => value.trim().length > 0, '名前を入力してください'),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), blocks: z.array(blockSchema).min(1),
}).refine(value => bodyVersion(value.blocks, value.schemaVersion) === value.schemaVersion, '拡張された本文には対応する文書バージョンが必要です');
export type Document = z.infer<typeof documentSchema>;
export type Block = z.infer<typeof blockSchema>;
export type List = z.infer<typeof listSchema>;
export type ListItem = z.infer<typeof listItemSchema>;
