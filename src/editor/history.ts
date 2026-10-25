import { UndoRedo } from '@tiptap/extensions';
export const editorHistory = UndoRedo.configure({ depth: 200 });
export { closeHistory } from '@tiptap/pm/history';
