import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const SYNC_TOKEN = 'c868ca1a-4f65-4a3e-b545-fd71ba4fec3b'; // seu token SyncPay

// Gerar PIX
app.post('/gerar-pix', async (req, res) => {
  try {
    const valor = 12.90; // valor fixo em reais
    const response = await fetch('https://api.syncpay.com.br/api/partner/v1/cash-in', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SYNC_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: valor,
        description: 'Pagamento 30 DIAS',
        webhook_url: 'https://seusite.com/webhook',
        client: {
          name: 'Cliente Teste',
          cpf: '12345678900',
          email: 'teste@teste.com',
          phone: '51999999999'
        }
      })
    });

    const data = await response.json();

    if (!data.id || !data.pix_copy_paste) {
      console.error('Erro SyncPay:', data);
      return res.status(500).json({ error: 'Não foi possível gerar PIX' });
    }

    res.json({
      pixCode: data.pix_copy_paste,
      paymentId: data.id
    });

  } catch (e) {
    console.error('Erro backend:', e);
    res.status(500).json({ error: 'Erro ao gerar PIX' });
  }
});

// Status do pagamento
app.get('/payment-status/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await fetch(`https://api.syncpay.com.br/api/partner/v1/cash-in/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SYNC_TOKEN}`
      }
    });
    const data = await response.json();
    res.json({ status: data.status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ status: 'error' });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
