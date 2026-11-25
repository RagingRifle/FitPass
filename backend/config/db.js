const prisma = require('./prisma');
const logger = require('../lib/logger');

const connectDB = async (retries = 8, delay = 4000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      // Run a simple raw query to test the PostgreSQL connection.
      await prisma.$queryRaw`SELECT 1`;
      logger.info('PostgreSQL connected successfully via Prisma');
      return;
    } catch (error) {
      logger.error({ err: error, attempt: i, retries }, 'PostgreSQL connection attempt failed');
      if (i === retries) {
        logger.warn('PostgreSQL connection warning: the database could not be reached during startup; the server will remain online and retry on incoming requests');
        return;
      }
      logger.info(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

module.exports = connectDB;
