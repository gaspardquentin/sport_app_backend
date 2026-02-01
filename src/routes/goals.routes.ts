import { Router } from 'express';
import { db } from '../db/index.js';
import { goals } from '../db/goals.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const allGoals = await db.select().from(goals);
    res.json(allGoals);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export const goalsRoutes = router;
