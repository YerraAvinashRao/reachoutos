import { Request, Response, NextFunction } from 'express';
import { db, DatabaseUnconfiguredError } from '../infrastructure/database/SupabaseDatabaseAdapter';
import { User, Tenant, Role } from '../types';

export interface AuthenticatedRequest extends Request {
  auth?: {
    user: User;
    tenant: Tenant;
    role: Role;
  };
}

/**
 * Supabase Authentication Middleware:
 * Validates Supabase Auth Bearer JWT token against Supabase Auth service,
 * checks user profile and tenant_members table in PostgreSQL,
 * and attaches verified user + tenant to request context.
 *
 * NON-NEGOTIABLE RULE: No fallback to hardcoded users or fake JWTs.
 * If Supabase is unconfigured or unavailable, rejects with controlled 503 error.
 */
export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!db.isConfigured) {
    return res.status(503).json({
      error: {
        code: 'DATABASE_UNCONFIGURED',
        message: 'Authoritative Supabase database is not configured. Please supply SUPABASE_URL and SUPABASE_ANON_KEY.'
      }
    });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      error: {
        code: 'MISSING_AUTHENTICATION_TOKEN',
        message: 'Authentication required. Please provide a valid Supabase Auth Bearer token.'
      }
    });
  }

  try {
    const authResult = await db.validateAuthToken(token);
    if (!authResult) {
      return res.status(401).json({
        error: {
          code: 'INVALID_OR_EXPIRED_TOKEN',
          message: 'Supabase authentication token is invalid or expired.'
        }
      });
    }

    const { user, memberships } = authResult;
    if (memberships.length === 0) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT_MEMBERSHIP',
          message: 'Authenticated user does not belong to any active workspace tenant in the database.'
        }
      });
    }

    const requestedTenantId = req.headers['x-tenant-id'] as string;
    let activeMembership = memberships[0];

    if (requestedTenantId) {
      const match = memberships.find(m => m.tenantId === requestedTenantId);
      if (!match) {
        return res.status(403).json({
          error: {
            code: 'CROSS_TENANT_ACCESS_DENIED',
            message: 'You are not an authorized member of the requested tenant workspace.'
          }
        });
      }
      activeMembership = match;
    }

    req.auth = {
      user: {
        ...user,
        role: activeMembership.role
      },
      tenant: activeMembership.tenant,
      role: activeMembership.role
    };

    next();
  } catch (err: any) {
    if (err instanceof DatabaseUnconfiguredError) {
      return res.status(503).json({
        error: {
          code: 'DATABASE_UNCONFIGURED',
          message: err.message
        }
      });
    }
    return res.status(401).json({
      error: {
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: err.message || 'Authentication token validation failed.'
      }
    });
  }
}

/**
 * Server-Side RBAC Guard Middleware:
 * Rejects requests if the user's role in the active tenant lacks permission.
 */
export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_ROLE_PERMISSIONS',
          message: `Role '${req.auth.role}' is not authorized to execute this operation. Required: ${allowedRoles.join(', ')}`
        }
      });
    }

    next();
  };
}
