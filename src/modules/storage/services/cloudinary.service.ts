import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common'
import type { v2 as CloudinaryType } from 'cloudinary'

import { UploadImageResponseDto } from '../dto/upload-image-response.dto'
import { CLOUDINARY } from '../providers/cloudinary.provider'

@Injectable()
export class CloudinaryService {
    constructor(
        @Inject(CLOUDINARY)
        private readonly cloudinary: typeof CloudinaryType,
    ) {}

    async uploadImage(
        file: Express.Multer.File,
        options?: { folder?: string; overwrite?: boolean },
    ): Promise<UploadImageResponseDto> {
        if (!file) {
            throw new InternalServerErrorException('File is required for upload')
        }

        return new Promise((resolve, reject) => {
            this.cloudinary.uploader
                .upload_stream(
                    {
                        folder: options?.folder,
                        overwrite: options?.overwrite ?? true,
                        resource_type: 'image',
                    },
                    (error, result) => {
                        if (error || !result) {
                            return reject(new InternalServerErrorException('Image upload failed'))
                        }

                        const response: UploadImageResponseDto = {
                            url: result.secure_url,
                            publicId: result.public_id,
                            format: result.format,
                            bytes: result.bytes,
                            width: result.width,
                            height: result.height,
                        }

                        resolve(response)
                    },
                )
                .end(file.buffer)
        })
    }
}
