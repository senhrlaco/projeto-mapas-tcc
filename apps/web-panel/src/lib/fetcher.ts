
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem('token'),
      'Content-Type': 'application/json',
    },
  })

  // o swr captura esse throw e expoe via error no hook
  if (!res.ok) {
    const err = new Error(`Requisicao falhou com status ${res.status}`)
    ;(err as Error & { status: number }).status = res.status
    throw err
  }

  return res.json() as Promise<T>
}
