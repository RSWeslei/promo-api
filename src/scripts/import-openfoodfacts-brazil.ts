import 'dotenv/config'
import fs from 'node:fs'
import readline from 'node:readline'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// 🔥 Caminho ABSOLUTO pro JSONL no HD
const INPUT_FILE = 'F:/Downloads/openfoodfacts-products.jsonl/openfoodfacts-products.jsonl'

// arquivo de estado pra retomar depois
const STATE_FILE = 'openfoodfacts-import-state.json'

// tamanho do batch para createMany (PEQUENO pra ver inserção logo)
const BATCH_SIZE = 10

// limite de produtos ÚTEIS para importar (pode ajustar depois)
const MAX_PRODUCTS = 50_000

// limite de LINHAS lidas do arquivo (pra não comer o planeta no teste)
const MAX_LINES = 1_000_000

type OffProduct = {
    _id?: string
    code?: string
    product_name?: string
    product_name_pt?: string
    product_name_en?: string
    generic_name?: string
    generic_name_pt?: string
    brands?: string
    countries?: string
    countries_tags?: string[]
    categories?: string
    categories_tags?: string[]
    quantity?: string
    product_quantity?: number
    product_quantity_unit?: string
    image_url?: string
    image_front_url?: string
    ingredients_text?: string
    allergens?: string
    allergens_tags?: string[]
    ingredients_analysis_tags?: string[]
    labels_tags?: string[]
}

const isBrazilian = (p: OffProduct): boolean => {
    if (Array.isArray(p.countries_tags)) {
        if (p.countries_tags.some((t) => /brazil|brasil/i.test(t))) {
            return true
        }
    }

    if (typeof p.countries === 'string' && /brasil|brazil/i.test(p.countries)) {
        return true
    }

    if (typeof p.code === 'string' && p.code.startsWith('789')) {
        return true
    }

    return false
}

const mapOffToProduct = (p: OffProduct) => {
    const name = p.product_name_pt?.trim() || p.product_name?.trim() || p.product_name_en?.trim() || undefined

    const barcode = p.code?.trim()

    // filtro "útil": precisa de nome e código de barras
    if (!name || !barcode) {
        return null
    }

    const brand = p.brands?.split(',')[0]?.trim() || null

    const description = p.generic_name_pt?.trim() || p.generic_name?.trim() || null

    const category =
        p.categories?.split(',')[0]?.trim() ||
        (p.categories_tags && p.categories_tags[0] ? (p.categories_tags[0].split(':').pop() ?? null) : null)

    const quantityLabel = p.quantity || null

    let netWeight: number | null = null
    let netWeightUnit: string | null = null
    let volume: number | null = null
    let volumeUnit: string | null = null

    if (typeof p.product_quantity === 'number' && p.product_quantity_unit) {
        const unit = p.product_quantity_unit.toLowerCase()
        const value = p.product_quantity

        if (unit === 'g' || unit === 'kg') {
            netWeight = unit === 'g' ? value : value * 1000
            netWeightUnit = 'g'
        } else if (unit === 'ml' || unit === 'l') {
            volume = unit === 'ml' ? value : value * 1000
            volumeUnit = 'ml'
        }
    }

    const ingredients = p.ingredients_text || null
    const allergens = p.allergens || null

    const analysis = p.ingredients_analysis_tags ?? []
    const allergensTags = p.allergens_tags ?? []
    const labelsTags = p.labels_tags ?? []

    const isVegan = analysis.includes('en:vegan')
    const isVegetarian = analysis.includes('en:vegetarian')
    const isGlutenFree = !allergensTags.some((t) => t.includes('gluten'))

    const tags: string[] = [...(p.categories_tags ?? []), ...labelsTags, ...analysis]

    const imageUrl = p.image_front_url || p.image_url || null

    return {
        name,
        brand,
        description,
        category,
        subcategory: null,
        sku: null,
        barcode,
        manufacturer: null,
        originCountry: 'BR',

        quantityLabel,
        packageQuantity: null,
        packageUnit: null,
        netWeight,
        netWeightUnit,
        volume,
        volumeUnit,

        imageUrl,
        additionalImages: [] as string[],
        ingredients,
        allergens,

        isVegan,
        isVegetarian,
        isGlutenFree,
        tags,

        source: 'openfoodfacts',
        externalId: p._id ?? p.code ?? null,
        externalUrl: p.code ? `https://world.openfoodfacts.org/product/${p.code}` : null,

        isActive: true,
    }
}

