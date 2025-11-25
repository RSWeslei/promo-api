import { Provider } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { v2 as Cloudinary } from 'cloudinary'

export const CLOUDINARY = 'CLOUDINARY'

export const CloudinaryProvider: Provider = {
    provide: CLOUDINARY,
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => {
        Cloudinary.config({
            cloud_name: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
            api_key: configService.get<string>('CLOUDINARY_API_KEY'),
            api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
            secure: configService.get<boolean>('CLOUDINARY_SECURE') ?? true,
        })

        return Cloudinary
    },
}
