import { CatalogService } from './catalog/catalog.service.js';
import { RoomController } from './rooms/room.controller.js';
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';
import { AuthService } from './auth/auth.service.js';
import { AuthController, HealthController } from './auth/auth.controller.js';
import { RoomRepository } from './rooms/room.repository.js';
import { RoomService } from './rooms/room.service.js';
import { DrawService } from './draws/draw.service.js';
import { RoundService } from './rounds/round.service.js';
import { ReviewService } from './review/review.service.js';
import { ScoringService } from './scoring/scoring.service.js';
import { GameEngine } from './game/engine.service.js';
import { GameGateway } from './gateway/game.gateway.js';
import { DeadlinesService } from './jobs/deadlines.service.js';
@Module({
  controllers: [AuthController, HealthController, RoomController],
  providers: [
    PrismaService,
    CatalogService,
    AuthService,
    RoomRepository,
    RoomService,
    DrawService,
    ReviewService,
    ScoringService,
    {
      provide: RoundService,
      useFactory: (draw: DrawService, review: ReviewService) => new RoundService(draw, review),
      inject: [DrawService, ReviewService],
    },
    {
      provide: GameEngine,
      useFactory: (
        draw: DrawService,
        rounds: RoundService,
        review: ReviewService,
        score: ScoringService,
      ) => new GameEngine(draw, rounds, review, score),
      inject: [DrawService, RoundService, ReviewService, ScoringService],
    },
    GameGateway,
    DeadlinesService,
  ],
})
export class AppModule {}
