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
const { createManager } = require('conveyor-mq');

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

### Orchestrator

An [orchestrator](https://jasrusable.github.io/conveyor-mq/index.html#createorchestrator) is responsible for various queue maintenance operations including re-enqueueing stalled tasks, and enqueueing delayed/scheduled tasks.
Create an orchestrator by calling `createOrchestrator` with a `queue` and `redisConfig` parameter. The orchestrator will then begin monitoring the queue for stalled tasks and re-enqueueing them if needed, as well as enqueueing scheduled tasks.

```js
const { createOrchestrator } = require('conveyor-mq');

// Create an orchestrator:
const orchestrator = await createOrchestrator({
  queue: 'my-queue',
  redisConfig: { host: 'localhost', port: 6379 },
});
```

### Listener

A [listener](https://jasrusable.github.io/conveyor-mq/index.html#createlistener) is responsible for listening and subscribing to [events](https://jasrusable.github.io/conveyor-mq/enums/eventtypes.html). Use `listener.on` to subscribe to various task, queue and worker related events.

```js
const { createListener } = require('conveyor-mq');

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

Various other keys can be set on a task which alter the way it is handled and processed by the queue:

#### Task.id

[`Task.id`](https://jasrusable.github.io/conveyor-mq/interfaces/task.html#id) uniquely identifies a task on a queue. Task ids can be explicitly set on a task, or alternatively will be generated by `manager.enqueueTask` when adding the task to the queue. The generated `id` will be a uuid string.

- Creating a task with a custom id:

```js
const myTask = { id: 'my-custom-task-id', data: { x: 1, y: 2 } };
```

- Letting `manager.enqueueTask` generate a task id:

```js
const myTask = { data: { x: 1, y: 2 } };
const enqueuedTask = await manager.enqueueTask({ task: myTask });
/*
  enqueuedTask = {
    id: '3984328c-f06f-4680-9c5b-00fa4e2ebf60',
    data: { x: 1, y: 2 },
    ...
  }
*/
```

#### Task.data

[`Task.data`](https://jasrusable.github.io/conveyor-mq/interfaces/task.html#data) is used for storing custom user-data. This should be JSON serializable as it needs to be sent to and from Redis:

```js
const myTask = { data: { emailAddress: 'john@doe.com', message: 'Dear John' } };
```

#### Task.status

[Task.status](https://jasrusable.github.io/conveyor-mq/interfaces/task.html#status) represents the status of a task. The status of a task will change as the task moves through the different stages of the queue.
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

### Task.result

[Task.result](https://jasrusable.github.io/conveyor-mq/interfaces/task.html#result) is set to the return value (or returned Promise resolution) of `worker.handler` after the successful processing of a task.

### Task.error

[Task.error](https://jasrusable.github.io/conveyor-mq/interfaces/task.html#error) is set to the value of an error thrown (or returned Promise rejection) in `worker.handler` after the failed processing of a task.


### Task.queuedAt

[Task.queuedAt](https://jasrusable.github.io/conveyor-mq/interfaces/task.html#queuedat) is the time at which the task was enqueued in the queue.

### Task.processingStartedAt

[Task.processingStartedAt](https://jasrusable.github.io/conveyor-mq/interfaces/task.html#processingstartedat) is the time at which processing of the task was started by a worker.

### Task.processingStartedAt

[Task.processingStartedAt](https://jasrusable.github.io/conveyor-mq/interfaces/task.html#processingstartedat) is the time at which processing of the task was started by a worker.


## API Reference

The API Reference can be found [here](https://jasrusable.github.io/conveyor-mq/)
