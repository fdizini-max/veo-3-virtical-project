import { logger } from '@/utils/logger';
import { BackgroundMode } from '@prisma/client';

interface PromptProcessingOptions {
  backgroundMode?: BackgroundMode;
  duration?: number;
  hasReferenceImage?: boolean;
}

interface ElementAnalysis {
  characters: string[];
  objects: string[];
  actions: string[];
  environment: string;
  mood: string;
  lighting: string;
}

/**
 * Prompt Service - Handles intelligent prompt processing
 * 
 * This service implements the user's requirement to:
 * 1. First recognize characters, elements, and objects in the prompt
 * 2. Then apply vertical formatting in an integrated way
 * 3. Use specific object names instead of generic 'object' references
 * 
 * Enhanced with advanced prompt scaffolding logic for Veo 3 optimization
 */
class PromptService {

  // Advanced prompt scaffolding templates
  private readonly PROMPT_SCAFFOLDS = {
    VERTICAL_FIRST: {
      header: `Design the video in 9:16 vertical composition, but render it in a 16:9 horizontal layout with the entire scene rotated 90 degrees counterclockwise — the visual top appears on the left edge. This sideways composition will be rotated 90 degrees clockwise in post to become upright 9:16.`,
      
      composition: `Center-align the subject in the vertical safe zone, ensure background lines read naturally after rotation, use one character only, no text/overlays/watermarks, and fill the full 16:9 frame.`,
      
      technical: `Optimize for vertical viewing: main action flows top-to-bottom in final output, background supports vertical storytelling, avoid horizontal panning, design depth and perspective for 9:16 aspect ratio.`,
      
      quality: `High production value, cinematic lighting, professional composition, avoid busy backgrounds that distract from main subject, ensure clear visual hierarchy for mobile viewing.`
    },
    
    HORIZONTAL: {
      header: `Create a cinematic 16:9 horizontal video with professional composition and lighting.`,
      
      composition: `Use rule of thirds, balanced framing, appropriate depth of field, and cinematic camera movements that enhance the narrative.`,
      
      technical: `Optimize for wide viewing: establish scene context, use landscape orientation effectively, include environmental details that support the story.`,
      
      quality: `Professional video production standards, dynamic lighting, engaging visual storytelling, smooth camera work, high visual fidelity.`
    }
  };

  // Character and scene consistency templates
  private readonly CONSISTENCY_TEMPLATES = {
    CHARACTER: {
      single: `Maintain consistent character appearance throughout: same clothing, hairstyle, facial features, and body proportions. Ensure lighting consistency across all shots.`,
      
      multiple: `Focus primarily on main character with consistent appearance. Secondary characters should be minimally featured to avoid composition confusion. Maintain visual hierarchy.`
    },
    
    ENVIRONMENT: {
      indoor: `Consistent indoor lighting, maintain spatial relationships, ensure background elements support the main action without distraction.`,
      
      outdoor: `Natural lighting consistency, weather conditions remain stable, environmental elements enhance rather than compete with subject.`,
      
      studio: `Controlled studio environment, consistent backdrop, professional lighting setup, minimal background distractions.`
    },
    
    SCENE_CONTINUATION: {
      template: `For subsequent scenes: maintain character consistency and environment continuity. Only add specific character guidance without copying lighting or technical settings.`
    }
  };

  /**
   * Process user prompt for vertical-first generation
   * Recognizes elements first, then applies vertical formatting
   */
  async processVerticalPrompt(
    userPrompt: string, 
    options: PromptProcessingOptions = {}
  ): Promise<string> {
    try {
      logger.debug('Processing vertical prompt', {
        promptLength: userPrompt.length,
        options
      });

      // Step 1: Analyze and recognize elements in the prompt
      const analysis = await this.analyzePromptElements(userPrompt);

      // Step 2: Apply vertical formatting using recognized elements
      const verticalEnhanced = this.applyVerticalFormatting(userPrompt, analysis, options);

      // Step 3: Add character and environment consistency
      const finalPrompt = this.addConsistencyGuidance(verticalEnhanced, analysis, options);

      logger.debug('Vertical prompt processed', {
        originalLength: userPrompt.length,
        processedLength: finalPrompt.length,
        charactersFound: analysis.characters.length,
        objectsFound: analysis.objects.length
      });

      return finalPrompt;

    } catch (error) {
      logger.error('Failed to process vertical prompt', {
        error: error.message,
        promptLength: userPrompt.length
      });

      // Fallback to basic processing
      return this.applyBasicVerticalFormatting(userPrompt, options);
    }
  }

