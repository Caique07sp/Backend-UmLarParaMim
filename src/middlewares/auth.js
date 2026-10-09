const jwt = require('jsonwebtoken');
const pool = require('../config/database');


function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: 'Token não fornecido.' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2) {
        return res.status(401).json({ message: 'Erro no formato do token.' });
    }

    const [scheme, token] = parts;

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Token inválido ou expirado.' });
        }

        req.userId = decoded.id;
        req.userEmail = decoded.email;

        return next();
    });
}


async function requirePlatformAdmin(req, res, next) {
    try {
        const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
        const user = result.rows[0];

        if (!user || user.role !== 'platform_admin') {
            return res.status(403).json({ message: 'Acesso negado. Requer privilégios de administrador da plataforma.' });
        }

        return next();
    } catch (error) {
        console.error('Erro na verificação de admin:', error);
        return res.status(500).json({ message: 'Erro interno de servidor.' });
    }
}


function requireOrgAccess(allowedRoles = ['owner', 'admin']) {
    return async (req, res, next) => {
        try {
         
            const result = await pool.query(
                `SELECT om.role, o.status 
                 FROM organization_members om
                 INNER JOIN organizations o ON om.organization_id = o.id
                 WHERE om.user_id = $1`,
                [req.userId]
            );

            const member = result.rows[0];

            if (!member) {
                return res.status(403).json({ message: 'Acesso negado. Usuário não possui vínculo com nenhuma organização.' });
            }

            if (!allowedRoles.includes(member.role)) {
                return res.status(403).json({ message: 'Acesso negado. Permissão insuficiente na organização.' });
            }

           
            req.userOrgRole = member.role;
            req.orgStatus = member.status;

            return next();
        } catch (error) {
            console.error('Erro na verificação de membro da ONG:', error);
            return res.status(500).json({ message: 'Erro interno de servidor.' });
        }
    };
}

module.exports = {
    authMiddleware,
    requirePlatformAdmin,
    requireOrgAccess
};