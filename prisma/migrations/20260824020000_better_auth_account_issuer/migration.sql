-- Better Auth 1.7 scopes account identities by issuer. BikeFlow currently
-- enables only email/password credentials, so every existing account belongs
-- to the local credential issuer.
ALTER TABLE "accounts" ADD COLUMN "issuer" TEXT;

UPDATE "accounts"
SET "issuer" = 'local:credential'
WHERE "issuer" IS NULL;

ALTER TABLE "accounts" ALTER COLUMN "issuer" SET NOT NULL;

CREATE UNIQUE INDEX "accounts_issuer_accountId_key"
ON "accounts"("issuer", "accountId");
