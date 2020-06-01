/**
 * This example demonstrates how to set up sub tasks be defining a parent task with child tasks.
 */
import { createManager, createWorker } from 'conveyor-mq';
import { map, reduce } from 'lodash';
import { Task } from 'conveyor-mq/dist/domain/tasks/task';

const queue = 'my-queue';
const redisConfig = { host: 'localhost', port: 6379 };

const manager = createManager({ queue, redisConfig });

const worker = createWorker({
  queue,
  redisConfig,
  // Concurrency must be greater than or equal to the child task depth to avoid deadlock.
  concurrency: 3,
  // Create a handler which is aware of the childTasks and enqueues and waits for them to complete.
  handler: async ({ task }) => {
    if (task.data.childTasks) {
      console.log('Processing parent task');
      const completedChildTasks = await Promise.all(
        // Iterate over child tasks and enqueue them and return a promise which resolves
        // once the tasks are complete.
        map(task.data.childTasks, async (childTask: Task) => {
          console.log('Enqueuing child task');
          const { onTaskComplete } = await manager.enqueueTask(childTask);
          return onTaskComplete();
        }),
      );
      console.log('Processed parent task');
      const childSum = reduce(
        completedChildTasks,
        (acc, curr) => acc + curr.result,
        0,
      );
      return task.data.x || task.data.y
        ? childSum + task.data.x + task.data.y
        : childSum;
    } else {
      console.log('Processing child task');
      const result = task.data.x + task.data.y;
      console.log('Processed child task');
      return result;
    }
  },
});

// Define a task which contains nested child tasks.
const task = {
  data: {
    childTasks: [
      { data: { x: 1, y: 2, childTasks: [{ data: { x: 3, y: 4 } }] } },
      { data: { x: 5, y: 6 } },
    ],
  },
};

(async () => {
  const { onTaskComplete } = await manager.enqueueTask(task);
  const completedTask = await onTaskComplete();
  console.log(completedTask.result);
})();
