import { Redis } from 'ioredis';
import { map, forEach, zipWith, reduce } from 'lodash';
import { getTaskAcknowledgedKey } from '../utils/keys';
import { exec } from '../utils/redis';
import { getProcessingTasks } from './get-processing-tasks';

// TODO: Optimisation: getProcessingTaskIds.
export const areTasksStalled = async ({
  taskIds,
  queue,
  client,
}: {
  taskIds: string[];
  queue: string;
  client: Redis;
}) => {
  const processingTasks = await getProcessingTasks({ queue, client });
  const taskAcknowledgeKeys = map(processingTasks, (task) =>
    getTaskAcknowledgedKey({ taskId: task.id, queue }),
  );
  const multi = client.multi();
  forEach(taskAcknowledgeKeys, (key) => {
    multi.exists(key);
  });
  const results = await exec(multi);
  const isStalledByTaskId: { [key: string]: boolean } = reduce(
    zipWith(processingTasks, results, ({ id }, result) => ({
      taskId: id,
      isStalled: result === 0,
    })),
    (acc, { taskId, isStalled }) => ({
      ...acc,
      [taskId]: isStalled,
    }),
    {},
  );
  return map(taskIds, (taskId) => ({
    taskId,
    isStalled: !!isStalledByTaskId[taskId],
  }));
};
