const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class SecurityManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  /**
   * Get or create encryption key for sensitive data
   */
  getOrCreateEncryptionKey() {
    const keyEnv = process.env.AI_ENCRYPTION_KEY;
    if (keyEnv) {
      return Buffer.from(keyEnv, 'hex');
    }

    // Generate a new key if not provided
    const key = crypto.randomBytes(this.keyLength);
    console.warn('⚠️  No AI_ENCRYPTION_KEY found in environment. Generated temporary key.');
    console.warn('   For production, set AI_ENCRYPTION_KEY in your .env file:');
    console.warn(`   AI_ENCRYPTION_KEY=${key.toString('hex')}`);
    
    return key;
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data) {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey, { iv });
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData) {
    try {
      const { encrypted, iv, tag } = encryptedData;
      
      const decipher = crypto.createDecipher(
        this.algorithm, 
        this.encryptionKey, 
        { iv: Buffer.from(iv, 'hex') }
      );
      
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Sanitize contract data for AI analysis
   */
  sanitizeContractData(contractData) {
    if (!contractData) return null;

    const sanitized = JSON.parse(JSON.stringify(contractData));

    // Remove or anonymize sensitive information
    if (sanitized.address) {
      sanitized.address = this.anonymizeAddress(sanitized.address);
    }

    if (sanitized.results && typeof sanitized.results === 'object') {
      Object.keys(sanitized.results).forEach(key => {
        const result = sanitized.results[key];
        if (result && typeof result === 'object') {
          // Remove transaction hashes
          if (result.transactionHash) {
            delete result.transactionHash;
          }
          
          // Remove block numbers and timestamps that could be identifying
          if (result.blockNumber) {
            delete result.blockNumber;
          }
          
          if (result.timestamp) {
            delete result.timestamp;
          }

          // Anonymize any addresses in the results
          if (result.from) {
            result.from = this.anonymizeAddress(result.from);
          }
          if (result.to) {
            result.to = this.anonymizeAddress(result.to);
          }
        }
      });
    }

    return sanitized;
  }

  /**
   * Anonymize Ethereum addresses
   */
  anonymizeAddress(address) {
    if (!address || typeof address !== 'string') return address;
    
    // Keep the 0x prefix and first 4 characters, anonymize the rest
    if (address.startsWith('0x') && address.length === 42) {
      return `0x${address.slice(2, 6)}...${address.slice(-4)}`;
    }
    
    return '[ADDRESS]';
  }

  /**
   * Validate API key format and strength
   */
  validateApiKey(apiKey, provider = 'unknown', allowFallback = true) {
    if (!apiKey || typeof apiKey !== 'string') {
      if (allowFallback) {
        return { valid: false, reason: `No API key provided for ${provider}`, allowFallback: true };
      }
      throw new Error(`Invalid API key format for ${provider}`);
    }

    // Basic validation rules
    const validations = {
      iointelligence: {
        minLength: 20,
        pattern: /^[a-zA-Z0-9._-]+$/
      },
      openai: {
        minLength: 40,
        pattern: /^sk-[a-zA-Z0-9]+$/
      },
      anthropic: {
        minLength: 30,
        pattern: /^[a-zA-Z0-9._-]+$/
      }
    };

    const validation = validations[provider] || validations.iointelligence;
    
    if (apiKey.length < validation.minLength) {
      if (allowFallback) {
        return { valid: false, reason: `API key too short for ${provider} (minimum ${validation.minLength} characters)`, allowFallback: true };
      }
      throw new Error(`API key too short for ${provider} (minimum ${validation.minLength} characters)`);
    }

    if (!validation.pattern.test(apiKey)) {
      if (allowFallback) {
        return { valid: false, reason: `Invalid API key format for ${provider}`, allowFallback: true };
      }
      throw new Error(`Invalid API key format for ${provider}`);
    }

    return { valid: true, reason: 'API key is valid' };
  }

  /**
   * Secure HTTP headers for API requests
   */
  getSecureHeaders(apiKey, provider = 'iointelligence') {
    const baseHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Somnia-Gas-Profiler/1.0',
      'Accept': 'application/json'
    };

    // Add provider-specific authentication
    switch (provider) {
      case 'openai':
        baseHeaders['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'anthropic':
        baseHeaders['x-api-key'] = apiKey;
        baseHeaders['anthropic-version'] = '2023-06-01';
        break;
      case 'iointelligence':
      default:
        baseHeaders['Authorization'] = `Bearer ${apiKey}`;
        break;
    }

    return baseHeaders;
  }

  /**
   * Rate limiting for API calls
   */
  createRateLimiter(maxRequests = 10, windowMs = 60000) {
    const requests = new Map();
    
    return {
      checkLimit: (identifier = 'default') => {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Clean old requests
        if (requests.has(identifier)) {
          const userRequests = requests.get(identifier).filter(time => time > windowStart);
          requests.set(identifier, userRequests);
        } else {
          requests.set(identifier, []);
        }
        
        const currentRequests = requests.get(identifier);
        
        if (currentRequests.length >= maxRequests) {
          const oldestRequest = Math.min(...currentRequests);
          const resetTime = oldestRequest + windowMs;
          throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((resetTime - now) / 1000)} seconds.`);
        }
        
        // Add current request
        currentRequests.push(now);
        return true;
      },
      
      getRemainingRequests: (identifier = 'default') => {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        if (!requests.has(identifier)) {
          return maxRequests;
        }
        
        const currentRequests = requests.get(identifier).filter(time => time > windowStart);
        return Math.max(0, maxRequests - currentRequests.length);
      }
    };
  }

  /**
   * Secure temporary file handling
   */
  async createSecureTempFile(data, prefix = 'secure-temp') {
    try {
      const tempDir = process.env.TEMP_DIR || path.join(process.cwd(), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.json`;
      const filepath = path.join(tempDir, filename);
      
      // Encrypt data before writing
      const encryptedData = this.encrypt(data);
      await fs.writeFile(filepath, JSON.stringify(encryptedData), { mode: 0o600 });
      
      return {
        filepath,
        cleanup: async () => {
          try {
            await fs.unlink(filepath);
          } catch (error) {
            console.warn(`Failed to cleanup temp file ${filepath}: ${error.message}`);
          }
        }
      };
    } catch (error) {
      throw new Error(`Failed to create secure temp file: ${error.message}`);
    }
  }

  /**
   * Read and decrypt secure temporary file
   */
  async readSecureTempFile(filepath) {
    try {
      const encryptedContent = await fs.readFile(filepath, 'utf8');
      const encryptedData = JSON.parse(encryptedContent);
      return this.decrypt(encryptedData);
    } catch (error) {
      throw new Error(`Failed to read secure temp file: ${error.message}`);
    }
  }

  /**
   * Audit log for security events
   */
  async logSecurityEvent(event, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details: this.sanitizeLogDetails(details),
      sessionId: this.getSessionId()
    };

    try {
      const logDir = path.join(process.cwd(), 'logs');
      await fs.mkdir(logDir, { recursive: true });
      
      const logFile = path.join(logDir, `security-${new Date().toISOString().split('T')[0]}.log`);
      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Failed to write security log:', error.message);
    }
  }

  /**
   * Sanitize log details to remove sensitive information
   */
  sanitizeLogDetails(details) {
    const sanitized = JSON.parse(JSON.stringify(details));
    
    // Remove sensitive keys
    const sensitiveKeys = ['apiKey', 'privateKey', 'password', 'token', 'secret'];
    
    const sanitizeObject = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      Object.keys(obj).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      });
    };
    
    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * Generate session ID for tracking
   */
  getSessionId() {
    if (!this.sessionId) {
      this.sessionId = crypto.randomBytes(16).toString('hex');
    }
    return this.sessionId;
  }

  /**
   * Sanitize input data to prevent injection attacks
   */
  sanitizeInput(data) {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    // Handle arrays properly
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeInput(item));
    }

    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined || value === null) {
        // Preserve undefined and null values to maintain object structure
        sanitized[key] = value;
      } else if (typeof value === 'string') {
        // Remove potentially dangerous characters and limit length
        sanitized[key] = value
          .replace(/[<>"'&]/g, '') // Remove HTML/XML characters
          .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control characters
          .substring(0, 10000); // Limit length
      } else if (Array.isArray(value)) {
        // Handle arrays properly
        sanitized[key] = value.map(item => this.sanitizeInput(item));
      } else if (typeof value === 'object') {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitizeInput(value);
      } else {
        // Keep other types as-is (numbers, booleans, etc.)
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Validate environment security configuration
   */
  validateSecurityConfig() {
    const issues = [];
    
    // Check for required security settings
    if (process.env.AI_ENCRYPT_SENSITIVE_DATA !== 'true') {
      issues.push('AI_ENCRYPT_SENSITIVE_DATA should be set to true for production');
    }
    
    if (process.env.AI_ANONYMIZE_CONTRACT_DATA !== 'true') {
      issues.push('AI_ANONYMIZE_CONTRACT_DATA should be set to true for privacy');
    }
    
    if (process.env.AI_SECURE_TRANSMISSION !== 'true') {
      issues.push('AI_SECURE_TRANSMISSION should be set to true for secure API calls');
    }
    
    if (!process.env.AI_ENCRYPTION_KEY) {
      issues.push('AI_ENCRYPTION_KEY should be set for data encryption');
    }
    
    // Check API key presence
    const provider = process.env.AI_PROVIDER || 'iointelligence';
    const apiKeyVar = provider === 'openai' ? 'OPENAI_API_KEY' : 
                     provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 
                     'IOINTELLIGENCE_API_KEY';
    
    if (!process.env[apiKeyVar]) {
      issues.push(`${apiKeyVar} is required for AI analysis`);
    }
    
    return {
      isSecure: issues.length === 0,
      issues,
      recommendations: issues.length > 0 ? [
        'Review your .env configuration',
        'Enable all security features for production use',
        'Ensure API keys are properly configured'
      ] : []
    };
  }
}

module.exports = SecurityManager;