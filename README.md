# Conveyor MQ

A fast, robust and extensible distributed task/job queue for Node.js, powered by Redis.

![Tests](https://github.com/jasrusable/conveyor-mq/workflows/Tests/badge.svg)
![npm](https://img.shields.io/npm/v/conveyor-mq)
[![Coverage Status](https://coveralls.io/repos/github/jasrusable/conveyor-mq/badge.svg?branch=master)](https://coveralls.io/github/jasrusable/conveyor-mq?branch=master)

## Introduction

Conveyor MQ is a general purpose, distributed task/job queue for Node.js, powered by Redis.

Conveyor MQ implements a [reliable queue](https://redis.io/commands/rpoplpush#pattern-reliable-queue) which provides strong guarantees around the reliability of tasks in the event of network or server errors, for example. Conveyor MQ offers [at-least-once](https://www.cloudcomputingpatterns.org/at_least_once_delivery/) and [exactly-once](https://www.cloudcomputingpatterns.org/exactly_once_delivery/) task delivery through the use of error or stall task retries. Conveyor MQ is implemented using a highly efficient and performant, polling-free design making use of [`brpoplpush`](https://redis.io/commands/brpoplpush) from Redis.

```js
import { createManager, createWorker } from 'conveyor-mq';

const queueName = 'my-queue';
const redisConfig = { host: '127.0.0.1', port: 6379 };

const manager = createManager({ queue: queueName, redisConfig });
manager.enqueueTask({ data: { x: 1, y: 2 } });

const worker = createWorker({
  queue: queueName,
  redisConfig,
  handler: ({ task }) => {
    console.log(`Processing task: ${task.id}`);
    return task.data.x + task.data.y;
  },
});
```

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
- Highly extensible design with [plugins](#plugins)
- Task rate limits
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
   - [Plugins](#plugins)
   - [Sharing Redis connections](#sharing-redis-connections)
   - [Debugging](#debugging)
6. [API Reference](#api-reference)
7. [Examples](#examples)
   - [Simple example](#simple-example)
   - [Scheduled task example](#scheduled-task-example)
   - [Express example](#express-example)
   - [Child/sub tasks example](#childsub-tasks-example)
   - [Task types example](#task-types-example)
   - [Shared Redis client example](#shared-redis-client-example)
   - [Plugins example](#plugins-example)
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

// Create a manager which is used to add tasks to the queue, and query various properties of a queue:
const manager = createManager({ queue, redisConfig });

// Add a task to the queue by calling manager.enqueueTask:
const task = { data: { x: 1, y: 2 } };
manager.enqueueTask(task);

// Schedule a task to be added to the queue later by calling manager.scheduleTask:
const scheduledTask = {
  data: { x: 1, y: 2 },
  enqueueAfter: new Date('2020-05-03'),
};
manager.enqueueTask(scheduledTask);

// Create a listener and subscribe to the task_complete event:
const listener = createListener({ queue, redisConfig });
listener.on('task_complete', ({ event }) =>
  console.log('Task complete:', event.task.id),
);

// Create a worker which will process tasks on the queue:
const worker = createWorker({
  queue,
  redisConfig,
  handler: ({ task }) => {
    return task.data.x + task.data.y;
  },
});

// Create an orchestrator to monitor the queue for stalled tasks, and enqueue scheduled tasks:
const orchestrator = createOrchestrator({ queue, redisConfig });
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
const manager = createManager({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});

// Add a task to the queue:
await manager.enqueueTask({ data: { x: 1, y: 2 } });

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

const manager = createManager({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});

const enqueuedTask = await manager.enqueueTask(myTask);
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
const worker = createWorker({
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

const worker = createWorker({
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
const orchestrator = createOrchestrator({
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

Tasks can be scheduled to be added to the queue at some future point in time. To schedule a task, include a `enqueueAfter` property on a task and call `manager.scheduleTask`:

```js
const scheduledTask = {
  data: { x: 1, y: 2 },
  enqueueAfter: new Date('2020-05-15'),
};

const { task: enqueuedTask } = await manager.scheduleTask(scheduledTask);
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
const listener = createListener({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});

// Listen for the 'task_complete' event:
listener.on('task_complete', ({ event }) => {
  console.log(`Task ${event.task.id} has completed!`),
});
```

### Plugins

Conveyor MQ is highly extensible through its plugin & hooks architecture. The `createManager`, `createWorker` and `createOrchestrator` functions have an optional `hooks` parameter through which various hook functions can be passed to hook into the various queue lifecycle actions.
Plugins can be created by implementing hook functions, and then calling `registerPlugins` to register plugins.

#### Create a plugin

A plugin is a simple object with keys corresponding to hook names, and values of functions.

```js
import { registerPlugins } from 'conveyor-mq';

// Create a simple plugin.
const myPlugin = {
  onBeforeEnqueueTask: ({ task }) => console.log(task),
  onAfterEnqueueTask: ({ task }) => console.log(task),
  onBeforeTaskProcessing: ({ taskId }) => console.log(taskId),
  onAfterTaskProcessing: ({ task }) => console.log(task),
  onAfterTaskSuccess: ({ task }) => console.log(task),
  onAfterTaskError: ({ task }) => console.log(task),
  onAfterTailFail: ({ task }) => console.log(task),
};

// Register the plugin and unpack new createManager and createWorker functions.
const { createManager, createWorker } = registerPlugins(myPlugin);

const queue = 'my-queue';
const redisConfig = { host: 'localhost', port: 6370 };

// Create a manager which is registered with myPlugin.
const manager = createManager({ queue, redisConfig });

// Create a worker which is registered with myPlugin.
const manager = createManager({
  queue,
  redisConfig,
  handler: ({ task }) => {
    // Do processing
    return 'some-result';
  },
});
```

See the [Plugins example](#plugins-example) for more information.

### Sharing Redis connections

Redis connections can be shared between a manager, worker and orchestrator as an optimization to reduce the total number of Redis connections used. This is particularly useful to do when your Redis server is hosted and priced based on the number of active connections, such as on Heroku or Compose.

The functions `createManager`, `createWorker` and `createOrchestrator` each take an optional `redisClient` parameter where a shared Redis client can be passed. The shared Redis client must first be configured with the custom Lua scripts by calling `loadLuaScripts({ client })`.

See the [Shared redis client example](#shared-redis-client-example) for more details.

### Debugging

Conveyor MQ makes use of the [debug](https://www.npmjs.com/package/debug) package for debug logging.

Enable Conveyor MQ debug logging by setting the `DEBUG` environment variable to `conveyor-mq:*` and then executing your project/app in the same shell session:

```bash
export DEBUG=conveyor-mq:*
node ./my-app.js
```

## API Reference

### Manager

- [createManager](#createManager)
- [manager.enqueueTask](#managerenqueueTask)
- [manager.enqueueTasks](#managerenqueueTasks)
- [manager.scheduleTask](#managerscheduleTask)
- [manager.scheduleTasks](#managerscheduleTasks)
- [manager.onTaskComplete](#manageronTaskComplete)
- [manager.getTaskById](#managergetTaskById)
- [manager.getTasksById](#managergetTasksById)
- [manager.getTaskCounts](#managergetTasksCounts)
- [manager.getWorkers](#managergetworkers)
- [manager.removeTaskById](#managerremoveTaskById)
- [manager.pauseQueue](#managerpauseQueue)
- [manager.resumeQueue](#managerresumeQueue)
- [manager.setQueueRateLimit](#managersetqueueratelimit)
- [manager.getQueueRateLimit](#managergetqueueratelimit)
- [manager.destroyQueue](#managerdestroyQueue)
- [manager.quit](#managerquit)

### Worker

- [createWorker](#createWorker)

#### createManager

Creates a manager instance which is responsible for adding tasks to the queue, as well as querying various properties of the queue.
Returns a promise which resolves with a manager instance.

```js
import { createManager } from 'conveyor-mq';

const manager = createManager({
  // Queue name.
  queue: 'my-queue',
  // Redis configuration
  redisConfig: {
    host: 'localhost',
    port: 6379,
    db: 0,
    password: 'abc',
    url: 'redis://some-password@localhost:6371/0',
  },
  // Pass in a shared redis instance.
  redisClient: sharedRedisInstance,
});
```

#### manager.enqueueTask

Enqueues a task on the queue.
Returns a promise which resolves with a `TaskResponse`.

```js
const task = {
  id: 'my-custom-id', // A custom task id. If omitted, an id (uuid string) will be auto generated by manager.enqueueTask.
  data: { x: 1, y: 2 }, // Custom task data.
  errorRetryLimit: 3, // The maximum number of times a task can be retried after due to an error.
  stallRetryLimit: 3, // The maximum number of times a task can be retried being after having stalled.
  retryLimit: 5, // The maximum number of times a task can be retired at all (error + stall).
  executionTimeout: 5000, // The maximum time a task is allowed to execute for after which it will fail with a timeout error.
  retryBackoff: { strategy: 'linear', factor: 10 }, // Custom retry strategy.
  expiresAt: new Date('2020-05-06'), // Time after which a task will expire and fail if only picked up by a worker after the time.
  stallTimeout: 5000, // Time after an acknowledgement after which a task will be considered stalled and re-enqueued by an orchestrator.
  taskAcknowledgementInterval: 1000, // Frequency at which a task is acknowledged by a worker while being processed.
};

const {
  task: enqueuedTask, // The enqueued task is returned.
  onTaskComplete, // A function which returns a promise that resolves once the task is complete.
} = await manager.enqueueTask(task);
```

#### manager.enqueueTasks

Enqueues multiple tasks in a single transaction.
Returns a promise which resolves with a list of `TaskResponse`'s.

```js
const task1 = { data: { x: 1 } };
const task2 = { data: { y: 2 } };

const [
  { task: enqueuedTask1 },
  { task: enqueuedTask2 },
] = await manager.enqueueTasks([task1, task2]);
```

#### manager.scheduleTask

Schedules a task to be enqueued at a later time.
Returns a promise which resolves with a `TaskResponse`.

```js
const myScheduledTask = {
  data: { x: 1, y: 2 },
  enqueueAfter: new Date('2020-05-30'),
};

const {
  task, // Scheduled task.
  onTaskComplete, // A function which returns a promise that resolves on task complete.
} = await manager.scheduleTask(myScheduledTask);
```

#### manager.scheduleTasks

Schedules a task to be enqueued at a later time.
Returns a promise which resolves with a list of `TaskResponse`'s.

```js
const myScheduledTask = {
  data: { x: 1, y: 2 },
  enqueueAfter: new Date('2020-05-30'),
};

const [{ task, onTaskComplete }] = await manager.scheduleTasks([
  myScheduledTask,
]);
```

#### manager.onTaskComplete

A function which takes a `taskId` and returns a promise that resolves with the task once the task has completed.

```js
const task = await manager.enqueueTask({ data: { x: 1, y: 2 } });
await manager.onTaskComplete(task.id);
console.log('Task has completed!');
```

#### manager.getTaskById

Gets a task from the queue. Returns a promise that resolves with the task from the queue.

```js
const task = await manager.getTaskById('my-task-id');
```

#### manager.getTasksById

Gets multiple tasks from the queue in a transaction. Returns a promises that resolves with a list of tasks.

```js
const tasks = await manager.getTasksById(['task-id-1', 'task-id-2']);
```

#### manager.getTaskCounts

Gets the count of tasks per status. Returns a promise that resolves with the counts of tasks per status.

```js
const {
  scheduledCount,
  queuedCount,
  processingCount,
  successCount,
  failedCount,
} = await manager.getTaskCounts();
```

#### manager.getWorkers

Gets the workers connected to the queue. Returns a promise that resolves with a list of workers.

```js
const workers = await manager.getWorkers();
```

#### manager.removeTaskById

Removes a given task from the queue by id. Returns a promise.

```js
await manager.removeTaskById('some-task-id');
```

#### manager.pauseQueue

Pauses a queue.

```js
await manager.pauseQueue();
```

#### manager.resumeQueue

Resumes a queue.

```js
await manager.resumeQueue();
```

#### manager.setQueueRateLimit

Sets the rate limit of a queue. (100 tasks every 60 seconds)

```js
await manager.setQueueRateLimit({ points: 100, duration: 60 });
```

#### manager.getQueueRateLimit

Gets the rate limit of a queue.

```js
const rateLimit = await manager.getQueueRateLimit();
// rateLimit = { points: 100, duration: 60 }
```

#### manager.destroyQueue

Destroys all queue data and data structures. Returns a promise.

```js
await manager.destroyQueue();
```

#### manager.quit

Quits a manager, disconnecting all redis connections and listeners. Returns a promise.

```js
await manager.quit();
```

### Worker

#### createWorker

A worker is responsible for taking enqueued tasks off of the queue and processing them. Create a worker by calling `createWorker` with at least a `queue`, `redisConfig` and `handler` parameter.

The `handler` parameter should be a function which receives a task and is responsible for processing the task.
The handler should return a promise which should resolve if the task was successful, or reject if failed.

```js
import { createWorker } from 'conveyor-mq';

// Create a worker which will start monitoring the queue for tasks and process them:
const worker = createWorker({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
  // Pass a handler which receives tasks, processes them, and then returns the result of a task:
  handler: ({ task }) => {
    return task.data.x + task.data.y;
  },
});
```

All worker params:

```js
import { createWorker } from 'conveyor-mq';

const worker = createWorker({
  // Queue name:
  queue: 'my-queue',

  // Redis configuration:
  redisConfig: { host: 'localhost', port: 6379 },

  // A handler function to process tasks.
  // If the handler function throws an error or returns a promise which rejects, the task will be considered to have errorerd and the thrown or rejected error will be set to the task's `error` field.
    // If the handler function returns a result, or returns a promise which resolves, the task will be considered successfully processed and the return or resolve value will be set to the task's `result` field.
  handler: async ({ task, updateTaskProgress }) => {
    await updateTaskProgress(100);
    return 'some-task-result';
  },

  // The number of concurrent tasks the worker can processes at a time:
  concurrency: 10,

  // The retry delay when retrying a task after it has errored or stalled:
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

## Examples

### [Simple example](https://github.com/conveyor-mq/conveyor-mq/tree/master/examples/simple-example)

### [Express example](https://github.com/conveyor-mq/conveyor-mq/tree/master/examples/express-example)

### [Scheduled task example](https://github.com/conveyor-mq/conveyor-mq/tree/master/examples/scheduled-task-example)

### [Child/sub tasks example](https://github.com/conveyor-mq/conveyor-mq/tree/master/examples/sub-tasks-example)

### [Task types example](https://github.com/conveyor-mq/conveyor-mq/tree/master/examples/task-types-example)

### [Shared redis client example](https://github.com/conveyor-mq/conveyor-mq/tree/master/examples/redis-client-sharing-example)

### [Plugins example](https://github.com/conveyor-mq/conveyor-mq/tree/master/examples/plugins-example)

## Roadmap

- [ ] Improve documentation
- [ ] Task priorities
- [ ] Recurring tasks
- [x] Task rate limiting
- [ ] Performance optimisations
- [ ] Child process workers
- [ ] Web UI

## Contributing

See [CONTRIBUTING.md](https://github.com/jasrusable/conveyor-mq/blob/master/CONTRIBUTING.md)

## License

See [LICENSE](https://github.com/jasrusable/conveyor-mq/blob/master/LICENSE)
