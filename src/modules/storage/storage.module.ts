import { Module } from '@nestjs/common'

import { CloudinaryProvider } from './providers/cloudinary.provider'
import { CloudinaryService } from './services/cloudinary.service'

@Module({
    providers: [CloudinaryProvider, CloudinaryService],
    exports: [CloudinaryService],
})
export class StorageModule {}
