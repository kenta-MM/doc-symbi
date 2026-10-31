import { z } from 'zod';
import type { Block, Document } from '../domain/schema';
import { createDocument, editedDocument, type DocumentEnvironment } from '../domain/document';

const text = z.string().max(100000);
const content = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('paragraph'), text }),
  z.strictObject({ kind: z.literal('heading'), text, level: z.number().int().min(1).max(6) }),
  z.strictObject({ kind: z.literal('code'), text }),
  z.strictObject({ kind: z.literal('list'), style: z.enum(['bullet', 'ordered']), items: z.array(text).min(1).max(500) }),
  z.strictObject({ kind: z.literal('table'), rows: z.array(z.array(text).min(1).max(20)).min(1).max(100) }),
]);
const blocks = z.array(content).min(1).max(500);
export const aiDocumentActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('create'), title: z.string().trim().min(1).max(200), folderPath: z.string().max(2000), blocks }),
  z.strictObject({ type: z.literal('update'), documentId: z.uuid(), title: z.string().trim().min(1).max(200).nullable(), operations: z.array(z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('replace'), id: z.uuid(), block: content }),
    z.strictObject({ type: z.literal('insert'), afterId: z.uuid().nullable(), blocks }),
    z.strictObject({ type: z.literal('delete'), id: z.uuid() }),
  ])).max(500) }),
]);
export const aiReplySchema = z.strictObject({ message: z.string().max(100000), action: aiDocumentActionSchema.nullable() });
export type AiDocumentAction = z.infer<typeof aiDocumentActionSchema>;
export type AiReply = z.infer<typeof aiReplySchema>;

function makeBlock(input: z.infer<typeof content>, environment: DocumentEnvironment): Block {
  const identity = () => ({ id: environment.id(), metadata: {} });
  const normalize = (value: string) => value.replace(/\r\n?/g, '\n');
  if (input.kind === 'list') return { ...identity(), kind: 'list', style: input.style, items: input.items.map(value => ({ ...identity(), text: normalize(value), children: [] })) };
  if (input.kind === 'table') return { ...identity(), kind: 'table', rows: input.rows.map((row, index) => row.map(value => ({ ...identity(), text: normalize(value), header: index === 0 }))) };
  return { ...identity(), ...input, text: normalize(input.text) };
}

/** Only explicit document commands are accepted; no file paths or executable code. */
export function prepareAiDocument(raw: AiDocumentAction, current: Document | null, environment: DocumentEnvironment): Document {
  const action = aiDocumentActionSchema.parse(raw);
  if (action.type === 'create') return editedDocument(createDocument(action.title, environment), { blocks: action.blocks.map(block => makeBlock(block, environment)) }, environment.clock);
  if (!current || action.documentId !== current.id) throw new Error('修正対象の文書を開いて、もう一度依頼してください。');
  const result = [...current.blocks];
  for (const operation of action.operations) {
    if (operation.type === 'insert') {
      const index = operation.afterId === null ? -1 : result.findIndex(block => block.id === operation.afterId);
      if (operation.afterId !== null && index < 0) throw new Error('挿入先のブロックが見つかりません。');
      result.splice(index + 1, 0, ...operation.blocks.map(block => makeBlock(block, environment)));
    } else {
      const index = result.findIndex(block => block.id === operation.id);
      if (index < 0) throw new Error('修正対象のブロックが見つかりません。');
      if (operation.type === 'delete') result.splice(index, 1);
      else result[index] = { ...makeBlock(operation.block, environment), id: result[index]!.id, metadata: result[index]!.metadata };
    }
  }
  return editedDocument(current, { title: action.title ?? current.title, blocks: result }, environment.clock);
}
