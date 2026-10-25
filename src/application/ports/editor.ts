import type { Document } from '../../domain/schema';
import type { DocumentEnvironment } from '../../domain/document';
import type { EditorCommand } from '../../domain/commands';
export type { EditorCommand } from '../../domain/commands';

/** The implementation owns its host element; DOM and editor position types stay inside. */
export interface EditorPort {
  mount(document: Document): void;
  execute(command: EditorCommand, environment: DocumentEnvironment): void;
  focusHeading(id: string): void;
  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  onAcceptedChange(listener: (document: Document) => void): () => void;
  dispose(): void;
}
