import { Readable } from 'node:stream'

import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'

import prisma from '@/infra/prisma/prisma'
import { CloudinaryService } from '@/modules/storage/services/cloudinary.service'

import type { ApiClient } from '../../api/api.types'
import {
    CosmosGpcSyncResult,
    CosmosGpcWithProducts,
    CosmosNcmWithProducts,
    CosmosProduct,
    CosmosProductsPage,
} from '../cosmos.types'
import { COSMOS_API_CLIENT } from '../providers/cosmos.provider'

@Injectable()
export class CosmosService {
    private readonly logger = new Logger(CosmosService.name)
    private readonly failedImageUrls = new Set<string>()

    constructor(
        @Inject(COSMOS_API_CLIENT)
        private readonly client: ApiClient,
        private readonly cloudinaryService: CloudinaryService,
        private readonly configService: ConfigService,
    ) {}

    async getGtin(code: string): Promise<CosmosProduct> {
        return this.client.get<CosmosProduct>(`/gtins/${code}`)
    }

    async getGpc(code: string, page?: string | number): Promise<CosmosGpcWithProducts> {
        return this.client.get<CosmosGpcWithProducts>(`/gpcs/${code}`, { page })
    }

    async getNcmProducts(code: string, page?: string | number): Promise<CosmosNcmWithProducts> {
        return this.client.get<CosmosNcmWithProducts>(`/ncms/${code}/products`, { page })
    }

    async searchProducts(query?: string, page?: string | number): Promise<CosmosProductsPage> {
        if (!query) {
            throw new BadRequestException('Query is required')
        }

        return this.client.get<CosmosProductsPage>('/products', { query, page })
    }

    async syncGpcProducts(code: string, page?: string | number): Promise<CosmosGpcSyncResult> {
        const gpcResponse = await this.getGpc(code, page)
        const products = gpcResponse.products ?? []

        const currentPage = this.resolveCurrentPage(gpcResponse.current_page, page)
        const nextPage = gpcResponse.next_page ?? null
        const gpcEnglishDescription = gpcResponse.english_description ?? null
        const gpcPortugueseDescription = gpcResponse.portuguese ?? null
        const segmentSlug = this.segmentFolderName(gpcEnglishDescription, gpcPortugueseDescription, code)

        let inserted = 0
        let skipped = 0

        for (const product of products) {
            const gtin = this.normalizeGtin(product.gtin)
            if (!gtin) {
                skipped += 1
                continue
            }

            const existing = await prisma.product.findUnique({ where: { barcode: gtin } })

            const productFolder = `products/${segmentSlug}`
            const barcodeFolder = `barcodes/${segmentSlug}`
            const brandId = this.slugify(product.brand?.name ?? gtin)

            const [brandImageUrl, barcodeImageUrl, productImageUrl] = await Promise.all([
                existing?.brandImageUrl
                    ? Promise.resolve(existing.brandImageUrl)
                    : this.uploadImageFromUrl(product.brand?.picture, 'brands', brandId),
                existing?.barcodeImageUrl
                    ? Promise.resolve(existing.barcodeImageUrl)
                    : this.uploadImageFromUrl(product.barcode_image, barcodeFolder, gtin),
                existing?.imageUrl
                    ? Promise.resolve(existing.imageUrl)
                    : this.uploadImageFromUrl(product.thumbnail, productFolder, gtin),
            ])

            const mappedProduct = this.mapToProductCreate(
                product,
                gtin,
                code,
                {
                    brandImageUrl,
                    barcodeImageUrl,
                    productImageUrl,
                },
                {
                    gpcEnglishDescription,
                    gpcPortugueseDescription,
                },
            )

            try {
                if (existing) {
                    await prisma.product.update({
                        where: { id: existing.id },
                        data: mappedProduct,
                    })
                } else {
                    await prisma.product.create({ data: mappedProduct })
                    inserted += 1
                }
            } catch (error) {
                this.logger.warn(`Failed to save product ${gtin}: ${(error as Error).message}`)
                skipped += 1
            }
        }

        await this.upsertGpcProgress(code, currentPage, nextPage)

        return {
            gpcCode: code,
            currentPage,
            nextPage,
            totalReceived: products.length,
            inserted,
            skipped,
        }
    }

    private async upsertGpcProgress(gpcCode: string, lastPage: number, nextPage: string | null): Promise<void> {
        await prisma.gpcSyncState.upsert({
            where: { gpcCode },
            update: { lastPage, nextPage },
            create: { gpcCode, lastPage, nextPage },
        })
    }

    private resolveCurrentPage(responsePage?: number, requestedPage?: string | number): number {
        const parsedResponse = responsePage !== undefined ? Number(responsePage) : NaN
        if (Number.isFinite(parsedResponse) && parsedResponse > 0) {
            return parsedResponse
        }

        const parsedRequest = requestedPage !== undefined ? Number(requestedPage) : NaN
        return Number.isFinite(parsedRequest) && parsedRequest > 0 ? parsedRequest : 1
    }

    private normalizeGtin(value?: string | number): string | null {
        if (value === undefined || value === null) {
            return null
        }

        const normalized = String(value).trim()
        return normalized.length ? normalized : null
    }

    private async uploadImageFromUrl(
        url: string | null | undefined,
        folder: string,
        publicId: string,
        options?: { fallbackToOriginal?: boolean },
    ): Promise<string | null> {
        if (!url) {
            return null
        }

        if (url.includes('res.cloudinary.com')) {
            return url
        }

        const normalizedUrl = url.trim()
        // Ignore relative/placeholder urls (e.g., /assets/brand-placeholder-*.png)
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            return null
        }

