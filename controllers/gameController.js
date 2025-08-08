import Simulation from '../models/simulationModels.js';
import { GameAction, StudentGameStats } from '../models/gameModels.js';
import User from '../models/userModels.js';
import { createNotification } from './notificationController.js';
import aiService from '../services/aiService.js';

/**
 * Game Controller
 * Handles AI-enhanced gaming mechanics for virtual lab simulations
 */

/**
 * Process game actions through AI analysis
 * POST /api/simulation/:simulationId/ai/process-action
 */
export const processGameAction = async (req, res) => {
  try {
    const { simulationId } = req.params;
    const { action, equipment, target, currentGameState, context } = req.body;

    // Validation
    if (!action || !target) {
      return res.status(400).json({
        success: false,
        message: 'Action and target are required'
      });
    }

    // Get simulation
    const simulation = await Simulation.findById(simulationId).populate('studentId');
    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: 'Simulation not found'
      });
    }

    console.log(`🎮 Processing game action: ${action} with ${equipment?.name || 'unknown'} on ${target}`);

    // Generate AI response for the action
    const aiResult = await aiService.processGameAction({
      action,
      equipment,
      target,
      gameState: currentGameState,
      context,
      simulation: {
        subject: simulation.subject,
        level: simulation.level,
        virtualLab: simulation.virtualLab,
        gameConfig: simulation.gameConfig
      }
    });

    // Calculate score gain based on action correctness
    const scoreGain = calculateScoreGain(action, aiResult, simulation.gameConfig);

    // Log the game action
    const gameAction = new GameAction({
      simulationId: simulation._id,
      studentId: simulation.studentId._id,
      action,
      equipment: equipment || {},
      target,
      result: aiResult,
      scoreGained: scoreGain,
      aiProcessed: true
    });
    await gameAction.save();

    // Update simulation game state
    if (!simulation.state.gameState) {
      simulation.state.gameState = {
        score: 0,
        selectedEquipment: [],
        mixedSolutions: [],
        observations: [],
        hints: [],
        achievements: [],
        workspaceContents: { beaker: [], burette: [], measuring: [], observation: [] }
      };
    }

    simulation.state.gameState.score += scoreGain;
    simulation.state.lastActiveAt = new Date();

    // Add observation if applicable
    if (aiResult.observation) {
      simulation.state.gameState.observations.push({
        timestamp: new Date(),
        action: action,
        result: aiResult.actionDescription,
        scientificExplanation: aiResult.explanation,
        visualEffect: aiResult.visualEffect
      });
    }

    // Add achievements if unlocked
    if (aiResult.achievements && aiResult.achievements.length > 0) {
      simulation.state.gameState.achievements.push(
        ...aiResult.achievements.map(achievement => ({
          id: achievement.id,
          title: achievement.title,
          unlockedAt: new Date()
        }))
      );
    }

    await simulation.save();

    res.status(200).json({
      success: true,
      data: {
        result: {
          actionDescription: aiResult.actionDescription,
          scientificResult: aiResult.scientificResult,
          explanation: aiResult.explanation,
          scoreGain: scoreGain,
          visualEffect: aiResult.visualEffect,
          hints: aiResult.hints || [],
          nextSuggestion: aiResult.nextSuggestion,
          experimentComplete: aiResult.experimentComplete || false,
          achievements: aiResult.achievements || []
        }
      }
    });

  } catch (error) {
    console.error('❌ Process game action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process game action',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Process chemical mixing through AI
 * POST /api/simulation/:simulationId/ai/mix-chemicals
 */
export const mixChemicals = async (req, res) => {
  try {
    const { simulationId } = req.params;
    const { chemical1, chemical2, currentGameState } = req.body;

    // Validation
    if (!chemical1 || !chemical2) {
      return res.status(400).json({
        success: false,
        message: 'Both chemicals are required for mixing'
      });
    }

    // Get simulation
    const simulation = await Simulation.findById(simulationId);
    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: 'Simulation not found'
      });
    }

    console.log(`🧪 Mixing chemicals: ${chemical1.name} + ${chemical2.name}`);

    // Generate AI response for chemical reaction
    const reaction = await aiService.processChemicalMixing({
      chemical1,
      chemical2,
      gameState: currentGameState,
      simulation: {
        subject: simulation.subject,
        level: simulation.level,
        virtualLab: simulation.virtualLab
      }
    });

    // Calculate score based on reaction safety and correctness
    const scoreGain = calculateMixingScore(chemical1, chemical2, reaction, simulation.gameConfig);

    // Log the mixing action
    const gameAction = new GameAction({
      simulationId: simulation._id,
      studentId: simulation.studentId,
      action: 'mix_chemicals',
      equipment: { 
        chemical1: chemical1.name, 
        chemical2: chemical2.name 
      },
      target: 'mixing',
      result: reaction,
      scoreGained: scoreGain,
      aiProcessed: true
    });
    await gameAction.save();

    // Update simulation game state
    if (!simulation.state.gameState.mixedSolutions) {
      simulation.state.gameState.mixedSolutions = [];
    }

    simulation.state.gameState.mixedSolutions.push({
      id: Date.now(),
      components: [chemical1.name, chemical2.name],
      result: reaction.resultSolution,
      visualEffect: reaction.visualEffect,
      timestamp: new Date()
    });

    simulation.state.gameState.score += scoreGain;
    simulation.state.lastActiveAt = new Date();

    await simulation.save();

    res.status(200).json({
      success: true,
      data: {
        reaction: {
          result: reaction.result,
          explanation: reaction.explanation,
          visualEffect: reaction.visualEffect,
          resultSolution: reaction.resultSolution,
          scoreGain: scoreGain,
          safety: reaction.safety,
          nextSteps: reaction.nextSteps || []
        }
      }
    });

  } catch (error) {
    console.error('❌ Mix chemicals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process chemical mixing',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get AI-generated contextual hints
 * POST /api/simulation/:simulationId/ai/get-hint
 */
export const getHint = async (req, res) => {
  try {
    const { simulationId } = req.params;
    const { currentGameState, strugglingArea } = req.body;

    // Get simulation
    const simulation = await Simulation.findById(simulationId);
    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: 'Simulation not found'
      });
    }

    console.log(`💡 Generating hint for simulation: ${simulation.title}`);

    // Generate contextual hint using AI
    const hint = await aiService.generateHint({
      gameState: currentGameState,
      strugglingArea,
      simulation: {
        subject: simulation.subject,
        level: simulation.level,
        objectives: simulation.objectives,
        virtualLab: simulation.virtualLab,
        gameConfig: simulation.gameConfig
      }
    });

    // Add hint to game state
    if (!simulation.state.gameState.hints) {
      simulation.state.gameState.hints = [];
    }

    simulation.state.gameState.hints.push({
      id: Date.now(),
      text: hint.text,
      type: hint.type,
      timestamp: new Date()
    });

    simulation.state.lastActiveAt = new Date();
    await simulation.save();

    res.status(200).json({
      success: true,
      data: {
        hint: {
          text: hint.text,
          type: hint.type,
          specificity: hint.specificity
        }
      }
    });

  } catch (error) {
    console.error('❌ Get hint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate hint',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get game leaderboard for competitive elements
 * GET /api/simulation/leaderboard/:level
 */
export const getLeaderboard = async (req, res) => {
  try {
    const { level } = req.params;
    const { limit = 10 } = req.query;

    if (!level || level < 1 || level > 5) {
      return res.status(400).json({
        success: false,
        message: 'Valid level (1-5) is required'
      });
    }

    console.log(`🏆 Getting leaderboard for level ${level}`);

    // Get leaderboard data
    const leaderboard = await StudentGameStats.getLeaderboard(parseInt(level), parseInt(limit));

    // Get current user rank if studentId is provided
    let currentUser = null;
    const { studentId } = req.query;
    if (studentId) {
      const userStats = await StudentGameStats.findOne({ studentId }).populate('studentId');
      if (userStats) {
        // Find user's rank in the broader leaderboard
        const allStats = await StudentGameStats.getLeaderboard(parseInt(level), 1000);
        const userRank = allStats.findIndex(entry => entry.studentId.toString() === studentId) + 1;
        
        currentUser = {
          rank: userRank || 'N/A',
          score: userStats.totalScore,
          experimentsCompleted: userStats.experimentsCompleted
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        leaderboard: leaderboard.map(entry => ({
          studentId: entry.studentId,
          studentName: entry.studentName,
          score: entry.score,
          experimentsCompleted: entry.experimentsCompleted,
          rank: entry.rank
        })),
        currentUser
      }
    });

  } catch (error) {
    console.error('❌ Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leaderboard',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Helper Functions

/**
 * Calculate score gain for a game action
 * @private
 */
function calculateScoreGain(action, aiResult, gameConfig) {
  const criteria = gameConfig?.scoringCriteria || {
    correctAction: 10,
    observation: 5,
    completion: 50
  };

  let score = 0;

  // Base score for any action
  score += criteria.correctAction;

  // Bonus for correct/educational actions
  if (aiResult.isCorrect) {
    score += criteria.correctAction;
  }

  // Bonus for making observations
  if (aiResult.observation) {
    score += criteria.observation;
  }

  // Safety penalty
  if (aiResult.safety === 'dangerous') {
    score = Math.max(0, score - 15);
  } else if (aiResult.safety === 'caution') {
    score = Math.max(0, score - 5);
  }

  return Math.min(score, 25); // Cap individual action score
}

/**
 * Calculate score for chemical mixing
 * @private
 */
function calculateMixingScore(chemical1, chemical2, reaction, gameConfig) {
  const criteria = gameConfig?.scoringCriteria || {
    correctAction: 10,
    observation: 5,
    completion: 50
  };

  let score = criteria.correctAction;

  // Bonus for safe reactions
  if (reaction.safety === 'safe') {
    score += 10;
  } else if (reaction.safety === 'caution') {
    score += 5;
  }

  // Bonus for educationally valuable reactions
  if (reaction.educational) {
    score += criteria.observation;
  }

  return Math.min(score, 30); // Cap mixing score
}

export default {
  processGameAction,
  mixChemicals,
  getHint,
  getLeaderboard
};
