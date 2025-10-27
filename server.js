import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import crypto from 'crypto'; // Nativo pra webhook

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const SYNC_TOKEN = 'c868ca1a-4f65-4a3e-b545-fd71ba4fec3b'; // Hardcoded – troque pelo seu real!
const SYNC_SECRET = 'sua_chave_secreta_webhook_aqui'; // Opcional, hardcoded também

// Validação básica pro /gerar-pix
const validatePixRequest = (req, res, next) => {
  const { amount, currency = 'BRL', client } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Amount deve ser > 0' });
  }
  if (currency !== 'BRL') {
    return res.status(400).json({ error: 'Currency deve ser BRL' });
  }
  if (client && (!client.name || !client.cpf || !/^\d{11}$/.test(client.cpf))) {
    return res.status(400).json({ error: 'Client: name e CPF (11 dígitos) obrigatórios se fornecido' });
  }
  next();
};

// Endpoint: Gerar PIX (POST /gerar-pix)
app.post('/gerar-pix', validatePixRequest, async (req, res) => {
  try {
    const { amount, description = 'Pagamento PIX', callback_url = 'https://seusite.com/webhook', client } = req.body;

    const bodyData = {
      amount,
      currency: 'BRL',
      description,
      callback_url,
      ...(client && { metadata: { client } }) // Client vai pro metadata
    };

    console.log('🔹 Enviando para SyncPay:', JSON.stringify(bodyData, null, 2));

    const response = await fetch('https://api.syncpayments.com.br/api/partner/v1/cash-in', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SYNC_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro HTTP SyncPay:', response.status, errorText);
      return res.status(response.status).json({ error: 'Falha na SyncPay', details: errorText });
    }

    const dataText = await response.text();
    console.log('📩 Resposta bruta da SyncPay:', dataText);

    let data;
    try {
      data = JSON.parse(dataText);
    } catch (err) {
      console.error('❌ Resposta não é JSON válida:', dataText);
      return res.status(500).json({ error: 'Resposta inválida da SyncPay' });
    }

    console.log('✅ Resposta JSON da SyncPay:', JSON.stringify(data, null, 2));

    // Extrai PIX: prioriza copy_paste
    const pix = data.pix || {};
    const pixCode = pix.copy_paste || pix.pix_copy_paste || pix.brcode || null;

    if (!pixCode) {
      return res.status(400).json({ error: 'Nenhum código PIX gerado' });
    }

    res.json({
      success: true,
      pixCode, // String pra cópia e cola no frontend
      qrCodeBase64: pix.qrcode || null, // Pra renderizar QR
      paymentId: data.id,
      status: data.status,
      expiresIn: data.expires_in, // Em segundos
      createdAt: data.created_at
    });

  } catch (e) {
    console.error('❌ Erro backend:', e);
    res.status(500).json({ error: 'Erro interno ao gerar PIX', details: e.message });
  }
});

// Endpoint: Status do pagamento (GET /payment-status/:id)
app.get('/payment-status/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'ID obrigatório' });

  try {
    const response = await fetch(`https://api.syncpayments.com.br/api/partner/v1/cash-in/${id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${SYNC_TOKEN}` }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Pagamento não encontrado' });
    }

    const data = await response.json();
    res.json({
      success: true,
      status: data.status,
      paidAt: data.paid_at,
      expiresAt: data.expires_at,
      amount: data.amount,
      currency: data.currency
    });
  } catch (e) {
    console.error('❌ Erro status:', e);
    res.status(500).json({ error: 'Erro ao consultar status' });
  }
});

// Endpoint: Webhook (POST /webhook) - Recebe updates da SyncPay
app.post('/webhook', (req, res) => {
  try {
    const { event, data } = req.body;
    const signature = req.headers['x-syncpay-signature'];

    // Verifica signature se SYNC_SECRET configurado
    if (SYNC_SECRET) {
      const payload = JSON.stringify(req.body);
      const computedSig = crypto.createHmac('sha256', SYNC_SECRET).update(payload).digest('hex');
      if (signature !== computedSig) {
        console.error('❌ Webhook signature inválida');
        return res.status(401).send('Unauthorized');
      }
    }

    if (event === 'cash_in.status_updated') {
      console.log('🔄 Webhook recebido:', data.id, 'Status:', data.status);
      // TODO: Aqui atualize seu DB, envie email, etc.
      // Ex: if (data.status === 'paid') { /* Libere acesso ao site */ }
    }

    res.status(200).send('OK'); // SyncPay espera 200 pra confirmar
  } catch (e) {
    console.error('❌ Erro webhook:', e);
    res.status(500).send('Error');
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
