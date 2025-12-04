export const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
};
export const requireAdmin = (req, res, next) => {
    console.log('[requireAdmin] URL:', req.url, 'User:', req.user);
    if (req.isAuthenticated() && req.user?.role === 'admin') {
        console.log('[requireAdmin] Access granted');
        return next();
    }
    console.log('[requireAdmin] Access denied');
    res.status(403).json({ error: 'Admin access required' });
};
export const requireClient = (req, res, next) => {
    if (req.isAuthenticated() && req.user?.role === 'client') {
        return next();
    }
    res.status(403).json({ error: 'Client access required' });
};
export const requireRole = (roles) => (req, res, next) => {
    if (req.isAuthenticated() && req.user?.role && roles.includes(req.user.role)) {
        return next();
    }
    res.status(403).json({ error: 'Insufficient permissions' });
};
