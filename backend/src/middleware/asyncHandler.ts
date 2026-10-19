import type { NextFunction, Request, Response } from 'express';

// Express 4 no captura errores de handlers async: sin esto, un throw
// (ej. validación zod) tumba el servidor en vez de llegar a errorHandler.
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: T, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
