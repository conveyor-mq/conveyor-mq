/* eslint-disable @typescript-eslint/no-non-null-assertion */
import moment from 'moment';
import { Task } from '../../domain/task';
import { hasTaskExpired } from '../../actions/has-task-expired';

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
