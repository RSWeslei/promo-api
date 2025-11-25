import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

// 🔥 Caminho ABSOLUTO direto no HD (ajusta se o teu for outro)
// usando /, que funciona normal no Windows
const INPUT_FILE = 'F:/Downloads/openfoodfacts-products.jsonl/openfoodfacts-products.jsonl'
// O output pode ir pro projeto, sem problema
const OUTPUT_FILE = path.join(process.cwd(), 'openfoodfacts-sample-20.json')

const MAX_ITEMS = 10

const run = async () => {
    console.log('Lendo de:', INPUT_FILE)

    const stat = fs.statSync(INPUT_FILE)
    if (!stat.isFile()) {
        console.error('O caminho não é um arquivo:', INPUT_FILE)
        process.exit(1)
    }

    const stream = fs.createReadStream(INPUT_FILE, { encoding: 'utf8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    const items: unknown[] = []
    let count = 0

    for await (const line of rl) {
        if (!line.trim()) continue

        try {
            const obj = JSON.parse(line)
            items.push(obj)
            count += 1
        } catch {
            console.warn('Linha inválida, ignorando...')
        }

        if (count >= MAX_ITEMS) {
            break
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(items, null, 2), 'utf8')

    console.log(`✅ Salvo ${count} produtos em: ${OUTPUT_FILE}`)
}

run().catch((err) => {
    console.error('Erro ao gerar sample:', err)
    process.exit(1)
})
