import type { Block, Document, List } from './schema';
import type { EditorCommand } from './commands';
import { editedDocument, type DocumentEnvironment } from './document';
import { equivalent } from './equivalence';
import { assertTextOffset } from './text';
import { applyHeadingSelection } from './heading-operations';
import { sliceFormatting } from './rich-text';

function requireIndex(index: number, maximum: number): void {
  if (!Number.isInteger(index) || index < 0 || index > maximum) throw new RangeError('Invalid block index');
}
function replaceListText(list: List, id: string, text: string): boolean {
  for (const item of list.items) {
    if (item.id === id) { item.text = text; delete item.formatting; return true; }
    for (const child of item.children) if (replaceListText(child, id, text)) return true;
  }
  return false;
}
export function applyCommand(document: Document, command: EditorCommand, environment: DocumentEnvironment): Document {
  if (command.type === 'applyHeading') return applyHeadingSelection(document, command, environment);
  const blocks: Block[] = structuredClone(document.blocks);
  const index = 'id' in command ? blocks.findIndex(block => block.id === command.id) : -1;
  const block = blocks[index];
  if (command.type === 'insertBlock') {
    requireIndex(command.index, blocks.length);
    blocks.splice(command.index, 0, structuredClone(command.block));
  } else if (command.type === 'replaceText') {
    if (block && block.kind !== 'list' && block.kind !== 'image' && block.kind !== 'quiz' && block.kind !== 'table') { block.text = command.text; if ('formatting' in block) delete block.formatting; }
    else if (!blocks.some(candidate => candidate.kind === 'list' && replaceListText(candidate, command.id, command.text))) throw new Error('Text element not found');
  } else {
    if (!block) throw new Error('Block not found');
    switch (command.type) {
      case 'updateQuiz':
        if (block.kind !== 'quiz') throw new Error('Not a quiz');
        block.questions = structuredClone(command.questions); break;
      case 'describeImage':
        if (block.kind !== 'image') throw new Error('Not an image');
        block.caption = command.caption; block.alt = command.alt; block.semantics = structuredClone(command.semantics); break;
      case 'deleteBlock':
        blocks.splice(index, 1);
        if (!blocks.length) blocks.push({ kind: 'paragraph', id: environment.id(), metadata: {}, text: '' });
        break;
      case 'moveBlock':
        requireIndex(command.index, blocks.length - 1);
        blocks.splice(index, 1); blocks.splice(command.index, 0, block); break;
      case 'setHeadingLevel':
        if (block.kind !== 'heading') throw new Error('Not a heading');
        block.level = command.level; break;
      case 'convertParagraphHeading':
        if (block.kind !== 'heading' && block.kind !== 'paragraph') throw new Error('Only paragraph and heading conversion is supported');
        blocks[index] = command.kind === 'paragraph'
          ? { kind: 'paragraph', id: block.id, metadata: block.metadata, text: block.text, ...sliceFormatting(block.formatting, 0, block.text.length) }
          : { kind: 'heading', id: block.id, metadata: block.metadata, text: block.text, ...sliceFormatting(block.formatting, 0, block.text.length), level: block.kind === 'heading' ? block.level : 1 };
        break;
      case 'split': {
        if (block.kind === 'list' || block.kind === 'image' || block.kind === 'quiz' || block.kind === 'table') throw new Error('Cannot split a non-text block');
        assertTextOffset(block.text, command.offset);
        const formatting = 'formatting' in block ? block.formatting : undefined;
        if ('formatting' in block) delete block.formatting;
        blocks.splice(index + 1, 0, { ...structuredClone(block), id: environment.id(), text: block.text.slice(command.offset), ...sliceFormatting(formatting, command.offset, block.text.length) });
        Object.assign(block, sliceFormatting(formatting, 0, command.offset));
        block.text = block.text.slice(0, command.offset); break;
      }
      case 'join': {
        const next = blocks[index + 1];
        if (!next || block.kind === 'list' || block.kind === 'image' || block.kind === 'quiz' || block.kind === 'table' || next.kind !== block.kind
          || !equivalent(block.metadata, next.metadata)
          || (block.kind === 'code' && next.kind === 'code' && block.language !== next.language)
          || (block.kind === 'heading' && next.kind === 'heading' && block.level !== next.level)) throw new Error('Cannot join without losing structure or metadata');
        const formatting = [...('formatting' in block ? block.formatting ?? [] : []), ...('formatting' in next ? next.formatting ?? [] : []).map(range => ({ ...range, from: range.from + block.text.length, to: range.to + block.text.length }))];
        if (formatting.length) Object.assign(block, { formatting });
        block.text += next.text; blocks.splice(index + 1, 1); break;
      }
      default: throw new Error('List command requires list operations');
    }
  }
  return equivalent(blocks, document.blocks) ? document : editedDocument(document, { blocks }, environment.clock);
}
