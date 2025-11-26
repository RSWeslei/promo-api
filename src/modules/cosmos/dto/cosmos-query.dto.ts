export class CosmosPaginationDto {
    page?: string
    next_page?: string
}

export class CosmosProductsQueryDto extends CosmosPaginationDto {
    query?: string
}
