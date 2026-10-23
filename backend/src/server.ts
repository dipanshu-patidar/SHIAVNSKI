import { app } from './app.js';
import { config } from './config/index.js';

const server = app.listen(config.PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 Voice Agent Management Backend API Started`);
  console.log(`📡 URL: http://localhost:${config.PORT}`);
  console.log(`🩺 Health: http://localhost:${config.PORT}/api/health`);
  console.log(`⚙️  Environment: ${config.NODE_ENV}`);
  console.log(`🎙️  Provider Mode: ${config.PROVIDER_MODE.toUpperCase()}`);
  console.log(`=================================================`);
});

// Graceful Shutdown Handlers
function shutdown(signal: string) {
  console.log(`\nReceived ${signal}. Gracefully shutting down HTTP server...`);
  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  // Force shutdown if connections do not close within 5 seconds
  setTimeout(() => {
    console.error('Forcefully terminating process after timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
