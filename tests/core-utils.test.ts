import assert from 'node:assert/strict'
import test from 'node:test'
import { getRandomRank, joinPath } from '../src/library-utils'
import { parseSavedPage } from '../src/reader-utils'

test('joinPath uses the parent path separator', () => {
  assert.equal(joinPath('C:\\Library', 'Series'), 'C:\\Library\\Series')
  assert.equal(joinPath('/media/library', 'Series'), '/media/library/Series')
})

test('joinPath does not duplicate a trailing separator', () => {
  assert.equal(joinPath('C:\\Library\\', 'Series'), 'C:\\Library\\Series')
  assert.equal(joinPath('/media/library/', 'Series'), '/media/library/Series')
})

test('getRandomRank is deterministic for the same seed', () => {
  const first = getRandomRank('Series 12', 42)
  assert.equal(first, getRandomRank('Series 12', 42))
  assert.notEqual(first, getRandomRank('Series 12', 43))
  assert.ok(Number.isInteger(first) && first >= 0 && first <= 0xffffffff)
})

test('parseSavedPage accepts only positive integers', () => {
  assert.equal(parseSavedPage('17'), 17)
  assert.equal(parseSavedPage(null), 1)
  assert.equal(parseSavedPage(''), 1)
  assert.equal(parseSavedPage('0'), 1)
  assert.equal(parseSavedPage('-2'), 1)
  assert.equal(parseSavedPage('2.5'), 1)
  assert.equal(parseSavedPage('7pages'), 1)
})
