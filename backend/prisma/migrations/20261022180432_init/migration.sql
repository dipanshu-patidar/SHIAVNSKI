-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SYNCED', 'PENDING_SYNC', 'SYNC_FAILED');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('INITIATED', 'ONGOING', 'ENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'PENDING_ORPHAN', 'PROCESSED', 'DUPLICATE', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_agent_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "voice_id" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "system_prompt" TEXT NOT NULL,
    "responsiveness" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "interruption_sensitivity" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING_SYNC',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "provider_call_id" TEXT NOT NULL,
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'INITIATED',
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "disconnection_reason" TEXT,
    "transcript_text" TEXT,
    "transcript_object" JSONB,
    "recording_url" TEXT,
    "recording_multi_channel_url" TEXT,
    "summary" TEXT,
    "sentiment" TEXT,
    "call_successful" BOOLEAN,
    "dynamic_variables" JSONB,
    "custom_analysis" JSONB,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'retell',
    "provider_call_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "event_timestamp" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agents_provider_agent_id_key" ON "agents"("provider_agent_id");

-- CreateIndex
CREATE INDEX "agents_user_id_idx" ON "agents"("user_id");

-- CreateIndex
CREATE INDEX "agents_user_id_is_active_idx" ON "agents"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "calls_provider_call_id_key" ON "calls"("provider_call_id");

-- CreateIndex
CREATE INDEX "calls_user_id_created_at_idx" ON "calls"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "calls_user_id_status_idx" ON "calls"("user_id", "status");

-- CreateIndex
CREATE INDEX "calls_user_id_agent_id_idx" ON "calls"("user_id", "agent_id");

-- CreateIndex
CREATE INDEX "calls_user_id_to_number_idx" ON "calls"("user_id", "to_number");

-- CreateIndex
CREATE INDEX "webhook_events_provider_call_id_idx" ON "webhook_events"("provider_call_id");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_provider_call_id_event_type_event_t_key" ON "webhook_events"("provider", "provider_call_id", "event_type", "event_timestamp");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
