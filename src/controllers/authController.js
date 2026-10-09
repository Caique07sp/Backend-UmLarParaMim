const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

exports.register = async (req, res) => {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const queryText = `
            INSERT INTO users (name, email, password, phone) 
            VALUES ($1, $2, $3, $4) 
            RETURNING id, name, email, created_at;
        `;
        const result = await pool.query(queryText, [name, email, hashedPassword, phone]);

        return res.status(201).json({
            message: 'Usuário cadastrado com sucesso!',
            user: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ message: 'E-mail já cadastrado.' });
        }
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        return res.status(200).json({ message: 'Login bem-sucedido!', token });
    } catch (error) {
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.getProfile = async (req, res) => {
    try {
        // Busca usuário + ONG (se ele tiver uma)
        const queryText = `
            SELECT 
                u.id, u.name, u.email, u.phone, u.role, u.created_at,
                om.organization_id, om.role AS org_role, o.name AS organization_name, o.status AS organization_status
            FROM users u
            LEFT JOIN organization_members om ON u.id = om.user_id
            LEFT JOIN organizations o ON om.organization_id = o.id
            WHERE u.id = $1;
        `;
        const result = await pool.query(queryText, [req.userId]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        return res.status(200).json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            created_at: user.created_at,
            organization: user.organization_id ? {
                id: user.organization_id,
                name: user.organization_name,
                role: user.org_role,
                status: user.organization_status
            } : null
        });
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};