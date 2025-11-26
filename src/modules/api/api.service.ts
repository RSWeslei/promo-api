import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'

import { ApiClient, ApiClientConfig, ApiQueryValue, ApiRequestOptions } from './api.types'

@Injectable()
export class ApiService {
    private readonly logger = new Logger(ApiService.name)

    createClient(config: ApiClientConfig): ApiClient {
        const { baseUrl, defaultHeaders = {} } = config
        const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')

        const requestWithDefaults = <T>(options: ApiRequestOptions): Promise<T> => {
            return this.request<T>({
                ...options,
                path: options.path,
                headers: { Accept: 'application/json', ...defaultHeaders, ...options.headers },
                baseUrl: normalizedBaseUrl,
            })
        }

        const get = <T>(path: string, query?: Record<string, ApiQueryValue>): Promise<T> =>
            requestWithDefaults<T>({ path, method: 'GET', query })

        const post = <T>(path: string, body?: unknown, query?: Record<string, ApiQueryValue>): Promise<T> =>
            requestWithDefaults<T>({ path, method: 'POST', body, query })

        const put = <T>(path: string, body?: unknown, query?: Record<string, ApiQueryValue>): Promise<T> =>
            requestWithDefaults<T>({ path, method: 'PUT', body, query })

        const patch = <T>(path: string, body?: unknown, query?: Record<string, ApiQueryValue>): Promise<T> =>
            requestWithDefaults<T>({ path, method: 'PATCH', body, query })

        const remove = <T>(path: string, query?: Record<string, ApiQueryValue>): Promise<T> =>
            requestWithDefaults<T>({ path, method: 'DELETE', query })

        return {
            request: requestWithDefaults,
            get,
            post,
            put,
            patch,
            delete: remove,
        }
    }

    async request<T>(options: ApiRequestOptions & ApiClientConfig): Promise<T> {
        const { baseUrl, path, method = 'GET', headers, query, body } = options

        if (!baseUrl) {
            throw new HttpException('baseUrl is required for API requests', HttpStatus.INTERNAL_SERVER_ERROR)
        }

        const url = this.resolveUrl(baseUrl, path, query)

        const init: RequestInit = {
            method,
            headers: this.normalizeHeaders(headers),
        }

        if (body !== undefined && method !== 'GET') {
            init.body = typeof body === 'string' ? body : JSON.stringify(body)
            init.headers = this.normalizeHeaders({
                'Content-Type': 'application/json',
                ...headers,
            })
        }

        let response: Response

        try {
            response = await fetch(url, init)
        } catch (error) {
            this.logger.error(`Request to ${url} failed`, error as Error)
            throw new HttpException('Failed to reach external API', HttpStatus.BAD_GATEWAY)
        }

        const text = await response.text()
        const data = text ? this.safeParseJson(text, response.url) : null

        if (!response.ok) {
            const message =
                data && typeof data === 'object' && 'message' in data ? (data as { message: string }).message : text
            throw new HttpException(message || 'External API request failed', response.status || HttpStatus.BAD_GATEWAY)
        }

        return data as T
    }

    private resolveUrl(baseUrl: string, path: string, query?: Record<string, ApiQueryValue>): string {
        let finalUrl: URL

        if (query?.page && typeof query.page === 'string' && this.isUrl(query.page)) {
            finalUrl = new URL(query.page)

            const { page: _page, ...otherParams } = query
            this.appendQueryParams(finalUrl, otherParams)

            return finalUrl.toString()
        }

        if (this.isUrl(path)) {
            finalUrl = new URL(path)
            this.appendQueryParams(finalUrl, query)
            return finalUrl.toString()
        }

        const normalizedBase = baseUrl.replace(/\/+$/, '')
        const normalizedPath = path.startsWith('/') ? path : `/${path}`

        finalUrl = new URL(`${normalizedBase}${normalizedPath}`)
        this.appendQueryParams(finalUrl, query)

        return finalUrl.toString()
    }

    private appendQueryParams(url: URL, query?: Record<string, ApiQueryValue>): void {
        if (!query) return

        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value))
            }
        })
    }

    private isUrl(value: string): boolean {
        return value.startsWith('https://')
    }

    private safeParseJson(input: string, url: string): unknown {
        try {
            return JSON.parse(input)
        } catch (error) {
            this.logger.warn(`Failed to parse JSON response from ${url}: ${(error as Error).message}`)
            return input
        }
    }

    private normalizeHeaders(headers?: Record<string, string | undefined>): HeadersInit | undefined {
        if (!headers) {
            return undefined
        }

        const filtered: Record<string, string> = {}

        Object.entries(headers).forEach(([key, value]) => {
            if (value !== undefined) {
                filtered[key] = value
            }
        })

        return filtered
    }
}
