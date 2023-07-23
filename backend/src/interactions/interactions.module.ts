import { Module } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { InteractionsController } from './interactions.controller';

@Module({
  providers: [InteractionsService],
  controllers: [InteractionsController],
  exports: [InteractionsService]
})
export class InteractionsModule {}
