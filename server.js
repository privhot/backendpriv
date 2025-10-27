import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Suas chaves SyncPay hardcoded
const CLIENT_ID = '2c34d421-423a-43fe-82f1-135068e3fe74';
const CLIENT_SECRET = '4c20d31d-c68a-44f5-ad88-eedd5d6dae1e';
const BASE_URL = 'https://api.syncpay.io/v1'; // Sandbox pra teste; troque pra prod se OK

// Cache simples pro token (expira em 1h, regenera antes)
let cachedToken = null;
let tokenExpiry = 0;

// Função pra gerar token (OAuth2 Client Credentials)
async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    console.log('🔑 Usando token cached');
    return cachedToken;
  }

  try {
    console.log('🔑 Gerando token SyncPay...');
    const response = await fetch(`${BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro token:', response.status, errorText);
      throw new Error(`Falha na autenticação: ${response.status}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    tokenExpiry = now + (expiresIn * 1000) - 60000; // Regenera 1 min antes
    console.log('✅ Token gerado (expira em', expiresIn, 's)');
    return cachedToken;
  } catch (e) {
    console.error('❌ Erro getToken:', e);
    throw e;
  }
}

// Validação básica
const validatePixRequest = (req, res, next) => {
  const { amount, client } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Amount deve ser > 0 (em reais, ex: 12.90)' });
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
    token = await getAccessToken();

    const { amount, description = 'Pagamento PIX', callback_url = 'https://backendpriv-1.onrender.com/webhook', client } = req.body;

    const bodyData = {
      amount: Math.round(amount * 100), // Converte pra centavos (doc exige)
      currency: 'BRL',
      customer_email: client?.email || 'cliente@teste.com', // Obrigatório
      description,
      callback_url,
      ...(client && { metadata: { client } }) // Name/CPF no metadata
    };

    console.log('🔹 Enviando para SyncPay:', JSON.stringify(bodyData, null, 2));

    const response = await fetch(`${BASE_URL}/cash-in`, {
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

    const data = await response.json();
    console.log('✅ Resposta JSON da SyncPay:', JSON.stringify(data, null, 2));

    const pix = data.pix || {};
    const pixCode = pix.copy_paste || null;

    if (!pixCode) {
      return res.status(400).json({ error: 'Nenhum código PIX gerado' });
    }

    res.json({
      success: true,
      pixCode, // Pra cópia e cola
      qrCodeBase64: pix.qrcode_base64 || null, // Pra QR
      paymentId: data.id,
      status: data.status,
      expiresIn: data.expires_in,
      createdAt: data.created_at
    });

  } catch (e) {
    console.error('❌ Erro backend:', e);
    res.status(500).json({ error: 'Erro interno ao gerar PIX', details: e.message });
  }
});

// Endpoint: Status
app.get('/payment-status/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'ID obrigatório' });

  let token;
  try {
    token = await getAccessToken();

    const response = await fetch(`${BASE_URL}/cash-in/${id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Pagamento não encontrado' });
    }

    const data = await response.json();
    res.json({
      success: true,
      status: data.status,
      paidAt: data.updated_at || null,
      amount: data.amount / 100 // Volta pra reais
    });
  } catch (e) {
    console.error('❌ Erro status:', e);
    res.status(500).json({ error: 'Erro ao consultar status' });
  }
});

// Webhook
app.post('/webhook', (req, res) => {
  try {
    const { event, data } = req.body;
    console.log('🔄 Webhook SyncPay:', event, data.id, data.status);
    // TODO: Atualize DB se 'paid'
    res.status(200).send('OK');
  } catch (e) {
    console.error('❌ Erro webhook:', e);
    res.status(500).send('Error');
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
