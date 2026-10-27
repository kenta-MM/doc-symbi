import { z } from 'zod';
import { metadataSchema } from './metadata';
import { textSchema } from './text';
import { imageFileSchema, imageSemanticsSchema } from './image';

const identity = { id: z.uuid(), metadata: metadataSchema };
export const paragraphSchema = z.strictObject({ ...identity, kind: z.literal('paragraph'), text: textSchema });
export const headingSchema = z.strictObject({ ...identity, kind: z.literal('heading'), text: textSchema, level: z.number().int().min(1).max(6) });
export const codeSchema = z.strictObject({ ...identity, kind: z.literal('code'), text: textSchema });
export const listSchema = z.strictObject({
  ...identity, kind: z.literal('list'), style: z.enum(['bullet', 'ordered']),
  get items(): z.ZodArray<z.ZodObject<{
    id: typeof identity.id; metadata: typeof metadataSchema;
    text: typeof textSchema; children: z.ZodArray<typeof listSchema>;
  }>> {
    return z.array(z.strictObject({ ...identity, text: textSchema, children: z.array(listSchema) })).min(1);
  },
});
export const listItemSchema = listSchema.shape.items.element;
export const imageSchema = z.strictObject({ ...identity, kind: z.literal('image'), file: imageFileSchema, caption: textSchema, alt: textSchema, semantics: imageSemanticsSchema });
export type ImageBlock = z.infer<typeof imageSchema>;
export const blockSchema = z.discriminatedUnion('kind', [paragraphSchema, headingSchema, codeSchema, listSchema, imageSchema]);
export const documentSchema = z.strictObject({
  format: z.literal('docsymbi'), schemaVersion: z.union([z.literal(1), z.literal(2)]), ...identity,
  title: z.string().refine(value => value.trim().length > 0, '名前を入力してください'),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), blocks: z.array(blockSchema).min(1),
}).refine(value => value.schemaVersion === 2 || !value.blocks.some(block => block.kind === 'image'), '画像を含む文書には schemaVersion 2 が必要です');
export type Document = z.infer<typeof documentSchema>;
export type Block = z.infer<typeof blockSchema>;
export type List = z.infer<typeof listSchema>;
export type ListItem = z.infer<typeof listItemSchema>;
