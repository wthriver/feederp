const { query, queryOne } = require('../config/database');

function loadUserPermissions(tenantId, roleId) {
    if (roleId) {
        const perms = query(
            `SELECT module, permission FROM role_permissions WHERE role_id = ? AND granted = 1`,
            [roleId]
        );

        const permissions = {};
        perms.forEach(p => {
            if (!permissions[p.module]) {
                permissions[p.module] = [];
            }
            permissions[p.module].push(p.permission);
        });

        return permissions;
    }
    return {};
}

function checkModuleAccess(module, permission) {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
                });
            }

            const user = queryOne(
                `SELECT u.*, r.name as role_name FROM users u
                 LEFT JOIN roles r ON u.role_id = r.id
                 WHERE u.id = ? AND u.tenant_id = ?`,
                [req.user.id, req.tenantId]
            );

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not found' }
                });
            }

            const permissions = loadUserPermissions(req.tenantId, user.role_id);
            req.user.permissions = permissions;
            req.user.roleName = user.role_name;
            req.user.name = user.name;
            req.user.factoryId = req.factoryId || user.factory_id;

            if (permission === 'any') {
                return next();
            }

            const modulePerms = permissions[module] || [];

            if (!modulePerms.includes(permission)) {
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: `Permission '${permission}' required for module '${module}'`
                    }
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: 'Permission check failed' }
            });
        }
    };
}

function requirePermission(module, permission) {
    return checkModuleAccess(module, permission);
}

module.exports = {
    loadUserPermissions,
    checkModuleAccess,
    requirePermission
};
