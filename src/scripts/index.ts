import fs from 'fs';
import util from 'util';
import path from 'path';
import { Redis } from 'ioredis';

const readFile = util.promisify(fs.readFile);

export const loadScripts = async ({ client }: { client: Redis }) => {
  const takeTaskScript = await readFile(
    path.join(__dirname, './take-task.lua'),
    'utf8',
  );
  client.defineCommand('takeTask', { numberOfKeys: 5, lua: takeTaskScript });
  return client;
};
