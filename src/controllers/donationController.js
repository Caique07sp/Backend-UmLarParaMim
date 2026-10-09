// src/controllers/donationController.js
const pool = require('../config/database');

// 1. Pública: Buscar chave Pix da ONG para doação
exports.getDonationInfo = async (req, res) => {
    const { id } = req.params; // ID da ONG

    try {
        const queryText = `
            SELECT pix_key, pix_type, receiver_name, description 
            FROM donation_info 
            WHERE organization_id = $1;
        `;
        const result = await pool.query(queryText, [id]);
        const donationInfo = result.rows[0];

        if (!donationInfo) {
            return res.status(404).json({ message: 'Esta organização ainda não configurou dados de doação Pix.' });
        }

        return res.status(200).json(donationInfo);
    } catch (error) {
        console.error('Erro ao buscar chave Pix:', error);
        return res.status(500).json({ message: 'Erro interno de servidor.' });
    }
};

// 2. Privada (Apenas Admin da ONG): Configurar ou Atualizar chave Pix
exports.upsertDonationInfo = async (req, res) => {
    const { pix_key, pix_type, receiver_name, description } = req.body;

    if (!pix_key || !pix_type || !receiver_name) {
        return res.status(400).json({ message: 'Campos obrigatórios: pix_key, pix_type e receiver_name.' });
    }

    const validTypes = ['cpf', 'cnpj', 'email', 'phone', 'random'];
    if (!validTypes.includes(pix_type)) {
        return res.status(400).json({ message: 'pix_type inválido. Tipos aceitos: cpf, cnpj, email, phone, random.' });
    }

    try {
        // Descobre o ID da organização do usuário logado
        const memberResult = await pool.query('SELECT organization_id FROM organization_members WHERE user_id = $1', [req.userId]);
        const member = memberResult.rows[0];

        if (!member) {
            return res.status(403).json({ message: 'Usuário não administra nenhuma organização.' });
        }

        const queryText = `
            INSERT INTO donation_info (organization_id, pix_key, pix_type, receiver_name, description)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (organization_id) 
            DO UPDATE SET 
                pix_key = EXCLUDED.pix_key,
                pix_type = EXCLUDED.pix_type,
                receiver_name = EXCLUDED.receiver_name,
                description = EXCLUDED.description,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;

        const values = [member.organization_id, pix_key, pix_type, receiver_name, description || null];
        const result = await pool.query(queryText, values);

        return res.status(200).json({
            message: 'Informações de doação Pix configuradas com sucesso!',
            donationInfo: result.rows[0]
        });
    } catch (error) {
        console.error('Erro ao configurar doação Pix:', error);
        return res.status(500).json({ message: 'Erro interno de servidor.' });
    }
};

// 3. Privada (Apenas Admin da ONG): Remover chave Pix
exports.removeDonationInfo = async (req, res) => {
    try {
        const memberResult = await pool.query('SELECT organization_id FROM organization_members WHERE user_id = $1', [req.userId]);
        const member = memberResult.rows[0];

        if (!member) {
            return res.status(403).json({ message: 'Usuário não administra nenhuma organização.' });
        }

        await pool.query('DELETE FROM donation_info WHERE organization_id = $1', [member.organization_id]);

        return res.status(200).json({ message: 'Informações de doação Pix removidas com sucesso.' });
    } catch (error) {
        console.error('Erro ao remover chave Pix:', error);
        return res.status(500).json({ message: 'Erro interno de servidor.' });
    }
};