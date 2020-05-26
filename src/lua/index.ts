import fs from 'fs';
import util from 'util';
import path from 'path';
import { Redis } from 'ioredis';
import { map } from 'lodash';

const readFile = util.promisify(fs.readFile);

export enum LuaScriptName {
  takeTask = 'takeTask',
  markTaskProcessing = 'markTaskProcessing',
  enqueueScheduledTasks = 'enqueueScheduledTasks',
  acknowledgeOrphanedProcessingTasks = 'acknowledgeOrphanedProcessingTasks',
  updateTask = 'updateTask',
  markTaskSuccess = 'markTaskSuccess',
  enqueueTask = 'enqueueTask',
}

export const loadScripts = async ({ client }: { client: Redis }) => {
  const commandDefinitions = [
    {
      name: LuaScriptName.enqueueTask,
      filePath: './enqueue-task.lua',
      numberOfKeys: 9,
    },
    {
      name: LuaScriptName.markTaskSuccess,
      filePath: './mark-task-success.lua',
      numberOfKeys: 13,
    },
    {
      name: LuaScriptName.takeTask,
      filePath: './take-task.lua',
      numberOfKeys: 10,
    },
    {
      name: LuaScriptName.markTaskProcessing,
      filePath: './mark-task-processing.lua',
      numberOfKeys: 9,
    },
    {
      name: LuaScriptName.enqueueScheduledTasks,
      filePath: './enqueue-delayed-tasks.lua',
      numberOfKeys: 10,
    },
    {
      name: LuaScriptName.acknowledgeOrphanedProcessingTasks,
      filePath: './acknowledge-orphaned-processing-tasks.lua',
      numberOfKeys: 5,
    },
    {
      name: LuaScriptName.updateTask,
      filePath: './update-task.lua',
      numberOfKeys: 5,
    },
  ];
  await Promise.all(
    map(commandDefinitions, async ({ name, filePath, numberOfKeys }) => {
      const script = await readFile(path.join(__dirname, filePath), 'utf8');
      client.defineCommand(name, { numberOfKeys, lua: script });
    }),
  );
  return client;
};
