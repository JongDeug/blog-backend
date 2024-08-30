import { createClient } from 'redis';

const redisClient = createClient({ password: process.env.REDIS_PWD });

export default redisClient;
