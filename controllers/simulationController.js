import Simulation from '../models/simulationModels.js';
import User from '../models/userModels.js';
import { createNotification } from './notificationController.js';
import aiService from '../services/aiService.js';

/**
 * Simulation Controller
 * Handles all simulation-related operations including AI generation,
 * state management, and parent/teacher integrations
 */

/**
 * 1. Generate New Simulation
 * POST /api/simulation/generate
 */
export const generateSimulation = async (req, res) => {
  try {
    const { studentId, prompt, subject, level } = req.body;

    // Validation
    if (!studentId || !prompt) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: studentId and prompt are required'
      });
    }

    if (prompt.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Prompt must be 500 characters or less'
      });
    }

    // Verify student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Use student's level if not provided
    const simulationLevel = level || student.selectedLevel || 3;
    const simulationSubject = subject || 'general';

    console.log(`🧪 Generating simulation for student ${student.profile.firstName} (Level ${simulationLevel})`);

    // Rate limiting check (5 simulations per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentSimulations = await Simulation.countDocuments({
      studentId,
      createdAt: { $gte: oneHourAgo }
    });

    if (recentSimulations >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Please wait before generating more simulations.',
        retryAfter: 3600 // seconds
      });
    }

    // Generate simulation using AI service
    const startTime = Date.now();
    const aiData = await aiService.generateSimulation({
      prompt,
      subject: simulationSubject,
      level: simulationLevel
    });
    const processingTime = Date.now() - startTime;

    // Validate simulation data completeness - CRITICAL FOR FRONTEND
    try {
      // Ensure virtualLab exists
      if (!aiData.virtualLab) {
        console.error('🚨 CRITICAL: No virtualLab data generated, creating default');
        aiData.virtualLab = {};
      }

      // Ensure equipment array has meaningful content
      if (!aiData.virtualLab.equipment || aiData.virtualLab.equipment.length === 0) {
        console.warn('⚠️ Missing equipment, adding defaults');
        aiData.virtualLab.equipment = [
          'Basic laboratory equipment',
          'Safety goggles',
          'Lab notebook',
          'Measuring tools',
          'Protective gloves'
        ];
      }

      // Ensure procedure array has detailed steps
      if (!aiData.virtualLab.procedure || aiData.virtualLab.procedure.length === 0) {
        console.warn('⚠️ Missing procedure, adding defaults');
        aiData.virtualLab.procedure = [
          'Step 1: Set up all equipment and review safety protocols',
          'Step 2: Follow the experimental procedure carefully',
          'Step 3: Record all observations and measurements',
          'Step 4: Clean up equipment and workspace',
          'Step 5: Analyze results and draw conclusions'
        ];
      }

      // Ensure safety notes are comprehensive
      if (!aiData.virtualLab.safetyNotes || aiData.virtualLab.safetyNotes.length === 0) {
        console.warn('⚠️ Missing safety notes, adding defaults');
        aiData.virtualLab.safetyNotes = [
          'Wear appropriate safety equipment at all times',
          'Follow all laboratory safety protocols',
          'Report any accidents or spills immediately',
          'Ensure proper ventilation in the workspace'
        ];
      }

      // Subject-specific validation for chemicals
      if (simulationSubject === 'chemistry') {
        if (!aiData.virtualLab.chemicals || aiData.virtualLab.chemicals.length === 0) {
          console.warn('⚠️ Chemistry experiment missing chemicals, adding defaults');
          aiData.virtualLab.chemicals = ['Distilled water', 'Standard solutions', 'Safety indicators'];
        }
      } else {
        // Ensure chemicals array exists (even if empty for non-chemistry)
        if (!aiData.virtualLab.chemicals) {
          aiData.virtualLab.chemicals = [];
        }
      }

      // Final validation - this should NEVER fail now
      if (!aiData.virtualLab.equipment || !aiData.virtualLab.procedure || !aiData.virtualLab.safetyNotes ||
          aiData.virtualLab.equipment.length === 0 || aiData.virtualLab.procedure.length === 0 || 
          aiData.virtualLab.safetyNotes.length === 0) {
        throw new Error('CRITICAL: virtualLab validation failed after fallbacks');
      }

      console.log('✅ virtualLab validation passed:', {
        equipment: aiData.virtualLab.equipment.length,
        chemicals: aiData.virtualLab.chemicals.length,
        procedure: aiData.virtualLab.procedure.length,
        safetyNotes: aiData.virtualLab.safetyNotes.length
      });

    } catch (validationError) {
      console.error('🚨 CRITICAL: Simulation data validation failed:', validationError.message);
      // This should never happen now, but if it does, use a complete fallback
      aiData.virtualLab = {
        equipment: ['Basic laboratory equipment', 'Safety goggles', 'Lab notebook'],
        chemicals: simulationSubject === 'chemistry' ? ['Water', 'Standard solutions'] : [],
        procedure: ['Set up equipment', 'Follow procedure', 'Record observations'],
        safetyNotes: ['Follow safety protocols', 'Wear protective equipment']
      };
    }

    // Create simulation in database with enhanced gaming structure
    const simulation = new Simulation({
      studentId,
      title: aiData.title,
      description: aiData.description,
      prompt,
      subject: simulationSubject,
      level: simulationLevel,
      experimentType: aiData.experimentType,
      virtualLab: aiData.virtualLab,
      gameConfig: aiData.gameConfig,
      objectives: aiData.objectives,
      expectedOutcome: aiData.expectedOutcome,
      estimatedDuration: aiData.estimatedDuration,
      difficulty: aiData.difficulty,
      state: {
        status: 'not_started',
        currentStep: 0,
        progress: 0,
        userInputs: {},
        observations: [],
        results: {},
        gameState: {
          currentAction: '',
          selectedEquipment: [],
          mixedSolutions: [],
          observations: [],
          score: 0,
          hints: [],
          achievements: [],
          workspaceContents: {
            beaker: [],
            burette: [],
            measuring: [],
            observation: []
          }
        }
      },
      aiGenerationData: {
        model: 'gemini',
        generatedAt: new Date(),
        processingTime,
        apiVersion: 'v1beta'
      }
    });

    await simulation.save();

    // Create notifications
    await createSimulationNotifications(student, simulation, 'generated');

    console.log(`✅ Simulation created successfully: ${simulation.title}`);

    res.status(201).json({
      success: true,
      data: {
        simulation: formatSimulationResponse(simulation)
      }
    });

  } catch (error) {
    console.error('❌ Generate simulation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate simulation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * 2. Get Student's Simulations
 * GET /api/simulation/student/:studentId
 */
export const getStudentSimulations = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { page = 1, limit = 10, status, subject } = req.query;

    // Verify student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get paginated simulations
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      subject
    };

    const result = await Simulation.getPaginatedSimulations(studentId, options);

    // Format response with enhanced gaming data
    const formattedSimulations = result.simulations.map(sim => ({
      id: sim._id,
      title: sim.title,
      description: sim.description,
      subject: sim.subject,
      level: sim.level,
      experimentType: sim.experimentType,
      virtualLab: sim.virtualLab, // ✅ CRITICAL FIX: Include virtualLab data
      gameConfig: sim.gameConfig, // ✅ Include game configuration
      objectives: sim.objectives,
      expectedOutcome: sim.expectedOutcome,
      state: {
        status: sim.state.status,
        progress: sim.state.progress,
        currentStep: sim.state.currentStep,
        startedAt: sim.state.startedAt,
        lastActiveAt: sim.state.lastActiveAt,
        gameState: sim.state.gameState // ✅ Include game state
      },
      estimatedDuration: sim.estimatedDuration,
      difficulty: sim.difficulty,
      createdAt: sim.createdAt,
      updatedAt: sim.updatedAt
    }));

    res.status(200).json({
      success: true,
      data: {
        simulations: formattedSimulations,
        pagination: result.pagination,
        stats: result.stats
      }
    });

  } catch (error) {
    console.error('❌ Get student simulations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve simulations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * 3. Get Simulation Details
 * GET /api/simulation/:simulationId
 */
export const getSimulationDetails = async (req, res) => {
  try {
    const { simulationId } = req.params;

    const simulation = await Simulation.findById(simulationId);
    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: 'Simulation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        simulation: formatSimulationResponse(simulation)
      }
    });

  } catch (error) {
    console.error('❌ Get simulation details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve simulation details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * 4. Update Simulation State
 * PUT /api/simulation/:simulationId/state
 */
export const updateSimulationState = async (req, res) => {
  try {
    const { simulationId } = req.params;
    const { state } = req.body;

    if (!state) {
      return res.status(400).json({
        success: false,
        message: 'State data is required'
      });
    }

    const simulation = await Simulation.findById(simulationId);
    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: 'Simulation not found'
      });
    }

    // Rate limiting for state updates (max 1 per second)
    const now = new Date();
    if (simulation.state.lastActiveAt && 
        (now - simulation.state.lastActiveAt) < 1000) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before updating state again'
      });
    }

    // Validate state transitions only if status is being changed
    const currentStatus = simulation.state.status;
    const newStatus = state.status;
    
    // If status is being changed, validate the transition
    if (newStatus && newStatus !== currentStatus && !isValidStateTransition(currentStatus, newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid state transition from ${currentStatus} to ${newStatus}`
      });
    }
    
    // Prepare state update data
    let stateUpdateData = { ...state };
    
    // If status is the same, remove it from update to avoid redundancy
    if (newStatus && newStatus === currentStatus) {
      const { status, ...stateWithoutStatus } = stateUpdateData;
      stateUpdateData = stateWithoutStatus;
    }

    // Update state
    simulation.state = { ...simulation.state.toObject(), ...stateUpdateData };
    simulation.state.lastActiveAt = now;

    await simulation.save();

    res.status(200).json({
      success: true,
      message: 'Simulation state updated successfully',
      data: {
        simulation: {
          id: simulation._id,
          state: simulation.state,
          updatedAt: simulation.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('❌ Update simulation state error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update simulation state',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * 5. Start Simulation
 * POST /api/simulation/:simulationId/start
 */
export const startSimulation = async (req, res) => {
  try {
    const { simulationId } = req.params;

    const simulation = await Simulation.findById(simulationId).populate('studentId');
    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: 'Simulation not found'
      });
    }

    if (simulation.state.status !== 'not_started') {
      return res.status(400).json({
        success: false,
        message: 'Simulation can only be started from not_started status'
      });
    }

    // Update state to in_progress
    simulation.state.status = 'in_progress';
    simulation.state.startedAt = new Date();
    simulation.state.lastActiveAt = new Date();

    await simulation.save();

    // Create notifications
    await createSimulationNotifications(simulation.studentId, simulation, 'started');

    res.status(200).json({
      success: true,
      message: 'Simulation started successfully',
      data: {
        simulation: {
          id: simulation._id,
          state: {
            status: simulation.state.status,
            startedAt: simulation.state.startedAt,
            lastActiveAt: simulation.state.lastActiveAt
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Start simulation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start simulation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * 6. Pause Simulation
 * POST /api/simulation/:simulationId/pause
 */
export const pauseSimulation = async (req, res) => {
  try {
    const { simulationId } = req.params;

    const simulation = await Simulation.findById(simulationId);
    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: 'Simulation not found'
      });
    }

    if (simulation.state.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Can only pause simulations that are in progress'
      });
    }

    simulation.state.status = 'paused';
    simulation.state.lastActiveAt = new Date();

    await simulation.save();

    res.status(200).json({
      success: true,
      message: 'Simulation paused successfully',
      data: {
        simulation: {
          id: simulation._id,
          state: {
            status: simulation.state.status,
            lastActiveAt: simulation.state.lastActiveAt
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Pause simulation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pause simulation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * 7. Resume Simulation
 * POST /api/simulation/:simulationId/resume
 */
export const resumeSimulation = async (req, res) => {
  try {
    const { simulationId } = req.params;

    const simulation = await Simulation.findById(simulationId);
    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: 'Simulation not found'
      });
    }

    if (simulation.state.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: 'Can only resume paused simulations'
      });
    }

    simulation.state.status = 'in_progress';
    simulation.state.lastActiveAt = new Date();

    await simulation.save();

    res.status(200).json({
      success: true,
      message: 'Simulation resumed successfully',
      data: {
        simulation: {
          id: simulation._id,
          state: {
            status: simulation.state.status,
            lastActiveAt: simulation.state.lastActiveAt
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Resume simulation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resume simulation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * 8. Complete Simulation
 * POST /api/simulation/:simulationId/complete
 */
export const completeSimulation = async (req, res) => {
  try {
    const { simulationId } = req.params;
    const { finalResults } = req.body;

    const simulation = await Simulation.findById(simulationId).populate('studentId');
    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: 'Simulation not found'
      });
    }

    if (!['in_progress', 'paused'].includes(simulation.state.status)) {
      return res.status(400).json({
        success: false,
        message: 'Can only complete simulations that are in progress or paused'
      });
    }

    // Update simulation state
    simulation.state.status = 'completed';
    simulation.state.progress = 100;
    simulation.state.completedAt = new Date();
    simulation.state.lastActiveAt = new Date();

    // Enhanced final results with game data
    if (finalResults) {
      simulation.state.results = { 
        ...simulation.state.results, 
        ...finalResults,
        gameScore: finalResults.gameScore || simulation.state.gameState?.score || 0,
        actionsCompleted: finalResults.actionsCompleted || 0,
        observationsMade: finalResults.observationsMade || simulation.state.gameState?.observations?.length || 0,
        hintsUsed: finalResults.hintsUsed || simulation.state.gameState?.hints?.length || 0
      };
    }

    await simulation.save();

    // Calculate game performance
    const gameScore = simulation.state.results.gameScore || 0;
    const maxScore = simulation.gameConfig?.maxScore || 100;
    const performance = calculatePerformance(gameScore, maxScore);

    // Generate game achievements
    const gameAchievements = generateGameAchievements(simulation.state.results, performance);

    // Update student game statistics
    await updateStudentGameStats(simulation.studentId._id, {
      subject: simulation.subject,
      finalScore: gameScore,
      completed: true,
      achievements: gameAchievements
    });

    // Create notifications
    await createSimulationNotifications(simulation.studentId, simulation, 'completed', gameAchievements);

    res.status(200).json({
      success: true,
      message: 'Simulation completed successfully',
      data: {
        simulation: {
          id: simulation._id,
          state: {
            status: simulation.state.status,
            progress: simulation.state.progress,
            completedAt: simulation.state.completedAt
          }
        },
        gameResults: {
          finalScore: gameScore,
          maxPossibleScore: maxScore,
          performance: performance,
          achievements: gameAchievements
        },
        notificationsCreated: gameAchievements.length + 2 // Parents + Teachers + Achievements
      }
    });

  } catch (error) {
    console.error('❌ Complete simulation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete simulation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * 9. Get Child's Simulation Progress (Parent Dashboard)
 * GET /api/simulation/parent/:parentId/children
 */
export const getChildrenSimulationProgress = async (req, res) => {
  try {
    const { parentId } = req.params;

    // Verify parent exists
    const parent = await User.findById(parentId).populate('profile.children');
    if (!parent || parent.role !== 'parent') {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    const children = parent.profile.children;
    const childrenProgress = [];

    for (const child of children) {
      // Get simulation statistics for each child
      const simulations = await Simulation.find({ studentId: child._id }).lean();
      
      const stats = {
        totalSimulations: simulations.length,
        completedSimulations: simulations.filter(s => s.state.status === 'completed').length,
        inProgressSimulations: simulations.filter(s => s.state.status === 'in_progress').length,
        pausedSimulations: simulations.filter(s => s.state.status === 'paused').length,
        averageAccuracy: 0,
        totalTimeSpent: 0,
        lastActivity: null,
        recentSimulations: []
      };

      // Calculate average accuracy and total time
      const completedSims = simulations.filter(s => s.state.status === 'completed');
      if (completedSims.length > 0) {
        const totalAccuracy = completedSims.reduce((sum, sim) => {
          return sum + (sim.state.results?.accuracy || 0);
        }, 0);
        stats.averageAccuracy = Math.round(totalAccuracy / completedSims.length);

        const totalTime = completedSims.reduce((sum, sim) => {
          if (sim.state.startedAt && sim.state.completedAt) {
            return sum + (sim.state.completedAt - sim.state.startedAt) / (1000 * 60); // minutes
          }
          return sum;
        }, 0);
        stats.totalTimeSpent = Math.round(totalTime);
      }

      // Get last activity
      const sortedSims = simulations.sort((a, b) => 
        new Date(b.state.lastActiveAt || b.createdAt) - new Date(a.state.lastActiveAt || a.createdAt)
      );
      if (sortedSims.length > 0) {
        stats.lastActivity = sortedSims[0].state.lastActiveAt || sortedSims[0].createdAt;
      }

      // Get recent simulations (last 3)
      stats.recentSimulations = sortedSims.slice(0, 3).map(sim => ({
        id: sim._id,
        title: sim.title,
        status: sim.state.status,
        accuracy: sim.state.results?.accuracy || null,
        completedAt: sim.state.completedAt
      }));

      childrenProgress.push({
        childId: child._id,
        childName: `${child.profile.firstName} ${child.profile.lastName}`,
        level: child.selectedLevel,
        simulationStats: stats
      });
    }

    res.status(200).json({
      success: true,
      data: {
        children: childrenProgress
      }
    });

  } catch (error) {
    console.error('❌ Get children simulation progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve children simulation progress',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Helper Functions

/**
 * Format simulation response for API
 * @private
 */
function formatSimulationResponse(simulation) {
  return {
    id: simulation._id,
    title: simulation.title,
    description: simulation.description,
    subject: simulation.subject,
    level: simulation.level,
    prompt: simulation.prompt,
    experimentType: simulation.experimentType,
    virtualLab: simulation.virtualLab,
    gameConfig: simulation.gameConfig, // ✅ Include game configuration
    objectives: simulation.objectives,
    expectedOutcome: simulation.expectedOutcome,
    estimatedDuration: simulation.estimatedDuration,
    difficulty: simulation.difficulty,
    state: simulation.state, // ✅ Includes full state with gameState
    createdAt: simulation.createdAt,
    updatedAt: simulation.updatedAt
  };
}

/**
 * Validate state transitions
 * @private
 */
function isValidStateTransition(currentStatus, newStatus) {
  const validTransitions = {
    'not_started': ['in_progress'],
    'in_progress': ['paused', 'completed'],
    'paused': ['in_progress', 'completed'],
    'completed': [] // Cannot transition from completed
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

/**
 * Create simulation-related notifications
 * @private
 */
async function createSimulationNotifications(student, simulation, action, achievement = null) {
  try {
    const studentName = `${student.profile.firstName} ${student.profile.lastName}`;
    
    // Notification for student
    if (action === 'generated') {
      await createNotification({
        userId: student._id,
        type: 'simulation_generated',
        message: `🧪 Your new simulation "${simulation.title}" is ready to start!`,
        link: `/simulations/${simulation._id}`
      });
    } else if (action === 'started') {
      await createNotification({
        userId: student._id,
        type: 'simulation_started',
        message: `🚀 You started the "${simulation.title}" simulation. Good luck!`,
        link: `/simulations/${simulation._id}`
      });
    } else if (action === 'completed') {
      const accuracy = simulation.state.results?.accuracy || 0;
      await createNotification({
        userId: student._id,
        type: 'simulation_completed',
        message: `🎉 Congratulations! You completed "${simulation.title}" with ${accuracy}% accuracy!`,
        link: `/simulations/${simulation._id}`
      });
    }

    // Notifications for parents
    const parents = await User.find({
      role: 'parent',
      'profile.children': student._id
    });

    for (const parent of parents) {
      let message = '';
      let type = '';

      if (action === 'started') {
        type = 'simulation_started';
        message = `${studentName} started a new virtual lab simulation: "${simulation.title}"`;
      } else if (action === 'completed') {
        type = 'simulation_completed';
        const accuracy = simulation.state.results?.accuracy || 0;
        message = `🎉 ${studentName} completed the "${simulation.title}" simulation with ${accuracy}% accuracy!`;
      }

      if (message) {
        await createNotification({
          userId: parent._id,
          type,
          message,
          link: '/simulation-progress'
        });
      }

      // Achievement notification for parents
      if (achievement) {
        await createNotification({
          userId: parent._id,
          type: 'simulation_achievement',
          message: `🏆 ${studentName} unlocked the "${achievement.title}" achievement for completing their simulation!`,
          link: '/simulation-progress'
        });
      }
    }

    console.log(`📢 Created notifications for simulation ${action}: ${simulation.title}`);

  } catch (error) {
    console.error('❌ Error creating simulation notifications:', error);
  }
}

/**
 * Calculate performance rating based on score
 * @private
 */
function calculatePerformance(score, maxScore) {
  const percentage = (score / maxScore) * 100;
  if (percentage >= 90) return 'excellent';
  if (percentage >= 75) return 'good';
  if (percentage >= 60) return 'fair';
  return 'needs_improvement';
}

/**
 * Generate game achievements based on results
 * @private
 */
function generateGameAchievements(results, performance) {
  const achievements = [];

  // Performance-based achievements
  if (performance === 'excellent') {
    achievements.push({
      id: 'perfect_scientist',
      title: 'Perfect Scientist',
      description: 'Achieved excellent performance in the virtual lab!',
      icon: '🏆'
    });
  } else if (performance === 'good') {
    achievements.push({
      id: 'skilled_researcher',
      title: 'Skilled Researcher',
      description: 'Showed great scientific skills and understanding!',
      icon: '⭐'
    });
  }

  // Observation-based achievements
  if (results.observationsMade >= 5) {
    achievements.push({
      id: 'keen_observer',
      title: 'Keen Observer',
      description: 'Made detailed observations throughout the experiment!',
      icon: '👀'
    });
  }

  // Action-based achievements
  if (results.actionsCompleted >= 10) {
    achievements.push({
      id: 'active_experimenter',
      title: 'Active Experimenter',
      description: 'Performed many experimental actions!',
      icon: '🔬'
    });
  }

  // First-time achievements
  if (results.gameScore > 0) {
    achievements.push({
      id: 'lab_apprentice',
      title: 'Lab Apprentice',
      description: 'Completed your first virtual lab simulation!',
      icon: '🎓'
    });
  }

  return achievements;
}

/**
 * Update student game statistics
 * @private
 */
async function updateStudentGameStats(studentId, gameData) {
  try {
    const { StudentGameStats } = await import('../models/gameModels.js');
    
    let stats = await StudentGameStats.findOne({ studentId });
    if (!stats) {
      stats = new StudentGameStats({ studentId });
    }

    await stats.updateStats(gameData);
    console.log(`📊 Updated game stats for student: ${studentId}`);
    
  } catch (error) {
    console.error('❌ Error updating student game stats:', error);
  }
}
