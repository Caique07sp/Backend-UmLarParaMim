require('dotenv').config();
const express = require('express');

const authRoutes = require('./routes/authRoutes');
const petRoutes = require('./routes/petRoutes');
const orgRoutes = require('./routes/organizationRoutes');
const adoptionRoutes = require('./routes/adoptionRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares Globais
app.use(express.json());

// Rotas do Sistema
app.use('/auth', authRoutes);
app.use('/pets', petRoutes);
app.use('/organizations', orgRoutes);
app.use('/adoption-requests', adoptionRoutes);
app.use('/chat', chatRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'API PetConnect rodando com sucesso!' });
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});