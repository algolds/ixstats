import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('~/env', () => ({ env: { DATABASE_URL: 'file:./test.db', NODE_ENV: 'test' } }));
jest.mock('~/server/db', () => ({ db: {} }));
jest.mock('~/lib/notification-api', () => ({ notificationAPI: { create: jest.fn(() => Promise.resolve('note_1')) } }));

import { createCallerFactory } from '../../trpc';
import { policiesRouter } from '../policies';
import { notificationAPI } from '~/lib/notification-api';

type MockFn = jest.Mock<any, any>;

const mockDb = {
  policy: {
    create: jest.fn() as MockFn,
    update: jest.fn() as MockFn,
    findMany: jest.fn() as MockFn,
    findUnique: jest.fn() as MockFn,
  },
  user: {
    findFirst: jest.fn() as MockFn,
  },
  activitySchedule: {
    create: jest.fn() as MockFn,
    findMany: jest.fn() as MockFn,
    update: jest.fn() as MockFn,
    delete: jest.fn() as MockFn,
  },
  policyEffectLog: {
    findMany: jest.fn() as MockFn,
    create: jest.fn() as MockFn,
  },
};

const baseContext = {
  db: mockDb,
  user: { clerkUserId: 'user_1', countryId: 'country_1' },
  auth: { userId: 'user_1' },
} as any;

describe('policiesRouter scheduling and notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('schedules activities tied to policies and stores references in relatedIds', async () => {
    const createdRecord = {
      id: 'activity_1',
      countryId: 'country_1',
      userId: 'user_1',
      relatedIds: JSON.stringify({ policyId: 'policy_1' }),
    };

    mockDb.activitySchedule.create.mockResolvedValue(createdRecord);

    const caller = createCallerFactory(policiesRouter)(baseContext);

    const result = await caller.scheduleActivity({
      countryId: 'country_1',
      policyId: 'policy_1',
      activityType: 'meeting',
      title: 'Implementation Briefing',
      scheduledDate: new Date('2024-05-01T00:00:00Z'),
    });

    expect(mockDb.activitySchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        countryId: 'country_1',
        userId: 'user_1',
        relatedIds: JSON.stringify({ policyId: 'policy_1' }),
      }),
    });
    expect(result).toEqual(createdRecord);
  });

  it('filters scheduled activities by policyId via relatedIds parsing', async () => {
    mockDb.activitySchedule.findMany.mockResolvedValue([
      {
        id: 'activity_1',
        countryId: 'country_1',
        relatedIds: JSON.stringify({ policyId: 'policy_1' }),
        scheduledDate: new Date('2024-05-01T00:00:00Z'),
      },
      {
        id: 'activity_2',
        countryId: 'country_1',
        relatedIds: JSON.stringify({ policyId: 'policy_2' }),
        scheduledDate: new Date('2024-05-02T00:00:00Z'),
      },
      {
        id: 'activity_3',
        countryId: 'country_1',
        relatedIds: null,
        scheduledDate: new Date('2024-05-03T00:00:00Z'),
      },
    ]);

    const caller = createCallerFactory(policiesRouter)(baseContext);

    const filtered = await caller.getScheduledActivities({
      countryId: 'country_1',
      policyId: 'policy_1',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('activity_1');
    expect(mockDb.activitySchedule.findMany).toHaveBeenCalledWith({
      where: { countryId: 'country_1' },
      orderBy: { scheduledDate: 'asc' },
    });
  });

  it('activates policies and triggers real-time notifications', async () => {
    const policyRecord = {
      id: 'policy_1',
      countryId: 'country_1',
      name: 'Infrastructure Renewal',
      category: 'economic',
      status: 'draft',
      priority: 'critical',
    };

    mockDb.policy.update.mockResolvedValue({ ...policyRecord, status: 'active' });
    mockDb.user.findFirst.mockResolvedValue({ clerkUserId: 'user_1' });

    const caller = createCallerFactory(policiesRouter)(baseContext);

    const updated = await caller.activatePolicy({ id: 'policy_1' });

    expect(updated.status).toBe('active');
    expect(notificationAPI.create).toHaveBeenCalledWith(expect.objectContaining({
      title: '📜 Policy Activated',
      countryId: 'country_1',
      metadata: expect.objectContaining({ policyId: 'policy_1' }),
    }));
  });
});
