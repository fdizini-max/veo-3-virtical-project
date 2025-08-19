/**
 * Validation utilities for the Vertical Veo 3 application
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
}

/**
 * Validate a video generation prompt
 */
export function validatePrompt(prompt: string): ValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Trim the prompt
  const trimmedPrompt = prompt.trim();

  // Check minimum length
  if (trimmedPrompt.length === 0) {
    errors.push('Prompt cannot be empty');
    suggestions.push('Describe what you want to see in your video');
    return { isValid: false, errors, suggestions };
  }

  if (trimmedPrompt.length < 10) {
    errors.push('Prompt is too short');
    suggestions.push('Add more descriptive details about the scene, character, and action');
  }

  // Check maximum length
  if (trimmedPrompt.length > 500) {
    errors.push('Prompt is too long');
    suggestions.push('Focus on the most important elements and reduce unnecessary details');
  }

  // Check for problematic terms that don't work well in video generation
  const problematicTerms = [
    { term: 'text', message: 'Text overlays may not render correctly in generated videos' },
    { term: 'watermark', message: 'Watermarks should be added in post-processing' },
    { term: 'logo', message: 'Logos may not generate accurately' },
    { term: 'subtitle', message: 'Subtitles should be added after generation' },
    { term: 'caption', message: 'Captions should be added in post-processing' },
    { term: 'ui', message: 'User interface elements may not generate correctly' },
    { term: 'menu', message: 'Menu interfaces are difficult to generate accurately' },
    { term: 'button', message: 'Interactive elements may not render properly' }
  ];

  const lowerPrompt = trimmedPrompt.toLowerCase();
  for (const { term, message } of problematicTerms) {
    if (lowerPrompt.includes(term)) {
      suggestions.push(message);
    }
  }

  // Check for multiple characters (can cause composition issues)
  const characterPatterns = [
    /\b(people|persons|crowd|group|team|family|friends|couple)\b/gi,
    /\b(man|woman|boy|girl|child|adult).+(man|woman|boy|girl|child|adult)\b/gi,
    /\b(two|three|four|five|several|many).+(people|persons|characters|individuals)\b/gi
  ];

  for (const pattern of characterPatterns) {
    if (pattern.test(lowerPrompt)) {
      suggestions.push('Consider focusing on one main character for better vertical composition');
      break;
    }
  }

  // Check for very wide/horizontal concepts that don't work well vertically
  const horizontalConcepts = [
    'panorama', 'landscape', 'wide shot', 'aerial view', 'bird\'s eye',
    'horizon', 'skyline', 'coastline', 'mountain range'
  ];

  for (const concept of horizontalConcepts) {
    if (lowerPrompt.includes(concept)) {
      suggestions.push('Wide/horizontal concepts work better in horizontal mode');
      break;
    }
  }

  // Check for good vertical elements
  const verticalElements = [
    'portrait', 'close-up', 'face', 'hands', 'cooking', 'dancing',
    'singing', 'painting', 'crafting', 'workout', 'yoga'
  ];

  const hasVerticalElements = verticalElements.some(element => 
    lowerPrompt.includes(element)
  );

  if (!hasVerticalElements && trimmedPrompt.length > 20) {
    suggestions.push('Consider adding close-up actions or portrait-style elements for vertical videos');
  }

  // Check for temporal/duration indicators that might be confusing
  const temporalTerms = ['long', 'extended', 'brief', 'quick', 'slow', 'fast'];
  const hasTemporalTerms = temporalTerms.some(term => lowerPrompt.includes(term));
  
  if (hasTemporalTerms) {
    suggestions.push('Video duration is controlled by settings, not prompt descriptions');
  }

  // Positive suggestions for good prompts
  if (trimmedPrompt.length >= 20 && trimmedPrompt.length <= 200 && errors.length === 0) {
    // Check for descriptive elements
    const descriptiveElements = [
      'lighting', 'mood', 'atmosphere', 'style', 'color', 'emotion',
      'expression', 'movement', 'action', 'setting', 'environment'
    ];
    
    const hasDescriptiveElements = descriptiveElements.some(element =>
      lowerPrompt.includes(element)
    );

    if (hasDescriptiveElements) {
      suggestions.push('Great! Your prompt includes good descriptive elements');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  if (!email.trim()) {
    errors.push('Email is required');
    return { isValid: false, errors, suggestions };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Please enter a valid email address');
    suggestions.push('Email should be in format: user@example.com');
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions
  };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors, suggestions };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    suggestions.push('Add at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    suggestions.push('Add at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    suggestions.push('Add at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    suggestions.push('Add at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions
  };
}

/**
 * Validate file upload
 */
export function validateFile(
  file: File,
  options: {
    maxSize?: number; // in MB
    allowedTypes?: string[];
    minDimensions?: { width: number; height: number };
    maxDimensions?: { width: number; height: number };
  } = {}
): ValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  const {
    maxSize = 10,
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    minDimensions = { width: 256, height: 256 },
    maxDimensions = { width: 4096, height: 4096 }
  } = options;

  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSize) {
    errors.push(`File size (${fileSizeMB.toFixed(2)}MB) exceeds maximum allowed size (${maxSize}MB)`);
    suggestions.push('Try compressing the image or using a smaller file');
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not supported`);
    suggestions.push(`Supported formats: ${allowedTypes.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions
  };
}