  /**
   * Process user prompt for horizontal generation
   */
  async processHorizontalPrompt(
    userPrompt: string,
    options: PromptProcessingOptions = {}
  ): Promise<string> {
    try {
      logger.debug('Processing horizontal prompt', {
        promptLength: userPrompt.length,
        options
      });

      // For horizontal, we still analyze elements for consistency
      const analysis = await this.analyzePromptElements(userPrompt);

      // Apply horizontal-specific enhancements
      let processedPrompt = userPrompt;

      // Add background mode if specified
      if (options.backgroundMode) {
        processedPrompt = this.addBackgroundGuidance(processedPrompt, options.backgroundMode);
      }

      // Add duration-specific guidance
      if (options.duration) {
        processedPrompt = this.addDurationGuidance(processedPrompt, options.duration);
      }

      // Ensure single character focus if multiple characters detected
      if (analysis.characters.length > 1) {
        processedPrompt = this.enforceSingleCharacterFocus(processedPrompt, analysis);
      }

      return processedPrompt;

    } catch (error) {
      logger.error('Failed to process horizontal prompt', {
        error: error.message,
        promptLength: userPrompt.length
      });

      return userPrompt; // Return original on error
    }
  }

  /**
   * Analyze prompt to recognize characters, elements, and objects
   * This is the first step as required - recognition before formatting
   */
  private async analyzePromptElements(prompt: string): Promise<ElementAnalysis> {
    const analysis: ElementAnalysis = {
      characters: [],
      objects: [],
      actions: [],
      environment: '',
      mood: '',
      lighting: ''
    };

    try {
      const lowerPrompt = prompt.toLowerCase();

      // Recognize characters (people, animals, beings)
      analysis.characters = this.extractCharacters(prompt);

      // Recognize specific objects (not generic 'object')
      analysis.objects = this.extractSpecificObjects(prompt);

      // Recognize actions and movements
      analysis.actions = this.extractActions(lowerPrompt);

      // Recognize environment/setting
      analysis.environment = this.extractEnvironment(lowerPrompt);

      // Recognize mood and tone
      analysis.mood = this.extractMood(lowerPrompt);

      // Recognize lighting conditions
      analysis.lighting = this.extractLighting(lowerPrompt);

      logger.debug('Element analysis completed', analysis);

      return analysis;

    } catch (error) {
      logger.error('Element analysis failed', {
        error: error.message,
        prompt: prompt.substring(0, 100)
      });

      return analysis; // Return partial analysis
    }
  }

  /**
   * Extract character references from prompt
   */
  private extractCharacters(prompt: string): string[] {
    const characters = [];
    const characterPatterns = [
      // People
      /\b(person|man|woman|child|boy|girl|adult|teenager|elder|human)\b/gi,
      /\b(doctor|teacher|artist|chef|musician|dancer|athlete|scientist)\b/gi,
      /\b(character|protagonist|hero|heroine|villain)\b/gi,
      
      // Animals
      /\b(cat|dog|bird|horse|elephant|lion|tiger|bear|wolf|deer|rabbit)\b/gi,
      /\b(fish|dolphin|whale|shark|eagle|owl|butterfly|bee)\b/gi,
      
      // Fantasy/Fictional
      /\b(dragon|unicorn|fairy|elf|wizard|knight|princess|prince)\b/gi,
      /\b(robot|android|alien|monster|creature|beast)\b/gi
    ];

    for (const pattern of characterPatterns) {
      const matches = prompt.match(pattern);
      if (matches) {
        characters.push(...matches.map(match => match.toLowerCase()));
      }
    }

    // Remove duplicates and return unique characters
    return [...new Set(characters)];
  }

