import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'

import {
    CosmosGpcSyncResult,
    CosmosGpcWithProducts,
    CosmosNcmWithProducts,
    CosmosProduct,
    CosmosProductsPage,
} from './cosmos.types'
import { CosmosPaginationDto, CosmosProductsQueryDto } from './dto/cosmos-query.dto'
import { CosmosService } from './services/cosmos.service'

@Controller('cosmos')
export class CosmosController {
    constructor(private readonly cosmosService: CosmosService) {}

    @Get('gtins/:code')
    getByGtin(@Param('code') code: string): Promise<CosmosProduct> {
        return this.cosmosService.getGtin(code)
    }

    @Get('gpcs/:code')
    getByGpc(@Param('code') code: string, @Query() pagination: CosmosPaginationDto): Promise<CosmosGpcWithProducts> {
        const { page, next_page } = pagination
        return this.cosmosService.getGpc(code, next_page ?? page)
    }

    @Get('ncms/:code/products')
    getNcmProducts(
        @Param('code') code: string,
        @Query() pagination: CosmosPaginationDto,
    ): Promise<CosmosNcmWithProducts> {
        const { page, next_page } = pagination
        return this.cosmosService.getNcmProducts(code, next_page ?? page)
    }

    @Get('products')
    searchProducts(@Query() queryParams: CosmosProductsQueryDto): Promise<CosmosProductsPage> {
        const { query, page, next_page } = queryParams
        return this.cosmosService.searchProducts(query, next_page ?? page)
    }

    @Post('gpcs/:code/sync')
    @HttpCode(HttpStatus.OK)
    syncGpcProducts(
        @Param('code') code: string,
        @Query() pagination: CosmosPaginationDto,
    ): Promise<CosmosGpcSyncResult> {
        const { page, next_page } = pagination
        return this.cosmosService.syncGpcProducts(code, next_page ?? page)
    }
}
