CREATE TABLE "CustomerAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  "customerId" TEXT NOT NULL UNIQUE REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Booking" ADD COLUMN "customerAccountId" TEXT REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD COLUMN "requestKey" TEXT;
CREATE UNIQUE INDEX "Booking_customerAccountId_requestKey_key" ON "Booking"("customerAccountId", "requestKey");
