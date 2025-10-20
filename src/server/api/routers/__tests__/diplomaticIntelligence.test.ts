import { describe, it, expect, beforeEach, jest } from '@jest/globals';

jest.mock('~/env', () => ({ env: { DATABASE_URL: 'file:./test.db', NODE_ENV: 'test' } }));
jest.mock('~/server/db', () => ({ 
  db: {
    systemLog: { create: jest.fn() }
  }
}));

import { createCallerFactory } from '../../trpc';
import { diplomaticIntelligenceRouter } from '../diplomatic-intelligence';

type MockFn = jest.MockedFunction<any>;

const mockDb = {
  country: { findUnique: jest.fn() as MockFn },
  diplomaticRelation: { findMany: jest.fn() as MockFn },
  policy: { findMany: jest.fn() as MockFn, count: jest.fn() as MockFn },
  embassy: { findMany: jest.fn() as MockFn, count: jest.fn() as MockFn },
  embassyMission: { findMany: jest.fn() as MockFn },
  diplomaticEvent: { findMany: jest.fn() as MockFn },
  notification: { findMany: jest.fn() as MockFn },
  diplomaticAction: { create: jest.fn() as MockFn, count: jest.fn() as MockFn },
  systemLog: { create: jest.fn() as MockFn },
};

const baseContext = {
  db: mockDb,
  user: { id: 'user_1', countryId: 'country_1' },
  auth: { userId: 'user_1' },
} as any;

