import { Module } from '@nestjs/common'

import { CosmosController } from './cosmos.controller'
import { StorageModule } from '../storage/storage.module'
import { CosmosApiProvider } from './providers/cosmos.provider'
import { CosmosService } from './services/cosmos.service'

@Module({
    imports: [StorageModule],
    controllers: [CosmosController],
    providers: [CosmosApiProvider, CosmosService],
})
export class CosmosModule {}
