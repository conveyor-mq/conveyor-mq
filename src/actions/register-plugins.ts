import { map, filter, forEach } from 'lodash';
import { OnBeforeEnqueueTask, OnAfterEnqueueTask } from './enqueue-task';
import { createManager, ManagerInput } from './create-manager';
import {
  createWorker,
  WorkerInput,
  OnBeforeTaskProcessing,
  OnAfterTaskProcessing,
} from './create-worker';
import { createOrchestrator } from './create-orchestrator';
import { createListener } from './create-listener';

export interface Plugin {
  onBeforeEnqueueTask?: OnBeforeEnqueueTask;
  onAfterEnqueueTask?: OnAfterEnqueueTask;
  onBeforeTaskProcessing?: OnBeforeTaskProcessing;
  onAfterTaskProcessing?: OnAfterTaskProcessing;
}

export const registerPlugins = (...plugins: Plugin[]) => {
  const createWrappedManager = (params: ManagerInput) => {
    return createManager({
      ...params,
      hooks: {
        onBeforeEnqueueTask: (hookParams) => {
          const hooks = filter(
            map(plugins, (plugin) => plugin.onBeforeEnqueueTask),
            (hook) => !!hook,
          ) as OnBeforeEnqueueTask[];
          forEach(hooks, (hook) => hook(hookParams));
        },
        onAfterEnqueueTask: (hookParams) => {
          const hooks = filter(
            map(plugins, (plugin) => plugin.onAfterEnqueueTask),
            (hook) => !!hook,
          ) as OnAfterEnqueueTask[];
          forEach(hooks, (hook) => hook(hookParams));
        },
        ...params.hooks,
      },
    });
  };
  const createWrappedWorker = (params: WorkerInput) => {
    return createWorker({
      ...params,
      hooks: {
        onBeforeTaskProcessing: (hookParams) => {
          const hooks = filter(
            map(plugins, (plugin) => plugin.onBeforeTaskProcessing),
            (hook) => !!hook,
          ) as OnBeforeTaskProcessing[];
          forEach(hooks, (hook) => hook(hookParams));
        },
        onAfterTaskProcessing: (hookParams) => {
          const hooks = filter(
            map(plugins, (plugin) => plugin.onAfterTaskProcessing),
            (hook) => !!hook,
          ) as OnAfterTaskProcessing[];
          forEach(hooks, (hook) => hook(hookParams));
        },
        ...params.hooks,
      },
    });
  };
  return {
    createManager: createWrappedManager,
    createWorker: createWrappedWorker,
    createOrchestrator,
    createListener,
  };
};
