import mongoose, { Schema } from 'mongoose';

export const OperationType = {
  BOOK: 'BOOK',
  CANCEL: 'CANCEL',
  LOCK: 'LOCK',
  SEAT_GENERATION: 'SEAT_GENERATION',
};

export const AuditOutcome = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
};

const AuditLogSchema = new Schema(
  {
    operationType: {
      type: String,
      enum: Object.values(OperationType),
      required: true,
      index: true,
    },
    eventId: { type: String, index: true },
    showId: { type: String, index: true },
    userId: { type: String, index: true },
    seatId: { type: String, index: true },
    bookingId: { type: String, index: true },
    adminId: { type: String, index: true },
    outcome: {
      type: String,
      enum: Object.values(AuditOutcome),
      required: true,
      index: true,
    },
    reason: String,
    metadata: Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
  }
);

AuditLogSchema.index({ showId: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ operationType: 1, outcome: 1, timestamp: -1 });

export const AuditLog = mongoose.model('AuditLog', AuditLogSchema, 'audit_logs');

