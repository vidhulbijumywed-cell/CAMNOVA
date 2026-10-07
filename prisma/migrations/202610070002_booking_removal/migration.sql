ALTER TABLE "Booking" DROP CONSTRAINT "Booking_status_check";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_status_check" CHECK ("status" IN ('DRAFT','BOOKED','PICKED_UP','RETURNED','CANCELLED','DELETED'));
