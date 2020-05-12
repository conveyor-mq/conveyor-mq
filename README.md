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

## Introduction

Conveyor is a asynchronous, distributed task/job queue for Node.js, powered by Redis. Conveyor is a general purpose task queue designed for both short lived, and long running tasks.

## Installation

npm:

```bash
npm install --save @jasrusable/conveyor
```

yarn:

```bash
yarn add @jasrusable/conveyor
```

You will also need Redis >=3.2

## Features

- Create and process tasks
  - Task retries
  - Task expiry
  - Task retry strategies
- Concurrent worker processing
- Simple and extensible design
- Async/await/Promise APIs
- Robust
  - Atomic operations
  - At-least-once task delivery
  - High test code coverage
- High performance
  - Minimised network overhead using Redis pipelining and multi commands (transactions)
  - Uses Redis Lua scripting for improved performance and atomicity
