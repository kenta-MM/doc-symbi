import type { Block, Document } from './schema';
import type { EditorCommand } from './commands';
import { editedDocument, type DocumentEnvironment } from './document';
import { equivalent } from './equivalence';
import { assertTextOffset } from './text';
import { sliceFormatting } from './rich-text';

export function applyHeadingSelection(document: Document, command: Extract<EditorCommand, { type: 'applyHeading' }>, environment: DocumentEnvironment): Document {
  const ranges = new Map(command.ranges.map(range => [range.id, range]));
  if (!ranges.size || ranges.size !== command.ranges.length || (command.cursor && ranges.size !== 1)) throw new Error('見出しにする段落または文字を選択してください');
  const blocks: Block[] = document.blocks.flatMap(block => {
    const range = ranges.get(block.id);
    if (!range) return [block];
    ranges.delete(block.id);
    if (block.kind === 'list' || block.kind === 'image' || block.kind === 'quiz' || block.kind === 'table') throw new Error('見出しは段落・見出し・コードの文字に適用できます');
    let { from, to } = range;
    assertTextOffset(block.text, from); assertTextOffset(block.text, to);
    if (from > to || (command.cursor && from !== to)) throw new Error('不正な選択範囲です');
    if (command.cursor) {
      from = from === 0 ? 0 : block.text.lastIndexOf('\n', from - 1) + 1;
      const next = block.text.indexOf('\n', to);
      to = next < 0 ? block.text.length : next;
    }
    const pieces: Block[] = [];
    const formatting = 'formatting' in block ? block.formatting : undefined;
    const original = { ...block }; if ('formatting' in original) delete original.formatting;
    // Adjacent LF becomes a block boundary; retain empty surrounding lines.
    if (from > 0) { const end = block.text[from - 1] === '\n' ? from - 1 : from; pieces.push({ ...original, text: block.text.slice(0, end), ...sliceFormatting(formatting, 0, end) }); }
    const kind = command.kind ?? 'heading';
    const common = { id: pieces.length ? environment.id() : block.id, metadata: structuredClone(block.metadata) };
    const text = block.text.slice(from, to), styled = sliceFormatting(formatting, from, to);
    if (kind === 'bullet' || kind === 'ordered') pieces.push({ ...common, kind: 'list', style: kind, items: [{ id: environment.id(), metadata: {}, text, ...styled, children: [] }] });
    else if (kind === 'code') pieces.push({ ...common, kind, text, language: command.language ?? 'text' });
    else if (kind === 'paragraph') pieces.push({ ...common, kind, text, ...styled });
    else pieces.push({ ...common, kind, level: block.kind === 'heading' ? block.level : 1, text, ...styled });
    if (to < block.text.length) { const start = block.text[to] === '\n' ? to + 1 : to; pieces.push({ ...original, id: environment.id(), metadata: structuredClone(block.metadata), text: block.text.slice(start), ...sliceFormatting(formatting, start, block.text.length) }); }
    return pieces;
  });
  if (ranges.size) throw new Error('編集対象が見つかりません');
  return equivalent(blocks, document.blocks) ? document : editedDocument(document, { blocks }, environment.clock);
}
