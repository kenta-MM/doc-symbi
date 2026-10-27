import { useState } from 'react';
import type { Block, Document, List } from '../domain/schema';
import type { EditorCommand } from '../application/ports/editor';
import type { DocumentEnvironment } from '../domain/document';
import { ImageAttachment, ImageInformation } from './ImageTools';

const labels = { paragraph: '段落', heading: '見出し', code: 'コード', list: 'リスト', image: '画像' };
export function BlockToolbar({ document, execute, environment, applyHeading }: {
  document: Document; execute: (command: EditorCommand) => void; environment: DocumentEnvironment; applyHeading: () => void;
}) {
  const [selected, select] = useState('');
  const [selectedItem, selectItem] = useState('');
  const block = document.blocks.find(value => value.id === selected) ?? document.blocks[0]!;
  const index = document.blocks.indexOf(block);
  const items: { id: string; text: string; listId: string; index: number; depth: number }[] = [];
  function collect(list: List, depth = 0) { list.items.forEach((item, index) => { items.push({ id: item.id, text: item.text, listId: list.id, index, depth }); item.children.forEach(child => collect(child, depth + 1)); }); }
  if (block.kind === 'list') collect(block);
  const item = items.find(value => value.id === selectedItem) ?? items[0];
  function add(kind: 'paragraph' | 'code' | 'bullet' | 'ordered') {
    const common = { id: environment.id(), metadata: {} };
    const next: Block = kind === 'bullet' || kind === 'ordered'
      ? { ...common, kind: 'list', style: kind, items: [{ id: environment.id(), metadata: {}, text: '', children: [] }] }
      : { ...common, kind, text: '' };
    execute({ type: 'insertBlock', index: index + 1, block: next }); select(next.id);
  }
  return <div className="block-tools" aria-label="ブロック操作">
    <div className="tool-row"><span className="tool-label">編集・追加</span>
      <button onClick={() => add('paragraph')}>段落</button><button onMouseDown={event => event.preventDefault()} onClick={applyHeading}>見出し</button>
      <button onClick={() => add('bullet')}>箇条書き</button><button onClick={() => add('ordered')}>番号付きリスト</button><button onClick={() => add('code')}>コード</button>
      <ImageAttachment newId={environment.id} insert={block => { execute({ type: 'insertBlock', index: index + 1, block }); select(block.id); }} />
    </div>
    <div className="tool-row"><label>操作対象 <select aria-label="操作対象ブロック" value={block.id} onChange={event => select(event.target.value)}>
      {document.blocks.map((value, i) => <option key={value.id} value={value.id}>{i + 1}. {labels[value.kind]} {'text' in value ? value.text.slice(0, 16) : value.kind === 'image' ? value.caption.slice(0, 24) : ''}</option>)}
    </select></label>
      <button disabled={index === 0} onClick={() => execute({ type: 'moveBlock', id: block.id, index: index - 1 })}>上へ</button>
      <button disabled={index === document.blocks.length - 1} onClick={() => execute({ type: 'moveBlock', id: block.id, index: index + 1 })}>下へ</button>
      <button onClick={() => execute({ type: 'deleteBlock', id: block.id })}>ブロック削除</button>
      {(block.kind === 'heading' || block.kind === 'paragraph') && <button onClick={() => execute({ type: 'convertParagraphHeading', id: block.id, kind: block.kind === 'heading' ? 'paragraph' : 'heading' })}>{block.kind === 'heading' ? '段落に変更' : '見出しに変更'}</button>}
      {block.kind === 'heading' && <label>レベル <select aria-label="見出しレベル" value={block.level} onChange={event => execute({ type: 'setHeadingLevel', id: block.id, level: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map(level => <option key={level}>{level}</option>)}</select></label>}
    </div>
    {block.kind === 'image' && <ImageInformation key={block.id} block={block} execute={execute} />}
    {block.kind === 'list' && <div className="tool-row"><label>項目 <select aria-label="操作対象項目" value={item?.id ?? ''} onChange={event => selectItem(event.target.value)}>{items.map((value, i) => <option key={value.id} value={value.id}>{i + 1}. {value.text || '空の項目'}</option>)}</select></label>
      <button onClick={() => execute({ type: 'insertListItem', listId: block.id, index: block.items.length, item: { id: environment.id(), metadata: {}, text: '', children: [] } })}>項目追加</button>
      {item && <><button disabled={item.index === 0} onClick={() => execute({ type: 'indentListItem', id: item.id })}>字下げ</button><button disabled={item.depth === 0} onClick={() => execute({ type: 'outdentListItem', id: item.id })}>字下げ解除</button><button onClick={() => execute({ type: 'deleteListItem', id: item.id })}>項目削除</button></>}
    </div>}
  </div>;
}
