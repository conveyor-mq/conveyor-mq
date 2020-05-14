# Conveyor MQ

A fast, robust and extensible distributed task/job queue for Node.js.

![Tests](https://github.com/jasrusable/conveyor-mq/workflows/Tests/badge.svg)
![npm](https://img.shields.io/npm/v/@jasrusable/conveyor-mq)
[![Coverage Status](https://coveralls.io/repos/github/jasrusable/conveyor-mq/badge.svg?branch=master)](https://coveralls.io/github/jasrusable/conveyor-mq?branch=master)

```js
const { createManager, createWorker } = require('conveyor-mq');

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

## Introduction

Conveyor is a asynchronous, distributed task/job queue for Node.js, powered by Redis. Conveyor is a general purpose task queue designed for both short lived, and long running tasks.

## Features

- Task management
  - Retry tasks on error or stall with customizable retry strategies
  - Tasks which expire
  - Task execution timeouts
  - Delayed/Scheduled tasks
- Events
  - Task, Queue and Worker events
- Concurrent worker processing
- Simple and extensible design
- Async/await/Promise APIs
- Robust
  - Atomic operations with Redis [transactions](https://redis.io/commands/multi)
  - [At-least-once](https://www.cloudcomputingpatterns.org/at_least_once_delivery/) task delivery
  - High test [code coverage](https://coveralls.io/github/jasrusable/conveyor-mq?branch=master)
- High performance
  - Minimised network overhead using Redis [pipelining](https://redis.io/topics/pipelining) and [multi commands](https://redis.io/commands/multi)
  - Uses Redis [Lua scripting](https://redis.io/commands/eval) for improved performance and atomicity

## Table of Contents

1. Installation
2. Quick start
3. API Reference
4. Examples
5. Contributing
6. License

## Installation

npm:

```bash
npm install --save conveyor-mq
```

yarn:

```bash
yarn add conveyor-mq
```

You will also need Redis >=3.2

## Quick start

### Queue manager

A queue manager is responsible for adding tasks to a queue, as well as querying various properties of a queue.

```js
const { createManager } = require('conveyor-mq');

// Create a manager instance:
const manager = await createManager({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});

// Add a task to the queue:
await manager.enqueueTask({ task: { id: 'my-task-id', data: { x: 1, y: 2 } } });

// Get a task's details:
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

### Queue worker

A queue worker is responsible for taking enqueued tasks off of the queue, and processing them.

```js
const { createWorker } = require('conveyor-mq');

// Create a worker which will start monitoring the queue for tasks and process them:
const worker = await createWorker({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
  // Pass a handler which receives tasks, processes them, and then returns the result of a task:
  handler: ({ task }) => {
    return task.data.x + task.data.y;
  },
});
```

### Queue orchestrator

A queue orchestrator is responsible for various queue maintenance functions including re-enqueueing stalled tasks.

```js
const { createOrchestrator } = require('conveyor-mq');

/*
  Create an orchestrator which will start monitoring the queue for stalled tasks
  and re-enqueue them if necessary:
*/
const orchestrator = await createOrchestrator({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});
```

### Queue listener

A queue listener is responsible for listening and subscribing to queue events.

```js
const { createListener } = require('conveyor-mq');

// Create a listener which will start monitoring the queue and listen for task_complete events:
const listener = await createListener({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});

listener.on('task_complete', ({ event }) =>
  console.log(`Task ${event.task.id} has completed!`),
);
```
