import { Redis } from 'ioredis';
import forEach from 'lodash/forEach';
import { getQueueTaskStalledChannel } from '../utils/keys';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventType } from '../domain/events/event-type';
import { exec } from '../utils/redis';
import { getStalledTasks } from './get-stalled-tasks';
import { handleStalledTasks } from './handle-stalled-tasks';

/**
 * @ignore
 */
export const processStalledTasks = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}) => {
  const stalledTasks = await getStalledTasks({ queue, client });
  const multi = client.multi();
  forEach(stalledTasks, (task) => {
    multi.publish(
      getQueueTaskStalledChannel({ queue }),
      serializeEvent({
        createdAt: new Date(),
        type: EventType.TaskStalled,
        task,
      }),
    );
  });
  await exec(multi);
  const { failedTasks, reQueuedTasks } = await handleStalledTasks({
    queue,
    client,
    tasks: stalledTasks,
  });
  return { stalledTasks, failedTasks, reQueuedTasks };
};
