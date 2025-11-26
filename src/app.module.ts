import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_INTERCEPTOR } from '@nestjs/core'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'
import { ApiModule } from './modules/api/api.module'
import { CosmosModule } from './modules/cosmos/cosmos.module'
import { StorageModule } from './modules/storage/storage.module'

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        ApiModule,
        CosmosModule,
        StorageModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        {
            provide: APP_INTERCEPTOR,
            useClass: ResponseInterceptor,
        },
    ],
})
export class AppModule {}
