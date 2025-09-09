import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedUser {
    id: number;
    username: string;
    fullName: string;
    email: string;
    role: 'admin' | 'client';
    position?: string;
    avatarUrl?: string;
    clientId?: number;
    client?: {
        id: number;
        name: string;
        industry?: string;
    };
}
declare global {
    namespace Express {
        interface User extends AuthenticatedUser {
        }
    }
}
export declare const requireAuth: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireClient: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireRole: (roles: string[]) => (req: Request, res: Response, next: NextFunction) => void;
