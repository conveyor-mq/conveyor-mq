# Conveyor MQ

A fast, robust and extensible distributed task/job queue for Node.js.

![Tests](https://github.com/jasrusable/conveyor-mq/workflows/Tests/badge.svg)
![npm](https://img.shields.io/npm/v/@jasrusable/conveyor-mq)
[![Coverage Status](https://coveralls.io/repos/github/jasrusable/conveyor-mq/badge.svg?branch=master)](https://coveralls.io/github/jasrusable/conveyor-mq?branch=master)

```js
import { createManager, createWorker } from 'conveyor-mq';

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

Conveyor MQ is a general purpose, asynchronous, distributed task/job queue for Node.js, powered by Redis, designed for both short lived, and long running tasks.

## Features

- Task management
  - Retry tasks on error or stall with customizable retry strategies
  - Tasks which expire
  - Task execution timeouts
  - Delayed/Scheduled tasks
- Events
  - Task, Queue and Worker events
- Concurrent worker processing
- Efficient, polling-free design
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
2. Quick Start Guide
3. Overview
4. API Reference
5. Examples
6. Contributing
7. License

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

## Quick Start

### Task

A [task](https://jasrusable.github.io/conveyor-mq/interfaces/task.html) is an object containing at least a `data` key.
The value of `data` should be JSON serializable as it will need to be transferred over the wire to and from Redis.

```js
// A task:
const myTask = { data: { x: 1, y: 2 } };
```

### Manager

A [manager](https://jasrusable.github.io/conveyor-mq/index.html#createmanager) is responsible for enqueuing tasks, as well as querying various properties of a queue.
Create a manager by calling `createManager` and passing a `queue` and `redisConfig` parameter.
Add a task to the queue by calling `manager.enqueueTask` with an object `{ task: { data: x: 1, y: 2} }`.

```js
import { createManager } from 'conveyor-mq';

// Create a manager instance:
const manager = await createManager({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});

// Add a task to the queue:
await manager.enqueueTask({ task: { data: { x: 1, y: 2 } } });

// Get a task:
const task = await manager.getTask({ taskId: 'my-task-id' });
/*
  task = {
    ...
    status: 'queued',
    data: {
      x: 1,
      y: 2,
    },
    ...
  }
*/
```

### Worker

A [worker](https://jasrusable.github.io/conveyor-mq/index.html#createworker) is responsible for taking enqueued tasks off of the queue and processing them.
Create a worker by calling `createWorker` with a `queue`, `redisConfig` and `handler` parameter. The `handler` parameter should be a function which receives a task and is responsible for processing the task.

```js
import { createWorker } from 'conveyor-mq';

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

### Orchestrator

An [orchestrator](https://jasrusable.github.io/conveyor-mq/index.html#createorchestrator) is responsible for various queue maintenance operations including re-enqueueing stalled tasks, and enqueueing delayed/scheduled tasks.
Create an orchestrator by calling `createOrchestrator` with a `queue` and `redisConfig` parameter. The orchestrator will then begin monitoring the queue for stalled tasks and re-enqueueing them if needed, as well as enqueueing scheduled tasks.

```js
import { createOrchestrator } from 'conveyor-mq';

// Create an orchestrator:
const orchestrator = await createOrchestrator({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});
```

### Listener

A [listener](https://jasrusable.github.io/conveyor-mq/index.html#createlistener) is responsible for listening and subscribing to [events](https://jasrusable.github.io/conveyor-mq/enums/eventtypes.html). Use `listener.on` to subscribe to various task, queue and worker related events.

```js
import { createListener } from 'conveyor-mq';

// Create a listener:
const listener = await createListener({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});

// Listen for the 'task_complete' event:
listener.on('task_complete', ({ event }) => {
  console.log(`Task ${event.task.id} has completed!`),
}
);
```

## Overview

### Tasks

The most basic implementation of a task is an object with a `data` key:

```js
const myTask = { data: { x: 1, y: 2 } };
```

#### Task life cycle

A task will move through various statuses throughout its life cycle within the queue:

`scheduled`: The task has been scheduled to be enqueued at a later time. (Delayed/Scheduled task)

`queued`: The task has been enqueued on the queue and is pending processing by a worker.

`processing`: The task has picked up by a worker and is being processed.

`success`: The task has been successfully processed by a worker.

`failed`: The task has been unsuccessfully processed by a worker and has exhausted all error & stall retires.

Task status flow diagram:

```js
                                   -> success
                                 /
scheduled -> queued -> processing
^          ^                    \
|--- or ---|----------< (Stall & error reties)
                                  \
                                    -> failed

```

\*Note: `success` and `failed` statuses both represent the final outcome of a task, after all stall/error retrying has been attempted and exhausted.

### Enqueuing tasks

Tasks are added to a queue (enqueued) by using a manager's `enqueueTask` function.

```js
import { createManager } from 'conveyor-mq';

const myTask = {
  // A custom task id. If omitted, an id will be auto generated by manager.enqueueTask.
  id: 'my-custom-id',

  // Custom task data for processing:
  data: { x: 1, y: 2 },

  // The maximum number of times a task can be retried after due to an error:
  errorRetryLimit: 3,

  // The maximum number of times a task can be retried being after having stalled:
  stallRetryLimit: 3,

  // The maximum number of times a task can be retired at all (error + stall):
  retryLimit: 5,

  // The maximum time a task is allowed to execute for after which it will fail with a timeout error:
  executionTimeout: 5000,

  // Custom retry strategy:
  retryBackoff: { strategy: 'linear', factor: 10 },

  // Schedules a task to only be enqueued after this time:
  enqueueAfter: moment('2020-05-01'),

  // Time after which a task will expire and fail if only picked up by a worker after the time:
  expiresAt: moment('2020-05-06'),

  // Time after an acknowledgement after which a task will be considered stalled and re-enqueued by an orchestrator:
  stallTimeout: 5000,

  // Frequency at which a task is acknowledged by a worker when being processed:
  taskAcknowledgementInterval: 1000,
};

const manager = await createManager({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});

const enqueuedTask = await manager.enqueueTask({ task: myTask });
```

### Processing tasks

Tasks are processed on the queue by workers. A worker can be created using `createWorker`.

```js
import { createWorker } from 'conveyor-mq';

const worker = await createWorker({
  // Queue name:
  queue: 'my-queue',

  // Redis configuration:
  redisConfig: { host: 'localhost', port: 6379 },

  // A handler function to process tasks:
  handler: ({ task }) => {
    return 'some-task-result';
  },

  // The number of concurrent tasks the worker can processes:
  concurrency: 10,

  // The retry delay when retrying a task after it has errored:
  getRetryDelay: ({ task }) => (task.retries + 1) * 100,

  // Task success callback:
  onTaskSuccess: ({ task }) => console.log('Task processed successfully', result),

  // Task error callback:
  onTaskError: ({ task, error }) => console.log('Task had an error', error),

  // Task fail callback:
  onTaskFailed: ({ task, error }) => console.log('Task failed with error', error),

  // Worker idle callback. Called when the worker becomes idle:
  onIdle: () => console.log('worker is now idle and not processing tasks'),

  // Amount of time since processing a task after which the worker is considered idle and the onIdle callback is called.
  idleTimeout: 250,

  // Worker ready callback, called once a worker is ready to start processing tasks:
  onReady: () => console.log('Worker is now ready to start processing tasks'),

  // Control whether the worker should start automatically, else worker.start() must be called manually:
  autoStart: true,
});
```

### Stalled tasks

As part of the at-least-once task delivery strategy, Conveyor MQ implements stalled or stuck task checking and retrying.

While a `worker` is busy processing a task, it will periodically acknowledge that it is still currently processing the task. The interval at which a processing task is acknowledged by a worker during processing at is controlled by `Task.taskAcknowledgementInterval` and otherwise falls back to `Worker.defaultTaskAcknowledgementInterval`.

A task is considered stalled if while it is being processed by a worker, the worker fails to acknowledge that it is currently working on the task. This situation occurs mainly when either a worker goes offline or crashes unexpectedly whilst processing a task, or if the Node event loop on the worker becomes blocked while processing a task.

The time since a task was last acknowledged after which it is considered stalled is controlled by `Task.stallInterval` and otherwise falls back to `Worker.defaultStallInterval`.

## API Reference

The API Reference can be found [here](https://jasrusable.github.io/conveyor-mq/)
