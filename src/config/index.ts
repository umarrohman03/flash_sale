import dotenv from 'dotenv';

// Load .env file, but don't override existing environment variables
// This allows Docker Compose environment variables to take precedence
dotenv.config({ override: false });

export interface Config {
  server: {
    port: number;
    nodeEnv: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    clusterMode: boolean;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    topicFlashSaleAttempts: string;
    consumerGroup: string;
  };
  postgres: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  flashSale: {
    startTime: Date;
    endTime: Date;
    productId: string;
    totalStock: number;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
  };
  worker: {
    enableConsumer: boolean;
  };
}

export const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    clusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'flash-sale-api',
    topicFlashSaleAttempts: process.env.KAFKA_TOPIC_FLASH_SALE_ATTEMPTS || 'flashsale.attempts',
    consumerGroup: process.env.KAFKA_CONSUMER_GROUP || 'flash-sale-worker-group',
  },
  postgres: {
    host: process.env.POSTGRES_HOST || 'postgres',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'flash_sale',
  },
  flashSale: {
    startTime: new Date(process.env.FLASH_SALE_START_TIME || '2024-01-01T00:00:00Z'),
    endTime: new Date(process.env.FLASH_SALE_END_TIME || '2024-01-01T23:59:59Z'),
    productId: process.env.FLASH_SALE_PRODUCT_ID || 'flash-sale-product-001',
    totalStock: parseInt(process.env.FLASH_SALE_TOTAL_STOCK || '1000', 10),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  worker: {
    enableConsumer: process.env.ENABLE_CONSUMER !== 'false',
  },
};

