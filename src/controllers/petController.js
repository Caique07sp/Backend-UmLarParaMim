const pool = require('../config/database');

exports.createPet = async (req, res) => {
    const { name, species, age_years, description, breed, gender, size, city, state, photo } = req.body;

    if (!name || !species) {
        return res.status(400).json({ message: 'Nome e espécie são obrigatórios.' });
    }

    try {
        // Verifica se o usuário pertence a uma ONG Aprovada
        const memberResult = await pool.query(
            `SELECT om.organization_id 
             FROM organization_members om
             INNER JOIN organizations o ON om.organization_id = o.id
             WHERE om.user_id = $1 AND o.status = 'approved'`,
            [req.userId]
        );

        const organizationId = memberResult.rows.length > 0 ? memberResult.rows[0].organization_id : null;

        const queryText = `
            INSERT INTO pets (name, species, age_years, description, breed, gender, size, city, state, photo, user_id, organization_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *;
        `;
        const values = [
            name, species, age_years || null, description || null, breed || 'SRD',
            gender || null, size || null, city || null, state || null, photo || null,
            req.userId, organizationId
        ];

        const result = await pool.query(queryText, values);

        return res.status(201).json({
            message: 'Pet cadastrado com sucesso!',
            pet: result.rows[0]
        });
    } catch (error) {
        console.error('Erro ao cadastrar pet:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.getAllPets = async (req, res) => {
    try {
        const queryText = `
            SELECT 
                pets.id,
                pets.name AS pet_name,
                pets.species,
                pets.breed,
                pets.age_years,
                pets.description,
                pets.gender,
                pets.size,
                pets.city,
                pets.photo_url,
                pets.status,
                pets.created_at,
                users.id AS donor_id,
                users.name AS donor_name,
                users.phone AS donor_phone,
                users.email AS donor_email
            FROM pets
            INNER JOIN users ON pets.user_id = users.id
            WHERE pets.status = $1
            ORDER BY pets.created_at DESC;
        `;

        const result = await pool.query(queryText, ['available']);

        const formattedPets = result.rows.map(row => ({
            id: row.id,
            name: row.pet_name,
            species: row.species,
            breed: row.breed,
            age_years: row.age_years,
            description: row.description,
            gender: row.gender,
            size: row.size,
            city: row.city,
            photo_url: row.photo_url,
            status: row.status,
            created_at: row.created_at,
            donor: {
                id: row.donor_id,
                name: row.donor_name,
                phone: row.donor_phone,
                email: row.donor_email
            }
        }));

        return res.status(200).json({
            total: formattedPets.length,
            pets: formattedPets
        });

    } catch (error) {
        console.error('Erro ao buscar todos os pets:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.getMyPets = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pets WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
        return res.status(200).json({ total: result.rowCount, myPets: result.rows });
    } catch (error) {
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.updatePet = async (req, res) => {
    const { id } = req.params;
    const { name, species, age_years, description, breed, gender, size, city, photo_url, status } = req.body;

    try {
        const petResult = await pool.query('SELECT * FROM pets WHERE id = $1', [id]);
        const pet = petResult.rows[0];

        if (!pet) return res.status(404).json({ message: 'Pet não encontrado.' });
        if (pet.user_id !== req.userId) return res.status(403).json({ message: 'Acesso negado.' });

        const updateQuery = `
            UPDATE pets 
            SET name = COALESCE($1, name), species = COALESCE($2, species), age_years = COALESCE($3, age_years),
                description = COALESCE($4, description), breed = COALESCE($5, breed), gender = COALESCE($6, gender),
                size = COALESCE($7, size), city = COALESCE($8, city), photo_url = COALESCE($9, photo_url), status = COALESCE($10, status)
            WHERE id = $11 RETURNING *;
        `;
        const values = [name || null, species || null, age_years || null, description || null, breed || null, gender || null, size || null, city || null, photo_url || null, status || null, id];
        const updatedResult = await pool.query(updateQuery, values);

        return res.status(200).json({ message: 'Pet atualizado!', pet: updatedResult.rows[0] });
    } catch (error) {
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};

exports.deletePet = async (req, res) => {
    const { id } = req.params;

    try {
        const petResult = await pool.query('SELECT * FROM pets WHERE id = $1', [id]);
        const pet = petResult.rows[0];

        if (!pet) return res.status(404).json({ message: 'Pet não encontrado.' });
        if (pet.user_id !== req.userId) return res.status(403).json({ message: 'Acesso negado.' });

        await pool.query('DELETE FROM pets WHERE id = $1', [id]);
        return res.status(200).json({ message: 'Pet removido com sucesso!' });
    } catch (error) {
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};