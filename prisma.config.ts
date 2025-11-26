import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
    schema: 'src/infra/prisma/schema',
    migrations: {
        path: 'src/infra/prisma/migrations',
    },
    datasource: {
        url: env('DATABASE_URL'),
    },
})
