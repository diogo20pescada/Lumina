# Lumina AI - Sistema de Pagamentos MBWay e Cartão

## 💳 Receber no Cartão Revolut

**SIM!** Você pode receber pagamentos diretamente no seu cartão Revolut usando Stripe. As pessoas colocam os dados dos cartões delas e você recebe o dinheiro no seu Revolut.

### Como Funciona:
1. **Usuários pagam** com cartão de crédito/débito
2. **Stripe processa** o pagamento (deduz taxas)
3. **Dinheiro vai** para sua conta Stripe/Revolut
4. **Você recebe** o valor líquido

## 🔧 Integração com Stripe + Revolut

### Passos para Configurar:

1. **Criar conta Stripe**:
   - Acesse: https://stripe.com/pt-pt
   - Registre-se como negócio português
   - Complete verificação de identidade

2. **Conectar conta bancária**:
   - No dashboard Stripe, vá para "Settings" > "Bank accounts"
   - Adicione seu cartão Revolut como conta de destino
   - Ou conecte sua conta bancária normal

3. **Ativar métodos de pagamento**:
   - Cartão de crédito/débito (automático)
   - MBWay (para Portugal)
   - Outros métodos locais

4. **Configurar webhooks** para confirmações automáticas

## 💰 Taxas Stripe (Portugal):
- **Cartão nacional**: 1.4% + €0.25
- **Cartão internacional**: 2.9% + €0.25
- **MBWay**: 1.2% + €0.10
- **Transferência**: Gratuita para Revolut (2-3 dias úteis)

## 📱 Exemplo de Recebimento:

**Cliente paga €4.99**
- Taxa Stripe: ~€0.32
- **Você recebe: €4.67** no Revolut

## 🔧 Código para Integração:

### Backend (server.js) - Atualizar /iniciar-pagamento:

```javascript
// Instalar: npm install stripe
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.post("/iniciar-pagamento", async (req, res) => {
  const { email, plano } = req.body;

  const precos = {
    basico: 4.99,  // €4.99 por mês
    premium: 19.99 // €19.99 por ano
  };

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'mbway'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `Plano ${plano} - Lumina AI` },
          unit_amount: Math.round(precos[plano] * 100), // centavos
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'http://localhost:3000/sucesso',
      cancel_url: 'http://localhost:3000/cancelar',
      metadata: { email, plano }
    });

    res.json({
      sucesso: true,
      url_checkout: session.url,
      session_id: session.id
    });
  } catch (error) {
    res.json({ sucesso: false, erro: error.message });
  }
});
```

### Webhook para confirmação automática:

```javascript
app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const { email, plano } = event.data.object.metadata;
    let dias = plano === 'basico' ? 30 : 365;
    atualizarPlano(email, plano, dias);
  }

  res.json({received: true});
});
```

## 🔐 Variáveis de Ambiente (.env):

```bash
STRIPE_SECRET_KEY=sk_test_51T7jEkJ86uVg6PVEvPkIKfCI85RQ3whgg0tEuDFFmJo4ivRZ0CS8X55mheofz5YWvqQUUXErovFn26MwWY8llu4n00C6KYEfm5
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_51T7jEkJ86uVg6PVEXJc10Jkb5UH9U645fDVq3IltS6cXjCjDtSdRVvGfZF5V9JNYRqYP3rdhIv6gr7yAEtNDEty8003iawBhIq
```

## 🎯 Vantagens de Usar Stripe + Revolut:

✅ **Instantâneo**: Recebe no Revolut em minutos
✅ **Seguro**: Stripe protege contra fraudes
✅ **Global**: Aceita cartões de todo mundo
✅ **MBWay**: Método português popular
✅ **Baixas taxas**: Competitivas para Portugal
✅ **Fácil integração**: APIs bem documentadas

## 🚀 Próximos Passos:

1. **Criar conta Stripe**: https://dashboard.stripe.com/register
2. **Conectar Revolut**: Adicionar como conta bancária
3. **Testar**: Usar modo sandbox primeiro
4. **Produção**: Ativar conta real após testes

**Quer que eu implemente o código Stripe completo no seu projeto?**</content>
<parameter name="filePath">c:\Users\Diogo\Desktop\Lumina\INTEGRACAO_PAGAMENTOS.md