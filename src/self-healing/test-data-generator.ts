import { faker } from '@faker-js/faker';
import { queryOllama } from '../orchestration/llm-provider.js';
import { TEST_DATA_GENERATION_PROMPT } from '../orchestration/prompts.js';
import { Logger } from '../utils/logger.js';
import { TestDataSchema } from '../orchestration/schemas.js';

const logger = new Logger('TestDataGenerator');

export type DataType = 'user' | 'product' | 'order' | 'address' | 'payment' | 'custom';

export interface GeneratedData {
  type: DataType;
  data: Record<string, any>;
  context?: string;
}

export class TestDataGenerator {
  private cache: Map<string, GeneratedData> = new Map();

  /**
   * Generate realistic test data using Faker.js (fast, deterministic)
   */
  generateBasicData(type: DataType): GeneratedData {
    const cacheKey = `basic:${type}:${Date.now()}`;
    
    let data: Record<string, any> = {};

    switch (type) {
      case 'user':
        data = {
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          email: faker.internet.email().toLowerCase(),
          username: faker.internet.userName().toLowerCase(),
          password: 'Test123!@#', // Standard test password
          phone: faker.phone.number(),
          dateOfBirth: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }),
        };
        break;

      case 'address':
        data = {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          zipCode: faker.location.zipCode(),
          country: 'United States',
        };
        break;

      case 'payment':
        data = {
          cardNumber: faker.finance.creditCardNumber('#### #### #### ####'),
          cardHolder: faker.person.fullName(),
          expiryMonth: faker.number.int({ min: 1, max: 12 }).toString().padStart(2, '0'),
          expiryYear: faker.number.int({ min: 2026, max: 2030 }).toString(),
          cvv: faker.number.int({ min: 100, max: 999 }).toString(),
        };
        break;

      case 'product':
        data = {
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          price: parseFloat(faker.commerce.price()),
          category: faker.commerce.department(),
          sku: faker.string.alphanumeric(10).toUpperCase(),
        };
        break;

      case 'order':
        data = {
          orderId: faker.string.uuid(),
          orderDate: faker.date.recent(),
          deliveryDate: faker.date.soon(),
          trackingNumber: faker.string.alphanumeric(16).toUpperCase(),
          total: parseFloat(faker.commerce.price({ min: 20, max: 500 })),
        };
        break;

      default:
        data = {
          id: faker.string.uuid(),
          name: faker.person.fullName(),
          value: faker.number.int({ min: 1, max: 1000 }),
        };
    }

    const result: GeneratedData = { type, data };
    this.cache.set(cacheKey, result);
    
    logger.debug(`Generated basic ${type} data`);
    return result;
  }

  /**
   * Generate contextually intelligent test data using LLM (slower, more accurate)
   */
  async generateContextualData(
    type: DataType,
    context: string,
    requirements?: Record<string, any>
  ): Promise<GeneratedData> {
    const cacheKey = `contextual:${type}:${context}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug(`Using cached contextual data for: ${type}`);
      return cached;
    }

    try {
      logger.info(`Generating contextual ${type} data with LLM`);
      
      const prompt = await TEST_DATA_GENERATION_PROMPT.format({
        dataType: type,
        context,
        applicationDomain: 'E-commerce and general web applications',
        requirements: requirements ? JSON.stringify(requirements, null, 2) : 'None specified',
      });

      const responseText = await queryOllama(
        `You are an expert at generating realistic test data. Output valid JSON only.\n${prompt}`
      );

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from LLM response');
      }

      const parsed = TestDataSchema.parse(JSON.parse(jsonMatch[0]));
      
      const result: GeneratedData = {
        type,
        data: parsed.fields,
        context: parsed.context,
      };

      this.cache.set(cacheKey, result);
      logger.info(`Generated contextual ${type} data`);
      
      return result;
    } catch (error) {
      logger.error('Failed to generate contextual data with LLM', error);
      
      // Fallback to basic generation
      logger.info('Falling back to basic data generation');
      return this.generateBasicData(type);
    }
  }

  /**
   * Generate a complete user profile
   */
  generateUserProfile(): GeneratedData {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const username = `${firstName.toLowerCase()}_${faker.number.int({ min: 100, max: 999 })}`;

    const data = {
      // Basic Info
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      email: `${username}@test-${faker.string.alphanumeric(5)}.com`.toLowerCase(),
      username,
      password: 'TestUser123!@#',
      
      // Demographics
      dateOfBirth: faker.date.birthdate({ min: 18, max: 65, mode: 'age' }),
      gender: faker.helpers.arrayElement(['Male', 'Female', 'Other', 'Prefer not to say']),
      
      // Contact
      phone: faker.phone.number(),
      
      // Address
      address: {
        street: faker.location.streetAddress(),
        apt: faker.helpers.maybe(() => `Apt ${faker.number.int({ min: 1, max: 999 })}`) || '',
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: 'United States',
      },
      
      // Preferences
      newsletter: faker.datatype.boolean(),
      notifications: faker.datatype.boolean(),
    };

    return {
      type: 'user',
      data,
      context: 'Complete user registration profile',
    };
  }

  /**
   * Generate checkout data (address + payment)
   */
  generateCheckoutData(): GeneratedData {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    const data = {
      shipping: {
        firstName,
        lastName,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        phone: faker.phone.number(),
        address: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: 'United States',
      },
      billing: {
        sameAsShipping: true,
      },
      payment: {
        method: 'credit_card',
        cardNumber: faker.finance.creditCardNumber('#### #### #### ####'),
        cardHolder: `${firstName} ${lastName}`,
        expiryMonth: faker.number.int({ min: 1, max: 12 }).toString().padStart(2, '0'),
        expiryYear: faker.number.int({ min: 2026, max: 2030 }).toString(),
        cvv: faker.number.int({ min: 100, max: 999 }).toString(),
      },
    };

    return {
      type: 'custom',
      data,
      context: 'Complete checkout information',
    };
  }

  /**
   * Generate unique email for testing
   */
  generateUniqueEmail(prefix?: string): string {
    const timestamp = Date.now();
    const random = faker.string.alphanumeric(6);
    const domain = 'test-agentic-qa.com';
    
    if (prefix) {
      return `${prefix}_${timestamp}_${random}@${domain}`.toLowerCase();
    }
    
    return `user_${timestamp}_${random}@${domain}`.toLowerCase();
  }

  /**
   * Clear data cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Test data cache cleared');
  }
}

// Export singleton instance
export const testDataGenerator = new TestDataGenerator();