const loadState = (): number => {
    if (!fs.existsSync(STATE_FILE)) {
        return 1 // começa da linha 1
    }

    // insira na tabela um dado de teste

    try {
        const raw = fs.readFileSync(STATE_FILE, 'utf8')
        const parsed = JSON.parse(raw) as { lastLine: number }
        if (parsed && typeof parsed.lastLine === 'number' && parsed.lastLine > 0) {
            console.log(`➡️  Retomando a partir da linha ${parsed.lastLine + 1}`)
            return parsed.lastLine + 1
        }
    } catch {
        // se der erro, ignora e começa do início
    }

    return 1
}

const saveState = (lastLine: number) => {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastLine }, null, 2), 'utf8')
}

const run = async () => {
    console.log('Lendo de:', INPUT_FILE)

    const stat = fs.statSync(INPUT_FILE)
    if (!stat.isFile()) {
        console.error('O caminho não é um arquivo:', INPUT_FILE)
        process.exit(1)
    }

    const startFromLine = loadState()

    const stream = fs.createReadStream(INPUT_FILE, { encoding: 'utf8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    let totalLines = 0
    let parsedLines = 0
    let brazilCandidates = 0
    let mappedCount = 0
    let insertedCount = 0
    let skippedNoNameOrBarcode = 0

    let batch: any[] = []

    console.log('Iniciando leitura linha a linha...')

    for await (const line of rl) {
        totalLines += 1

        // pula até chegar na linha de início (para retomar depois)
        if (totalLines < startFromLine) {
            continue
        }

        // LOG FREQUENTE
        if (totalLines % 10_000 === 0) {
            console.log(
                `Linhas lidas: ${totalLines}, candidatos BR: ${brazilCandidates}, mapeados úteis: ${mappedCount}, inseridos: ${insertedCount}`,
            )
        }

        // limite de linhas para teste
        if (totalLines >= MAX_LINES) {
            console.log(`🔚 Limite de ${MAX_LINES} linhas atingido, parando leitura.`)
            break
        }

        if (!line.trim()) continue

        let raw: any
        try {
            raw = JSON.parse(line)
            parsedLines += 1
        } catch {
            continue
        }

        if (!isBrazilian(raw)) {
            continue
        }
        brazilCandidates += 1

        const mapped = mapOffToProduct(raw)
        if (!mapped) {
            skippedNoNameOrBarcode += 1
            continue
        }

        mappedCount += 1
        batch.push(mapped)

        if (batch.length >= BATCH_SIZE) {
            try {
                const result = await prisma.product.createMany({
                    data: batch,
                    skipDuplicates: true,
                })
                insertedCount += result.count
                console.log(
                    `Batch inserido. Total inseridos: ${insertedCount}, candidatos BR: ${brazilCandidates}, mapeados úteis: ${mappedCount}`,
                )
                // salva progresso de linha sempre que insere um batch
                saveState(totalLines)
            } catch (err) {
                console.error('Erro ao inserir batch:', err)
            } finally {
                batch = []
            }
        }

        if (insertedCount >= MAX_PRODUCTS) {
            console.log(`🔚 Limite de ${MAX_PRODUCTS} produtos atingido, parando import.`)
            break
        }
    }

    if (batch.length > 0 && insertedCount < MAX_PRODUCTS) {
        try {
            const result = await prisma.product.createMany({
                data: batch,
                skipDuplicates: true,
            })
            insertedCount += result.count
            console.log(`Batch final inserido. Total inseridos: ${insertedCount}`)
            saveState(totalLines)
        } catch (err) {
            console.error('Erro ao inserir batch final:', err)
        }
    }

    console.log('--- Resumo ---')
    console.log('Linhas totais lidas (até limite):', totalLines)
    console.log('JSON válidos:', parsedLines)
    console.log('Produtos com Brasil:', brazilCandidates)
    console.log('Produtos mapeados (úteis):', mappedCount)
    console.log('Inseridos (após skipDuplicates):', insertedCount)
    console.log('Pulados por falta de nome/código:', skippedNoNameOrBarcode)
}

run()
    .catch((err) => {
        console.error('Erro no import:', err)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
