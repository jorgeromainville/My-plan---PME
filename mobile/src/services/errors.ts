// Error de API compartido por el cliente HTTP y la capa local (modo invitado).
// `status` imita el código HTTP del backend para que la UI no distinga el origen.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Error inesperado.';
}
