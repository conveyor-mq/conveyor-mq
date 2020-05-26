import { Redis } from 'ioredis';
import { callLuaScript } from '../utils/redis';
import { getTaskKey, getQueueTaskUpdatedChannel } from '../utils/keys';
import { Task } from '../domain/tasks/task';
import { EventType } from '../domain/events/event-type';
import { LuaScriptName } from '../lua';
import { deSerializeTask } from '../domain/tasks/deserialize-task';

/**
 * @ignore
 */
export const updateTask = async ({
  taskId,
  taskUpdateData,
  queue,
  client,
}: {
  taskId: string;
  taskUpdateData: Partial<Task>;
  queue: string;
  client: Redis;
}) => {
  const taskKey = getTaskKey({ taskId, queue });
  const taskString = (await callLuaScript({
    client,
    script: LuaScriptName.updateTask,
    args: [
      taskKey,
      JSON.stringify(taskUpdateData),
      new Date().toISOString(),
      getQueueTaskUpdatedChannel({ queue }),
      EventType.TaskUpdated,
    ],
  })) as string | undefined;
  if (!taskString) {
    throw new Error(`Task with id '${taskId}' not found.`);
  }
  const task = deSerializeTask(taskString);
  return task;
};
