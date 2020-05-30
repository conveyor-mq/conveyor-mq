import express from 'express';
import { createManager, createWorker } from 'conveyor-mq';

const app = express();
const redisConfig = { host: '127.0.0.1', port: 6379 };
const queue = 'myQueue';

// Create manager.
const manager = createManager({
  queue,
  redisConfig,
});

// Create worker to process tasks.
const worker = createWorker({
  queue,
  redisConfig,
  handler: ({ task }) => {
    return new Promise((resolve) => {
      setTimeout(() => resolve('some-result'), task.data.delay || 1000);
    });
  },
});

// POST /tasks to create a new task.
app.post('/tasks', async (req, res) => {
  const task = await manager.enqueueTask({ data: { delay: 1000 } });
  res.json(task);
});

// GET /tasks/:taskId to get a task.
app.get('/tasks/:taskId', async (req, res) => {
  const task = await manager.getTaskById(req.params.taskId);
  res.json(task);
});

// GET /tasks/:task-id/on-complete to block until the task is complete.
app.get('/tasks/:taskId/on-complete', async (req, res) => {
  const task = await manager.onTaskComplete(req.params.taskId);
  res.json({
    message: 'Task completed',
    task,
  });
});

// Home page.
app.get('/', async (req, res) => {
  console.log(req.params);
  res.send('Conveyor MQ - Express example');
});

const port = 3000;
app.listen(port, () =>
  console.log(`Example app listening at http://localhost:${port}`),
);
