import moment from 'moment';
import { hasTaskExpired } from '../../actions/has-task-expired';
import { Task } from '../../domain/tasks/task';

describe('hasTaskExpired', () => {
  it('hasTaskExpired returns false for task with no expiresOn', () => {
    const thePast = moment('2020-01-01');
    const task: Task = { id: 'i', data: 'j' };
    expect(hasTaskExpired({ task, asOf: thePast })).toBe(false);
  });
  it('hasTaskExpired returns false for not expired task', () => {
    const thePast = moment('2020-01-01');
    const theFuture = moment('2020-01-02');
    const task: Task = { id: 'i', expiresOn: theFuture, data: 'j' };
    expect(hasTaskExpired({ task, asOf: thePast })).toBe(false);
  });
  it('hasTaskExpired returns true for expired task', () => {
    const thePast = moment('2020-01-01');
    const theFuture = moment('2020-01-02');
    const task: Task = { id: 'i', expiresOn: thePast, data: 'j' };
    expect(hasTaskExpired({ task, asOf: theFuture })).toBe(true);
  });
});
