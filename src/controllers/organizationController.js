// src/controllers/organizationController.js
const pool = require('../config/database');

// 1. Solicitar criação de uma nova ONG (Inicia com status 'pending')
exports.createOrganization = async (req, res) => {
    const { name, description, cnpj, email, phone, city, state, address, logo_url, responsible_name } = req.body;

    if (!name || !email || !phone || !city || !state || !responsible_name) {
        return res.status(400).json({ message: 'Campos obrigatórios: Nome, E-mail, Telefone, Cidade, Estado e Nome do Responsável.' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // Inicia transação atômica SQL

        // Verifica se o usuário já gerencia outra ONG
        const memberCheck = await client.query('SELECT id FROM organization_members WHERE user_id = $1', [req.userId]);
        if (memberCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Usuário já está vinculado a uma organização.' });
        }

        // Insere a nova ONG com status 'pending'
        const orgQuery = `
            INSERT INTO organizations (name, description, cnpj, email, phone, city, state, address, logo_url, responsible_name, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
            RETURNING *;
        `;
        const orgValues = [name, description || null, cnpj || null, email, phone, city, state, address || null, logo_url || null, responsible_name];
        const orgResult = await client.query(orgQuery, orgValues);
        const newOrg = orgResult.rows[0];

        // Associa o criador como 'owner' na tabela de membros
        const memberQuery = `
            INSERT INTO organization_members (organization_id, user_id, role)
            VALUES ($1, $2, 'owner');
        `;
        await client.query(memberQuery, [newOrg.id, req.userId]);

        await client.query('COMMIT'); // Confirma as alterações

        return res.status(201).json({
            message: 'Solicitação de cadastro de ONG enviada com sucesso e pendente de análise.',
            organization: newOrg
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao criar ONG:', error);
        if (error.code === '23505') { // UNIQUE Constraint Violation
            return res.status(400).json({ message: 'CNPJ ou e-mail informado já está em uso.' });
        }
        return res.status(500).json({ message: 'Erro interno de servidor.' });
    } finally {
        client.release();
    }
};

// 2. Consulta dos dados da própria ONG (Área Administrativa do Doador/ONG)
exports.getMyOrganization = async (req, res) => {
    try {
        const queryText = `
            SELECT o.*, om.role AS user_role
            FROM organizations o
            INNER JOIN organization_members om ON o.id = om.organization_id
            WHERE om.user_id = $1;
        `;
        const result = await pool.query(queryText, [req.userId]);
        const org = result.rows[0];

        if (!org) {
            return res.status(404).json({ message: 'Você não administra nenhuma organização.' });
        }

        return res.status(200).json(org);
    } catch (error) {
        console.error('Erro ao buscar própria ONG:', error);
        return res.status(500).json({ message: 'Erro interno de servidor.' });
    }
};

// 3. Atualizar dados da própria ONG
exports.updateMyOrganization = async (req, res) => {
    const { name, description, phone, city, state, address, logo_url, responsible_name } = req.body;

    try {
        // Localiza a ONG do usuário logado
        const memberResult = await pool.query('SELECT organization_id FROM organization_members WHERE user_id = $1', [req.userId]);
        const member = memberResult.rows[0];

        if (!member) {
            return res.status(404).json({ message: 'Organização não encontrada para este usuário.' });
        }

        const updateQuery = `
            UPDATE organizations
            SET 
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                phone = COALESCE($3, phone),
                city = COALESCE($4, city),
                state = COALESCE($5, state),
                address = COALESCE($6, address),
                logo_url = COALESCE($7, logo_url),
                responsible_name = COALESCE($8, responsible_name),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING *;
        `;

        const values = [
            name || null, description || null, phone || null, city || null, 
            state || null, address || null, logo_url || null, responsible_name || null, 
            member.organization_id
        ];

        const result = await pool.query(updateQuery, values);

        return res.status(200).json({
            message: 'Dados da organização atualizados com sucesso!',
            organization: result.rows[0]
        });
    } catch (error) {
        console.error('Erro ao atualizar ONG:', error);
        return res.status(500).json({ message: 'Erro interno de servidor.' });
    }
};

// 4. Listar ONGs Aprovadas (Consulta Pública)
exports.getApprovedOrganizations = async (req, res) => {
    const { city, state } = req.query;

    try {
        let queryText = `
            SELECT id, name, description, city, state, logo_url, created_at
            FROM organizations
            WHERE status = 'approved'
        `;
        const values = [];

        if (city) {
            values.push(city);
            queryText += ` AND city = $${values.length}`;
        }

        if (state) {
            values.push(state);
            queryText += ` AND state = $${values.length}`;
        }

        queryText += ' ORDER BY name ASC';

        const result = await pool.query(queryText, values);

        return res.status(200).json({
            total: result.rowCount,
            organizations: result.rows
        });
    } catch (error) {
        console.error('Erro ao listar ONGs aprovadas:', error);
        return res.status(500).json({ message: 'Erro interno de servidor.' });
    }
};

// 5. Perfil Público de uma ONG especifica (Com contagem de pets disponíveis)
exports.getPublicOrganizationById = async (req, res) => {
    const { id } = req.params;

    try {
        const orgQuery = `
            SELECT id, name, description, email, phone, city, state, logo_url, created_at, status
            FROM organizations
            WHERE id = $1 AND status = 'approved';
        `;
        const orgResult = await pool.query(orgQuery, [id]);
        const org = orgResult.rows[0];

        if (!org) {
            return res.status(404).json({ message: 'Organização não encontrada ou ainda não aprovada.' });
        }

        // Busca a contagem de animais disponíveis dessa ONG
        const petsCountResult = await pool.query(
            "SELECT COUNT(*)::INT AS available_pets_count FROM pets WHERE organization_id = $1 AND status = 'available'",
            [id]
        );

        return res.status(200).json({
            ...org,
            available_pets_count: petsCountResult.rows[0].available_pets_count
        });
    } catch (error) {
        console.error('Erro ao buscar perfil público da ONG:', error);
        return res.status(500).json({ message: 'Erro interno de servidor.' });
    }
};

// =============================================================================
// MODERAÇÃO ADMINISTRATIVA (Apenas platform_admin)
// =============================================================================

// 6. Admin: Listar solicitações de ONGs (filtrável por status)
exports.adminListOrganizations = async (req, res) => {
    const { status } = req.query; // pending, approved, rejected

    try {
        let queryText = 'SELECT * FROM organizations';
        const values = [];

        if (status) {
            values.push(status);
            queryText += ' WHERE status = $1';
        }

        queryText += ' ORDER BY created_at DESC';

        const result = await pool.query(queryText, values);

        return res.status(200).json({
            total: result.rowCount,
            organizations: result.rows
        });
    } catch (error) {
        console.error('Erro na moderação de ONGs:', error);
        return res.status(500).json({ message: 'Erro interno de servidor.' });
    }
};

// 7. Admin: Aprovar ou Rejeitar solicitação de ONG
exports.adminVerifyOrganization = async (req, res) => {
    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Status inválido. Escolha 'approved' ou 'rejected'." });
    }

    if (status === 'rejected' && !rejection_reason) {
        return res.status(400).json({ message: 'Motivo da rejeição é obrigatório ao rejeitar uma organização.' });
    }

    try {
        const queryText = `
            UPDATE organizations
            SET 
                status = $1,
                rejection_reason = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *;
        `;
        const values = [status, status === 'rejected' ? rejection_reason : null, id];

        const result = await pool.query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Organização não encontrada.' });
        }

        return res.status(200).json({
            message: `Organização ${status === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso!`,
            organization: result.rows[0]
        });
    } catch (error) {
        console.error('Erro ao verificar ONG:', error);
        return res.status(500).json({ message: 'Erro interno de servidor.' });
    }
};