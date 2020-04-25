import { RedisClient } from 'redis';
import { Task } from '../domain/task';
import { serializeTask } from '../domain/serialize-task';
import { set } from '../utils/redis';
import { getTaskKey } from '../utils/keys';

export const updateTask = async ({
  task,
  queue,
  client,
}: {
  task: Task;
  queue: string;
  client: RedisClient;
}) => {
  const taskKey = getTaskKey({ taskId: task.id, queue });
  await set({
    key: taskKey,
    value: serializeTask(task),
    client,
  });
  return task;
};
