import type { Block, Document } from './schema';
import type { EditorCommand } from './commands';
import { editedDocument, type DocumentEnvironment } from './document';
import { equivalent } from './equivalence';
import { assertTextOffset } from './text';

export function applyHeadingSelection(document: Document, command: Extract<EditorCommand, { type: 'applyHeading' }>, environment: DocumentEnvironment): Document {
  const ranges = new Map(command.ranges.map(range => [range.id, range]));
  if (!ranges.size || ranges.size !== command.ranges.length || (command.cursor && ranges.size !== 1)) throw new Error('見出しにする段落または文字を選択してください');
  const blocks: Block[] = document.blocks.flatMap(block => {
    const range = ranges.get(block.id);
    if (!range) return [block];
    ranges.delete(block.id);
    if (block.kind === 'list' || block.kind === 'image') throw new Error('見出しは段落・見出し・コードの文字に適用できます');
    let { from, to } = range;
    assertTextOffset(block.text, from); assertTextOffset(block.text, to);
    if (from > to || (command.cursor && from !== to)) throw new Error('不正な選択範囲です');
    if (command.cursor) {
      from = from === 0 ? 0 : block.text.lastIndexOf('\n', from - 1) + 1;
      const next = block.text.indexOf('\n', to);
      to = next < 0 ? block.text.length : next;
    }
    const pieces: Block[] = [];
    // Adjacent LF becomes a block boundary; retain empty surrounding lines.
    if (from > 0) pieces.push({ ...block, text: block.text.slice(0, block.text[from - 1] === '\n' ? from - 1 : from) });
    pieces.push({ kind: 'heading', id: pieces.length ? environment.id() : block.id,
      metadata: structuredClone(block.metadata), level: block.kind === 'heading' ? block.level : 1, text: block.text.slice(from, to) });
    if (to < block.text.length) pieces.push({ ...block, id: environment.id(), metadata: structuredClone(block.metadata), text: block.text.slice(block.text[to] === '\n' ? to + 1 : to) });
    return pieces;
  });
  if (ranges.size) throw new Error('編集対象が見つかりません');
  return equivalent(blocks, document.blocks) ? document : editedDocument(document, { blocks }, environment.clock);
}
