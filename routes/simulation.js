import express from 'express';
import {
  generateSimulation,
  getStudentSimulations,
  getSimulationDetails,
  updateSimulationState,
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  completeSimulation,
  getChildrenSimulationProgress
} from '../controllers/simulationController.js';

const router = express.Router();

/**
 * Simulation Routes
 * Handles all simulation-related endpoints
 */

// 1. Generate New Simulation
router.post('/generate', generateSimulation);

// 2. Get Student's Simulations (with pagination and filtering)
router.get('/student/:studentId', getStudentSimulations);

// 3. Get Simulation Details
router.get('/:simulationId', getSimulationDetails);

// 4. Update Simulation State (real-time state saving)
router.put('/:simulationId/state', updateSimulationState);

// 5. Start Simulation
router.post('/:simulationId/start', startSimulation);

// 6. Pause Simulation
router.post('/:simulationId/pause', pauseSimulation);

// 7. Resume Simulation
router.post('/:simulationId/resume', resumeSimulation);

// 8. Complete Simulation
router.post('/:simulationId/complete', completeSimulation);

// 9. Get Child's Simulation Progress (Parent Dashboard)
router.get('/parent/:parentId/children', getChildrenSimulationProgress);

export default router;