/**
 * Validate generation settings
 */
export function validateGenerationSettings(settings: {
  duration: number;
  fps: number;
  resolution: string;
  mode: string;
}): ValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Validate duration
  if (settings.duration < 1 || settings.duration > 10) {
    errors.push('Duration must be between 1 and 10 seconds');
  }

  // Validate FPS
  if (![24, 30].includes(settings.fps)) {
    errors.push('FPS must be either 24 or 30');
  }

  // Validate resolution
  const validResolutions = ['1280x720', '1920x1080'];
  if (!validResolutions.includes(settings.resolution)) {
    errors.push('Invalid resolution selected');
  }

  // Validate mode
  const validModes = ['VERTICAL_FIRST', 'HORIZONTAL'];
  if (!validModes.includes(settings.mode)) {
    errors.push('Invalid generation mode');
  }

  // Suggestions based on settings
  if (settings.duration > 8) {
    suggestions.push('Longer videos take more time and cost more to generate');
  }

  if (settings.fps === 24) {
    suggestions.push('24 FPS provides a cinematic look');
  } else if (settings.fps === 30) {
    suggestions.push('30 FPS is standard for social media content');
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions
  };
}

/**
 * Validate export settings
 */
export function validateExportSettings(settings: {
  exportType: string;
  resolution: string;
  fps: number;
  cropX?: number;
  cropY?: number;
}): ValidationResult {
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Validate export type
  const validExportTypes = ['METADATA_ROTATE', 'GUARANTEED_UPRIGHT', 'HORIZONTAL', 'SCALE_PAD'];
  if (!validExportTypes.includes(settings.exportType)) {
    errors.push('Invalid export type');
  }

  // Validate resolution for vertical exports
  if (settings.exportType !== 'HORIZONTAL') {
    const verticalResolutions = ['1080x1920', '720x1280'];
    if (!verticalResolutions.includes(settings.resolution)) {
      errors.push('Invalid vertical resolution');
    }
  }

  // Validate crop coordinates
  if (settings.cropX !== undefined && (settings.cropX < 0 || settings.cropX > 1920)) {
    errors.push('Invalid crop X coordinate');
  }

  if (settings.cropY !== undefined && (settings.cropY < 0 || settings.cropY > 1080)) {
    errors.push('Invalid crop Y coordinate');
  }

  // Suggestions
  if (settings.exportType === 'METADATA_ROTATE') {
    suggestions.push('Fast export - may not work on all platforms');
  } else if (settings.exportType === 'GUARANTEED_UPRIGHT') {
    suggestions.push('Slower but works everywhere - recommended for social media');
  }

  return {
    isValid: errors.length === 0,
    errors,
    suggestions
  };
}

/**
 * General form validation helper
 */
export function validateForm<T extends Record<string, any>>(
  data: T,
  validators: Record<keyof T, (value: any) => ValidationResult>
): ValidationResult & { fieldErrors: Record<keyof T, ValidationResult> } {
  const fieldErrors: Record<keyof T, ValidationResult> = {} as any;
  const allErrors: string[] = [];
  const allSuggestions: string[] = [];

  // Validate each field
  for (const [field, validator] of Object.entries(validators) as [keyof T, (value: any) => ValidationResult][]) {
    const result = validator(data[field]);
    fieldErrors[field] = result;
    
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
    
    if (result.suggestions.length > 0) {
      allSuggestions.push(...result.suggestions);
    }
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    suggestions: allSuggestions,
    fieldErrors
  };
}
