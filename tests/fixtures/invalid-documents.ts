import { fixtureDocument } from './documents';
const base = fixtureDocument();
export const invalidDocuments: [string, unknown][] = [
  ['format', { ...base, format: 'other' }],
  ['version', { ...base, schemaVersion: 99 }],
  ['unknown key', { ...base, extra: true }],
  ['empty blocks', { ...base, blocks: [] }],
  ['blank title', { ...base, title: ' \t ' }],
  ['bad id', { ...base, id: 'bad' }],
  ['non UTC date', { ...base, createdAt: '2026-10-25T09:00:00+09:00' }],
  ['missing metadata', { ...base, metadata: undefined }],
  ['metadata number', { ...base, metadata: 4 }],
  ['metadata infinity', { ...base, metadata: { value: Infinity } }],
  ['duplicate element', { ...base, blocks: [base.blocks[0], base.blocks[0]] }],
  ['carriage return', { ...base, blocks: [{ ...base.blocks[0], text: 'a\rb' }] }],
  ['unsupported kind', { ...base, blocks: [{ ...base.blocks[0], kind: 'image' }] }],
  ['heading level', { ...base, blocks: [{ ...base.blocks[0], kind: 'heading', level: 7 }] }],
  ['fractional level', { ...base, blocks: [{ ...base.blocks[0], kind: 'heading', level: 1.5 }] }],
  ['non-string text', { ...base, blocks: [{ ...base.blocks[0], text: 42 }] }],
  ['unknown block key', { ...base, blocks: [{ ...base.blocks[0], extra: null }] }],
];
