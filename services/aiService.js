import dotenv from 'dotenv';
dotenv.config();

/**
 * AI Service for simulation generation using Google Gemini API
 * Handles the creation of virtual science lab simulations based on student prompts
 */

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    // Align with frontend working endpoint
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';
  }

  /**
   * Generate a virtual science lab simulation based on student prompt
   * @param {Object} params - Generation parameters
   * @param {string} params.prompt - Student's simulation request
   * @param {string} params.subject - Subject area (chemistry, physics, biology)
   * @param {number} params.level - Student level (1-5)
   * @returns {Promise<Object>} Generated simulation data
   */
  async generateSimulation({ prompt, subject = 'general', level = 3 }) {
    try {
      console.log(`🤖 Generating simulation for prompt: "${prompt}"`);
      
      const aiPrompt = this.createAIPrompt(prompt, subject, level);
      
      // If API key is not available, return mock data for development
      if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
        console.log('⚠️ Using mock AI response (API key not configured)');
        return this.generateMockSimulation(prompt, subject, level);
      }

      // Call Gemini API
      const response = await this.callGeminiAPI(aiPrompt);
      
      // Parse and structure the response
      const simulationData = this.parseAIResponse(response, prompt, subject, level);
      
      console.log(`✅ Simulation generated successfully: "${simulationData.title}"`);
      return simulationData;
      
    } catch (error) {
      console.error('❌ AI Service Error:', error.message);
      
      // Fallback to mock data on error
      console.log('🔄 Falling back to mock simulation data');
      return this.generateMockSimulation(prompt, subject, level);
    }
  }

  /**
   * Create AI prompt for simulation generation
   * @private
   */
  createAIPrompt(prompt, subject, level) {
    const levelDescriptions = {
      1: 'elementary (ages 6-8): very simple, basic concepts, minimal equipment',
      2: 'early primary (ages 8-10): simple concepts, basic equipment',
      3: 'late primary (ages 10-12): intermediate concepts, standard equipment',
      4: 'early secondary (ages 12-14): advanced concepts, multiple equipment',
      5: 'advanced secondary (ages 14-16): complex concepts, sophisticated equipment'
    };

    return `Create a virtual science lab simulation for a Level ${level} student (${levelDescriptions[level]}) based on this prompt: "${prompt}"

The simulation should be in the ${subject} subject area.

Generate a detailed JSON response with the following structure:
{
  "title": "Clear, engaging title for the experiment",
  "description": "Detailed description of what the student will learn and do",
  "experimentType": "Type of experiment (e.g., titration, microscopy, circuit_building)",
  "virtualLab": {
    "equipment": ["list", "of", "required", "equipment"],
    "chemicals": ["list", "of", "chemicals", "if", "applicable"],
    "procedure": ["Step 1: Detailed instruction", "Step 2: Next step", "etc"],
    "safetyNotes": ["Important safety consideration 1", "Safety note 2", "etc"]
  },
  "objectives": ["Learning objective 1", "Learning objective 2", "etc"],
  "expectedOutcome": "What the student should observe or achieve",
  "estimatedDuration": 30,
  "difficulty": "beginner/intermediate/advanced"
}

Make it:
- Age-appropriate for the level
- Educational and engaging
- Safe (virtual environment)
- Interactive with clear steps
- Aligned with ${subject} curriculum standards

Response must be valid JSON only, no additional text.`;
  }

  /**
   * Call Gemini API
   * @private
   */
  async callGeminiAPI(prompt) {
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };

    const response = await fetch(`${this.baseURL}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response from Gemini API');
    }

    return data.candidates[0].content.parts[0].text;
  }

  /**
   * Parse AI response and structure simulation data
   * @private
   */
  parseAIResponse(aiResponse, originalPrompt, subject, level) {
    try {
      // Clean the response (remove markdown formatting if present)
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```$/, '');
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```$/, '');
      }

      const aiData = JSON.parse(cleanResponse);
      
      // Validate and enhance the response with game structures
      return {
        title: aiData.title || `${subject} Experiment`,
        description: aiData.description || 'An engaging virtual laboratory experiment.',
        prompt: originalPrompt,
        subject: subject,
        level: level,
        experimentType: aiData.experimentType || 'general_experiment',
        virtualLab: {
          equipment: this.enhanceEquipmentForGaming(aiData.virtualLab?.equipment, subject),
          chemicals: this.enhanceChemicalsForGaming(aiData.virtualLab?.chemicals, subject),
          procedure: (aiData.virtualLab?.procedure && aiData.virtualLab.procedure.length > 0) 
            ? aiData.virtualLab.procedure 
            : ['Step 1: Set up equipment', 'Step 2: Follow experimental procedure', 'Step 3: Record observations'],
          safetyNotes: (aiData.virtualLab?.safetyNotes && aiData.virtualLab.safetyNotes.length > 0)
            ? aiData.virtualLab.safetyNotes
            : ['Wear appropriate safety equipment', 'Follow all laboratory protocols', 'Report any issues immediately']
        },
        gameConfig: this.generateGameConfig(subject, level),
        objectives: aiData.objectives || ['Learn basic scientific principles'],
        expectedOutcome: aiData.expectedOutcome || 'Observe scientific phenomena',
        estimatedDuration: aiData.estimatedDuration || 30,
        difficulty: aiData.difficulty || this.getDifficultyByLevel(level)
      };
      
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError.message);
      throw new Error('Failed to parse AI response');
    }
  }

  /**
   * Generate mock simulation data for development/fallback
   * @private
   */
  generateMockSimulation(prompt, subject, level) {
    const mockData = {
      chemistry: {
        title: "Acid-Base Titration Experiment",
        description: "Learn about acid-base reactions by performing a virtual titration to determine the concentration of an unknown acid solution.",
        experimentType: "titration",
        virtualLab: {
          equipment: [
            { id: "eq_1", name: "burette", description: "Precise measuring device", icon: "🔬", category: "instruments" },
            { id: "eq_2", name: "conical flask", description: "Glass container for reactions", icon: "🥤", category: "glassware" },
            { id: "eq_3", name: "pipette", description: "Precision liquid transfer", icon: "💉", category: "tools" }
          ],
          chemicals: [
            { id: "chem_1", name: "HCl solution", concentration: "Unknown", hazard: "dangerous", color: "colorless", icon: "🧪" },
            { id: "chem_2", name: "NaOH solution", concentration: "0.1M", hazard: "caution", color: "colorless", icon: "🧪" },
            { id: "chem_3", name: "phenolphthalein indicator", concentration: "1%", hazard: "safe", color: "colorless", icon: "🧪" }
          ],
          procedure: [
            "Set up the burette and fill it with 0.1M NaOH solution",
            "Pipette 25.0ml of HCl solution into a conical flask",
            "Add 2-3 drops of phenolphthalein indicator to the flask",
            "Place the flask under the burette on a white tile",
            "Slowly add NaOH solution while swirling the flask",
            "Stop when the solution turns light pink",
            "Record the volume of NaOH used",
            "Calculate the concentration of HCl"
          ],
          safetyNotes: [
            "Wear safety goggles and lab coat",
            "Handle chemicals carefully",
            "Report any spills immediately",
            "Wash hands after the experiment"
          ]
        },
        objectives: [
          "Understand acid-base neutralization reactions",
          "Learn to use laboratory equipment accurately",
          "Calculate molarity from titration data",
          "Observe color changes with indicators"
        ],
        expectedOutcome: "The colorless solution will turn light pink at the endpoint, indicating neutralization is complete.",
        estimatedDuration: 45,
        difficulty: "intermediate"
      },
      physics: {
        title: "Simple Circuit Construction",
        description: "Build and analyze simple electrical circuits to understand current, voltage, and resistance relationships.",
        experimentType: "circuit_building",
        virtualLab: {
          equipment: [
            { id: "eq_1", name: "breadboard", description: "Circuit construction platform", icon: "🔌", category: "tools" },
            { id: "eq_2", name: "LED", description: "Light emitting diode", icon: "💡", category: "tools" },
            { id: "eq_3", name: "multimeter", description: "Electrical measurement device", icon: "⚡", category: "instruments" }
          ],
          chemicals: [],
          procedure: [
            "Connect the battery pack to the breadboard",
            "Insert the LED into the breadboard",
            "Add a resistor in series with the LED",
            "Connect the circuit with jumper wires",
            "Test the circuit - LED should light up",
            "Use multimeter to measure voltage across components",
            "Try different resistor values and observe changes"
          ],
          safetyNotes: [
            "Use appropriate voltage levels",
            "Check connections before powering on",
            "Handle components carefully"
          ]
        },
        objectives: [
          "Understand basic electrical circuits",
          "Learn Ohm's law relationships",
          "Practice using measuring instruments",
          "Observe effects of resistance on current"
        ],
        expectedOutcome: "LED will illuminate and brightness will vary with different resistor values.",
        estimatedDuration: 30,
        difficulty: "beginner"
      },
      biology: {
        title: "Microscopic Cell Observation",
        description: "Explore the microscopic world by observing different types of cells and identifying their structures.",
        experimentType: "microscopy",
        virtualLab: {
          equipment: [
            { id: "eq_1", name: "light microscope", description: "Device for magnifying specimens", icon: "🔬", category: "instruments" },
            { id: "eq_2", name: "prepared slides", description: "Sample specimens for observation", icon: "📏", category: "tools" },
            { id: "eq_3", name: "lens paper", description: "For cleaning microscope lenses", icon: "🧻", category: "tools" }
          ],
          chemicals: [
            { id: "chem_1", name: "methylene blue stain", concentration: "1%", hazard: "safe", color: "blue", icon: "🧪" }
          ],
          procedure: [
            "Set up the microscope and adjust lighting",
            "Start with low magnification (4x objective)",
            "Place the prepared slide on the stage",
            "Focus using coarse adjustment knob",
            "Switch to higher magnification (10x, then 40x)",
            "Use fine adjustment for clear focus",
            "Observe and identify cell structures",
            "Draw what you observe"
          ],
          safetyNotes: [
            "Handle microscope and slides carefully",
            "Clean lenses with lens paper only",
            "Store microscope properly"
          ]
        },
        objectives: [
          "Learn proper microscope usage",
          "Identify basic cell structures",
          "Understand magnification principles",
          "Practice scientific observation skills"
        ],
        expectedOutcome: "Clear observation of cell structures including nucleus, cytoplasm, and cell membrane.",
        estimatedDuration: 35,
        difficulty: "intermediate"
      }
    };

    const baseData = mockData[subject] || mockData.chemistry;
    
          return {
        ...baseData,
        prompt: prompt,
        subject: subject,
        level: level,
        difficulty: this.getDifficultyByLevel(level),
        gameConfig: this.generateGameConfig(subject, level)
      };
  }

  /**
   * Get difficulty level based on student level
   * @private
   */
  getDifficultyByLevel(level) {
    if (level <= 2) return 'beginner';
    if (level <= 4) return 'intermediate';
    return 'advanced';
  }

  /**
   * Process game action using AI
   * @param {Object} params - Action processing parameters
   * @returns {Promise<Object>} AI-generated action result
   */
  async processGameAction({ action, equipment, target, gameState, context, simulation }) {
    try {
      console.log(`🤖 AI processing game action: ${action}`);
      
      const prompt = this.createGameActionPrompt(action, equipment, target, gameState, simulation);
      
      // Use mock response for now, can be replaced with real AI call
      return this.generateMockActionResult(action, equipment, target, simulation);
      
    } catch (error) {
      console.error('❌ AI Game Action Error:', error.message);
      return this.generateFallbackActionResult(action, equipment);
    }
  }

  /**
   * Process chemical mixing using AI
   * @param {Object} params - Chemical mixing parameters
   * @returns {Promise<Object>} AI-generated reaction result
   */
  async processChemicalMixing({ chemical1, chemical2, gameState, simulation }) {
    try {
      console.log(`🤖 AI processing chemical mixing: ${chemical1.name} + ${chemical2.name}`);
      
      const prompt = this.createChemicalMixingPrompt(chemical1, chemical2, simulation);
      
      // Use mock response for now
      return this.generateMockChemicalReaction(chemical1, chemical2, simulation);
      
    } catch (error) {
      console.error('❌ AI Chemical Mixing Error:', error.message);
      return this.generateFallbackChemicalReaction(chemical1, chemical2);
    }
  }

  /**
   * Generate contextual hint using AI
   * @param {Object} params - Hint generation parameters
   * @returns {Promise<Object>} AI-generated hint
   */
  async generateHint({ gameState, strugglingArea, simulation }) {
    try {
      console.log(`🤖 AI generating hint for ${simulation.subject} simulation`);
      
      const prompt = this.createHintPrompt(gameState, strugglingArea, simulation);
      
      // Use mock response for now
      return this.generateMockHint(gameState, simulation);
      
    } catch (error) {
      console.error('❌ AI Hint Generation Error:', error.message);
      return this.generateFallbackHint();
    }
  }

  /**
   * Create AI prompt for game action processing
   * @private
   */
  createGameActionPrompt(action, equipment, target, gameState, simulation) {
    return `You are an AI tutor for a ${simulation.subject} virtual lab simulation for Level ${simulation.level} students.

