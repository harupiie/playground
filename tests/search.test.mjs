import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, matchesQuery } from '../src/lib/search.mjs';

// normalize()

test('大文字小文字を統一する', () => {
  assert.equal(normalize('Codex'), 'codex');
  assert.equal(normalize('CLAUDE CODE'), 'claude code');
});

test('カタカナをひらがなに変換する', () => {
  assert.equal(normalize('コード'), 'こーど');
  assert.equal(normalize('エージェント'), 'えーじぇんと');
});

test('ひらがなはそのまま', () => {
  assert.equal(normalize('こーど'), 'こーど');
});

test('英数字混在', () => {
  assert.equal(normalize('Claude 3.5'), 'claude 3.5');
});

// matchesQuery()

test('英語タイトルへの前方一致（部分一致）', () => {
  const article = { title: 'Introducing Codex', titleJa: 'Codexのご紹介' };
  assert.ok(matchesQuery(article, 'cod'));
  assert.ok(matchesQuery(article, 'Cod'));
  assert.ok(matchesQuery(article, 'COD'));
});

test('日本語タイトルへのカタカナ・ひらがな両対応', () => {
  const article = { title: 'Claude Code', titleJa: 'クロードコード' };
  assert.ok(matchesQuery(article, 'くろーど'));   // ひらがなで検索 → カタカナタイトルにヒット
  assert.ok(matchesQuery(article, 'クロード'));   // カタカナで検索 → カタカナタイトルにヒット
});

test('英語タイトルのみの記事（titleJa なし）', () => {
  const article = { title: 'Cursor Updates', titleJa: undefined };
  assert.ok(matchesQuery(article, 'cursor'));
  assert.ok(!matchesQuery(article, 'openai'));
});

test('クエリが空のときは全件マッチ', () => {
  const article = { title: 'anything', titleJa: '' };
  assert.ok(matchesQuery(article, ''));
});

test('無関係な単語はヒットしない', () => {
  const article = { title: 'Cursor Blog Post', titleJa: 'カーソルのブログ' };
  assert.ok(!matchesQuery(article, 'codex'));
  assert.ok(!matchesQuery(article, 'openai'));
});
