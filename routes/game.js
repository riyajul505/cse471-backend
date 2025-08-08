import express from 'express';
import {
  processGameAction,
  mixChemicals,
  getHint,
  getLeaderboard
} from '../controllers/gameController.js';

const router = express.Router();

/**
 * Game Routes
 * Handles AI-enhanced gaming mechanics for virtual lab simulations
 */

// AI Integration Endpoints
router.post('/:simulationId/ai/process-action', processGameAction);
router.post('/:simulationId/ai/mix-chemicals', mixChemicals);
router.post('/:simulationId/ai/get-hint', getHint);

// Game Analytics
router.get('/leaderboard/:level', getLeaderboard);

export default router;
