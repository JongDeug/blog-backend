import { createClient } from 'redis';

const redisClient = createClient({
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PWD,
});

export default redisClient;
