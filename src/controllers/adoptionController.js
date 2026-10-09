const pool = require('../config/database');

// 1. Criar Solicitação de Adoção
exports.createAdoptionRequest = async (req, res) => {
    const { pet_id, initial_message } = req.body;

    if (!pet_id || !initial_message) {
        return res.status(400).json({ message: 'O ID do pet e uma mensagem inicial são obrigatórios.' });
    }

    try {
        // Busca o pet para checar existência, status e ONG responsável
        const petResult = await pool.query('SELECT * FROM pets WHERE id = $1', [pet_id]);
        const pet = petResult.rows[0];

        if (!pet) {
            return res.status(404).json({ message: 'Pet não encontrado.' });
        }

        if (pet.status !== 'available') {
            return res.status(400).json({ message: 'Este animal não está disponível para adoção.' });
        }

        // Impede que o próprio dono/doador peça a adoção do seu próprio pet
        if (pet.user_id === req.userId) {
            return res.status(400).json({ message: 'Você não pode solicitar a adoção do seu próprio animal.' });
        }

        const queryText = `
            INSERT INTO adoption_requests (user_id, pet_id, organization_id, initial_message)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const values = [req.userId, pet_id, pet.organization_id || null, initial_message];
        const result = await pool.query(queryText, values);

        return res.status(201).json({
            message: 'Solicitação de adoção enviada com sucesso!',
            request: result.rows[0]
        });

    } catch (error) {
        if (error.code === '23505') { // UNIQUE Constraint (user_id, pet_id)
            return res.status(400).json({ message: 'Você já enviou uma solicitação de adoção para este pet.' });
        }
        console.error('Erro ao criar solicitação de adoção:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

// 2. Minhas Solicitações (Visão do Adotante)
exports.getMyAdoptionRequests = async (req, res) => {
    try {
        const queryText = `
            SELECT ar.*, p.name AS pet_name, p.photo AS pet_photo, o.name AS organization_name
            FROM adoption_requests ar
            INNER JOIN pets p ON ar.pet_id = p.id
            LEFT JOIN organizations o ON ar.organization_id = o.id
            WHERE ar.user_id = $1
            ORDER BY ar.created_at DESC;
        `;
        const result = await pool.query(queryText, [req.userId]);

        return res.status(200).json({
            total: result.rowCount,
            requests: result.rows
        });
    } catch (error) {
        console.error('Erro ao buscar minhas solicitações:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

// 3. Solicitações Recebidas pela ONG (Visão da ONG)
exports.getOrgAdoptionRequests = async (req, res) => {
    try {
        // Descobre a ONG vinculada ao usuário logado
        const memberResult = await pool.query('SELECT organization_id FROM organization_members WHERE user_id = $1', [req.userId]);
        const member = memberResult.rows[0];

        if (!member) {
            return res.status(403).json({ message: 'Usuário não administra nenhuma organização.' });
        }

        const queryText = `
            SELECT ar.*, p.name AS pet_name, u.name AS adopter_name, u.email AS adopter_email, u.phone AS adopter_phone
            FROM adoption_requests ar
            INNER JOIN pets p ON ar.pet_id = p.id
            INNER JOIN users u ON ar.user_id = u.id
            WHERE ar.organization_id = $1
            ORDER BY ar.created_at DESC;
        `;
        const result = await pool.query(queryText, [member.organization_id]);

        return res.status(200).json({
            total: result.rowCount,
            requests: result.rows
        });
    } catch (error) {
        console.error('Erro ao buscar solicitações da ONG:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

// 4. Atualizar Status da Solicitação (Aprovado / Rejeitado / Em análise)
exports.updateAdoptionStatus = async (req, res) => {
    const { id } = req.params;
    const { status, internal_notes } = req.body;

    const validStatuses = ['under_review', 'approved', 'rejected', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Status inválido.' });
    }

    try {
        const reqResult = await pool.query('SELECT * FROM adoption_requests WHERE id = $1', [id]);
        const adoptionReq = reqResult.rows[0];

        if (!adoptionReq) {
            return res.status(404).json({ message: 'Solicitação de adoção não encontrada.' });
        }

        const updateQuery = `
            UPDATE adoption_requests
            SET status = $1, internal_notes = COALESCE($2, internal_notes), updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *;
        `;
        const result = await pool.query(updateQuery, [status, internal_notes || null, id]);

        // Se a solicitação foi APROVADA, atualiza o status do animal para 'adopted'
        if (status === 'approved') {
            await pool.query("UPDATE pets SET status = 'adopted' WHERE id = $1", [adoptionReq.pet_id]);
        }

        return res.status(200).json({
            message: `Solicitação atualizada para '${status}' com sucesso!`,
            request: result.rows[0]
        });
    } catch (error) {
        console.error('Erro ao atualizar status de adoção:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};