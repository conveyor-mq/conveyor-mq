/**
 * This example demonstrates how sub-handlers can be used to handle
 * tasks based on a task discriminator ('type' in this case).
 */
import { createManager, createWorker } from 'conveyor-mq';

const queueName = 'my-queue';
const redisConfig = { host: '127.0.0.1', port: 6379 };

enum TaskType {
  Addition = 'addition',
  Subtraction = 'subtraction',
  Multiplication = 'multiplication',
}

const manager = createManager({ queue: queueName, redisConfig });
manager.enqueueTask({ data: { type: TaskType.Addition, x: 1, y: 2 } });
manager.enqueueTask({ data: { type: TaskType.Subtraction, x: 4, y: 3 } });
manager.enqueueTask({ data: { type: TaskType.Multiplication, x: 5, y: 2 } });

// Create a worker to process tasks.
const worker = createWorker({
  queue: queueName,
  redisConfig,
  handler: ({ task }) => {
    const handlerMap: { [key in TaskType]: () => number } = {
      [TaskType.Addition]: () => task.data.x + task.data.y,
      [TaskType.Subtraction]: () => task.data.x - task.data.y,
      [TaskType.Multiplication]: () => task.data.x * task.data.y,
    };
    const handler = handlerMap[task.data.type as TaskType];
    if (!handler) {
      throw new Error(`No handler defined for task type ${task.data.type}`);
    }
    const result = handler();
    console.log(result);
    return result;
  },
});
