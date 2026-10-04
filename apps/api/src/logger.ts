import pino from 'pino';

export function createLogger(level: pino.LevelWithSilent = 'info') {
  return pino({
    level,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      remove: true,
    },
  });
}
