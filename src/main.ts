import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'

import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule)

    app.use(helmet())

    await app.listen(process.env.PORT ?? 3000)
}

bootstrap().catch((error) => {
    console.error('Error when initiate api', error)
    process.exit(1)
})
