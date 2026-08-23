import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!email || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT id, restaurant_id, restaurant_name, email, password_hash
       FROM users WHERE email = $1`,
    [email]
  );
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 }
    );
  }

  await createSession(user.id);
  delete user.password_hash;
  return NextResponse.json({ user });
}
