import "dotenv/config";
import { hash } from "bcryptjs";
import { db } from "../lib/db";
async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email) throw new Error("Pass the existing account email");
  const password = process.env.RESET_PASSWORD;
  if (!password || password.length < 12)
    throw new Error(
      "Set RESET_PASSWORD securely in the shell (12+ characters). Never put it in a command argument.",
    );
  await db.user.update({
    where: { email },
    data: {
      passwordHash: await hash(password, 12),
      sessionVersion: { increment: 1 },
    },
  });
  await db.loginAttempt.deleteMany({});
  console.log("Password updated.");
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
