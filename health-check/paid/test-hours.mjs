import { dueAfterWorkingMinutes, londonText } from './hours.ts';
import assert from 'node:assert/strict';
const due = (iso) => dueAfterWorkingMinutes(new Date(iso), 180).toISOString();
// Monday 24 Nov 2026 is GMT (UTC = London time)
assert.equal(due('2026-11-23T10:00:00Z'), '2026-11-23T13:00:00.000Z');       // Mon 10:00 -> Mon 13:00
assert.equal(due('2026-11-23T14:00:00Z'), '2026-11-23T17:00:00.000Z');       // Mon 14:00 -> Mon 17:00
assert.equal(due('2026-11-23T15:30:00Z'), '2026-11-24T10:30:00.000Z');       // Mon 15:30 -> Tue 10:30
assert.equal(due('2026-11-23T20:00:00Z'), '2026-11-24T12:00:00.000Z');       // Mon evening -> Tue 12:00
assert.equal(due('2026-11-27T16:00:00Z'), '2026-11-30T11:00:00.000Z');       // Fri 16:00 -> Mon 11:00
assert.equal(due('2026-11-28T11:00:00Z'), '2026-11-30T12:00:00.000Z');       // Sat -> Mon 12:00
assert.equal(due('2026-11-23T07:00:00Z'), '2026-11-23T12:00:00.000Z');       // Mon 07:00 -> Mon 12:00
// summer time: Wed 1 July 2026, London is UTC+1. 15:00 London = 14:00 UTC -> Thu 10:00 London = 09:00 UTC
assert.equal(due('2026-07-01T14:00:00Z'), '2026-07-02T09:00:00.000Z');
console.log(londonText(new Date('2026-11-24T10:30:00Z')), '|', londonText(new Date('2026-07-02T09:00:00Z')));
console.log('HOURS TESTS PASSED');
