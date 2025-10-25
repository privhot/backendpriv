import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const SYNC_TOKEN = 'c868ca1a-4f65-4a3e-b545-fd71ba4fec3b';

// Gerar PIX
app.post('/gerar-pix', async (req, res) => {
  try {
    const valor = 12.90;

    const bodyData = {
      amount: valor,
      description: 'Pagamento 30 DIAS',
      webhook_url: 'https://seusite.com/webhook',
      client: {
        name: 'Cliente Teste',
        cpf: '12345678900',
        email: 'teste@teste.com',
        phone: '51999999999'
      }
    };

    console.log('🔹 Enviando para SyncPay:', JSON.stringify(bodyData));

    const response = await fetch('https://api.syncpayments.com.br/api/partner/v1/cash-in', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SYNC_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData)
    });

    const dataText = await response.text();
    console.log('📩 Resposta bruta da SyncPay:', dataText);

    let data;
    try {
      data = JSON.parse(dataText);
    } catch (err) {
      console.error('❌ Resposta não é JSON válida:', dataText);
      return res.status(500).json({ error: 'Resposta inválida da SyncPay', raw: dataText });
    }

    console.log('✅ Resposta JSON da SyncPay:', data);

    // Captura flexível de qualquer campo de PIX
    const pixCode =
      data.pix_copy_paste ||
      data.brcode ||
      data.qrcode ||
      (data.pix && (data.pix.brcode || data.pix.qrcode || data.pix.copy_paste)) ||
      null;

    if (!pixCode) {
      return res.status(500).json({
        error: 'Nenhum código PIX retornado',
        resposta: data
      });
    }

    res.json({
      pixCode: pixCode,
      paymentId: data.id || data.txid || null
    });

  } catch (e) {
    console.error('❌ Erro backend:', e);
    res.status(500).json({ error: 'Erro interno ao gerar PIX', detalhes: e.message });
  }
});

// Status do pagamento
app.get('/payment-status/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await fetch(`https://api.syncpayments.com.br/api/partner/v1/cash-in/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SYNC_TOKEN}`
      }
    });

    const data = await response.json();
    res.json({ status: data.status });
  } catch (e) {
    console.error('❌ Erro status:', e);
    res.status(500).json({ status: 'error', detalhes: e.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
