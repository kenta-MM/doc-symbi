import { expect, test } from 'vitest';
import { applyListCommand } from '../../src/domain/list-operations';
import { validateDocument } from '../../src/domain/validate';
import { fixtureDocument } from '../fixtures/documents';
import { deepFreeze, fixedIds, fixedTime } from '../helpers/deterministic';

test('indent/outdent preserves identities, metadata and mixed child lists', () => {
  const environment = { id: fixedIds(), clock: () => fixedTime };
  // Use fresh IDs beyond those in the fixture.
  for (let i = 0; i < 100; i++) environment.id();
  const document = deepFreeze(validateDocument(fixtureDocument(1)));
  const list = document.blocks[3]!;
  if (list.kind !== 'list') throw new Error('fixture');
  const first = list.items[0]!;
  const second = list.items[1]!;
  expect(applyListCommand(document, { type: 'indentListItem', id: first.id }, environment)).toEqual(document);
  expect(applyListCommand(document, { type: 'outdentListItem', id: first.id }, environment)).toEqual(document);
  const indented = applyListCommand(document, { type: 'indentListItem', id: second.id }, environment);
  const nested = indented.blocks[3]!;
  if (nested.kind !== 'list') throw new Error('fixture');
  expect(nested.items).toHaveLength(1);
  expect(nested.items[0]!.children.at(-1)!.items.at(-1)).toEqual(second);
  expect(applyListCommand(indented, { type: 'outdentListItem', id: second.id }, environment)).toEqual(document);
  expect(document.blocks[3]).toEqual(list);
});
test('insert/delete item and remove empty lists without empty document', () => {
  const environment = { id: fixedIds(), clock: () => fixedTime };
  for (let i = 0; i < 100; i++) environment.id();
  const listId = environment.id();
  const itemId = environment.id();
  const document = validateDocument({ ...fixtureDocument(), blocks: [{ kind: 'list', id: listId, metadata: {}, style: 'bullet', items: [{ id: itemId, metadata: {}, text: '', children: [] }] }] });
  const item = { id: environment.id(), metadata: { preserved: true }, text: 'new', children: [] };
  const inserted = applyListCommand(document, { type: 'insertListItem', listId, index: 1, item }, environment);
  expect(applyListCommand(inserted, { type: 'deleteListItem', id: item.id }, environment)).toEqual(document);
  expect(applyListCommand(document, { type: 'deleteListItem', id: itemId }, environment).blocks[0]).toMatchObject({ kind: 'paragraph', text: '' });
});

test('changing nested list style preserves IDs, metadata and other lists', () => {
  const environment = { id: fixedIds(), clock: () => fixedTime };
  const document = validateDocument(fixtureDocument(1));
  const list = document.blocks[3]!;
  if (list.kind !== 'list') throw new Error('fixture');
  const nested = list.items[0]!.children[0]!;
  const changed = applyListCommand(document, { type: 'setListStyle', listId: nested.id, style: 'bullet' }, environment);
  const expected = structuredClone(document);
  const expectedList = expected.blocks[3]!;
  if (expectedList.kind !== 'list') throw new Error('fixture');
  expectedList.items[0]!.children[0]!.style = 'bullet';
  expect(changed).toEqual(expected);
  expect(applyListCommand(changed, { type: 'setListStyle', listId: nested.id, style: 'ordered' }, environment)).toEqual(document);
});
