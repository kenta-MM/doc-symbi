import { prepareAiDocument, type AiDocumentAction } from './ai-document-actions';
import type { DocumentSession } from './document-session';
import type { EditorPort } from './ports/editor';

export function aiDocumentVersion(session: DocumentSession): string {
  return `${session.state.loadVersion}:${session.state.generation}`;
}

export function applyAiDocument(session: DocumentSession, action: AiDocumentAction, expectedVersion: string, folders: readonly string[], editor: EditorPort | null): void {
  if (aiDocumentVersion(session) !== expectedVersion) throw new Error('依頼後に文書が変更されました。最新の内容でもう一度依頼してください。');
  if (session.state.saveState === 'saving') throw new Error('保存の完了を待ってください。');
  if (action.type === 'create' && session.state.dirty) throw new Error('現在の文書を保存してから、新しい文書の作成を依頼してください。');
  if (action.type === 'create' && (!folders.includes(action.folderPath) || (action.folderPath !== '' && action.folderPath.split('/').some(part => !part || part === '.' || part === '..' || (/[\\:]/.test(part) || [...part].some(char => char.charCodeAt(0) < 32)))))) throw new Error('指定された作成先フォルダが見つかりません。フォルダ一覧を同期して、もう一度依頼してください。');
  if (action.type === 'create') session.access?.assertFolder(action.folderPath);
  else if (session.state.document) session.access?.assertDocument(session.state.document.id);
  const current = session.state.document;
  const prepared = prepareAiDocument(action, current ? { ...current, title: session.state.draftTitle ?? current.title } : null, session.environment);
  if (action.type === 'create') {
    session.create(prepared.title, action.folderPath);
    session.accept({ ...prepared, id: session.state.document!.id });
  } else {
    if (!editor?.replaceBody || !current) throw new Error('文書の表示が完了してから適用してください。');
    editor.setEditable(true);
    editor.replaceBody({ ...prepared, title: current.title });
    session.rename(prepared.title);
  }
}
