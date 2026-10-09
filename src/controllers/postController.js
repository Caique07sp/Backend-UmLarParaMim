const pool = require('../config/database');


exports.createPost = async (req, res) => {
    const { photo_url, description, pet_id } = req.body;

    if (!photo_url) {
        return res.status(400).json({ message: 'A URL da foto é obrigatória.' });
    }

    try {
        const queryText = `
            INSERT INTO posts (photo_url, description, pet_id, user_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const result = await pool.query(queryText, [photo_url, description || null, pet_id || null, req.userId]);

        return res.status(201).json({ message: 'Post publicado com sucesso!', post: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};


exports.getFeed = async (req, res) => {
    try {
        const queryText = `
            SELECT 
                p.id,
                p.photo_url,
                p.description,
                p.created_at,
                u.id AS author_id,
                u.name AS author_name,
                -- Conta total de curtidas
                COUNT(DISTINCT l.id)::INT AS likes_count,
                -- Conta total de comentários
                COUNT(DISTINCT c.id)::INT AS comments_count,
                -- Verifica se o usuário logado já curtiu este post
                EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = $1) AS liked_by_me
            FROM posts p
            INNER JOIN users u ON p.user_id = u.id
            LEFT JOIN likes l ON p.id = l.post_id
            LEFT JOIN comments c ON p.id = c.post_id
            GROUP BY p.id, u.id
            ORDER BY p.created_at DESC;
        `;

        const result = await pool.query(queryText, [req.userId || null]);

        return res.status(200).json({ total: result.rowCount, posts: result.rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};


exports.toggleLike = async (req, res) => {
    const { postId } = req.params;

    try {
   
        const likeCheck = await pool.query(
            'SELECT * FROM likes WHERE user_id = $1 AND post_id = $2',
            [req.userId, postId]
        );

        if (likeCheck.rows.length > 0) {
           
            await pool.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [req.userId, postId]);
            return res.status(200).json({ message: 'Curtida removida.' });
        } else {
          
            await pool.query('INSERT INTO likes (user_id, post_id) VALUES ($1, $2)', [req.userId, postId]);
            return res.status(201).json({ message: 'Post curtido com sucesso!' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};


exports.addComment = async (req, res) => {
    const { postId } = req.params;
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({ message: 'O comentário não pode ser vazio.' });
    }

    try {
        const queryText = `
            INSERT INTO comments (content, user_id, post_id)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await pool.query(queryText, [content, req.userId, postId]);

        return res.status(201).json({ message: 'Comentário enviado!', comment: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};