import fs from 'fs';
import util from 'util';
import path from 'path';
import { Redis } from 'ioredis';
import { map } from 'lodash';

const readFile = util.promisify(fs.readFile);

export enum ScriptNames {
  takeTask = 'takeTask',
  markTaskProcessing = 'markTaskProcessing',
  enqueueDelayedTasks = 'enqueueDelayedTasks',
  acknowledgeOrphanedProcessingTasks = 'acknowledgeOrphanedProcessingTasks',
  updateTask = 'updateTask',
  markTaskSuccess = 'markTaskSuccess',
  enqueueTask = 'enqueueTask',
}

export const loadScripts = async ({ client }: { client: Redis }) => {
  const commandDefinitions = [
    {
      name: ScriptNames.enqueueTask,
      filePath: './enqueue-task.lua',
      numberOfKeys: 7,
    },
    {
      name: ScriptNames.markTaskSuccess,
      filePath: './mark-task-success.lua',
      numberOfKeys: 13,
    },
    {
      name: ScriptNames.takeTask,
      filePath: './take-task.lua',
      numberOfKeys: 10,
    },
    {
      name: ScriptNames.markTaskProcessing,
      filePath: './mark-task-processing.lua',
      numberOfKeys: 9,
    },
    {
      name: ScriptNames.enqueueDelayedTasks,
      filePath: './enqueue-delayed-tasks.lua',
      numberOfKeys: 8,
    },
    {
      name: ScriptNames.acknowledgeOrphanedProcessingTasks,
      filePath: './acknowledge-orphaned-processing-tasks.lua',
      numberOfKeys: 5,
    },
    {
      name: ScriptNames.updateTask,
      filePath: './update-task.lua',
      numberOfKeys: 5,
    },
  ];
  await Promise.all(
    map(commandDefinitions, async ({ name, filePath, numberOfKeys }) => {
      const script = await readFile(path.join(__dirname, filePath), 'utf8');
      client.defineCommand(name, {
        numberOfKeys,
        lua: script,
      });
    }),
  );
  return client;
};
