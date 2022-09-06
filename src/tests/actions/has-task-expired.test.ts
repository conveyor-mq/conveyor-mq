import { hasTaskExpired } from '../../actions/has-task-expired';
import { Task } from '../../domain/tasks/task';
import { strToDate } from '../../utils/date';

describe('hasTaskExpired', () => {
  it('hasTaskExpired returns false for task with no expiresOn', () => {
    const thePast = strToDate('2020-01-01');
    const task: Task = { id: 'i', data: 'j' };
    expect(hasTaskExpired({ task, asOf: thePast })).toBe(false);
  });
  it('hasTaskExpired returns false for not expired task', () => {
    const thePast = strToDate('2020-01-01');
    const theFuture = strToDate('2020-01-02');
    const task: Task = { id: 'i', expiresAt: theFuture, data: 'j' };
    expect(hasTaskExpired({ task, asOf: thePast })).toBe(false);
  });
  it('hasTaskExpired returns true for expired task', () => {
    const thePast = strToDate('2020-01-01');
    const theFuture = strToDate('2020-01-02');
    const task: Task = { id: 'i', expiresAt: thePast, data: 'j' };
    expect(hasTaskExpired({ task, asOf: theFuture })).toBe(true);
  });
});
