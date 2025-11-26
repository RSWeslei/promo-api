import { Logger, Provider } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { ApiService } from '../../api/api.service'
import { ApiClient } from '../../api/api.types'

export const COSMOS_API_CLIENT = 'COSMOS_API_CLIENT'

export const CosmosApiProvider: Provider<ApiClient> = {
    provide: COSMOS_API_CLIENT,
    inject: [ConfigService, ApiService],
    useFactory: (configService: ConfigService, apiService: ApiService) => {
        const logger = new Logger('CosmosApiProvider')
        const token = configService.get<string>('COSMOS_TOKEN') ?? ''
        const baseUrl = configService.get<string>('COSMOS_BASE_URL') ?? 'https://api.cosmos.bluesoft.com.br'

        if (!token) {
            logger.warn('COSMOS_TOKEN is not set; Cosmos API requests will fail')
        }

        return apiService.createClient({
            baseUrl,
            defaultHeaders: { 'X-Cosmos-Token': token },
        })
    },
}
