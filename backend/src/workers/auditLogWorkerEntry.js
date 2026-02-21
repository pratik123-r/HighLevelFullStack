import dotenv from 'dotenv';
import { connectMongoDB, disconnectDatabases } from '../config/database.js';
import { AuditLogWorker } from './auditLogWorker.js';

dotenv.config();

async function startAuditLogWorker() {
  try {
    console.log('Starting Audit Log Worker...');

    await connectMongoDB();

    const worker = new AuditLogWorker();

    console.log('Audit Log Worker started successfully');
    console.log('Listening for audit log jobs...');

    const shutdown = async () => {
      console.log('Shutting down Audit Log Worker...');
      await worker.close();
      await disconnectDatabases();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start Audit Log Worker:', error);
    process.exit(1);
  }
}

startAuditLogWorker();

