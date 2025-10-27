import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import crypto from 'crypto'; // Pra webhook signature se precisar

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Chaves HooPay hardcoded
const CLIENT_ID = '69ed34bb6a849cfd32c01b16c56050ec';
const CLIENT_SECRET = 'fbee087d641bad7eea36ebdb33fc167f3ba2a94d4d67ffe2a5bb5e8685d7fca6';
const BASE_URL = 'https://api.hoopay.com.br'; // Troque pra sandbox se teste
const CALLBACK_URL = 'https://backendpriv-1.onrender.com/webhook'; // Seu webhook

// Basic Auth header (base64(clientId:secret))
const getBasicAuth = () => {
  const credentials = `${CLIENT_ID}:${CLIENT_SECRET}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
};

// Validação básica
const validatePixRequest = (req, res, next) => {
  const { amount, client } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Amount deve ser > 0' });
  }
  if (!client?.name || !client?.email || !client?.phone || !client?.cpf || !/^\d{11}$/.test(client.cpf)) {
    return res.status(400).json({ error: 'Client: name, email, phone, cpf (11 dígitos) obrigatórios' });
  }
  next();
};

// Endpoint: Gerar PIX
app.post('/gerar-pix', validatePixRequest, async (req, res) => {
  try {
    const { amount, description = 'Pagamento PIX', client } = req.body;
    const ip = req.ip || '192.168.0.1'; // IP do cliente

    const bodyData = {
      amount,
      customer: {
        name: client.name,
        email: client.email,
        phone: client.phone,
        document: client.cpf
      },
      products: [
        {
          title: description, // Ex: '30 DIAS'
          amount,
          quantity: 1
        }
      ],
      payments: [
        {
          type: 'pix'
        }
      ],
      data: {
        ip,
        callbackURL: CALLBACK_URL
      }
    };

    console.log('🔹 Enviando para HooPay:', JSON.stringify(bodyData, null, 2));

    const response = await fetch(`${BASE_URL}/charge`, {
      method: 'POST',
      headers: {
        'Authorization': getBasicAuth(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro HTTP HooPay:', response.status, errorText);
      return res.status(response.status).json({ error: 'Falha na HooPay', details: errorText });
    }

    const data = await response.json();
    console.log('✅ Resposta JSON da HooPay:', JSON.stringify(data, null, 2));

    if (data.payment?.hasErrors || data.payment?.status !== 'pending') {
      return res.status(400).json({ error: 'Falha ao gerar PIX', details: data.payment?.message || 'Status inválido' });
    }

    const charge = data.payment?.charges?.[0];
    const pixCode = charge?.pixPayload || null;
    const qrCodeBase64 = charge?.pixQrCode || null;
    const expiresAt = charge?.expireAt || null;

    if (!pixCode) {
      return res.status(400).json({ error: 'Nenhum código PIX gerado' });
    }

    res.json({
      success: true,
      pixCode, // Cópia e cola
      qrCodeBase64, // Pra render QR
      paymentId: data.orderUUID, // Pra status
      status: data.payment.status,
      expiresAt,
      createdAt: data.paymentDate
    });

  } catch (e) {
    console.error('❌ Erro backend:', e);
    res.status(500).json({ error: 'Erro interno ao gerar PIX', details: e.message });
  }
});

// Endpoint: Status do pagamento
app.get('/payment-status/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'ID obrigatório' });

  try {
    const response = await fetch(`${BASE_URL}/pix/consult/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': getBasicAuth()
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Pagamento não encontrado' });
    }

    const data = await response.json();
    res.json({
      success: true,
      status: data.payment?.status || 'unknown',
      paidAt: data.paymentDate,
      expiresAt: data.payment?.charges?.[0]?.expireAt || null,
      amount: data.payment?.charges?.[0]?.amount || null
    });
  } catch (e) {
    console.error('❌ Erro status:', e);
    res.status(500).json({ error: 'Erro ao consultar status' });
  }
});

// Endpoint: Webhook (recebe notificações da HooPay via callbackURL)
app.post('/webhook', (req, res) => {
  try {
    const { payment } = req.body; // Payload similar à resposta de /charge
    console.log('🔄 Webhook HooPay recebido:', req.body.orderUUID, 'Status:', payment?.status);
    // TODO: Atualize DB, libere acesso, envie email se status === 'paid'
    res.status(200).send('OK'); // HooPay espera 200
  } catch (e) {
    console.error('❌ Erro webhook:', e);
    res.status(500).send('Error');
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
