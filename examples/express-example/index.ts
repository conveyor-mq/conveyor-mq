import express from 'express';
import { createManager, createWorker } from 'conveyor-mq';

const app = express();
const redisConfig = { host: '127.0.0.1', port: 6379 };
const queue = 'myQueue';

const manager = createManager({
  queue,
  redisConfig,
});

const worker = createWorker({
  queue,
  redisConfig,
  handler: () => {
    return 'some-result';
  },
});

app.post('/create-task', async (req, res) => {
  const task = await manager.enqueueTask({ data: 'some-data' });
  res.json();
});

const port = 3000;
app.listen(port, () =>
  console.log(`Example app listening at http://localhost:${port}`),
);
