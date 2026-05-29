
import { api } from '../services/api'

export async function fetcher<T>(url: string): Promise<T> {
  try {
    const res = await api.get(url)
    return res.data
  } catch (error: any) {
    if (error.response) {
      const err = new Error(`Requisicao falhou com status ${error.response.status}`)
      ;(err as Error & { status: number }).status = error.response.status
      throw err
    }
    throw error
  }
}
