import type { JwtPayload } from "jsonwebtoken"

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        role: string
      } & JwtPayload
    }
  }
}