describe('diplomaticIntelligenceRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock systemLog.create to prevent database errors in user logging
    mockDb.systemLog.create.mockResolvedValue({ id: 'log_1' });
  });

  it('builds a live intelligence briefing from relational data', async () => {
    mockDb.country.findUnique.mockResolvedValue({
      id: 'country_1',
      name: 'Testland',
      economicTier: 'Strong',
      currentGdpPerCapita: 42000,
    });

    mockDb.diplomaticRelation.findMany.mockResolvedValue([
      {
        id: 'rel_1',
        country1: 'country_1',
        country2: 'ally_1',
        relationship: 'alliance',
        strength: 80,
        recentActivity: 'Treaty signed',
        establishedAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-02-01T00:00:00Z'),
      },
    ]);

    mockDb.policy.findMany.mockResolvedValue([
      {
        id: 'policy_1',
        name: 'National Innovation Act',
        description: 'Investments into research hubs.',
        status: 'active',
        priority: 'high',
        updatedAt: new Date('2024-02-02T00:00:00Z'),
        createdAt: new Date('2024-01-15T00:00:00Z'),
      },
    ]);

    const mockEmbassy = {
      id: 'emb_1',
      hostCountryId: 'ally_1',
      guestCountryId: 'country_1',
      status: 'active',
    };

    mockDb.embassy.findMany.mockResolvedValue([mockEmbassy]);

    mockDb.embassyMission.findMany.mockResolvedValue([
      {
        id: 'mission_1',
        name: 'Technology Exchange',
        description: 'Facilitating research partnerships.',
        difficulty: 'hard',
        status: 'active',
        updatedAt: new Date('2024-02-03T00:00:00Z'),
        embassy: mockEmbassy,
      },
    ]);

    mockDb.diplomaticEvent.findMany.mockResolvedValue([
      {
        id: 'event_1',
        country1Id: 'country_1',
        country2Id: 'ally_1',
        eventType: 'treaty',
        title: 'Alliance Ratified',
        description: 'Mutual defense pact',
        severity: 'info',
        createdAt: new Date('2024-02-04T00:00:00Z'),
        metadata: JSON.stringify({ scope: 'regional' }),
      },
    ]);

    mockDb.notification.findMany.mockResolvedValue([
      {
        id: 'note_1',
        title: 'Embassy Upgraded',
        description: null,
        message: 'Embassy in Ally 1 upgraded to level 2.',
        createdAt: new Date('2024-02-05T00:00:00Z'),
        metadata: JSON.stringify({ embassyId: 'emb_1' }),
      },
    ]);

    const caller = diplomaticIntelligenceRouter.createCaller(baseContext);

    const result = await caller.getIntelligenceBriefing({
      countryId: 'country_1',
      clearanceLevel: 'RESTRICTED',
      briefingType: 'daily',
    });

    expect(result.metrics.embassyCount).toBe(1);
    expect(result.metrics.activePolicyCount).toBe(1);
    expect(result.keyDevelopments[1]?.description).toContain('1 relations');
    expect(result.recentActivities[0]?.id).toBe('note_1');
    expect(mockDb.diplomaticRelation.findMany).toHaveBeenCalled();
  });

  it('returns mixed activity intelligence and enforces clearance', async () => {
    mockDb.notification.findMany.mockResolvedValue([
      {
        id: 'note_1',
        title: 'Crisis Averted',
        category: 'diplomatic',
        priority: 'high',
        createdAt: new Date('2024-03-01T00:00:00Z'),
      },
    ]);

    mockDb.diplomaticEvent.findMany.mockResolvedValue([
      {
        id: 'event_1',
        country1Id: 'country_1',
        country2Id: 'ally_1',
        eventType: 'summit',
        description: 'Emergency summit',
        severity: 'critical',
        createdAt: new Date('2024-02-28T00:00:00Z'),
      },
    ]);

    mockDb.embassyMission.findMany.mockResolvedValue([
      {
        id: 'mission_1',
        name: 'Trade Outreach',
        difficulty: 'medium',
        status: 'active',
        updatedAt: new Date('2024-02-27T00:00:00Z'),
        embassy: {
          hostCountryId: 'ally_1',
          guestCountryId: 'country_1',
        },
      },
    ]);

    const caller = diplomaticIntelligenceRouter.createCaller(baseContext);

    await expect(
      caller.getActivityIntelligence({ countryId: 'country_1', clearanceLevel: 'PUBLIC' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const feed = await caller.getActivityIntelligence({
      countryId: 'country_1',
      clearanceLevel: 'RESTRICTED',
      limit: 5,
    });

    expect(feed).toHaveLength(3);
    expect(feed[0]?.id).toBe('note_1');
    expect(feed.some(item => item.activityType === 'intelligence')).toBe(true);
  });

  it('persists diplomatic actions for the authenticated country', async () => {
    const actionRecord = {
      id: 'action_1',
      fromCountryId: 'country_1',
      toCountryId: 'ally_1',
      actionType: 'propose',
      description: 'Propose cultural exchange',
      status: 'pending',
      createdAt: new Date('2024-03-02T00:00:00Z'),
    };

    mockDb.diplomaticAction.create.mockResolvedValue(actionRecord);

    const caller = diplomaticIntelligenceRouter.createCaller(baseContext);

    const created = await caller.createDiplomaticAction({
      targetCountryId: 'ally_1',
      actionType: 'propose',
      message: 'Propose cultural exchange',
    });

    expect(mockDb.diplomaticAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromCountryId: 'country_1',
        toCountryId: 'ally_1',
        actionType: 'propose',
      }),
    });
    expect(created.status).toBe('pending');
    expect(created.timestamp).toEqual(actionRecord.createdAt);
  });

  it('builds strategic assessments only for confidential clearance', async () => {
    mockDb.country.findUnique.mockResolvedValue({
      id: 'country_1',
      name: 'Testland',
      economicTier: 'Strong',
      currentGdpPerCapita: 42000,
    });

    mockDb.embassy.count.mockResolvedValue(4);
    mockDb.policy.count.mockResolvedValue(3);
    mockDb.diplomaticAction.count.mockResolvedValue(2);

    const caller = diplomaticIntelligenceRouter.createCaller(baseContext);

    await expect(
      caller.getStrategicAssessment({ countryId: 'country_1', clearanceLevel: 'RESTRICTED' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const assessment = await caller.getStrategicAssessment({
      countryId: 'country_1',
      clearanceLevel: 'CONFIDENTIAL',
    });

    expect(assessment.classification).toBe('CONFIDENTIAL');
    expect(assessment.threatAnalysis).toHaveLength(3);
    expect(assessment.recommendations.some(r => r.includes('Resolve pending'))).toBe(true);
  });
});
