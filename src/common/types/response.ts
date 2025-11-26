export interface Response<T> {
    type: 'success' | 'error'
    message: string
    data: T
}
