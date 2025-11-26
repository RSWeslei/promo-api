export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ApiQueryValue = string | number | boolean | undefined | null

export interface ApiRequestOptions {
    path: string
    method?: ApiHttpMethod
    headers?: Record<string, string | undefined>
    query?: Record<string, ApiQueryValue>
    body?: unknown
}

export interface ApiClientConfig {
    baseUrl: string
    defaultHeaders?: Record<string, string | undefined>
}

export interface ApiClient {
    request<T>(options: ApiRequestOptions): Promise<T>
    get<T>(path: string, query?: Record<string, ApiQueryValue>): Promise<T>
    post<T>(path: string, body?: unknown, query?: Record<string, ApiQueryValue>): Promise<T>
    put<T>(path: string, body?: unknown, query?: Record<string, ApiQueryValue>): Promise<T>
    patch<T>(path: string, body?: unknown, query?: Record<string, ApiQueryValue>): Promise<T>
    delete<T>(path: string, query?: Record<string, ApiQueryValue>): Promise<T>
}