  /**
   * Extract specific object names (not generic 'object')
   * Uses specific names as per user preference
   */
  private extractSpecificObjects(prompt: string): string[] {
    const objects = [];
    const objectPatterns = [
      // Vehicles
      /\b(car|truck|bicycle|motorcycle|plane|helicopter|boat|ship|train)\b/gi,
      
      // Buildings/Structures
      /\b(house|building|castle|tower|bridge|church|temple|palace|cabin)\b/gi,
      
      // Furniture/Items
      /\b(chair|table|bed|sofa|desk|lamp|mirror|painting|vase|book)\b/gi,
      /\b(phone|computer|camera|television|guitar|piano|sword|shield)\b/gi,
      
      // Nature Objects
      /\b(tree|flower|mountain|rock|river|lake|ocean|cloud|star|moon|sun)\b/gi,
      /\b(forest|garden|meadow|valley|hill|cliff|waterfall|cave)\b/gi,
      
      // Food/Drink
      /\b(apple|cake|coffee|wine|bread|pizza|sandwich|ice cream)\b/gi,
      
      // Clothing/Accessories
      /\b(dress|suit|hat|shoes|glasses|jewelry|watch|bag|backpack)\b/gi
    ];

    for (const pattern of objectPatterns) {
      const matches = prompt.match(pattern);
      if (matches) {
        objects.push(...matches.map(match => match.toLowerCase()));
      }
    }

    return [...new Set(objects)];
  }

  /**
   * Extract action words and movements
   */
  private extractActions(prompt: string): string[] {
    const actionPatterns = [
      /\b(walking|running|jumping|dancing|flying|swimming|climbing|falling)\b/gi,
      /\b(sitting|standing|lying|kneeling|crouching|leaning|turning|spinning)\b/gi,
      /\b(talking|singing|laughing|crying|smiling|frowning|looking|watching)\b/gi,
      /\b(eating|drinking|cooking|reading|writing|drawing|painting|playing)\b/gi,
      /\b(fighting|hugging|kissing|waving|pointing|gesturing|nodding)\b/gi
    ];

    const actions = [];
    for (const pattern of actionPatterns) {
      const matches = prompt.match(pattern);
      if (matches) {
        actions.push(...matches.map(match => match.toLowerCase()));
      }
    }

    return [...new Set(actions)];
  }

  /**
   * Extract environment/setting information
   */
  private extractEnvironment(prompt: string): string {
    const environmentKeywords = [
      'indoor', 'outdoor', 'inside', 'outside', 'interior', 'exterior',
      'studio', 'stage', 'street', 'park', 'beach', 'forest', 'mountain',
      'city', 'countryside', 'urban', 'rural', 'suburban',
      'kitchen', 'bedroom', 'office', 'classroom', 'restaurant', 'cafe',
      'hospital', 'library', 'museum', 'theater', 'concert hall'
    ];

    for (const keyword of environmentKeywords) {
      if (prompt.includes(keyword)) {
        return keyword;
      }
    }

    return 'neutral';
  }

  /**
   * Extract mood and emotional tone
   */
  private extractMood(prompt: string): string {
    const moodKeywords = {
      'happy': ['happy', 'joyful', 'cheerful', 'bright', 'upbeat', 'positive'],
      'sad': ['sad', 'melancholy', 'somber', 'gloomy', 'depressing'],
      'dramatic': ['dramatic', 'intense', 'powerful', 'strong', 'bold'],
      'peaceful': ['peaceful', 'calm', 'serene', 'tranquil', 'relaxing'],
      'energetic': ['energetic', 'dynamic', 'vibrant', 'lively', 'active'],
      'mysterious': ['mysterious', 'enigmatic', 'dark', 'shadowy', 'secretive'],
      'romantic': ['romantic', 'intimate', 'tender', 'loving', 'passionate']
    };

    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      for (const keyword of keywords) {
        if (prompt.includes(keyword)) {
          return mood;
        }
      }
    }

