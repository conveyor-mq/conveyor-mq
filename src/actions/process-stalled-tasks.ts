import { Redis } from 'ioredis';
import { EventType } from '../domain/events/event-type';
import { serializeEvent } from '../domain/events/serialize-event';
import { getQueueTaskStalledChannel } from '../utils/keys';
import { exec } from '../utils/redis';
import { getStalledTasks } from './get-stalled-tasks';
import { handleStalledTasks } from './handle-stalled-tasks';

/**
 * @ignore
 */
// TODO: Wrap in multi.
export const processStalledTasks = async ({
  queue,
  client,
}: {
  queue: string;
  client: Redis;
}) => {
  const stalledTasks = await getStalledTasks({ queue, client });
  const multi = client.multi();
  stalledTasks.forEach((task) => {
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
