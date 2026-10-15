-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "GuestIdentity" (
    "id" UUID NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "hostParticipantId" UUID NOT NULL,
    "phase" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "state" JSONB NOT NULL,
    "creationKey" TEXT NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "guestIdentityId" UUID NOT NULL,
    "nickname" TEXT NOT NULL,
    "normalizedNickname" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservedSlot" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "preferredName" TEXT NOT NULL,
    "claimantId" UUID,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReservedSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entityKind" TEXT NOT NULL,
    "validationMode" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alias" (
    "id" UUID NOT NULL,
    "entityKind" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,

    CONSTRAINT "Alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "configuredRoundCount" INTEGER NOT NULL,
    "roundDurationSeconds" INTEGER NOT NULL,
    "currentRound" INTEGER NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameCategory" (
    "gameId" UUID NOT NULL,
    "categoryId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "GameCategory_pkey" PRIMARY KEY ("gameId","categoryId")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "pickerId" UUID NOT NULL,
    "letter" TEXT,
    "status" TEXT NOT NULL,
    "answeringStartsAt" TIMESTAMP(3),
    "answeringEndsAt" TIMESTAMP(3),
    "reviewEndsAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" UUID NOT NULL,
    "roundId" UUID NOT NULL,
    "categoryId" TEXT NOT NULL,
    "participantId" UUID NOT NULL,
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "canonicalEntityId" TEXT,
    "version" INTEGER NOT NULL,
    "draftUpdatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "invalidReason" TEXT NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerVote" (
    "answerId" UUID NOT NULL,
    "voterParticipantId" UUID NOT NULL,
    "verdict" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerVote_pkey" PRIMARY KEY ("answerId","voterParticipantId")
);

-- CreateTable
CREATE TABLE "AnswerJudgment" (
    "answerId" UUID NOT NULL,
    "verdict" TEXT NOT NULL,
    "resolverId" UUID,
    "reason" TEXT NOT NULL,
    "judgedAt" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL,

    CONSTRAINT "AnswerJudgment_pkey" PRIMARY KEY ("answerId")
);

-- CreateTable
CREATE TABLE "RoundScore" (
    "roundId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "uniqueCount" INTEGER NOT NULL,
    "validCount" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,

    CONSTRAINT "RoundScore_pkey" PRIMARY KEY ("roundId","participantId")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "actorId" UUID,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mutation" (
    "roomId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "mutationId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mutation_pkey" PRIMARY KEY ("roomId","guestId","mutationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestIdentity_sessionHash_key" ON "GuestIdentity"("sessionHash");

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Room_creationKey_key" ON "Room"("creationKey");

-- CreateIndex
CREATE INDEX "Room_expiresAt_idx" ON "Room"("expiresAt");

-- CreateIndex
CREATE INDEX "Participant_roomId_idx" ON "Participant"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_roomId_guestIdentityId_key" ON "Participant"("roomId", "guestIdentityId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservedSlot_roomId_slotNumber_key" ON "ReservedSlot"("roomId", "slotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Alias_entityKind_alias_key" ON "Alias"("entityKind", "alias");

-- CreateIndex
CREATE INDEX "Game_roomId_idx" ON "Game"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "GameCategory_gameId_order_key" ON "GameCategory"("gameId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Round_gameId_number_key" ON "Round"("gameId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_roundId_categoryId_participantId_key" ON "Answer"("roundId", "categoryId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_roomId_revision_key" ON "AuditEvent"("roomId", "revision");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hostParticipantId_fkey" FOREIGN KEY ("hostParticipantId") REFERENCES "Participant"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_guestIdentityId_fkey" FOREIGN KEY ("guestIdentityId") REFERENCES "GuestIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservedSlot" ADD CONSTRAINT "ReservedSlot_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservedSlot" ADD CONSTRAINT "ReservedSlot_claimantId_fkey" FOREIGN KEY ("claimantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCategory" ADD CONSTRAINT "GameCategory_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCategory" ADD CONSTRAINT "GameCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_pickerId_fkey" FOREIGN KEY ("pickerId") REFERENCES "Participant"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerVote" ADD CONSTRAINT "AnswerVote_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerVote" ADD CONSTRAINT "AnswerVote_voterParticipantId_fkey" FOREIGN KEY ("voterParticipantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerJudgment" ADD CONSTRAINT "AnswerJudgment_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerJudgment" ADD CONSTRAINT "AnswerJudgment_resolverId_fkey" FOREIGN KEY ("resolverId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundScore" ADD CONSTRAINT "RoundScore_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundScore" ADD CONSTRAINT "RoundScore_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mutation" ADD CONSTRAINT "Mutation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mutation" ADD CONSTRAINT "Mutation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invariantes de dominio que Prisma no representa como campos del modelo.
ALTER TABLE "Room" ADD CONSTRAINT "Room_capacity_range" CHECK ("capacity" IS NULL OR "capacity" BETWEEN 2 AND 7);
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_slot_range" CHECK ("slotNumber" BETWEEN 1 AND 7);
CREATE UNIQUE INDEX "Participant_active_nickname_key" ON "Participant"("roomId","normalizedNickname") WHERE "leftAt" IS NULL;
CREATE UNIQUE INDEX "Participant_active_slot_key" ON "Participant"("roomId","slotNumber") WHERE "leftAt" IS NULL;
ALTER TABLE "Game" ADD CONSTRAINT "Game_rounds_allowed" CHECK ("configuredRoundCount" IN (3,5,7,10));
ALTER TABLE "Game" ADD CONSTRAINT "Game_duration_allowed" CHECK ("roundDurationSeconds" IN (60,90,120,180));
ALTER TABLE "GameCategory" ADD CONSTRAINT "GameCategory_order_range" CHECK ("order" BETWEEN 0 AND 6);
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_text_length" CHECK (char_length("rawText") <= 80);
ALTER TABLE "RoundScore" ADD CONSTRAINT "RoundScore_range" CHECK ("score" BETWEEN 0 AND 140);
-- Sala y anfitrión se crean dentro de una transacción: la FK se comprueba al commit.
ALTER TABLE "Room" ALTER CONSTRAINT "Room_hostParticipantId_fkey" DEFERRABLE INITIALLY DEFERRED;

-- Cada partida guarda exactamente siete categorías después de confirmar la transacción.
CREATE FUNCTION basta_check_game_categories() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target UUID;
BEGIN
  IF TG_TABLE_NAME = 'Game' THEN
    target := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    target := OLD."gameId";
  ELSE
    target := NEW."gameId";
  END IF;
  IF EXISTS (SELECT 1 FROM "Game" WHERE "id" = target)
     AND (SELECT count(*) FROM "GameCategory" WHERE "gameId" = target) <> 7 THEN
    RAISE EXCEPTION 'Una partida debe conservar exactamente siete categorías';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Game_category_count"
AFTER INSERT OR UPDATE ON "Game" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION basta_check_game_categories();
CREATE CONSTRAINT TRIGGER "GameCategory_count"
AFTER INSERT OR UPDATE OR DELETE ON "GameCategory" DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION basta_check_game_categories();
