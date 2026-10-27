import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSharedItems, ownedMatch } from '../docs/js/community.js';

test('shared items carry only brand/name/category/catalogId (no private fields)', () => {
  const items = toSharedItems([
    { brand: 'COSRX', name: 'Snail Essence', category: 'essence', catalogId: 'cosrx-snail-essence', memo: 'secret', ingredientsText: 'Water', amount: '2 drops' },
    { brand: '', name: '', category: 'cream' },
  ]);
  assert.deepEqual(items, [{ brand: 'COSRX', name: 'Snail Essence', category: 'essence', catalogId: 'cosrx-snail-essence' }]);
});

test('owned match ignores spacing/case and respects brand when both have one', () => {
  const vanity = [{ id: 'a', brand: '토리든', name: '다이브인 세럼' }, { id: 'b', brand: 'Other', name: 'Snail Essence' }];
  assert.equal(ownedMatch({ brand: '토리든', name: '다이브인세럼' }, vanity)?.id, 'a');
  assert.equal(ownedMatch({ brand: 'COSRX', name: 'snail essence' }, vanity), null);
  assert.equal(ownedMatch({ brand: '', name: 'Snail Essence' }, vanity)?.id, 'b');
});
