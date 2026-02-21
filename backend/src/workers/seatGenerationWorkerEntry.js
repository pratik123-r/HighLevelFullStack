import dotenv from 'dotenv';
import { connectMongoDB, disconnectDatabases } from '../config/database.js';
import { SeatRepository } from '../repositories/SeatRepository.js';
import { ShowRepository } from '../repositories/ShowRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { AdminRepository } from '../repositories/AdminRepository.js';
import { BookingRepository } from '../repositories/BookingRepository.js';
import { AuditService } from '../services/AuditService.js';
import { QueueService } from '../services/QueueService.js';
import { SeatGenerationWorker } from './seatGenerationWorker.js';

dotenv.config();

async function startSeatGenerationWorker() {
  try {
    console.log('Starting Seat Generation Worker...');

    await connectMongoDB();

    const seatRepository = new SeatRepository();
    const showRepository = new ShowRepository();
    const userRepository = new UserRepository();
    const adminRepository = new AdminRepository();
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

    const worker = new SeatGenerationWorker(
      seatRepository,
      showRepository,
      auditService
    );

    console.log('Seat Generation Worker started successfully');
    console.log('Listening for seat generation jobs...');

    const shutdown = async () => {
      console.log('Shutting down Seat Generation Worker...');
      await worker.close();
      await disconnectDatabases();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start Seat Generation Worker:', error);
    process.exit(1);
  }
}

startSeatGenerationWorker();

