# Gym CRM VPS Deployment and Handover

This runbook records the current test deployment and how to hand the project to
a new owner. It intentionally contains **no passwords, tokens, private keys, or
database connection strings**. Keep those in a password manager or the
appropriate provider's secret manager, not in Git.

## Current deployment

| Item | Current value / status |
| --- | --- |
| VPS operating system | Ubuntu 26.04 LTS (as reported during setup) |
| VPS public IP | `50.6.44.247` |
| VPS Linux account for the app | `deploy` |
| Project directory on VPS | `/var/www/gym-crm` |
| Backend service | `gym-crm` (systemd), port `5000` on localhost |
| Web frontend | Nginx serves `/var/www/gym-crm/frontend/dist` on port `80` |
| Database | Neon PostgreSQL, using `backend/.env` on the VPS |
| Image uploads | Cloudinary, if its credentials are configured |
| Android app | Expo/EAS project; API URL currently configured to `http://50.6.44.247/api/v1` |
| Domain / HTTPS | Not configured; current IP deployment uses HTTP |

The frontend and Android app call the same backend API. The backend uses the
database URL in its server-side `.env`; the database is not stored on the VPS.

## Important status and safety notes

- The VPS's `/api/health` endpoint returned `200 OK`, and Nginx served the
  frontend during setup. This verifies the web server and API process respond;
  it **does not prove Neon is connected or that application login/data
  operations work**.
- The Neon account/project owner was not identified during setup. The database
  URL existed in the developer's local `backend/.env` and was entered on the
  VPS, but database ownership, billing, backups, quota, and connection were not
  independently confirmed. Recover access to the Neon account and verify the
  connection before relying on or handing over production data.
- HTTP is unencrypted. The current IP-based site and Android API endpoint are
  for testing only. Do not use real member, password, or payment data until a
  domain and HTTPS are configured.
- Do **not** run `npm run build` in `backend`. Its current script runs
  `prisma db push --accept-data-loss`, which can make destructive schema
  changes. Back up the database and review schema changes before applying any
  database update.
- `backend/.env`, SSH private keys, EAS credentials, and provider credentials
  must never be committed to Git or sent in chat.
- Review the Git working tree and files such as `App-Code/details.txt` before
  pushing. Do not use `git add .` without reviewing what it stages.
- The app code currently disables PostgreSQL TLS certificate verification
  (`rejectUnauthorized: false`) in `backend/config/prisma.js`. Address this
  before treating the database connection as fully hardened for production.

## Secret and ownership inventory

Record the **provider/account owner and where the secret is stored**, not the
secret itself, in a password manager. Each service should ultimately be owned
by the client/new project owner.

| Item to secure or transfer | Where it is used |
| --- | --- |
| VPS provider account, recovery method, and root access | Server billing and recovery |
| `deploy` account password and SSH access | VPS login and administration |
| GitHub repository owner and administrator access | Source code and deployments |
| VPS GitHub deploy key | Read-only clone/pull from this repository |
| `DATABASE_URL` and Neon account recovery | PostgreSQL connection, ownership, billing, backups |
| `JWT_SECRET` | Backend user sessions/authentication |
| Cloudinary account/API credentials | Gym and profile image uploads |
| SMTP credentials | Email notifications, if enabled |
| Razorpay keys | Payments, if enabled |
| Expo/EAS account, project ownership, and Android signing credentials | Mobile builds and future app updates |
| Domain registrar/DNS and TLS certificate renewal | Production HTTPS, once a domain is used |

Do not write actual values in this file. Rotate secrets if they were ever
committed, shared, or exposed to someone who should not have them.

## Current VPS operation

Connect from Windows PowerShell using the private key on the authorized
administrator's own computer:

```powershell
ssh -i "$env:USERPROFILE\.ssh\gym-crm-vps" deploy@50.6.44.247
```

The corresponding public key was added to
`/home/deploy/.ssh/authorized_keys`. Never copy the private key to the VPS,
GitHub, or a new owner's computer. Give a new administrator their own key and
remove the old key only after their login has been tested.

Useful commands, run after logging into the VPS:

```bash
# Check backend service
sudo systemctl status gym-crm --no-pager
sudo journalctl -u gym-crm -n 100 --no-pager

# Check Nginx
sudo nginx -t
sudo systemctl status nginx --no-pager

# Check API through Nginx locally
curl -i http://localhost/api/health

# Check firewall rules
sudo ufw status
```

The backend service is configured to run as `deploy` via
`/etc/systemd/system/gym-crm.service`. Nginx is configured by
`/etc/nginx/sites-available/gym-crm`, enabled under
`/etc/nginx/sites-enabled/gym-crm`. The firewall allowed OpenSSH and Nginx
Full during setup; backend port `5000` should remain private.

## Updating code on the VPS

Only code already pushed to GitHub can be pulled onto the VPS. First review and
push intended source changes from the development computer. On the VPS:

```bash
cd /var/www/gym-crm
git pull --ff-only

cd /var/www/gym-crm/backend
npm ci
sudo systemctl restart gym-crm

cd /var/www/gym-crm/frontend
npm ci
VITE_API_URL=/api/v1 npm run build

sudo nginx -t
sudo systemctl reload nginx
```

This update procedure does not apply database schema changes. Review and back
up the database before any schema migration or update.

## Android APK

`App-Code/eas.json` has `preview` and `production` profiles configured to build
APKs. Both currently set `EXPO_PUBLIC_API_URL` to the VPS over HTTP. Android
cleartext HTTP is temporarily enabled in `App-Code/app.json`. These are
temporary testing settings. After HTTPS is available:

1. Change both EAS profile URLs to `https://<your-domain>/api/v1`.
2. Remove `usesCleartextTraffic` from the Android config.
3. Build and test a new APK.

From Windows PowerShell, run:

```powershell
cd D:\Projects\GYM-CRM\App-Code
npx eas-cli build --platform android --profile preview
```

The EAS project ID is in `App-Code/app.json`. The new owner will need access to
the Expo/EAS project or must transfer/reconfigure it, and must retain the
Android signing credentials to publish updates under the same app identity.
Never include EAS tokens or signing private keys in Git.

## Production readiness checklist

- [ ] Confirm the Neon account and project are owned/accessible by the new
  owner; confirm plan, storage quota, backup/PITR settings, and recovery access.
- [ ] Verify Neon connection in backend logs and test a non-destructive
  application login/read/write flow with approved test data.
- [ ] Take and verify a database backup before schema changes or data transfer.
- [ ] Point a client-owned domain to the VPS and set up/renew HTTPS.
- [ ] Change backend `CORS_ORIGINS` to the exact HTTPS web origin and rebuild
  the frontend/mobile app with the HTTPS API URL.
- [ ] Keep port `5000` private; expose only SSH and Nginx web ports as needed.
- [ ] Review production secrets, rotate them, and configure only the needed
  Cloudinary, SMTP, and payment integrations.
- [ ] Review repository contents and Git history for credentials or private
  client data before transferring/publishing.
- [ ] Confirm the new owner's access to GitHub, VPS, Neon, Cloudinary, Expo/EAS,
  domain/DNS, email, and payment accounts.
- [ ] Test the new owner's SSH login, GitHub clone/pull, deployment, database
  access, and Android build before removing the previous owner's access.

## Complete transfer to a new owner

The project is not fully transferred by transferring GitHub alone. Source code,
the VPS, database, images, mobile build service, domain, and external service
accounts are separate.

1. **Agree on ownership and data.** Confirm who owns the code, production
   records, domain, and provider subscriptions. Do not copy real customer data
   into a personal account.
2. **Audit source before handover.** On the development computer, inspect
   `git status`, staged files, ignored files, and commit history. Review
   `App-Code/details.txt` and other local-only/untracked files. Keep `.env`,
   private keys, tokens, real customer data, and personal files out of Git.
3. **Move GitHub control.** Transfer the repository to the client's GitHub
   account/organization or push reviewed code/history to a client-owned
   repository. Give the client administrator access and verify they can clone
   it. Change the VPS Git remote if the repository location changes.
4. **Transfer the VPS account.** Prefer the client having their own VPS-provider
   account and billing ownership. If the provider supports server/account
   transfer, use its official process. Otherwise, create an administrator
   account/key for the client and test it before removing old access. Never
   hand over the developer's private SSH key or personal account password.
5. **Transfer the database properly.** Recover the existing Neon account and
   invite/transfer the client, or arrange a planned database migration with a
   verified backup and restore. Do not merely create an empty database if
   existing member/payment/attendance records must be retained. Update the
   server `DATABASE_URL` after the new owner has control and rotate the
   database password.
6. **Transfer file storage and integrations.** Move Cloudinary ownership or
   migrate assets; transfer/configure SMTP, Razorpay, and any other used
   integrations. Rotate their credentials and update the server `.env`.
7. **Transfer domain and mobile delivery.** Put domain/DNS under the client's
   account, configure HTTPS, transfer/reconfigure Expo/EAS ownership and
   signing credentials, and test a client-owned Android build.
8. **Rotate and revoke access.** After the client verifies the deployment,
   rotate `JWT_SECRET`, database and integration credentials, remove old SSH
   authorized keys and GitHub deploy keys, remove former account access, and
   verify that old credentials no longer work.
9. **Hand over operations.** Provide this runbook, account recovery details
   through an approved secure channel/password manager, backup/restore
   instructions, renewal/billing responsibilities, and a successful deployment
   test.

## Git review reminders

On the development computer, before pushing:

```powershell
git status --short
git diff --check
git diff --stat
```

Stage only the reviewed files rather than using `git add .`. Check the staged
diff before committing:

```powershell
git diff --cached --check
git diff --cached
```

Never commit `.env`, SSH private keys, database URLs, JWT secrets, API keys,
passwords, signing credentials, or real customer records. Removing a secret
from the latest commit does not erase it from repository history; revoke and
rotate exposed credentials.