    return 'neutral';
  }

  /**
   * Extract lighting conditions
   */
  private extractLighting(prompt: string): string {
    const lightingKeywords = {
      'bright': ['bright', 'sunny', 'daylight', 'well-lit', 'illuminated'],
      'dim': ['dim', 'low light', 'shadowy', 'twilight', 'dusk'],
      'dramatic': ['dramatic lighting', 'spotlight', 'high contrast', 'chiaroscuro'],
      'soft': ['soft light', 'diffused', 'gentle', 'warm light'],
      'neon': ['neon', 'fluorescent', 'artificial', 'electric'],
      'natural': ['natural light', 'sunlight', 'moonlight', 'candlelight', 'firelight']
    };

    for (const [lighting, keywords] of Object.entries(lightingKeywords)) {
      for (const keyword of keywords) {
        if (prompt.includes(keyword)) {
          return lighting;
        }
      }
    }

    return 'natural';
  }

  /**
   * Advanced prompt scaffolding - builds complete structured prompt
   */
  buildScaffoldedPrompt(
    userPrompt: string,
    analysis: ElementAnalysis,
    mode: 'VERTICAL_FIRST' | 'HORIZONTAL',
    options: PromptProcessingOptions = {}
  ): string {
    const scaffold = this.PROMPT_SCAFFOLDS[mode];
    
    // Build structured prompt sections
    const sections = [
      // 1. Technical header
      scaffold.header,
      
      // 2. Composition guidelines
      scaffold.composition,
      
      // 3. User scene description (processed)
      `SCENE: ${this.enhanceUserScene(userPrompt, analysis, mode, options)}`,
      
      // 4. Character and object specifics
      this.buildElementGuidance(analysis),
      
      // 5. Technical and quality requirements
      scaffold.technical,
      scaffold.quality,
      
      // 6. Final constraints
      this.buildConstraints(mode, options)
    ];

    const finalPrompt = sections.filter(Boolean).join('\n\n');
    
    logger.debug('Scaffolded prompt built', {
      mode,
      userPromptLength: userPrompt.length,
      finalPromptLength: finalPrompt.length,
      sectionsCount: sections.length,
      hasCharacters: analysis.characters.length > 0,
      hasObjects: analysis.objects.length > 0
    });

    return finalPrompt;
  }

  /**
   * Enhance user scene description with recognized elements
   */
  private enhanceUserScene(
    userPrompt: string,
    analysis: ElementAnalysis,
    mode: 'VERTICAL_FIRST' | 'HORIZONTAL',
    options: PromptProcessingOptions
  ): string {
    let enhanced = userPrompt;

    // Add specific character details
    if (analysis.characters.length > 0) {
      const primaryCharacter = analysis.characters[0];
      if (mode === 'VERTICAL_FIRST') {
        enhanced = `${enhanced}. ${primaryCharacter} positioned centrally for vertical framing with clear facial expressions and upper body focus`;
      } else {
        enhanced = `${enhanced}. ${primaryCharacter} positioned using rule of thirds with full scene context`;
      }
    }

    // Enhance with specific object positioning
    if (analysis.objects.length > 0) {
      const objectList = analysis.objects.slice(0, 3).join(', ');
      enhanced = `${enhanced}. Feature ${objectList} as key scene elements that support the narrative`;
    }

    // Add action and movement guidance
    if (analysis.actions.length > 0) {
      const primaryAction = analysis.actions[0];
      if (mode === 'VERTICAL_FIRST') {
        enhanced = `${enhanced}. ${primaryAction} with movement that translates well to vertical viewing, emphasizing gestures and expressions`;
      } else {
        enhanced = `${enhanced}. ${primaryAction} with cinematic movement that utilizes the full horizontal frame`;
      }
    }

    // Add environment and mood integration
    if (analysis.environment && analysis.environment !== 'neutral') {
      enhanced = `${enhanced}. ${analysis.environment} setting that complements the action`;
    }

    if (analysis.mood && analysis.mood !== 'neutral') {
      enhanced = `${enhanced}. ${analysis.mood} mood conveyed through lighting and composition`;
    }

    return enhanced;
  }

  /**
   * Build element-specific guidance using recognized elements
   */
  private buildElementGuidance(analysis: ElementAnalysis): string {
    const guidance = [];

    // Character guidance
    if (analysis.characters.length > 0) {
      if (analysis.characters.length === 1) {
        guidance.push(this.CONSISTENCY_TEMPLATES.CHARACTER.single);
      } else {
        guidance.push(this.CONSISTENCY_TEMPLATES.CHARACTER.multiple);
      }
    }

    // Object-specific guidance using actual object names
    if (analysis.objects.length > 0) {
      const objectGuidance = analysis.objects.map(obj => {
        return this.getObjectSpecificGuidance(obj);
      }).filter(Boolean).join(' ');
      
      if (objectGuidance) {
        guidance.push(`OBJECT DETAILS: ${objectGuidance}`);
      }
    }

    // Environment guidance
    if (analysis.environment && analysis.environment !== 'neutral') {
      const envTemplate = this.CONSISTENCY_TEMPLATES.ENVIRONMENT[analysis.environment as keyof typeof this.CONSISTENCY_TEMPLATES.ENVIRONMENT];
      if (envTemplate) {
        guidance.push(envTemplate);
      }
    }

    return guidance.join(' ');
  }

  /**
   * Get specific guidance for individual objects
   */
  private getObjectSpecificGuidance(objectName: string): string {
    const objectGuidance: Record<string, string> = {
      // Vehicles
      'car': 'Vehicle positioned to show key details like wheels, body, and design elements clearly',
      'bicycle': 'Bicycle frame and wheels visible with proper proportions and realistic physics',
      'motorcycle': 'Motorcycle with detailed engine, wheels, and rider positioning if applicable',
      
      // Food items
      'coffee': 'Coffee with realistic steam, proper cup proportions, and appealing color',
      'cake': 'Cake with detailed texture, frosting, and appetizing presentation',
      'pizza': 'Pizza with realistic toppings, cheese texture, and proper cooking appearance',
      
      // Musical instruments
      'guitar': 'Guitar with accurate fret details, proper string tension, and realistic wood grain',
      'piano': 'Piano keys with proper perspective, realistic key action, and appropriate lighting',
      
      // Nature elements
      'tree': 'Tree with natural branch structure, realistic foliage, and appropriate seasonal appearance',
      'flower': 'Flower with detailed petals, natural colors, and realistic botanical accuracy',
      'mountain': 'Mountain with realistic geological features, proper scale, and atmospheric perspective',
      
      // Architecture
      'house': 'House with architectural accuracy, proper proportions, and realistic materials',
      'building': 'Building with structural integrity, appropriate scale, and detailed facade',
      
      // Technology
      'phone': 'Phone with current design aesthetics, proper screen proportions, and realistic interface',
      'computer': 'Computer with accurate screen display, proper keyboard layout, and realistic setup'
    };

    return objectGuidance[objectName.toLowerCase()] || `${objectName} with realistic details and proper integration into the scene`;
  }

  /**
   * Build technical and quality constraints
   */
  private buildConstraints(mode: 'VERTICAL_FIRST' | 'HORIZONTAL', options: PromptProcessingOptions): string {
    const constraints = [];

    // Duration-specific constraints
    if (options.duration) {
      if (options.duration <= 3) {
        constraints.push('Concise scene with immediate visual impact, single key moment, avoid complex narratives');
      } else if (options.duration <= 6) {
        constraints.push('Structured scene with clear beginning-middle-end, 2-3 key moments, smooth transitions');
      } else {
        constraints.push('Detailed scene development with multiple moments, character arc, environmental changes');
      }
    }

    // Reference image constraints
    if (options.hasReferenceImage) {
      constraints.push('Maintain visual consistency with reference image while adapting composition for video format and specified aspect ratio');
    }

    // Mode-specific final constraints
    if (mode === 'VERTICAL_FIRST') {
      constraints.push('CRITICAL: Ensure all elements work correctly when rotated 90 degrees clockwise for final 9:16 output');
    } else {
      constraints.push('Utilize full 16:9 horizontal frame for cinematic storytelling and visual impact');
    }

    return constraints.join('. ');
  }

  /**
   * Apply vertical formatting using recognized elements
   * This integrates vertical formatting with element recognition
   */
  private applyVerticalFormatting(
    prompt: string, 
    analysis: ElementAnalysis, 
    options: PromptProcessingOptions
  ): string {
    // Use the new scaffolding system
    return this.buildScaffoldedPrompt(prompt, analysis, 'VERTICAL_FIRST', options);
  }

  /**
   * Apply horizontal formatting using recognized elements
   */
  private applyHorizontalFormatting(
    prompt: string,
    analysis: ElementAnalysis,
    options: PromptProcessingOptions
  ): string {
    // Use the new scaffolding system
    return this.buildScaffoldedPrompt(prompt, analysis, 'HORIZONTAL', options);
  }

  /**
   * Add character and environment consistency guidance
   * For subsequent scenes, only adds specific character guidance
   */
  private addConsistencyGuidance(
    prompt: string, 
    analysis: ElementAnalysis, 
    options: PromptProcessingOptions
  ): string {
    let enhanced = prompt;

    // Add character consistency if characters are present
    if (analysis.characters.length > 0) {
      const characterGuidance = this.buildCharacterConsistency(analysis.characters);
      enhanced = `${enhanced}. ${characterGuidance}`;
    }

    // Add environment consistency
    if (analysis.environment && analysis.environment !== 'neutral') {
      enhanced = `${enhanced}. Maintain ${analysis.environment} environment consistency throughout`;
    }

    // For reference image mode, add extra consistency guidance
    if (options.hasReferenceImage) {
      enhanced = `${enhanced}. Maintain visual consistency with reference image while adapting for vertical composition`;
    }

    return enhanced;
  }

  /**
   * Build character consistency guidance
   */
  private buildCharacterConsistency(characters: string[]): string {
    if (characters.length === 1) {
      return `Maintain consistent ${characters[0]} appearance, clothing, and characteristics`;
    } else {
      // Focus on primary character but acknowledge others
      return `Focus primarily on ${characters[0]} with consistent appearance, briefly include ${characters.slice(1, 2).join(', ')} if needed`;
    }
  }

  /**
   * Add background mode specific guidance
   */
  private addBackgroundGuidance(prompt: string, backgroundMode: BackgroundMode): string {
    const backgroundGuidance = {
      [BackgroundMode.SOLID_COLOR]: 'Use clean solid color background that complements the subject',
      [BackgroundMode.GREENSCREEN]: 'Use uniform green screen background for easy replacement',
      [BackgroundMode.MINIMAL_GRADIENT]: 'Use subtle gradient background that enhances vertical composition',
      [BackgroundMode.CUSTOM]: 'Use custom background that supports the scene narrative'
    };

    const guidance = backgroundGuidance[backgroundMode] || backgroundGuidance[BackgroundMode.MINIMAL_GRADIENT];
    return `${prompt}. ${guidance}`;
  }

  /**
   * Add duration-specific guidance
   */
  private addDurationGuidance(prompt: string, duration: number): string {
    if (duration <= 3) {
      return `${prompt}. Create concise, impactful scene suitable for ${duration} second duration`;
    } else if (duration <= 6) {
      return `${prompt}. Develop scene with clear beginning, middle, and end for ${duration} second duration`;
    } else {
      return `${prompt}. Create detailed scene with multiple moments and smooth transitions for ${duration} second duration`;
    }
  }

  /**
   * Enforce single character focus when multiple characters detected
   */
  private enforceSingleCharacterFocus(prompt: string, analysis: ElementAnalysis): string {
    if (analysis.characters.length <= 1) return prompt;

    const primaryCharacter = analysis.characters[0];
    return `${prompt}. Focus primarily on ${primaryCharacter} as the main subject, minimize other characters to avoid composition confusion`;
  }

  /**
   * Fallback basic vertical formatting
   */
  private applyBasicVerticalFormatting(prompt: string, options: PromptProcessingOptions): string {
    let enhanced = `${prompt}. Compose for vertical viewing with centered subject and top-to-bottom visual flow`;

    if (options.backgroundMode) {
      enhanced = this.addBackgroundGuidance(enhanced, options.backgroundMode);
    }

    return enhanced;
  }

  /**
   * Validate prompt for potential issues
   */
  validatePrompt(prompt: string): { isValid: boolean; issues: string[]; suggestions: string[] } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check prompt length
    if (prompt.length < 10) {
      issues.push('Prompt is too short');
      suggestions.push('Add more descriptive details about the scene, character, and action');
    }

    if (prompt.length > 500) {
      issues.push('Prompt is too long');
      suggestions.push('Focus on the most important elements and reduce unnecessary details');
    }

    // Check for problematic content
    const problematicTerms = ['text', 'watermark', 'logo', 'subtitle', 'caption'];
    for (const term of problematicTerms) {
      if (prompt.toLowerCase().includes(term)) {
        issues.push(`Contains potentially problematic term: ${term}`);
        suggestions.push(`Remove ${term} references as they may not work well in vertical video`);
      }
    }

    // Check for multiple characters
    const analysis = this.extractCharacters(prompt);
    if (analysis.length > 2) {
      issues.push('Multiple characters detected');
      suggestions.push('Focus on one main character for better vertical composition');
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }
}

// Export singleton instance
export const promptService = new PromptService();
