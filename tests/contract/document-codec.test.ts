import { expect, test } from 'vitest';
import { serialize, deserialize } from '../../src/domain/codec';
import { documents } from '../fixtures/documents';
import { validateDocument } from '../../src/domain/validate';

test.each(documents.map((value, i) => [i, value] as const))('fixture %i survives ten portable round trips', (_, value) => {
  let document = validateDocument(value);
  for (let round = 0; round < 10; round++) document = deserialize(serialize(document));
  expect(document).toEqual(value);
});
test('typed failures distinguish syntax, format, version, structure and duplicate identity', () => {
  const base = documents[0]!;
  for (const [input, code] of [
    ['{', 'InvalidJson'], ['{}', 'InvalidFormat'],
    [JSON.stringify({ ...base, schemaVersion: 2 }), 'UnsupportedVersion'],
    [JSON.stringify({ ...base, unknown: true }), 'InvalidStructure'],
    [JSON.stringify({ ...base, blocks: [base.blocks[0], base.blocks[0]] }), 'DuplicateElementId'],
  ]) {
    try { deserialize(input!); expect.fail('must reject'); }
    catch (error) { expect(error).toHaveProperty('code', code); }
  }
});
