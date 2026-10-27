import type { Block, ListItem, ImageBlock } from './schema';

export type EditorCommand =
  | { type: 'applyHeading'; cursor: boolean; ranges: { id: string; from: number; to: number }[] }
  | { type: 'describeImage'; id: string; caption: string; alt: string; semantics: ImageBlock['semantics'] }
  | { type: 'replaceText'; id: string; text: string }
  | { type: 'insertBlock'; index: number; block: Block }
  | { type: 'deleteBlock'; id: string }
  | { type: 'moveBlock'; id: string; index: number }
  | { type: 'setHeadingLevel'; id: string; level: number }
  | { type: 'convertParagraphHeading'; id: string; kind: 'paragraph' | 'heading' }
  | { type: 'split'; id: string; offset: number }
  | { type: 'join'; id: string }
  | { type: 'insertListItem'; listId: string; index: number; item: ListItem }
  | { type: 'setListStyle'; listId: string; style: 'bullet' | 'ordered' }
  | { type: 'deleteListItem' | 'indentListItem' | 'outdentListItem'; id: string };