A student is performing the action: "${action}" using "${equipment?.name || 'unknown equipment'}" on target "${target}".

Current game state: ${JSON.stringify(gameState, null, 2)}

Simulation context: ${simulation.subject} - ${simulation.level} level

Please provide:
1. A clear description of what happens when this action is performed
2. The scientific explanation appropriate for the student's level
3. Any visual effects that should occur
4. Educational value and correctness of the action
5. Helpful suggestions for next steps
6. Any safety considerations

Respond with engaging, age-appropriate language that encourages learning.`;
  }

  /**
   * Generate mock action result for development
   * @private
   */
  generateMockActionResult(action, equipment, target, simulation) {
    const actionResults = {
      use_equipment: {
        actionDescription: `You picked up the ${equipment?.name || 'laboratory equipment'} and placed it in the ${target} area.`,
        scientificResult: 'Equipment is now ready for use in your experiment.',
        explanation: 'Proper equipment handling is essential for accurate scientific results.',
        visualEffect: 'equipment_placed',
        isCorrect: true,
        observation: true,
        hints: ['Great choice! Now you can use this equipment for measurements.'],
        nextSuggestion: 'Try adding some chemicals to begin your experiment.',
        safety: 'safe'
      },
      mix_chemicals: {
        actionDescription: 'You carefully mixed the chemicals in the beaker.',
        scientificResult: 'A chemical reaction is occurring between the substances.',
        explanation: 'When different chemicals combine, their molecules interact to form new compounds.',
        visualEffect: 'bubbling_reaction',
        isCorrect: true,
        observation: true,
        hints: ['Watch carefully for color changes or temperature differences!'],
        nextSuggestion: 'Record your observations about what you see happening.',
        safety: 'safe'
      },
      observe: {
        actionDescription: 'You observed the current state of your experiment carefully.',
        scientificResult: 'Making observations is a crucial part of the scientific method.',
        explanation: 'Scientists use their senses to gather data about what they see, hear, smell, and feel.',
        visualEffect: 'observation_highlight',
        isCorrect: true,
        observation: true,
        hints: ['Good observation skills! Try to notice colors, textures, and any changes.'],
        nextSuggestion: 'Record what you observed in your lab notebook.',
        safety: 'safe'
      },
      measure: {
        actionDescription: 'You used the measuring instrument to take precise measurements.',
        scientificResult: 'Accurate measurements are essential for scientific experiments.',
        explanation: 'Measuring tools help us quantify our observations and make experiments repeatable.',
        visualEffect: 'measurement_display',
        isCorrect: true,
        observation: true,
        hints: ['Precise measurements lead to better scientific results!'],
        nextSuggestion: 'Compare your measurement with the expected values.',
        safety: 'safe'
      }
    };

    return actionResults[action] || actionResults.observe;
  }

  /**
   * Generate mock chemical reaction
   * @private
   */
  generateMockChemicalReaction(chemical1, chemical2, simulation) {
    const reactions = {
      chemistry: {
        result: `${chemical1.name} reacts with ${chemical2.name} to form a new compound.`,
        explanation: 'This is a classic chemical reaction where atoms rearrange to form new substances.',
        visualEffect: 'color_change_blue_to_pink',
        resultSolution: {
          name: `${chemical1.name}-${chemical2.name} Solution`,
          color: 'light pink',
          properties: 'Clear solution with slight fizzing'
        },
        safety: 'safe',
        educational: true,
        nextSteps: [
          'Record the color change in your observations',
          'Measure the final temperature',
          'Test the pH of the resulting solution'
        ]
      },
      physics: {
        result: 'The substances combine but no chemical reaction occurs.',
        explanation: 'This is a physical mixture where the substances retain their original properties.',
        visualEffect: 'mixing_no_reaction',
        resultSolution: {
          name: 'Physical Mixture',
          color: 'mixed',
          properties: 'Combined but separable substances'
        },
        safety: 'safe',
        educational: true,
        nextSteps: [
          'Try to separate the mixture using physical methods',
          'Observe the different phases'
        ]
      },
      biology: {
        result: 'The biological samples show interesting interactions under the microscope.',
        explanation: 'Different biological specimens can show various cellular structures when combined.',
        visualEffect: 'cellular_activity',
        resultSolution: {
          name: 'Biological Sample',
          color: 'clear with particles',
          properties: 'Living cells visible under magnification'
        },
        safety: 'safe',
        educational: true,
        nextSteps: [
          'Examine under different magnifications',
          'Look for cellular structures'
        ]
      }
    };

    return reactions[simulation.subject] || reactions.chemistry;
  }

  /**
   * Generate mock hint
   * @private
   */
  generateMockHint(gameState, simulation) {
    const hints = {
      chemistry: [
        { text: "Remember to always add acid to water, never water to acid!", type: "safety" },
        { text: "Look for color changes - they often indicate chemical reactions.", type: "tip" },
        { text: "You're doing great! Keep observing carefully.", type: "encouragement" },
        { text: "Try mixing small amounts first to see what happens.", type: "direction" }
      ],
      physics: [
        { text: "Check your measurements twice for accuracy.", type: "tip" },
        { text: "Remember that electricity follows predictable patterns.", type: "direction" },
        { text: "Excellent work! You're thinking like a scientist.", type: "encouragement" },
        { text: "Always ensure circuits are disconnected before making changes.", type: "safety" }
      ],
      biology: [
        { text: "Start with low magnification and gradually increase.", type: "tip" },
        { text: "Look for movement or structures in your samples.", type: "direction" },
        { text: "Great observation skills! Keep it up.", type: "encouragement" },
        { text: "Handle biological samples with care and proper hygiene.", type: "safety" }
      ]
    };

    const subjectHints = hints[simulation.subject] || hints.chemistry;
    const randomHint = subjectHints[Math.floor(Math.random() * subjectHints.length)];
    
    return {
      text: randomHint.text,
      type: randomHint.type,
      specificity: 'specific'
    };
  }

  /**
   * Generate fallback action result
   * @private
   */
  generateFallbackActionResult(action, equipment) {
    return {
      actionDescription: `You performed the ${action} action.`,
      scientificResult: 'Action completed successfully.',
      explanation: 'This action helps you learn about scientific methods.',
      visualEffect: 'default_action',
      isCorrect: true,
      observation: false,
      hints: ['Keep experimenting to learn more!'],
      nextSuggestion: 'Try another action to continue your experiment.',
      safety: 'safe'
    };
  }

  /**
   * Generate fallback chemical reaction
   * @private
   */
  generateFallbackChemicalReaction(chemical1, chemical2) {
    return {
      result: 'The chemicals were mixed safely.',
      explanation: 'Chemical mixing can teach us about molecular interactions.',
      visualEffect: 'gentle_mixing',
      resultSolution: {
        name: 'Mixed Solution',
        color: 'clear',
        properties: 'Safe mixture'
      },
      safety: 'safe',
      educational: true,
      nextSteps: ['Continue with your experiment']
    };
  }

  /**
   * Generate fallback hint
   * @private
   */
  generateFallbackHint() {
    return {
      text: "Take your time and observe carefully. Science is about curiosity and discovery!",
      type: "encouragement",
      specificity: "general"
    };
  }

  /**
   * Enhance equipment list for gaming with detailed objects
   * @private
   */
  enhanceEquipmentForGaming(equipmentList, subject) {
    const defaultEquipment = this.getDefaultEquipment(subject);
    
    if (!equipmentList || equipmentList.length === 0) {
      return defaultEquipment;
    }

    // Convert simple strings to enhanced objects if needed
    return equipmentList.map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `eq_${index + 1}`,
          name: item,
          description: `${item} for laboratory experiments`,
          icon: this.getEquipmentIcon(item),
          category: this.categorizeEquipment(item)
        };
      }
      return item;
    });
  }

  /**
   * Enhance chemicals list for gaming with detailed objects
   * @private
   */
  enhanceChemicalsForGaming(chemicalsList, subject) {
    const defaultChemicals = this.getDefaultChemicals(subject);
    
    if (!chemicalsList || chemicalsList.length === 0) {
      return subject === 'chemistry' ? defaultChemicals : [];
    }

    return chemicalsList.map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `chem_${index + 1}`,
          name: item,
          concentration: this.getConcentration(item),
          hazard: this.getHazardLevel(item),
          color: this.getChemicalColor(item),
          icon: '🧪'
        };
      }
      return item;
    });
  }

  /**
   * Generate game configuration based on subject and level
   * @private
   */
  generateGameConfig(subject, level) {
    const baseScore = {
      correctAction: 10,
      observation: 5,
      completion: 50
    };

    const maxScore = 100 + (level * 20); // Higher levels have higher possible scores

    return {
      objectives: this.getGameObjectives(subject, level),
      scoringCriteria: baseScore,
      maxScore: maxScore,
      timeLimit: subject === 'chemistry' ? 45 : subject === 'physics' ? 30 : 40
    };
  }

  /**
   * Get default equipment for subject
   * @private
   */
  getDefaultEquipment(subject) {
    const equipment = {
      chemistry: [
        { id: 'eq_1', name: 'Beaker', description: 'Glass container for mixing solutions', icon: '🥤', category: 'glassware' },
        { id: 'eq_2', name: 'Burette', description: 'Precise measuring device for liquids', icon: '🔬', category: 'instruments' },
        { id: 'eq_3', name: 'Safety Goggles', description: 'Eye protection equipment', icon: '🥽', category: 'tools' }
      ],
      physics: [
        { id: 'eq_1', name: 'Multimeter', description: 'Electrical measurement device', icon: '⚡', category: 'instruments' },
        { id: 'eq_2', name: 'Breadboard', description: 'Circuit construction platform', icon: '🔌', category: 'tools' },
        { id: 'eq_3', name: 'Safety Goggles', description: 'Eye protection equipment', icon: '🥽', category: 'tools' }
      ],
      biology: [
        { id: 'eq_1', name: 'Microscope', description: 'Device for magnifying small objects', icon: '🔬', category: 'instruments' },
        { id: 'eq_2', name: 'Prepared Slides', description: 'Sample specimens for observation', icon: '📏', category: 'tools' },
        { id: 'eq_3', name: 'Safety Goggles', description: 'Eye protection equipment', icon: '🥽', category: 'tools' }
      ]
    };

    return equipment[subject] || equipment.chemistry;
  }

  /**
   * Get default chemicals for subject
   * @private
   */
  getDefaultChemicals(subject) {
    if (subject !== 'chemistry') return [];

    return [
      { id: 'chem_1', name: 'Distilled Water', concentration: 'Pure', hazard: 'safe', color: 'colorless', icon: '💧' },
      { id: 'chem_2', name: 'Sodium Chloride', concentration: '0.1M', hazard: 'safe', color: 'white', icon: '🧂' },
      { id: 'chem_3', name: 'Phenolphthalein', concentration: '1%', hazard: 'caution', color: 'colorless', icon: '🧪' }
    ];
  }

  /**
   * Get equipment icon based on name
   * @private
   */
  getEquipmentIcon(name) {
    const icons = {
      beaker: '🥤', burette: '🔬', microscope: '🔬', multimeter: '⚡',
      breadboard: '🔌', pipette: '💉', goggles: '🥽', thermometer: '🌡️',
      scale: '⚖️', flask: '🧪', slide: '📏'
    };

    const lowercaseName = name.toLowerCase();
    for (const [key, icon] of Object.entries(icons)) {
      if (lowercaseName.includes(key)) {
        return icon;
      }
    }
    return '🔬';
  }

  /**
   * Categorize equipment
   * @private
   */
  categorizeEquipment(name) {
    const categories = {
      glassware: ['beaker', 'flask', 'tube', 'cylinder'],
      instruments: ['microscope', 'multimeter', 'thermometer', 'scale', 'burette'],
      tools: ['goggles', 'tongs', 'spatula', 'brush', 'pipette'],
      chemicals: ['acid', 'base', 'salt', 'indicator']
    };

    const lowercaseName = name.toLowerCase();
    for (const [category, items] of Object.entries(categories)) {
      if (items.some(item => lowercaseName.includes(item))) {
        return category;
      }
    }
    return 'tools';
  }

  /**
   * Get chemical concentration
   * @private
   */
  getConcentration(name) {
    if (name.toLowerCase().includes('water')) return 'Pure';
    if (name.toLowerCase().includes('acid')) return '0.1M';
    if (name.toLowerCase().includes('base')) return '0.1M';
    return '1%';
  }

  /**
   * Get hazard level for chemical
   * @private
   */
  getHazardLevel(name) {
    const dangerous = ['acid', 'concentrated', 'strong'];
    const caution = ['base', 'indicator', 'salt'];
    
    const lowercaseName = name.toLowerCase();
    if (dangerous.some(word => lowercaseName.includes(word))) return 'dangerous';
    if (caution.some(word => lowercaseName.includes(word))) return 'caution';
    return 'safe';
  }

  /**
   * Get chemical color
   * @private
   */
  getChemicalColor(name) {
    const colors = {
      water: 'colorless',
      acid: 'colorless',
      base: 'colorless',
      indicator: 'pink',
      salt: 'white',
      iodine: 'brown',
      copper: 'blue'
    };

    const lowercaseName = name.toLowerCase();
    for (const [chemical, color] of Object.entries(colors)) {
      if (lowercaseName.includes(chemical)) {
        return color;
      }
    }
    return 'colorless';
  }

  /**
   * Get game objectives based on subject and level
   * @private
   */
  getGameObjectives(subject, level) {
    const objectives = {
      chemistry: [
        'Learn about chemical reactions and molecular interactions',
        'Practice safe laboratory procedures',
        'Understand the importance of accurate measurements',
        'Observe and record experimental results'
      ],
      physics: [
        'Understand fundamental physical principles',
        'Learn to use measurement instruments properly',
        'Explore cause and effect relationships',
        'Practice scientific problem-solving'
      ],
      biology: [
        'Observe living organisms and biological structures',
        'Learn proper microscope techniques',
        'Understand biological processes',
        'Practice careful scientific observation'
      ]
    };

    return objectives[subject] || objectives.chemistry;
  }

  /**
   * Validate simulation data structure
   * @private
   */
  validateSimulationData(data) {
    const required = ['title', 'description', 'experimentType', 'virtualLab', 'objectives'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate virtualLab completeness
    if (!data.virtualLab.procedure || data.virtualLab.procedure.length === 0) {
      throw new Error('Procedure steps are required and cannot be empty');
    }

    if (!data.virtualLab.equipment || data.virtualLab.equipment.length === 0) {
      throw new Error('Equipment list is required and cannot be empty');
    }

    if (!data.virtualLab.safetyNotes || data.virtualLab.safetyNotes.length === 0) {
      throw new Error('Safety notes are required and cannot be empty');
    }

    // For chemistry experiments, chemicals should not be empty
    if (data.subject === 'chemistry' && (!data.virtualLab.chemicals || data.virtualLab.chemicals.length === 0)) {
      console.warn('⚠️ Chemistry experiment has no chemicals specified, adding default');
      data.virtualLab.chemicals = ['Water', 'Standard solutions'];
    }

    return true;
  }
}

// Export singleton instance
const aiService = new AIService();
export default aiService;
