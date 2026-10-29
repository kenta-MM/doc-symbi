import type { Block, ListItem, ImageBlock } from './schema';
import type { QuizQuestion } from './quiz';

export type EditorCommand =
  | { type: 'updateQuiz'; id: string; questions: QuizQuestion[] }
  | { type: 'applyHeading'; cursor: boolean; ranges: { id: string; from: number; to: number }[]; kind?: 'heading' | 'paragraph' | 'code' | 'bullet' | 'ordered'; language?: 'text' | 'javascript' | 'typescript' | 'python' | 'json' | 'html' | 'css' | 'sql' | 'bash' }
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