        try {
            const headers: Record<string, string> = {
                Accept: 'image/*',
                'User-Agent': 'promo-api/1.0 (+https://promo.local)',
                Referer: 'https://cosmos.bluesoft.com.br/',
            }
            if (url.includes('cosmos.bluesoft.com.br')) {
                const token = this.configService.get<string>('COSMOS_TOKEN')
                if (token) {
                    headers['X-Cosmos-Token'] = token
                }
            }

            const response = await fetch(url, { headers })
            if (!response.ok) {
                if (!this.failedImageUrls.has(url)) {
                    this.logger.warn(`Image download failed for ${url} (status ${response.status})`)
                    this.failedImageUrls.add(url)
                }
                return options?.fallbackToOriginal !== false ? url : null
            }

            const arrayBuffer = await response.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            const mimeType = response.headers.get('content-type') ?? 'image/jpeg'

            const file: Express.Multer.File = {
                fieldname: 'file',
                originalname: `${publicId}`,
                encoding: '7bit',
                mimetype: mimeType,
                size: buffer.length,
                destination: '',
                filename: `${publicId}`,
                path: '',
                buffer,
                stream: Readable.from(buffer),
            }

            const uploaded = await this.cloudinaryService.uploadImage(file, {
                folder,
                publicId,
                overwrite: true,
            })

            return uploaded.url
        } catch (error) {
            if (!this.failedImageUrls.has(url)) {
                this.logger.warn(`Upload to Cloudinary failed for ${publicId}: ${(error as Error).message}`)
                this.failedImageUrls.add(url)
            }
            return options?.fallbackToOriginal !== false ? url : null
        }
    }

    private mapToProductCreate(
        product: CosmosProduct,
        gtin: string,
        gpcCode: string,
        images: {
            brandImageUrl: string | null
            barcodeImageUrl: string | null
            productImageUrl: string | null
        },
        meta: {
            gpcEnglishDescription: string | null
            gpcPortugueseDescription: string | null
        },
    ): Prisma.ProductCreateInput {
        const packaging = product.gtins?.[0]?.commercial_unit

        return {
            name: product.description || gtin,
            brand: product.brand?.name ?? null,
            description: product.description ?? null,
            category: product.category?.description ?? null,
            subcategory: null,
            sku: null,
            barcode: gtin,
            manufacturer: product.brand?.name ?? null,
            originCountry: product.origin ?? null,
            quantityLabel: packaging?.type_packaging ?? null,
            packageQuantity: packaging?.quantity_packaging ?? null,
            packageUnit: packaging?.type_packaging ?? null,
            netWeight: product.net_weight ?? null,
            netWeightUnit: null,
            volume: null,
            volumeUnit: null,
            width: product.width ?? null,
            height: product.height ?? null,
            length: product.length ?? null,
            grossWeight: product.gross_weight ?? null,
            priceText: product.price ?? null,
            priceMin: product.min_price ?? null,
            priceMax: product.max_price ?? null,
            priceAvg: product.avg_price ?? null,
            gpcCode: product.gpc?.code ?? gpcCode,
            gpcDescription: product.gpc?.description ?? null,
            gpcEnglishDescription: meta.gpcEnglishDescription,
            gpcPortugueseDescription: meta.gpcPortugueseDescription,
            ncmCode: product.ncm?.code ?? null,
            ncmDescription: product.ncm?.description ?? null,
            ncmFullDescription: product.ncm?.full_description ?? null,
            ncmEx: product.ncm?.ex ?? null,
            externalCategoryId: product.category?.id ?? null,
            externalCategoryParentId: product.category?.parent_id ?? null,
            externalCategoryName: product.category?.description ?? null,
            releaseDate: this.parseDate(product.release_date),
            imageUrl: images.productImageUrl ?? null,
            additionalImages: [] as string[],
            brandImageUrl: images.brandImageUrl ?? null,
            barcodeImageUrl: images.barcodeImageUrl ?? null,
            ingredients: null,
            allergens: null,
            isVegan: null,
            isVegetarian: null,
            isGlutenFree: null,
            tags: [] as string[],
            gtinDetails: product.gtins ? (product.gtins as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
            source: 'cosmos',
            externalId: gtin,
            externalUrl: null,
            cosmosRaw: product as unknown as Prisma.InputJsonValue,
            cosmosCreatedAt: this.parseDate(product.created_at),
            cosmosUpdatedAt: this.parseDate(product.updated_at),
            cestCode: product.cest?.code ?? null,
            cestDescription: product.cest?.description ?? null,
            cestId: product.cest?.id ?? null,
            cestParentId: product.cest?.parent_id ?? null,
            isActive: true,
        }
    }

    private parseDate(value?: string | null): Date | null {
        if (!value) {
            return null
        }

        const parsed = new Date(value)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    private slugify(value: string): string {
        return (
            value
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .toLowerCase() || 'unknown'
        )
    }

    private segmentFolderName(english?: string | null, portuguese?: string | null, code?: string): string {
        const base = english?.trim() || portuguese?.trim() || code || 'unknown'
        const tokens = base
            .replace(/[^\w]+/g, ' ')
            .split(' ')
            .filter(Boolean)
        const firstTwo = tokens.slice(0, 2).join(' ')
        return this.slugify(firstTwo || base)
    }
}
