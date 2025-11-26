import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'

import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule)

    app.use(helmet())
    app.useGlobalFilters(new HttpExceptionFilter())

    await app.listen(Number(process.env.API_PORT) || 3001)
}

bootstrap().catch((error) => {
    console.error('Error when initiate api', error)
    process.exit(1)
})
