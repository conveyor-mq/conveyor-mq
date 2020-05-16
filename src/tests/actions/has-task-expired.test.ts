import moment from 'moment';
import { hasTaskExpired } from '../../actions/has-task-expired';
import { Task } from '../../domain/tasks/task';

describe('hasTaskExpired', () => {
  it('hasTaskExpired returns false for task with no expiresOn', () => {
    const thePast = moment('2020-01-01').toDate();
    const task: Task = { id: 'i', data: 'j' };
    expect(hasTaskExpired({ task, asOf: thePast })).toBe(false);
  });
  it('hasTaskExpired returns false for not expired task', () => {
    const thePast = moment('2020-01-01').toDate();
    const theFuture = moment('2020-01-02').toDate();
    const task: Task = { id: 'i', expiresAt: theFuture, data: 'j' };
    expect(hasTaskExpired({ task, asOf: thePast })).toBe(false);
  });
  it('hasTaskExpired returns true for expired task', () => {
    const thePast = moment('2020-01-01').toDate();
    const theFuture = moment('2020-01-02').toDate();
    const task: Task = { id: 'i', expiresAt: thePast, data: 'j' };
    expect(hasTaskExpired({ task, asOf: theFuture })).toBe(true);
  });
});
