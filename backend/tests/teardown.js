// Global teardown to close all connections after tests
export default async () => {
  try {
    // Close Redis connections if they exist
    const { redis } = await import('../src/config/redis.js');
    if (redis && typeof redis.quit === 'function') {
      await redis.quit().catch(() => {});
    }
    if (redis && typeof redis.disconnect === 'function') {
      redis.disconnect();
    }
  } catch (error) {
    // Ignore errors if redis module doesn't exist or is mocked
  }

  try {
    // Close Prisma and MongoDB connections
    const { disconnectDatabases } = await import('../src/config/database.js');
    if (disconnectDatabases) {
      await disconnectDatabases().catch(() => {});
    }
  } catch (error) {
    // Ignore errors if database module doesn't exist or is mocked
  }

  // Give Node.js time to close connections
  await new Promise(resolve => setTimeout(resolve, 100));
};

