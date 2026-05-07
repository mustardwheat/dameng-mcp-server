import assert from 'node:assert/strict';
import test from 'node:test';
import dmdb from 'dmdb';
import DaMengConnection from '../src/database.js';

test('queries fetch numeric columns as strings to preserve large BIGINT precision', async () => {
  const calls = [];
  const fakeConn = {
    async execute(...args) {
      calls.push(args);
      return { rows: [['2050839598690603010']] };
    },
    async close() {}
  };
  const db = new DaMengConnection({});
  db.connection = {
    async getConnection() {
      return fakeConn;
    }
  };

  await db.query('SELECT ID FROM ISSUE2_BIGINT_REPRO');

  assert.deepEqual(calls[0], [
    'SELECT ID FROM ISSUE2_BIGINT_REPRO',
    [],
    { extendedMetaData: true }
  ]);
  assert.ok(dmdb.fetchAsString.includes(dmdb.NUMBER));
});

test('keeps unsafe integers as strings while preserving ordinary numeric values', async () => {
  const fakeConn = {
    async execute() {
      return {
        metaData: [
          { name: 'UNSAFE_ID', dbTypeName: 'BIGINT', scale: 0 },
          { name: 'SAFE_ID', dbTypeName: 'INT', scale: 0 },
          { name: 'AMOUNT', dbTypeName: 'DEC', scale: 2 },
          { name: 'NOTE', dbTypeName: 'VARCHAR' }
        ],
        rows: [
          [
            '2050839598690603010',
            '42',
            '19.95',
            '2050839598690603010'
          ]
        ]
      };
    },
    async close() {}
  };
  const db = new DaMengConnection({});
  db.connection = {
    async getConnection() {
      return fakeConn;
    }
  };

  const result = await db.query('SELECT * FROM ISSUE2_BIGINT_REPRO');

  assert.deepEqual(result.rows, [
    [
      '2050839598690603010',
      42,
      19.95,
      '2050839598690603010'
    ]
  ]);
});

test('keeps high precision decimals as strings', async () => {
  const fakeConn = {
    async execute() {
      return {
        metaData: [
          { name: 'LARGE_AMOUNT', dbTypeName: 'DEC', scale: 2 },
          { name: 'SMALL_AMOUNT', dbTypeName: 'DEC', scale: 2 }
        ],
        rows: [
          [
            '123456789012345678.90',
            '19.95'
          ]
        ]
      };
    },
    async close() {}
  };
  const db = new DaMengConnection({});
  db.connection = {
    async getConnection() {
      return fakeConn;
    }
  };

  const result = await db.query('SELECT LARGE_AMOUNT, SMALL_AMOUNT FROM DUAL');

  assert.deepEqual(result.rows, [
    [
      '123456789012345678.90',
      19.95
    ]
  ]);
});
