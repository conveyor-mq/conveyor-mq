import { Redis } from 'ioredis';
import moment from 'moment';
import { forEach } from 'lodash';
import { getStalledTasks, handleStalledTasks } from '..';
import { getQueueTaskStalledChannel } from '../utils/keys';
import { serializeEvent } from '../domain/events/serialize-event';
import { EventTypes } from '../domain/events/event-types';
import { exec } from '../utils/redis';

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
        createdAt: moment(),
        type: EventTypes.TaskStalled,
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
