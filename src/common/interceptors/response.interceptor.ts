import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

import type { Response } from '../types/response'

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
        return next.handle().pipe(
            map((data: T) => {
                if (this.isResponseEnvelope(data)) {
                    return data as Response<T>
                }

                return {
                    type: 'success',
                    message: 'OK',
                    data,
                }
            }),
        )
    }

    private isResponseEnvelope(value: unknown): value is Response<unknown> {
        if (!value || typeof value !== 'object') {
            return false
        }

        if (!('type' in value)) {
            return false
        }

        const type = (value as { type?: unknown }).type
        return type === 'success' || type === 'error'
    }
}
