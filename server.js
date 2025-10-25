const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Substitua pelo seu token da SyncPay
const SYNC_TOKEN = 'c868ca1a-4f65-4a3e-b545-fd71ba4fec3b';

app.use(cors());
app.use(bodyParser.json());

// Rota para teste
app.get('/', (req, res) => {
  res.send('Backend SyncPay rodando!');
});

// Rota para criar cobrança
app.post('/create-payment', async (req, res) => {
  const { name, cpf, email, phone } = req.body;

  try {
    const response = await axios.post(
      'https://syncpay.apidog.io/api/partner/v1/cash-in',
      {
        amount: 12.90,
        description: "Pagamento VIP",
        webhook_url: "https://seusite.com/webhook",
        client: { name, cpf, email, phone }
      },
      {
        headers: {
          Authorization: `Bearer ${SYNC_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erro ao criar pagamento' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
