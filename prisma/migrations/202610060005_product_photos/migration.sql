CREATE TABLE "EquipmentPhoto" (
    "equipmentId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EquipmentPhoto_pkey" PRIMARY KEY ("equipmentId"),
    CONSTRAINT "EquipmentPhoto_size_check" CHECK (octet_length("data") BETWEEN 4 AND 1048576),
    CONSTRAINT "EquipmentPhoto_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
