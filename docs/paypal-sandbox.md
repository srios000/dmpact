# PayPal sandbox setup

DMpact uses one shared sandbox REST app, `DMpact`, in the US sandbox region. PayPal sandbox only: no live credentials anywhere.

Never commit or post credentials. They belong in `.env`, which is git-ignored.

## Run PayPal flows locally

1. Copy `.env.example` to `.env` if you don't have one yet.
2. Set these values in `.env`, using the credentials from the team group chat:

   ```
   PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
   PAYPAL_CLIENT_ID=
   PAYPAL_CLIENT_SECRET=
   ```

3. Check the credentials. This requests an OAuth token and prints only the HTTP status, so `200` means they work. It needs Node 20.6 or later.

   ```bash
   node --env-file=.env -e "const {PAYPAL_API_BASE:b,PAYPAL_CLIENT_ID:i,PAYPAL_CLIENT_SECRET:s}=process.env;fetch(b+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+btoa(i+':'+s)},body:new URLSearchParams({grant_type:'client_credentials'})}).then(r=>console.log(r.status))"
   ```

## Test accounts

| Account | Role in DMpact | Used for |
| --- | --- | --- |
| Business | Creator | Receives payment for invoices |
| Personal | Client | Pays invoices |

You need both logins to run the invoice and payment flows by hand. They're in the team group chat with the app credentials. Don't put them in `.env` or the repo.

Log in to either account at <https://www.sandbox.paypal.com/signin>.

## Webhooks

`PAYPAL_WEBHOOK_ID` is only needed to receive webhooks, which arrive with the endpoint in #15 (`POST /api/webhooks/paypal`). Each subscribed listener URL has its own webhook ID, and an app can have up to 10 URLs.

1. Expose your local app through a tunnel such as ngrok or cloudflared. PayPal only delivers to HTTPS on port 443, so it can't reach `localhost:3000` directly.
2. In the Developer Dashboard, open the `DMpact` app under **Apps & Credentials** and subscribe `https://<your-tunnel>/api/webhooks/paypal` in its webhook settings.
3. Select `INVOICING.INVOICE.PAID` and `INVOICING.INVOICE.CANCELLED`.
4. Set `PAYPAL_WEBHOOK_ID` in `.env` to the ID of that subscription.

The [webhook simulator](https://developer.paypal.com/api/rest/webhooks/simulator/) sends mock events, but those can't be verified through `verify-webhook-signature`. Use a real sandbox payment to test signature verification.

## Disputes (evidence pack)

The commission page has a **PayPal disputes** card once an invoice is paid. To try it in the sandbox:

1. Pay an invoice with the sandbox Personal account.
2. Still signed in as Personal at sandbox.paypal.com, open the Resolution Center, pick that payment and report a problem (for example "I didn't receive it").
3. On the commission page, click **Check PayPal**. The dispute is matched through the payment's transaction ID. A new dispute can take a few minutes to show up.
4. While PayPal waits for the seller (`WAITING_FOR_SELLER_RESPONSE`), **Send evidence pack** uploads the evidence pack PDF with `provide-evidence`. Other statuses can't take evidence.

The app's PayPal account needs the Disputes feature (Apps & Credentials, app settings) if the API answers 403.

## Recreate the setup

Only needed if the shared app or accounts are lost. Log in at <https://developer.paypal.com/dashboard> and confirm the page shows "You're in sandbox mode".

1. Go to **Apps & Credentials** and select **Create App**. Name it `DMpact`.
2. Copy the client ID and secret key.
3. Go to **Testing Tools** > **Sandbox Accounts** and select **Create account**.
4. Choose **Business** as the account type and **United States** as the country, then create it.
5. Repeat steps 3 and 4 with **Personal** as the account type.
6. Open each account's **View/Edit account** page to find its login.
7. Share the new credentials privately with the team.

## References

- [Get started with PayPal REST APIs](https://developer.paypal.com/api/rest/)
- [Sandbox accounts](https://developer.paypal.com/tools/sandbox/accounts/)
- [Integrate webhooks](https://developer.paypal.com/api/rest/webhooks/rest/)
- [Invoicing v2 API](https://developer.paypal.com/docs/api/invoicing/v2/)
