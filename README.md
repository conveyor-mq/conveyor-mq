# Conveyor MQ

A fast, robust and extensible distributed task/job queue for Node.js.

![Tests](https://github.com/jasrusable/conveyor-mq/workflows/Tests/badge.svg)
![npm](https://img.shields.io/npm/v/conveyor-mq)
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
  - Task progress
- Events
  - Task, Queue and Worker events
- Concurrent worker processing
- Fast & efficient, polling-free design
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

1. [Introduction](#introduction)
2. [Features](#features)
3. [Table of Contents](#table-of-contents)
4. [Quick Start Guide](#quick-start-guide)
5. [Overview](#overview)
   - [Tasks](#tasks)
   - [Manager](#manager)
   - [Enqueuing tasks](#enqueuing-tasks)
   - [Task retries](#task-retries)
   - [Worker](#worker)
   - [Processing tasks](#processing-tasks)
   - [Orchestrator](#orchestrator)
   - [Stalled tasks](#stalled-tasks)
   - [Scheduled tasks](#scheduled-tasks)
   - [Listener](#listener)
6. [API Reference](#api-reference)
7. [Examples](#examples)
   - [Simple example](#simple-example)
   - [Scheduled task example](#scheduled-task-example)
8. [Roadmap](#roadmap)
9. [Contributing](#contributing)
10. [License](#license)

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

## Quick Start Guide

```js
import {
  createManager,
  createWorker,
  createOrchestrator,
  createListener,
} from 'conveyor-mq';

const redisConfig = { host: '127.0.0.1', port: 6379 };
const queue = 'myQueue';

const main = async () => {
  // Create a manager which is used to add tasks to the queue, and query various properties of a queue:
  const manager = await createManager({
    queue,
    redisConfig,
  });

  // Add a task to the queue by calling manager.enqueueTask:
  const task = { data: x: 1, y: 2 };
  await manager.enqueueTask({ task });

  // Create a listener and subscribe to the task_complete event:
  const listener = await createListener({ queue, redisConfig });
  listener.on('task_complete', ({ event }) =>
    console.log('Task complete:', event?.task?.id),
  );

  // Create a worker which will process tasks on the queue:
  const worker = await createWorker({
    queue,
    redisConfig,
    handler: ({ task }) => {
      return task.data.x + task.data.y;
    },
  });

  // Create an orchestrator to monitor the queue for stalled tasks, and enqueue scheduled tasks:
  const orchestrator = await createOrchestrator({
    queue,
    redisConfig,
  });
};

main();
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

### Manager

A [manager](https://jasrusable.github.io/conveyor-mq/index.html#createmanager) is responsible for enqueuing tasks, as well as querying various properties of a queue.
Create a manager by calling `createManager` and passing a `queue` and `redisConfig` parameter.

Add a task to the queue by calling `manager.enqueueTask` with an object `{ task: { data: x: 1, y: 2} }`.

For more information, see [createManager](https://jasrusable.github.io/conveyor-mq/index.html#createmanager), [Enqueuing tasks](#enqueuing-tasks)

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
const task = await manager.getTaskById('my-task-id');
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
  enqueueAfter: new Date('2020-05-01'),

  // Time after which a task will expire and fail if only picked up by a worker after the time:
  expiresAt: new Date('2020-05-06'),

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

### Task retries

Conveyor MQ implements a number of different task retry mechanisms which can be controlled by various task properties.

`errorRetryLimit` controls the maximum number of times a task is allowed to be retried after encountering an error whilst being processed.

```js
// Create a task which can be retried on error a maximum of 2 times:
const task = { data: { x: 1, y: 2 }, errorRetryLimit: 2 };
```

`errorRetries` is the number of times a task has been retried because of an error.

```js
// See how many times a task has been retried due to an error:
const task = await manager.getTaskById('my-task-id');
/*
  task = {
    ...
    id: 'my-task-id',
    errorRetries: 2,
    ...
  }
*/
```

`stallRetryLimit` controls the maximum number of times a task is allowed to be retried after encountering becoming stalled whilst being processed.

```js
// Create a task which can be retried on stall a maximum of 2 times:
const task = { data: { x: 1, y: 2 }, stallRetryLimit: 2 };
```

`stallRetries` is the number of times a task has been retried after having stalled:

```js
// See how many times a task has been retried due to an error:
const task = await manager.getTaskById('my-task-id');
/*
  task = {
    ...
    id: 'my-task-id',
    stallRetries: 2,
    ...
  }
*/
```

`retryLimit` controls the maximum number of times a task is allowed to be retried after either stalling or erroring whilst being processed.

```js
// Create a task which can be retried on stall or error a maximum of 2 times:
const task = { data: { x: 1, y: 2 }, retryLimit: 2 };
```

`retries` is the number of times a task has been retried in total (error + stall retries)

```js
// See how many times a task has been retried in total:
const task = await manager.getTaskById('my-task-id');
/*
  task = {
    ...
    id: 'my-task-id',
    retries: 2,
    ...
  }
*/
```

### Worker

A [worker](https://jasrusable.github.io/conveyor-mq/index.html#createworker) is responsible for taking enqueued tasks off of the queue and processing them.
Create a worker by calling `createWorker` with a `queue`, `redisConfig` and `handler` parameter.

The `handler` parameter should be a function which receives a task and is responsible for processing the task.
The handler should return a promise which should resolve if the task was successful, or reject if failed.

For more information, see [createWorker](https://jasrusable.github.io/conveyor-mq/index.html#createworker) and [Processing tasks](#processing-tasks)

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

### Processing tasks

Tasks are processed on the queue by workers which can be created using `createWorker`. Once created, a worker will begin monitoring a queue for tasks to process using an efficient, non-polling implementation making use of the `brpoplpush` Redis command.

A worker can paused and resumed by calling `worker.pause` and `worker.start` respectively.

```js
import { createWorker } from 'conveyor-mq';

const worker = await createWorker({
  // Queue name:
  queue: 'my-queue',

  // Redis configuration:
  redisConfig: { host: 'localhost', port: 6379 },

  // A handler function to process tasks:
  handler: async ({ task, updateTaskProgress }) => {
    await updateTaskProgress(100);
    return 'some-task-result';
  },

  // The number of concurrent tasks the worker can processes:
  concurrency: 10,

  // The retry delay when retrying a task after it has errored:
  getRetryDelay: ({ task }) => (task.retries + 1) * 100,

  // Task success callback:
  onTaskSuccess: ({ task }) => {
    console.log('Task processed successfully', result);
  },

  // Task error callback:
  onTaskError: ({ task, error }) => {
    console.log('Task had an error', error);
  },

  // Task fail callback:
  onTaskFailed: ({ task, error }) => {
    console.log('Task failed with error', error);
  },

  // Worker idle callback. Called when the worker becomes idle:
  onIdle: () => {
    console.log('worker is now idle and not processing tasks');
  },

  // Amount of time since processing a task after which the worker is considered idle and the onIdle callback is called.
  idleTimeout: 250,

  // Worker ready callback, called once a worker is ready to start processing tasks:
  onReady: () => {
    console.log('Worker is now ready to start processing tasks');
  },

  // Control whether the worker should start automatically, else worker.start() must be called manually:
  autoStart: true,

  // Remove tasks once they are processed successfully
  removeOnSuccess = false,

  // Remove tasks once they are fail to be processed successfully
  removeOnFailed = false,
});
```

### Orchestrator

An [orchestrator](https://jasrusable.github.io/conveyor-mq/index.html#createorchestrator) is responsible for various queue maintenance operations including re-enqueueing stalled tasks, and enqueueing delayed/scheduled tasks.
Create an orchestrator by calling `createOrchestrator` with a `queue` and `redisConfig` parameter. The orchestrator will then begin monitoring the queue for stalled tasks and re-enqueueing them if needed, as well as enqueueing scheduled tasks.

For more information, see [createOrchestrator](https://jasrusable.github.io/conveyor-mq/index.html#createorchestrator) and [Stalling tasks](#stalled-tasks)

```js
import { createOrchestrator } from 'conveyor-mq';

// Create an orchestrator:
const orchestrator = await createOrchestrator({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});
```

### Stalled tasks

As part of the at-least-once task delivery strategy, Conveyor MQ implements stalled or stuck task checking and retrying.

While a `worker` is busy processing a task, it will periodically acknowledge that it is still currently processing the task. The interval at which a processing task is acknowledged by a worker during processing at is controlled by `Task.taskAcknowledgementInterval` and otherwise falls back to `Worker.defaultTaskAcknowledgementInterval`.

A task is considered stalled if while it is being processed by a worker, the worker fails to acknowledge that it is currently working on the task. This situation occurs mainly when either a worker goes offline or crashes unexpectedly whilst processing a task, or if the Node event loop on the worker becomes blocked while processing a task.

The time since a task was last acknowledged after which it is considered stalled is controlled by `Task.stallInterval` and otherwise falls back to `Worker.defaultStallInterval`.

> _Note_: An orchestrator is required to be running on the queue which will monitor and re-enqueue any stalled tasks. It is recommended to have only a single orchestrator run per queue to minimize Redis overhead, however multiple orchestrators can be run simultaneously.

### Scheduled tasks

Tasks can be scheduled to be added to the queue at some future point in time. To schedule a task, include a `enqueueAfter` property on a task:

```js
const scheduledTask = {
  data: { x: 1, y: 2 },
  enqueueAfter: new Date('2020-05-15'),
};

const { task: enqueuedTask } = await manager.enqueueTask({
  task: scheduledTask,
});
/*
  enqueuedTask = {
    ...
    data: { x: 1, y: 2 },
    status: 'scheduled',
    enqueueAfter: '2020-05-15',
    ...
  }
*/
```

> _Note_: An orchestrator is required to be running on the queue which will monitor and enqueue any scheduled tasks. It is recommended to have only a single orchestrator run per queue to minimize Redis overhead, however multiple orchestrators can be run simultaneously.

### Listener

A [listener](https://jasrusable.github.io/conveyor-mq/index.html#createlistener) is responsible for listening and subscribing to [events](https://jasrusable.github.io/conveyor-mq/enums/eventtypes.html). Use `listener.on` to subscribe to various task, queue and worker related events.

For more information, see [createListener](https://jasrusable.github.io/conveyor-mq/index.html#createlistener) and [Event](https://jasrusable.github.io/conveyor-mq/interfaces/event.html)

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
});
```

## API Reference

The API Reference can be found [here](https://jasrusable.github.io/conveyor-mq/)

## Examples

### [Simple example](https://github.com/jasrusable/conveyor-mq/blob/master/examples/simple-example.ts)

### [Scheduled task example](https://github.com/jasrusable/conveyor-mq/blob/master/examples/schedulted-task-example.ts)

## Roadmap

- [ ] Improve documentation
- [ ] Task priorities
- [ ] Recurring tasks
- [ ] Queue pause/resume
- [ ] Task rate limiting
- [ ] Performance optimisations
- [ ] Child process workers
- [ ] Web UI

## Contributing

See [CONTRIBUTING.md](https://github.com/jasrusable/conveyor-mq/blob/master/CONTRIBUTING.md)

## License

See [LICENSE](https://github.com/jasrusable/conveyor-mq/blob/master/LICENSE)
