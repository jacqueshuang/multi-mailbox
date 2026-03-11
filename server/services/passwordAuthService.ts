import { randomBytes, scrypt, timingSafeEqual } from "crypto";

export const normalizeUsername = (username: string) => username.trim().toLowerCase();

export const hashPassword = (password: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(`${salt}:${Buffer.from(derivedKey).toString("hex")}`);
    });
  });

export const verifyPassword = (password: string, passwordHash: string): Promise<boolean> =>
  new Promise((resolve, reject) => {
    const [salt, hash] = passwordHash.split(":");
    if (!salt || !hash) {
      resolve(false);
      return;
    }

    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }

      const stored = Buffer.from(hash, "hex");
      const incoming = Buffer.from(derivedKey);

      if (stored.length !== incoming.length) {
        resolve(false);
        return;
      }

      resolve(timingSafeEqual(stored, incoming));
    });
  });
