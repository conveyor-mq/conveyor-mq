import fs from 'fs';
import { Redis } from 'ioredis';
import path from 'path';

export enum LuaScriptName {
  takeTaskAndMarkAsProcessing = 'takeTask',
  markTaskProcessing = 'markTaskProcessing',
  enqueueScheduledTasks = 'enqueueScheduledTasks',
  acknowledgeOrphanedProcessingTasks = 'acknowledgeOrphanedProcessingTasks',
  updateTask = 'updateTask',
  markTaskSuccess = 'markTaskSuccess',
  enqueueTask = 'enqueueTask',
}

export const loadLuaScripts = ({ client }: { client: Redis }) => {
  const commandDefinitions = [
    {
      name: LuaScriptName.enqueueTask,
      filePath: './enqueue-task.lua',
      numberOfKeys: 4,
    },
    {
      name: LuaScriptName.takeTaskAndMarkAsProcessing,
      filePath: './take-task-and-mark-as-processing.lua',
      numberOfKeys: 3,
    },
    {
      name: LuaScriptName.markTaskProcessing,
      filePath: './mark-task-processing.lua',
      numberOfKeys: 3,
    },
    {
      name: LuaScriptName.enqueueScheduledTasks,
      filePath: './enqueue-scheduled-tasks.lua',
      numberOfKeys: 4,
    },
    {
      name: LuaScriptName.acknowledgeOrphanedProcessingTasks,
      filePath: './acknowledge-orphaned-processing-tasks.lua',
      numberOfKeys: 2,
    },
    {
      name: LuaScriptName.updateTask,
      filePath: './update-task.lua',
      numberOfKeys: 1,
    },
  ];
  commandDefinitions.forEach(({ name, filePath, numberOfKeys }) => {
    const script = fs.readFileSync(path.join(__dirname, filePath), 'utf8');
    client.defineCommand(name, { numberOfKeys, lua: script });
  });
  return client;
};
