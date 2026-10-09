const pool = require('../config/database');

// 1. Iniciar ou Buscar Conversa
exports.startConversation = async (req, res) => {
    const { pet_id, adoption_request_id } = req.body;

    if (!pet_id) {
        return res.status(400).json({ message: 'O ID do pet é obrigatório para iniciar uma conversa.' });
    }

    try {
        const petResult = await pool.query('SELECT organization_id, user_id FROM pets WHERE id = $1', [pet_id]);
        const pet = petResult.rows[0];

        if (!pet) {
            return res.status(404).json({ message: 'Pet não encontrado.' });
        }

        // Verifica se já existe uma conversa entre este adotante e este pet
        const convCheck = await pool.query(
            'SELECT * FROM conversations WHERE user_id = $1 AND pet_id = $2',
            [req.userId, pet_id]
        );

        if (convCheck.rows.length > 0) {
            return res.status(200).json({
                message: 'Conversa já existente.',
                conversation: convCheck.rows[0]
            });
        }

        // Cria nova conversa
        const createQuery = `
            INSERT INTO conversations (user_id, pet_id, organization_id, adoption_request_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const result = await pool.query(createQuery, [
            req.userId, 
            pet_id, 
            pet.organization_id || null, 
            adoption_request_id || null
        ]);

        return res.status(201).json({
            message: 'Conversa iniciada com sucesso!',
            conversation: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao iniciar conversa:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

// 2. Listar Conversas do Usuário Autenticado
exports.getConversations = async (req, res) => {
    try {
        const queryText = `
            SELECT c.*, p.name AS pet_name, p.photo AS pet_photo, o.name AS organization_name,
                   (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
                   (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message_at
            FROM conversations c
            INNER JOIN pets p ON c.pet_id = p.id
            LEFT JOIN organizations o ON c.organization_id = o.id
            WHERE c.user_id = $1 OR c.organization_id IN (
                SELECT organization_id FROM organization_members WHERE user_id = $1
            )
            ORDER BY c.updated_at DESC;
        `;
        const result = await pool.query(queryText, [req.userId]);

        return res.status(200).json({
            total: result.rowCount,
            conversations: result.rows
        });
    } catch (error) {
        console.error('Erro ao buscar conversas:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

// 3. Listar Mensagens de uma Conversa
exports.getMessages = async (req, res) => {
    const { id } = req.params; // conversation_id

    try {
        // Validação de Autorização: O usuário faz parte da conversa?
        const convCheck = await pool.query(
            `SELECT c.* FROM conversations c
             LEFT JOIN organization_members om ON c.organization_id = om.organization_id
             WHERE c.id = $1 AND (c.user_id = $2 OR om.user_id = $2)`,
            [id, req.userId]
        );

        if (convCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Acesso negado. Você não participa desta conversa.' });
        }

        const msgQuery = `
            SELECT m.*, u.name AS sender_name
            FROM messages m
            INNER JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = $1
            ORDER BY m.created_at ASC;
        `;
        const messages = await pool.query(msgQuery, [id]);

        return res.status(200).json({
            total: messages.rowCount,
            messages: messages.rows
        });
    } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

// 4. Enviar Mensagem
exports.sendMessage = async (req, res) => {
    const { id } = req.params; // conversation_id
    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ message: 'O conteúdo da mensagem não pode estar vazio.' });
    }

    try {
        // Validação de Autorização
        const convCheck = await pool.query(
            `SELECT c.* FROM conversations c
             LEFT JOIN organization_members om ON c.organization_id = om.organization_id
             WHERE c.id = $1 AND (c.user_id = $2 OR om.user_id = $2)`,
            [id, req.userId]
        );

        if (convCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Acesso negado. Você não participa desta conversa.' });
        }

        // Insere a mensagem
        const insertMsg = `
            INSERT INTO messages (conversation_id, sender_id, content)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await pool.query(insertMsg, [id, req.userId, content]);

        // Atualiza o timestamp da conversa
        await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

        return res.status(201).json({
            message: 'Mensagem enviada com sucesso!',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};