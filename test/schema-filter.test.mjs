import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const sdkRoot = pathToFileURL(
  `${process.cwd().replace(/\\/g, '/')}/node_modules/@modelcontextprotocol/sdk/dist/esm/`,
).href;

const { Client } = await import(new URL('client/index.js', sdkRoot));
const { StdioClientTransport } = await import(new URL('client/stdio.js', sdkRoot));

function parseToolText(result) {
  const textPart = result.content.find((item) => item.type === 'text');
  assert.ok(textPart, 'Expected tool response to contain text content');
  return JSON.parse(textPart.text);
}

test('metadata tools filter by configured schema', async () => {
  const schema = process.env.DAMENG_SCHEMA;
  assert.ok(schema, 'DAMENG_SCHEMA is required for integration test');

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['src/index.js'],
    stderr: 'pipe',
    env: { ...process.env },
  });

  let stderr = '';
  transport.stderr?.setEncoding('utf8');
  transport.stderr?.on('data', (chunk) => {
    stderr += chunk;
  });

  const client = new Client(
    { name: 'dameng-schema-filter-test', version: '1.0.0' },
    { capabilities: {} },
  );

  await client.connect(transport);

  try {
    const listTablesResult = parseToolText(
      await client.callTool({ name: 'list_tables', arguments: {} }),
    );
    const expectedTablesResult = parseToolText(
      await client.callTool({
        name: 'execute_sql',
        arguments: {
          sql: `SELECT TABLE_NAME FROM ALL_TABLES WHERE OWNER = '${schema}' ORDER BY TABLE_NAME`,
        },
      }),
    );

    assert.deepEqual(
      listTablesResult.rows,
      expectedTablesResult.rows,
      `list_tables should filter by schema ${schema}. stderr=${stderr}`,
    );

    const describeResult = parseToolText(
      await client.callTool({
        name: 'describe_table',
        arguments: { table_name: 'COMMAND_EXPERT' },
      }),
    );
    const expectedDescribeResult = parseToolText(
      await client.callTool({
        name: 'execute_sql',
        arguments: {
          sql: `SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE, DATA_DEFAULT
                FROM ALL_TAB_COLUMNS
                WHERE OWNER = '${schema}' AND TABLE_NAME = 'COMMAND_EXPERT'
                ORDER BY COLUMN_ID`,
        },
      }),
    );

    assert.deepEqual(
      describeResult.rows,
      expectedDescribeResult.rows,
      `describe_table should filter by schema ${schema}. stderr=${stderr}`,
    );
  } finally {
    await transport.close();
  }
});
