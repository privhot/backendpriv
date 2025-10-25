// server.js
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const SYNC_TOKEN = 'c868ca1a-4f65-4a3e-b545-fd71ba4fec3b';

app.post('/gerar-pix', async (req, res) => {
  try {
    const { value, description } = req.body;

    const response = await fetch('https://api.syncpay.com/api/partner/v1/cash-in', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SYNC_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: value / 100, // R$ 12,90 => 12.90
        description: description,
        webhook_url: 'https://backendpriv-1.onrender.com/webhook',
        client: {
          name: 'Cliente Teste',
          cpf: '12345678900',
          email: 'teste@teste.com',
          phone: '51123123123'
        }
      })
    });

    const data = await response.json();

    // Ajuste aqui se a SyncPay retornar outro nome para o código PIX
    res.json({
      pixCode: data.pix_copy_and_paste || data.pix_copia_e_cola || 'Código não disponível',
      paymentId: data.id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao gerar PIX.' });
  }
});

// Endpoint opcional para verificar status do pagamento
app.get('/payment-status/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const response = await fetch(`https://api.syncpay.com/api/partner/v1/payment-status/${id}`, {
      headers: {
        'Authorization': `Bearer ${SYNC_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    res.json({ status: data.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao consultar status do pagamento.' });
  }
});

app.listen(10000, () => console.log('Servidor rodando na porta 10000'));
