export interface CosmosBrand {
    name: string
    picture: string | null
}

export interface CosmosGpc {
    code: string
    description: string
}

export interface CosmosNcm {
    code: string
    description: string
    full_description?: string
    ex?: string | null
}

export interface CosmosCategory {
    id: number
    description: string
    parent_id: number | null
}

export interface CosmosCommercialUnit {
    type_packaging: string | null
    quantity_packaging: number | null
    ballast: number | null
    layer: number | null
}

export interface CosmosGtinEntry {
    gtin: string | number
    commercial_unit?: CosmosCommercialUnit
}

export interface CosmosCest {
    id: number
    code: string
    description: string
    parent_id: number | null
}

export interface CosmosProduct {
    description: string
    gtin: string | number
    thumbnail?: string | null
    width?: number | null
    height?: number | null
    length?: number | null
    net_weight?: number | null
    gross_weight?: number | null
    created_at?: string
    updated_at?: string
    release_date?: string | null
    price?: string
    avg_price?: number
    max_price?: number
    min_price?: number
    gtins?: CosmosGtinEntry[]
    origin?: string
    barcode_image?: string
    brand?: CosmosBrand
    gpc?: CosmosGpc
    ncm?: CosmosNcm
    cest?: CosmosCest
    category?: CosmosCategory
}

export interface CosmosProductsPage {
    products: CosmosProduct[]
    page?: number
    per_page?: number
    total?: number
    next_page?: string | null
}

export interface CosmosPagination {
    current_page?: number
    per_page?: number
    total_pages?: number
    total_count?: number
    next_page?: string | null
}

export interface CosmosGpcWithProducts extends CosmosPagination {
    id?: number
    code: string
    level?: number
    english_description?: string
    portuguese?: string
    parent_id?: number | null
    products?: CosmosProduct[]
}

export interface CosmosNcmWithProducts {
    ncm?: CosmosNcm
    products?: CosmosProduct[]
    [key: string]: unknown
}

export interface CosmosGpcSyncResult {
    gpcCode: string
    currentPage: number
    nextPage?: string | null
    totalReceived: number
    inserted: number
    skipped: number
}
