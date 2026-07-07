CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AppearanceMode" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "ResponseMode" AS ENUM ('NORMAL', 'ADVANCED');

-- CreateEnum
CREATE TYPE "ChatMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('AVATAR', 'CHAT_ATTACHMENT', 'IMAGE_ATTACHMENT', 'AUDIO_ATTACHMENT', 'VIDEO_ATTACHMENT', 'DOCUMENT_ATTACHMENT', 'KNOWLEDGE_IMPORT');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('CALL_TEXT', 'CLIENT_CHAT', 'DOCUMENT_TEXT', 'FAQ', 'MANUAL');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('PHONE', 'WHATSAPP', 'TELEGRAM', 'WEBSITE', 'CRM', 'EMAIL', 'MANUAL');

-- CreateEnum
CREATE TYPE "KnowledgeConversationStatus" AS ENUM ('DRAFT', 'READY', 'PROCESSING', 'INDEXED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SenderRole" AS ENUM ('CLIENT', 'MANAGER', 'ASSISTANT', 'SYSTEM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "KnowledgeChunkType" AS ENUM ('FULL_CONVERSATION', 'DIALOG_FRAGMENT', 'CLIENT_QUESTION', 'MANAGER_ANSWER', 'SUMMARY', 'OBJECTION', 'PRICE_DISCUSSION', 'DELIVERY_DISCUSSION', 'PRODUCT_CONSULTATION', 'PAYMENT_DISCUSSION');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('CREATED', 'UPLOADED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportItemStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "username" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "avatarFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "appearance" "AppearanceMode" NOT NULL DEFAULT 'SYSTEM',
    "assistantVoice" TEXT NOT NULL DEFAULT 'Cherry',
    "assistantModel" TEXT NOT NULL DEFAULT 'qwen-plus',
    "responseMode" "ResponseMode" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Новый чат',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT,
    "role" "ChatMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "responseMode" "ResponseMode",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "bucket" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT,
    "sizeBytes" BIGINT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "uploadedById" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'CREATED',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeConversation" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "channel" "ConversationChannel" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "managerName" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "productName" TEXT,
    "city" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "conversationDate" TIMESTAMP(3),
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT,
    "summary" TEXT,
    "clientIntent" TEXT,
    "result" TEXT,
    "status" "KnowledgeConversationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "senderRole" "SenderRole" NOT NULL DEFAULT 'UNKNOWN',
    "senderName" TEXT,
    "text" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "chunkType" "KnowledgeChunkType" NOT NULL,
    "text" TEXT NOT NULL,
    "cleanText" TEXT,
    "summary" TEXT,
    "productName" TEXT,
    "city" TEXT,
    "managerName" TEXT,
    "clientIntent" TEXT,
    "objection" TEXT,
    "metadata" JSONB,
    "qualityScore" DOUBLE PRECISION,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeInsight" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "productNames" JSONB,
    "clientQuestions" JSONB,
    "managerAnswers" JSONB,
    "objections" JSONB,
    "priceMentions" JSONB,
    "deliveryMentions" JSONB,
    "paymentMentions" JSONB,
    "nextSteps" JSONB,
    "sentiment" TEXT,
    "result" TEXT,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "uploadedById" TEXT,
    "title" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'CREATED',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceFileId" TEXT,
    "conversationId" TEXT,
    "externalId" TEXT,
    "originalName" TEXT,
    "rowNumber" INTEGER,
    "status" "ImportItemStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "Chat_userId_idx" ON "Chat"("userId");

-- CreateIndex
CREATE INDEX "Chat_isPinned_idx" ON "Chat"("isPinned");

-- CreateIndex
CREATE INDEX "Chat_isDeleted_idx" ON "Chat"("isDeleted");

-- CreateIndex
CREATE INDEX "Chat_lastMessageAt_idx" ON "Chat"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Message_chatId_idx" ON "Message"("chatId");

-- CreateIndex
CREATE INDEX "Message_userId_idx" ON "Message"("userId");

-- CreateIndex
CREATE INDEX "Message_role_idx" ON "Message"("role");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "MessageAttachment_fileId_idx" ON "MessageAttachment"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "File_s3Key_key" ON "File"("s3Key");

-- CreateIndex
CREATE INDEX "File_ownerId_idx" ON "File"("ownerId");

-- CreateIndex
CREATE INDEX "File_fileType_idx" ON "File"("fileType");

-- CreateIndex
CREATE INDEX "File_uploadStatus_idx" ON "File"("uploadStatus");

-- CreateIndex
CREATE INDEX "File_processingStatus_idx" ON "File"("processingStatus");

-- CreateIndex
CREATE INDEX "KnowledgeSource_sourceType_idx" ON "KnowledgeSource"("sourceType");

-- CreateIndex
CREATE INDEX "KnowledgeSource_status_idx" ON "KnowledgeSource"("status");

-- CreateIndex
CREATE INDEX "KnowledgeSource_uploadedById_idx" ON "KnowledgeSource"("uploadedById");

-- CreateIndex
CREATE INDEX "KnowledgeConversation_sourceId_idx" ON "KnowledgeConversation"("sourceId");

-- CreateIndex
CREATE INDEX "KnowledgeConversation_sourceType_idx" ON "KnowledgeConversation"("sourceType");

-- CreateIndex
CREATE INDEX "KnowledgeConversation_channel_idx" ON "KnowledgeConversation"("channel");

-- CreateIndex
CREATE INDEX "KnowledgeConversation_managerName_idx" ON "KnowledgeConversation"("managerName");

-- CreateIndex
CREATE INDEX "KnowledgeConversation_productName_idx" ON "KnowledgeConversation"("productName");

-- CreateIndex
CREATE INDEX "KnowledgeConversation_city_idx" ON "KnowledgeConversation"("city");

-- CreateIndex
CREATE INDEX "KnowledgeConversation_conversationDate_idx" ON "KnowledgeConversation"("conversationDate");

-- CreateIndex
CREATE INDEX "KnowledgeConversation_status_idx" ON "KnowledgeConversation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeConversation_sourceId_externalId_key" ON "KnowledgeConversation"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "KnowledgeMessage_conversationId_idx" ON "KnowledgeMessage"("conversationId");

-- CreateIndex
CREATE INDEX "KnowledgeMessage_senderRole_idx" ON "KnowledgeMessage"("senderRole");

-- CreateIndex
CREATE INDEX "KnowledgeMessage_orderIndex_idx" ON "KnowledgeMessage"("orderIndex");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_conversationId_idx" ON "KnowledgeChunk"("conversationId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_chunkType_idx" ON "KnowledgeChunk"("chunkType");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_productName_idx" ON "KnowledgeChunk"("productName");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_city_idx" ON "KnowledgeChunk"("city");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_managerName_idx" ON "KnowledgeChunk"("managerName");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_isApproved_idx" ON "KnowledgeChunk"("isApproved");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_isArchived_idx" ON "KnowledgeChunk"("isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeInsight_conversationId_key" ON "KnowledgeInsight"("conversationId");

-- CreateIndex
CREATE INDEX "ImportBatch_sourceId_idx" ON "ImportBatch"("sourceId");

-- CreateIndex
CREATE INDEX "ImportBatch_uploadedById_idx" ON "ImportBatch"("uploadedById");

-- CreateIndex
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");

-- CreateIndex
CREATE INDEX "ImportItem_batchId_idx" ON "ImportItem"("batchId");

-- CreateIndex
CREATE INDEX "ImportItem_sourceFileId_idx" ON "ImportItem"("sourceFileId");

-- CreateIndex
CREATE INDEX "ImportItem_conversationId_idx" ON "ImportItem"("conversationId");

-- CreateIndex
CREATE INDEX "ImportItem_status_idx" ON "ImportItem"("status");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeConversation" ADD CONSTRAINT "KnowledgeConversation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeMessage" ADD CONSTRAINT "KnowledgeMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "KnowledgeConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "KnowledgeConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeInsight" ADD CONSTRAINT "KnowledgeInsight_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "KnowledgeConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "KnowledgeConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
