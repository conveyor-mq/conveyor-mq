import { createListener } from './create-listener';
import { createManager, ManagerInput } from './create-manager';
import { createOrchestrator } from './create-orchestrator';
import {
  createWorker,
  OnAfterTaskProcessing,
  OnBeforeTaskProcessing,
  WorkerInput,
} from './create-worker';
import { OnAfterEnqueueTask, OnBeforeEnqueueTask } from './enqueue-task';

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
          const hooks = plugins
            .map((plugin) => plugin.onBeforeEnqueueTask)
            .filter((hook) => !!hook) as OnBeforeEnqueueTask[];
          hooks.forEach((hook) => hook(hookParams));
        },
        onAfterEnqueueTask: (hookParams) => {
          const hooks = plugins
            .map((plugin) => plugin.onAfterEnqueueTask)
            .filter((hook) => !!hook) as OnAfterEnqueueTask[];
          hooks.forEach((hook) => hook(hookParams));
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
          const hooks = plugins
            .map((plugin) => plugin.onBeforeTaskProcessing)
            .filter((hook) => !!hook) as OnBeforeTaskProcessing[];
          hooks.forEach((hook) => hook(hookParams));
        },
        onAfterTaskProcessing: (hookParams) => {
          const hooks = plugins
            .map((plugin) => plugin.onAfterTaskProcessing)
            .filter((hook) => !!hook) as OnAfterTaskProcessing[];
          hooks.forEach((hook) => hook(hookParams));
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
