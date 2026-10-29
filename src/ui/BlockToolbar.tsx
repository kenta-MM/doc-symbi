import { useEffect, useState } from 'react';
import type { Document } from '../domain/schema';
import type { EditorPort, CursorAction, CursorContext } from '../application/ports/editor';
import type { DocumentEnvironment } from '../domain/document';
import { languages, safeLink } from '../domain/rich-text';
import { ImageAttachment } from './ImageTools';
import { ImageInformation } from './ImageInformation';
import { DocumentDialog } from './DocumentDialogs';
import { QuizSettings } from './QuizSettings';

export function BlockToolbar({ document, editor, environment }: { document: Document; editor: EditorPort | null; environment: DocumentEnvironment }) {
  const [context, setContext] = useState<CursorContext>({ selected: false, inTable: false });
  const [menu, setMenu] = useState<{ x: number; y: number; imageId?: string } | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  useEffect(() => {
    const open = (event: Event) => setQuizId((event as CustomEvent<string>).detail);
    window.addEventListener('quiz-edit', open);
    return () => window.removeEventListener('quiz-edit', open);
  }, []);
  const [link, setLink] = useState<string | null>(null), [error, setError] = useState('');
  const [table, setTable] = useState(false), [rows, setRows] = useState(3), [columns, setColumns] = useState(3), [header, setHeader] = useState(true);
  useEffect(() => {
    const update = () => {
      const next = editor?.cursorContext?.() ?? { selected: false, inTable: false };
      setContext(current => current.blockId === next.blockId && current.selected === next.selected && current.inTable === next.inTable && current.language === next.language && current.headingLevel === next.headingLevel && current.href === next.href ? current : next);
    };
    update(); return editor?.onSelectionChange?.(update);
  }, [editor]);
  useEffect(() => {
    const open = (event: Event) => setMenu((event as CustomEvent<{ x: number; y: number; imageId?: string }>).detail);
    const close = () => setMenu(null);
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('editor-context', open); window.addEventListener('click', close); window.addEventListener('keydown', key); window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('editor-context', open); window.removeEventListener('click', close); window.removeEventListener('keydown', key); window.removeEventListener('scroll', close, true); };
  }, []);
  function action(action: CursorAction, value?: string) { try { editor?.applyAtCursor?.(action, value); setError(''); } catch (failure) { setError(failure instanceof Error ? failure.message : '編集を適用できません'); } }
  function openLink() { setLink(editor?.cursorContext?.().href ?? ''); setError(''); setMenu(null); }
  const image = document.blocks.find(block => block.id === imageId);
  const quiz = document.blocks.find(block => block.id === quizId);
  return <div className="block-tools" aria-label="ブロック操作">
    <div className="tool-row" onMouseDown={event => { if ((event.target as HTMLElement).closest('button')) event.preventDefault(); }}>
      <span className="tool-label">編集・追加</span>
      {([['heading', '見出し'], ['bullet', '箇条書き'], ['ordered', '番号付きリスト'], ['code', 'コード'], ['bold', '太字']] as const).map(([key, label]) => <button key={key} onClick={() => action(key)}>{label}</button>)}
      <button disabled={!context.selected} onClick={openLink}>リンクの挿入</button>
      <ImageAttachment newId={environment.id} insert={block => editor?.insertAtCursor?.(block)} />
      <button onClick={() => setTable(true)}>表を挿入</button>
      <button onClick={() => setQuizId('new')}>クイズを追加</button>
      <button onClick={() => action('indent')}>字下げ</button><button onClick={() => action('outdent')}>字下げ解除</button>
      <button onClick={() => action('delete')}>{context.inTable ? '表を削除' : 'ブロック削除'}</button>
      <button onClick={() => action('up')}>上へ</button><button onClick={() => action('down')}>下へ</button>
      {context.headingLevel !== undefined && <label>見出しレベル <select aria-label="見出しレベル" value={context.headingLevel} onChange={event => action('headingLevel', event.target.value)}>{[1, 2, 3, 4, 5, 6].map(level => <option key={level}>{level}</option>)}</select></label>}
      {context.language !== undefined && <label>コード言語 <select aria-label="コード言語" value={context.language} onChange={event => action('code', event.target.value)}>{languages.map(language => <option key={language} value={language}>{language === 'text' ? 'プレーンテキスト' : language}</option>)}</select></label>}
      {context.inTable && <>{([['rowAdd', '行を追加'], ['rowDelete', '行を削除'], ['columnAdd', '列を追加'], ['columnDelete', '列を削除']] as const).map(([key, label]) => <button key={key} onClick={() => action(key)}>{label}</button>)}</>}
    </div>
    {error && link === null && <p role="alert">{error}</p>}
    {quizId !== null && <QuizSettings key={quizId} {...(quiz?.kind === 'quiz' ? { initial: quiz.questions } : {})} close={() => setQuizId(null)} apply={questions => {
      if (quiz?.kind === 'quiz') editor?.execute({ type: 'updateQuiz', id: quiz.id, questions }, environment);
      else editor?.insertAtCursor?.({ kind: 'quiz', id: environment.id(), metadata: {}, questions });
    }} />}
    {menu && <div role="menu" aria-label="本文のメニュー" className="editor-context-menu" style={{ left: Math.max(0, Math.min(menu.x, window.innerWidth - 220)), top: Math.max(0, Math.min(menu.y, window.innerHeight - 110)) }} onMouseDown={event => event.preventDefault()}>
      {menu.imageId ? <button role="menuitem" autoFocus onClick={() => { setImageId(menu.imageId!); setMenu(null); }}>画像の詳細設定</button> : <><button role="menuitem" autoFocus onClick={openLink}>リンクの挿入</button><button role="menuitem" onClick={() => { action('bold'); setMenu(null); }}>太字</button></>}
    </div>}
    {image?.kind === 'image' && <ImageInformation key={image.id} block={image} close={() => setImageId(null)} apply={block => { editor?.execute({ type: 'describeImage', id: block.id, caption: block.caption, alt: block.alt, semantics: block.semantics }, environment); setImageId(null); }} />}
    {link !== null && <DocumentDialog label="リンクの挿入" close={() => setLink(null)}><h2>リンクの挿入</h2><form onSubmit={event => {
      event.preventDefault(); const href = link.trim(); if (!safeLink(href)) { setError('http(s)・mailto・記事リンクを入力してください'); return; } try { editor?.setLink?.(href); setLink(null); } catch (failure) { setError(failure instanceof Error ? failure.message : 'リンクを適用できません'); }
    }}><div className="link-entry"><input autoFocus aria-label="リンクURL" placeholder="https://…" value={link} onChange={event => setLink(event.target.value)} /><button type="submit">OK</button><button type="button" onClick={() => setLink(null)}>キャンセル</button></div>{error && <p role="alert">{error}</p>}</form></DocumentDialog>}
    {table && <DocumentDialog label="表の挿入" close={() => setTable(false)}><h2>表の挿入</h2>{error && <p role="alert">{error}</p>}<form onSubmit={event => {
      event.preventDefault(); try { editor?.insertAtCursor?.({ kind: 'table', id: environment.id(), metadata: {}, rows: Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, () => ({ id: environment.id(), metadata: {}, text: '', header: header && row === 0 }))) }); setTable(false); } catch (failure) { setError(failure instanceof Error ? failure.message : '表を挿入できません'); }
    }}><label>行数<input aria-label="行数" type="number" min={1} max={100} required value={rows} onChange={event => setRows(Number(event.target.value))} /></label><label>列数<input aria-label="列数" type="number" min={1} max={20} required value={columns} onChange={event => setColumns(Number(event.target.value))} /></label><label><input type="checkbox" checked={header} onChange={event => setHeader(event.target.checked)} />先頭行を見出しにする</label><button type="submit">挿入</button><button type="button" onClick={() => setTable(false)}>キャンセル</button></form></DocumentDialog>}
  </div>;
}
