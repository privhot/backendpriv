import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import crypto from 'crypto'; // Pra webhook

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Suas chaves SyncPay hardcoded
const CLIENT_ID = '2c34d421-423a-43fe-82f1-135068e3fe74';
const CLIENT_SECRET = '4c20d31d-c68a-44f5-ad88-eedd5d6dae1e';
const BASE_URL = 'https://api.syncpayments.com.br';

// Função pra gerar token Bearer (chamada a cada /gerar-pix)
async function getAccessToken() {
  try {
    console.log('🔑 Gerando token SyncPay...');
    const response = await fetch(`${BASE_URL}/Authentication/Token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro ao gerar token:', response.status, errorText);
      throw new Error(`Falha na autenticação SyncPay: ${response.status}`);
    }

    const data = await response.json();
    const token = data.accessToken;
    console.log('✅ Token gerado (expira em', data.expiresInSeconds, 's)');
    return token;
  } catch (e) {
    console.error('❌ Erro getToken:', e);
    throw e;
  }
}

// Validação básica
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

// Endpoint: Gerar PIX
app.post('/gerar-pix', validatePixRequest, async (req, res) => {
  let token;
  try {
    // Gera token fresco
    token = await getAccessToken();

    const { amount, description = 'Pagamento PIX', callback_url = 'https://backendpriv-1.onrender.com/webhook', client } = req.body;

    const bodyData = {
      amount,
      currency: 'BRL',
      description,
      callback_url,
      ...(client && { metadata: { client } })
    };

    console.log('🔹 Enviando para SyncPay:', JSON.stringify(bodyData, null, 2));

    const response = await fetch(`${BASE_URL}/api/partner/v1/cash-in`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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

    const pix = data.pix || {};
    const pixCode = pix.copy_paste || pix.pix_copy_paste || pix.brcode || null;

    if (!pixCode) {
      return res.status(400).json({ error: 'Nenhum código PIX gerado' });
    }

    res.json({
      success: true,
      pixCode,
      qrCodeBase64: pix.qrcode || null,
      paymentId: data.id,
      status: data.status,
      expiresIn: data.expires_in,
      createdAt: data.created_at
    });

  } catch (e) {
    console.error('❌ Erro backend (inclui token):', e);
    res.status(500).json({ error: 'Erro interno ao gerar PIX', details: e.message });
  }
});

// Endpoint: Status (usa token fresco também)
app.get('/payment-status/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'ID obrigatório' });

  let token;
  try {
    token = await getAccessToken();

    const response = await fetch(`${BASE_URL}/api/partner/v1/cash-in/${id}`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}` 
      }
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

// Webhook (sem token, SyncPay envia pra cá)
app.post('/webhook', (req, res) => {
  try {
    const { event, data } = req.body;
    const signature = req.headers['x-syncpay-signature'];

    // Verifica signature se você tiver SYNC_SECRET (adicione hardcoded se quiser)
    // const SYNC_SECRET = 'sua_chave_secreta';
    // if (SYNC_SECRET) { ... } // Mesmo código anterior

    if (event === 'cash_in.status_updated') {
      console.log('🔄 Webhook recebido:', data.id, 'Status:', data.status);
      // TODO: Atualize DB, libere acesso, etc.
    }

    res.status(200).send('OK');
  } catch (e) {
    console.error('❌ Erro webhook:', e);
    res.status(500).send('Error');
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
