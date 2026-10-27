import { EditorController } from '../../src/editor/editor-controller';
import type { EditorCommand } from '../../src/domain/commands';
import { validateDocument } from '../../src/domain/validate';
import { documents } from '../fixtures/documents';
import { fixedIds, fixedTime } from './deterministic';
import { IndexedDbRepository } from '../../src/infrastructure/indexeddb/document-repository';
import { FileDocumentRepository } from '../../src/infrastructure/files/document-repository';
import { equivalent } from '../../src/domain/equivalence';

export function createEditorTest(index = 1) {
  let document = validateDocument(documents[index]);
  const initial = structuredClone(document);
  const id = fixedIds(); for (let i = 0; i < 100; i++) id();
  const environment = { id, clock: () => fixedTime };
  const errors: string[] = [];
  const host = window.document.createElement('div'); window.document.body.append(host);
  const editor = new EditorController(host, () => document, environment, error => errors.push(error.message));
  editor.onAcceptedChange(value => { document = value; });
  editor.mount(document);
  return { initial, getDocument: () => document, errors,
    execute: (command: EditorCommand) => editor.execute(command, environment),
    undo: () => editor.undo(), redo: () => editor.redo(),
    canUndo: () => editor.canUndo, canRedo: () => editor.canRedo,
    dispose: () => { editor.dispose(); host.remove(); },
  };
}
export async function checkEditSaveRoundTrips(storage: 'indexeddb' | 'files' = 'indexeddb') {
  const repository = storage === 'files' ? new FileDocumentRepository() : new IndexedDbRepository();
  let completed = 0;
  for (let index = 0; index < documents.length; index++) {
    const editor = createEditorTest(index);
    let stored = await repository.create(editor.initial);
    for (let round = 0; round < 10; round++) {
      editor.execute({ type: 'replaceText', id: editor.initial.blocks[0]!.id, text: `日本語 😀 ${round}\n  保持` });
      const expected = structuredClone(editor.getDocument());
      stored = await repository.save(expected, stored.revision);
      const actual = await repository.get(expected.id);
      if (!equivalent(actual.document, expected)) throw new Error(`Round trip mismatch ${index}/${round}`);
      if (editor.errors.length) throw new Error(editor.errors.join(', '));
      completed++;
    }
    await repository.delete(stored.document.id, stored.revision); editor.dispose();
  }
  if (repository instanceof IndexedDbRepository) repository.close();
  return completed;
}
