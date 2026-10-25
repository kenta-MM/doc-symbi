import type { Block, ListItem } from './schema';

export type EditorCommand =
  | { type: 'replaceText'; id: string; text: string }
  | { type: 'insertBlock'; index: number; block: Block }
  | { type: 'deleteBlock'; id: string }
  | { type: 'moveBlock'; id: string; index: number }
  | { type: 'setHeadingLevel'; id: string; level: number }
  | { type: 'convertParagraphHeading'; id: string; kind: 'paragraph' | 'heading' }
  | { type: 'split'; id: string; offset: number }
  | { type: 'join'; id: string }
  | { type: 'insertListItem'; listId: string; index: number; item: ListItem }
  | { type: 'deleteListItem' | 'indentListItem' | 'outdentListItem'; id: string };
