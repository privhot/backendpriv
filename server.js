import express from "express";
import fetch from "node-fetch"; // Se Node >=18, pode usar fetch nativo
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;
const SYNC_TOKEN = "c868ca1a-4f65-4a3e-b545-fd71ba4fec3b"; // seu token SyncPay

app.use(cors());
app.use(express.json());

// Endpoint para gerar PIX
app.post("/gerar-pix", async (req, res) => {
  try {
    const { value, description } = req.body;

    if (!value || !description) {
      return res.status(400).json({ error: "value e description são obrigatórios" });
    }

    // Corpo da requisição SyncPay
    const body = {
      amount: value / 100, // valor em reais (12,90 -> 12.9)
      description: description,
      webhook_url: "https://seusite.com/webhook", // opcional
      client: {
        name: "Cliente Teste",
        cpf: "00000000000",
        email: "cliente@teste.com",
        phone: "11999999999"
      }
    };

    const response = await fetch("https://syncpay.apidog.io/api/partner/v1/cash-in", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SYNC_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    // Retornar apenas o código PIX e ID do pagamento
    return res.json({
      pixCode: data.pix_code || data.code || "", // depende do retorno da SyncPay
      paymentId: data.id || ""
    });

  } catch (error) {
    console.error("Erro ao gerar PIX:", error);
    return res.status(500).json({ error: "Erro interno ao gerar PIX" });
  }
});

// Status do pagamento (opcional)
app.get("/payment-status/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const response = await fetch(`https://syncpay.apidog.io/api/partner/v1/cash-in/${id}`, {
      headers: { "Authorization": `Bearer ${SYNC_TOKEN}` }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    // Exemplo simples: se estiver pago
    return res.json({
      status: data.status || "pending"
    });

  } catch (error) {
    console.error("Erro ao consultar status:", error);
    return res.status(500).json({ error: "Erro interno ao consultar status" });
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
