import type { Document, Block } from '../../domain/schema';
import type { DocumentEnvironment } from '../../domain/document';
import type { EditorCommand } from '../../domain/commands';
export type { EditorCommand } from '../../domain/commands';
export type CursorAction = 'paragraph' | 'heading' | 'bullet' | 'ordered' | 'code' | 'bold' | 'indent' | 'outdent' | 'delete' | 'rowAdd' | 'rowDelete' | 'columnAdd' | 'columnDelete' | 'up' | 'down' | 'headingLevel';
export interface CursorContext { blockId?: string | undefined; language?: string | undefined; headingLevel?: number | undefined; selected: boolean; href?: string | undefined; inTable: boolean }

/** The implementation owns its host element; DOM and editor position types stay inside. */
export interface EditorPort {
  mount(document: Document): void;
  setEditable(editable: boolean): void;
  execute(command: EditorCommand, environment: DocumentEnvironment): void;
  focusHeading(id: string): void;
  applyHeading(): void;
  applyAtCursor?(action: CursorAction, value?: string): void;
  insertAtCursor?(block: Block): void;
  cancelInsertion?(): void;
  setAutomaticInput?(enabled: boolean): void;
  readonly automaticInput?: boolean;
  setLink?(href: string): void;
  cursorContext?(): CursorContext;
  onSelectionChange?(listener: () => void): () => void;
  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  onAcceptedChange(listener: (document: Document) => void): () => void;
  dispose(): void;
}
