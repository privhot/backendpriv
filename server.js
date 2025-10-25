// server.js
import express from 'express';
import fetch from 'node-fetch'; // se não tiver, instale: npm install node-fetch
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 10000;

// Seu token da SyncPay
const SYNC_TOKEN = 'c868ca1a-4f65-4a3e-b545-fd71ba4fec3b';

app.use(cors());
app.use(bodyParser.json());

// Endpoint para gerar PIX
app.post('/gerar-pix', async (req, res) => {
  const { value, description } = req.body;

  if (!value || !description) {
    return res.status(400).json({ error: 'Valor e descrição são obrigatórios' });
  }

  try {
    const body = {
      amount: value / 100, // 1290 -> 12.90
      description: description,
      webhook_url: 'https://seusite.com/webhook',
      client: {
        name: 'Cliente Teste',
        cpf: '12345678900',
        email: 'teste@cliente.com',
        phone: '11999999999'
      }
    };

    const response = await fetch('https://syncpay.apidog.io/api/partner/v1/cash-in', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SYNC_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!data.pix || !data.pix.code) {
      console.log('Erro SyncPay:', data);
      return res.status(500).json({ error: 'Erro ao gerar PIX', raw: data });
    }

    res.json({
      pixCode: data.pix.code,
      paymentId: data.id || null
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor', details: err.message });
  }
});

// Endpoint para checar status (opcional)
app.get('/payment-status/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await fetch(`https://syncpay.apidog.io/api/partner/v1/payments/${id}`, {
      headers: {
        'Authorization': `Bearer ${SYNC_TOKEN}`
      }
    });
    const data = await response.json();
    res.json({ status: data.status || 'pending' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar status', details: err.message });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
