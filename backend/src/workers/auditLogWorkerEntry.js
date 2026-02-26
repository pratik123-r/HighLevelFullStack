import dotenv from 'dotenv';
import { connectMongoDB, disconnectDatabases } from '../config/database.js';
import { SeatRepository } from '../repositories/SeatRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { AdminRepository } from '../repositories/AdminRepository.js';
import { ShowRepository } from '../repositories/ShowRepository.js';
import { BookingRepository } from '../repositories/BookingRepository.js';
import { AuditService } from '../services/AuditService.js';
import { QueueService } from '../services/QueueService.js';
import { AuditLogWorker } from './auditLogWorker.js';

dotenv.config();

async function startAuditLogWorker() {
  try {
    console.log('Starting Audit Log Worker...');

    await connectMongoDB();

    const seatRepository = new SeatRepository();
    const userRepository = new UserRepository();
    const adminRepository = new AdminRepository();
    const showRepository = new ShowRepository();
    const bookingRepository = new BookingRepository();
    const queueService = new QueueService();
    const auditService = new AuditService(
      queueService,
      userRepository,
      adminRepository,
      showRepository,
      bookingRepository,
      seatRepository
    );

    const worker = new AuditLogWorker(auditService, seatRepository);

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

