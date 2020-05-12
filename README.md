# Conveyor

A fast, robust and extensible distributed task/job queue for Node.js.

![Tests](https://github.com/jasrusable/conveyor/workflows/Tests/badge.svg)
![npm](https://img.shields.io/npm/v/@jasrusable/conveyor)
[![Coverage Status](https://coveralls.io/repos/github/jasrusable/conveyor/badge.svg?branch=master)](https://coveralls.io/github/jasrusable/conveyor?branch=master)

```js
const { createManager, createWorker } = require('@jasrusable/conveyor');

const main = async () => {
  const queueName = 'my-queue';
  const redisConfig = { host: '127.0.0.1', port: 6379 };

  const manager = await createManager({ queue: queueName, redisConfig });
  await manager.enqueueTask({ task: { data: { x: 1, y: 2 } } });

  const worker = await createWorker({
    queue: queueName,
    redisConfig,
    handler: ({ task }) => {
      console.log(`Processing task: ${task.id}`);
      return task.x + task.y;
    },
  });
};

main();
```

### Introduction

Conveyor is a asynchronous, distributed task/job queue for Node.js, powered by Redis. Conveyor is a general purpose task queue designed for both short lived, and long running tasks.

### Installation

npm:

```bash
npm install --save @jasrusable/conveyor
```

yarn:

```bash
yarn add @jasrusable/conveyor
```

You will also need Redis >=3.2

### Features

- Create and process tasks
  - Task retries
  - Task expiry
  - Task retry strategies
- Concurrent worker processing
- Simple and extensible design
- Async/await/Promise APIs
- Robust
  - Atomic operations with Redis [transactions](https://redis.io/commands/multi)
  - [At-least-once](https://www.cloudcomputingpatterns.org/at_least_once_delivery/) task delivery
  - High test [code coverage](https://coveralls.io/github/jasrusable/conveyor?branch=master)
- High performance
  - Minimised network overhead using Redis [pipelining](https://redis.io/topics/pipelining) and [multi commands](https://redis.io/commands/multi)
  - Uses Redis [Lua scripting](https://redis.io/commands/eval) for improved performance and atomicity

## Table of Contents

1. Quick start
2. API Reference
3. Examples
4. Contributing
5. License

### Quick start

#### Queue manager

A queue manager is responsible for adding tasks to a queue, as well as querying various properties of a queue.

```js
const { createManager } = require('@jasrusable/conveyor');

// Create a manager instance:
const manager = await createManager({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});

// Add a task to the queue:
await manager.enqueueTask({ task: { id: 'my-task-id', data: { x: 1, y: 2 } } });

// Get a task's details
const task = await manager.getTask({ taskId: 'my-task-id' });
/*
  {
    ...
    id: 'my-task-id',
    status: 'queued',
    data: {
      x: 1,
      y: 2,
    },
    ...
  }
*/
```

#### Queue worker

A queue worker is responsible for taking enqueued tasks off of the queue, and processing them.

```js
const { createWorker } = require('@jasrusable/conveyor');

// Create a worker which will start monitoring the queue for tasks and process them:
const worker = await createWorker({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
  // Pass a handler which receives tasks and returns the result of a task:
  handler: ({ task }) => {
    return task.data.x + task.data.y;
  },
});
```

#### Queue orchestrator

A queue orchestrator is responsible for various queue queue maintenance functions including re-enqueueing stalled tasks.

```js
const { createOrchestrator } = require('@jasrusable/conveyor');

/*
  Create an orchestrator which will start monitoring the queue for stalled tasks
  and re-enqueue them if necessary:
*/
const orchestrator = await createOrchestrator({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});
```

#### Queue listener

A queue listener is responsible for listening and subscribing to queue events.

```js
const { createListener } = require('@jasrusable/conveyor');

/*
  Create a listener which will start monitoring the queue and listen for task_complete events.
*/
const listener = await createListener({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});
listener.on('task_complete', ({ event }) =>
  console.log(`Task ${event.task.id} has completed!`),
);
```
