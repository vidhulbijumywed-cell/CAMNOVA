-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rawPhone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "referral" TEXT NOT NULL DEFAULT '',
    "importId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rate" INTEGER,
    "purchaseCost" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "importId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "serial" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "condition" TEXT NOT NULL DEFAULT 'Not inspected',
    "accessories" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "customerId" TEXT,
    "bookingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pickupAt" TIMESTAMP(3),
    "returnAt" TIMESTAMP(3),
    "actualReturnAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "total" INTEGER,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "negotiated" BOOLEAN NOT NULL DEFAULT false,
    "equipmentText" TEXT NOT NULL DEFAULT '',
    "referral" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "historical" BOOLEAN NOT NULL DEFAULT false,
    "sourceRef" TEXT,
    "sourceRow" INTEGER,
    "importId" TEXT,
    "followupNote" TEXT NOT NULL DEFAULT '',
    "followupAt" TIMESTAMP(3),
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingItem" (
    "id" TEXT NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "returned" INTEGER NOT NULL DEFAULT 0,
    "rate" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,

    CONSTRAINT "BookingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'RENTAL',
    "mode" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "recordedBy" TEXT NOT NULL,
    "reversesId" TEXT,
    "reviewedCredit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outsource" (
    "id" TEXT NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "vendorId" TEXT,
    "description" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,

    CONSTRAINT "Outsource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL,
    "outsourceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "mode" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL DEFAULT 'business',
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_name_key" ON "Equipment"("name");

-- CreateIndex
CREATE INDEX "Booking_bookingDate_idx" ON "Booking"("bookingDate");

-- CreateIndex
CREATE INDEX "Booking_pickupAt_returnAt_idx" ON "Booking"("pickupAt", "returnAt");

-- CreateIndex
CREATE INDEX "BookingItem_equipmentId_idx" ON "BookingItem"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reversesId_key" ON "Payment"("reversesId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_hash_key" ON "ImportBatch"("hash");

-- CreateIndex
CREATE INDEX "Audit_entity_entityId_idx" ON "Audit"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingItem" ADD CONSTRAINT "BookingItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outsource" ADD CONSTRAINT "Outsource_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outsource" ADD CONSTRAINT "Outsource_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_outsourceId_fkey" FOREIGN KEY ("outsourceId") REFERENCES "Outsource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

