import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SYNC_API_TOKEN = process.env.SYNC_API_TOKEN; // token no Render como variável de ambiente
const SYNC_API_URL = 'https://syncpay.apidog.io';

// Endpoint para criar pagamento de R$12,90
app.post('/create-payment', async (req, res) => {
  try {
    const client = {
      name: req.body.name || 'Cliente Teste',
      cpf: req.body.cpf || '12345678900',
      email: req.body.email || 'teste@teste.com',
      phone: req.body.phone || '51123123123',
    };

    const response = await axios.post(
      `${SYNC_API_URL}/api/partner/v1/cash-in`,
      {
        amount: 12.90,
        description: "Pagamento de R$12,90",
        webhook_url: req.body.webhook_url || "https://seusite.com/webhook",
        client,
        split: []
      },
      {
        headers: {
          Authorization: `Bearer ${SYNC_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Erro ao criar pagamento:', error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao criar pagamento' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});

