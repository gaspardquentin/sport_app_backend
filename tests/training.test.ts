import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { db } from '../src/db';
import { user, session, programs, enrollments, dayPlans, wodBlocs, dayPlanWodBlocs, exercises, wodBlocExercises, exerciseType } from '../src/db/training';
import { schema } from '../src/db';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { auth } from '../src/config/auth';

// Mock the auth module
vi.mock('../src/config/auth', async () => {
  return {
    auth: {
      api: {
        getSession: vi.fn(),
      },
    },
  };
});

// Helper to create a user
async function createTestUser() {
  const userId = uuidv4();
  const email = `test-${userId}@example.com`;
  const now = new Date();
  
  await db.insert(schema.user).values({
    id: userId,
    name: 'Test User',
    email: email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    role: 'athlete'
  });

  return { userId, email };
}

describe('Training API', () => {
  let testUser: { userId: string, email: string };

  beforeAll(async () => {
    testUser = await createTestUser();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const res = await request(app).get('/api/v1/training/week');
    expect(res.status).toBe(401);
  });

  it('should return 404 if user has no enrollment', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: testUser.userId, email: testUser.email, emailVerified: true, name: 'Test User', createdAt: new Date(), updatedAt: new Date(), role: 'athlete' },
      session: { id: 'session-id', userId: testUser.userId, expiresAt: new Date(), token: 'token', createdAt: new Date(), updatedAt: new Date(), ipAddress: null, userAgent: null }
    });

    const res = await request(app).get('/api/v1/training/week');
      
    expect(res.status).toBe(404); // No enrollment found
    expect(res.body.message).toContain('No active enrollment');
  });

  it('should return the weekly plan for enrolled user', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: testUser.userId, email: testUser.email, emailVerified: true, name: 'Test User', createdAt: new Date(), updatedAt: new Date(), role: 'athlete' },
      session: { id: 'session-id', userId: testUser.userId, expiresAt: new Date(), token: 'token', createdAt: new Date(), updatedAt: new Date(), ipAddress: null, userAgent: null }
    });

    // 1. Create a Program
    const programId = uuidv4();
    await db.insert(schema.programs).values({
      id: programId,
      title: 'Test Program',
      description: 'A test program'
    });

    // 2. Create Exercises
    const exerciseId = uuidv4();
    await db.insert(schema.exercises).values({
      id: exerciseId,
      name: 'Burpees',
      sets: 3,
      reps: 10,
      type: 'cardio'
    });

    // 3. Create WodBloc
    const wodBlocId = uuidv4();
    await db.insert(schema.wodBlocs).values({
      id: wodBlocId,
      title: 'Warmup',
      type: 'cardio'
    });

    // 4. Link Exercise to WodBloc
    await db.insert(schema.wodBlocExercises).values({
      wodBlocId: wodBlocId,
      exerciseId: exerciseId
    });

    // 5. Create Day Plans for Week 1 (Days 1-7)
    // We'll create Day 1
    const dayPlanId = uuidv4();
    await db.insert(schema.dayPlans).values({
      id: dayPlanId,
      programId: programId,
      dayNumber: 1
    });

    // 6. Link WodBloc to DayPlan
    await db.insert(schema.dayPlanWodBlocs).values({
      dayPlanId: dayPlanId,
      wodBlocId: wodBlocId,
      order: 1
    });

    // 7. Enroll User
    await db.insert(schema.enrollments).values({
      userId: testUser.userId,
      programId: programId,
      currentDay: 1
    });

    const res = await request(app).get('/api/v1/training/week');

    expect(res.status).toBe(200);
    expect(res.body.weekNumber).toBe(1);
    expect(res.body.days).toHaveLength(1);
    // We expect to see day 1 with our wod bloc
    const day1 = res.body.days.find((d: any) => d.dayNumber === 1);
    expect(day1).toBeDefined();
    expect(day1.blocks).toHaveLength(1);
    expect(day1.blocks[0].title).toBe('Warmup');
    expect(day1.blocks[0].exercises).toHaveLength(1);
    expect(day1.blocks[0].exercises[0].name).toBe('Burpees');
  });
});
